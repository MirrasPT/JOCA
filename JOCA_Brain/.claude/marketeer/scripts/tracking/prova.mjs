#!/usr/bin/env node
// `node "<MKT>/scripts/tracking/prova.mjs" <url>` — prova de rede do consentimento num chromium headless.
//
//   node "<MKT>/scripts/tracking/prova.mjs" <url> [--formulario <url> [--abrir <seletor>] [--form <seletor>]
//     [--enviar <seletor>] [--evento generate_lead] [--parametro formulario]] [--cliente <slug> [--login <id|mcc>]] [raiz]
//
// Cenários (cada um num contexto limpo, excepto B, que continua o A):
//   A  sem interacção           → 0 pedidos a GA (google-analytics/analytics.google), doubleclick e googleadservices
//   B  depois de Recusar        → 0 (clica «Recusar», recarrega)
//   C  depois de Aceitar        → ≥1 hit GA4 (collect) e ≥1 pedido Google Ads
//   D  --formulario (opcional)  → aceita, preenche com dados de teste e envia; o POST é INTERCEPTADO
//                                 e respondido aqui com 201 (→ 1 evento de lead no dataLayer, com o
//                                 parâmetro do plano preenchido) e 422 (→ 0)
// Parâmetro do lead: --parametro; senão o 1.º `parametros` do evento no tracking/plano.md da marca
// (com --cliente); senão `formulario` (CONTRATO §5.5). Evento sem parâmetro → o GA4 recebe-o vazio.
//
// Só leitura (D-008, D-021), com a regra da auditoria (scripts/auditoria/renderizar.mjs, vigiarContexto):
// nenhum hit sai para as contas do cliente (são respondidos aqui com 204 e só contados) e NENHUM
// pedido que não seja GET sai para a rede — o POST do formulário nunca chega ao servidor do cliente.
// Com --cliente grava clientes/<slug>/tracking/relatorio-<data>.md, com a checklist GA4/Ads.
// Saída 1 = alguma expectativa falhou (ou o browser não arrancou).

import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chromium } from 'playwright';
import { eEntrada } from '../validar-dossier.mjs';
import { dataLocal } from '../criar-dossier.mjs';
import { eHitDeRecolha, vigiarContexto, explicarFalhaDoBrowser, USER_AGENT } from '../auditoria/renderizar.mjs';
import { limparErro } from '../auditoria/limpar.mjs';
import { checklist, checklistMarkdown } from './checklist.mjs';
import { raizDados } from '../raiz.mjs';
import { lerPlano } from './gtm.mjs';

const ESPERA_MS = 3000;
const RECUSAR = /^\s*(recusar|rejeitar|recuso|recusar todos|rejeitar todos|reject( all)?|decline)\s*$/i;
const ACEITAR = /^\s*(aceitar|aceito|aceitar todos|aceitar tudo|accept( all)?|allow all)\s*$/i;
const ENVIAR = /enviar|submeter|pedir|contactar|send|submit/i;
export const TESTE = { texto: 'Teste marketeer (prova de rede, nada é enviado)', email: 'teste@example.invalid', tel: '910000000' };

const em = (h, d) => h === d || h.endsWith(`.${d}`);
// Pedido → 'ga' | 'ads' | null. Classifica o hit pelo destino (eHitDeRecolha) e, fora disso, qualquer
// pedido aos domínios de GA, doubleclick e googleadservices (bibliotecas incluídas).
export function classificar(url) {
  const v = eHitDeRecolha(url);
  if (v === 'ga4' || v === 'ua') return 'ga';
  if (v === 'google-ads') return 'ads';
  let h;
  try { h = new URL(url).hostname; } catch { return null; }
  if (em(h, 'google-analytics.com') || em(h, 'analytics.google.com')) return 'ga';
  if (em(h, 'doubleclick.net') || em(h, 'googleadservices.com')) return 'ads';
  return null;
}

export function contarGoogle(pedidos) {
  const ga = pedidos.filter((p) => classificar(p.url) === 'ga');
  const ads = pedidos.filter((p) => classificar(p.url) === 'ads');
  return { ga, ads, collect: ga.filter((p) => eHitDeRecolha(p.url) === 'ga4') };
}

// POST (ou outro não-GET) que não é hit nem serviço Google = o envio do formulário.
export const eEnvio = (p) => p.metodo !== 'GET' && !classificar(p.url) && !eHitDeRecolha(p.url)
  && !/(^|\.)(google\.com|gstatic\.com|recaptcha\.net|googletagmanager\.com)$/.test((() => { try { return new URL(p.url).hostname; } catch { return ''; } })());

// Corre na página antes de qualquer script: regista os eventos empurrados para o dataLayer em
// sessionStorage (sobrevive à navegação para /obrigado, na mesma origem).
// Cada linha: `<evento>\t<valor do parâmetro>` (vazio se faltar).
function capturarDataLayer(parametro) {
  const guardar = (x) => {
    if (!x || typeof x !== 'object' || Array.isArray(x) || typeof x.event !== 'string' || /^gtm\./.test(x.event)) return;
    const v = parametro && x[parametro] != null ? String(x[parametro]).replace(/[\t\n]/g, ' ').trim() : '';
    try { sessionStorage.setItem('__marketeer_ev', `${sessionStorage.getItem('__marketeer_ev') ?? ''}${x.event}\t${v}\n`); } catch {}
  };
  const ligar = (arr) => {
    // O GTM troca o push pelo dele, que volta a chamar o anterior (este): sem o travão, cada
    // evento contava-se de novo em cada volta.
    let interior = Array.prototype.push;
    let ocupado = false;
    const w = function (...a) {
      if (ocupado) return Array.prototype.push.apply(this, a);
      ocupado = true;
      try { a.forEach(guardar); return interior.apply(this, a); } finally { ocupado = false; }
    };
    Object.defineProperty(arr, 'push', { configurable: true, get: () => w, set: (f) => { interior = f; } });
    return arr;
  };
  let dl;
  Object.defineProperty(window, 'dataLayer', { configurable: true, get: () => dl, set: (v) => { dl = Array.isArray(v) ? ligar(v) : v; } });
}

async function clicarBotao(page, re) {
  const b = page.getByRole('button', { name: re }).filter({ visible: true }).first();
  if (!(await b.count())) return false;
  await b.click({ timeout: 5000 });
  return true;
}

async function acalmar(page, ms = ESPERA_MS) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function preencher(page, { form = 'form', enviar, antesDeEnviar }) {
  const c = page.locator(form).filter({ visible: true }).first();
  if (!(await c.count())) return `nenhum formulário visível (${form})`;
  for (const campo of await c.locator('input, textarea, select').all()) {
    if (!(await campo.isVisible()) || !(await campo.isEditable().catch(() => false))) continue;
    if (await campo.evaluate((el) => !!el.closest('[aria-hidden="true"]'))) continue; // honeypot
    const tag = await campo.evaluate((el) => el.tagName.toLowerCase());
    const tipo = (await campo.getAttribute('type'))?.toLowerCase() ?? 'text';
    if (tag === 'select') {
      const n = await campo.locator('option').count();
      if (n > 1) await campo.selectOption({ index: 1 });
    } else if (tipo === 'checkbox') await campo.check();
    else if (['hidden', 'submit', 'button', 'file', 'radio', 'image', 'reset', 'date', 'range', 'color'].includes(tipo)) continue;
    else if (!(await campo.inputValue())) {
      await campo.fill(tipo === 'email' ? TESTE.email : tipo === 'tel' ? TESTE.tel : tipo === 'number' ? '1' : tipo === 'url' ? 'https://example.invalid' : TESTE.texto);
    }
  }
  const botao = enviar ? page.locator(enviar) : c.locator('button[type=submit], input[type=submit], [data-submit]').or(c.getByRole('button', { name: ENVIAR }));
  const b = botao.filter({ visible: true }).first();
  if (!(await b.count())) return `nenhum botão de envio visível${enviar ? ` (${enviar})` : ''}`;
  antesDeEnviar?.();
  await b.click({ timeout: 5000 });
  return null;
}

async function sessao(browser, url, responder, bloquearTudo) {
  const context = await browser.newContext({ userAgent: USER_AGENT, serviceWorkers: 'block', acceptDownloads: false });
  const { pedidos } = await vigiarContexto(context, url, { responder, bloquearTudo });
  const page = await context.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  return { context, page, pedidos };
}

// Comando reproduzível (para o relatório): só as opções da prova, com aspas de shell.
export function comandoDaProva(url, o = {}) {
  const q = (v) => `'${String(v).replace(/'/g, "'\\''")}'`;
  const partes = ['node "<MKT>/scripts/tracking/prova.mjs"', q(url)];
  for (const k of ['formulario', 'abrir', 'form', 'enviar', 'evento', 'parametro', 'cliente']) if (o[k]) partes.push(`--${k} ${q(o[k])}`);
  return partes.join(' ');
}

const resumoPedidos = (xs) => [...new Set(xs.map((p) => { const u = new URL(p.url); return `${u.hostname}${u.pathname}`; }))].slice(0, 6);

// Evento de lead por omissão = o do plano da casa (plano.mjs). Plano antigo com outro nome → --evento.
export const EVENTO_LEAD = 'generate_lead';
// Parâmetro do lead da casa (CONTRATO §5.5); o plano da marca manda (parametroDoPlano).
export const PARAMETRO_LEAD = 'formulario';

// 1.º parâmetro do evento no tracking/plano.md da marca; sem plano ou sem o evento → undefined.
export function parametroDoPlano(raiz, slug, evento = EVENTO_LEAD) {
  try {
    return lerPlano(raiz, slug).eventos?.find((e) => e?.nome === evento)?.parametros?.[0];
  } catch {
    return undefined;
  }
}

export async function provar(url, { formulario, abrir, form, enviar, evento = EVENTO_LEAD, parametro = PARAMETRO_LEAD } = {}) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  } catch (e) {
    return { erro: explicarFalhaDoBrowser(e), cenarios: [] };
  }
  const cenarios = [];
  const cenario = (id, nome, esperado, ok, detalhe) => cenarios.push({ id, nome, esperado, ok, detalhe });
  try {
    // A e B — sem interacção, depois Recusar (mesma sessão).
    {
      const { context, page, pedidos } = await sessao(browser, url);
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await acalmar(page);
      const a = contarGoogle(pedidos);
      cenario('A', 'sem interacção', '0 pedidos a GA, doubleclick e googleadservices', !a.ga.length && !a.ads.length,
        `GA: ${a.ga.length} · Ads: ${a.ads.length}${a.ga.length + a.ads.length ? ` — ${resumoPedidos([...a.ga, ...a.ads]).join(', ')}` : ''}`);
      const inicio = pedidos.length;
      const clicou = await clicarBotao(page, RECUSAR);
      if (clicou) {
        await page.waitForTimeout(1500);
        await page.reload({ waitUntil: 'load' });
        await acalmar(page);
      }
      const b = contarGoogle(pedidos.slice(inicio));
      cenario('B', 'depois de Recusar', '0 pedidos a GA, doubleclick e googleadservices', clicou && !b.ga.length && !b.ads.length,
        clicou ? `GA: ${b.ga.length} · Ads: ${b.ads.length}${b.ga.length + b.ads.length ? ` — ${resumoPedidos([...b.ga, ...b.ads]).join(', ')}` : ''}` : 'botão «Recusar» não encontrado no banner');
      await context.close();
    }
    // C — Aceitar.
    {
      const { context, page, pedidos } = await sessao(browser, url);
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await acalmar(page, 1000);
      const inicio = pedidos.length;
      const clicou = await clicarBotao(page, ACEITAR);
      if (clicou) {
        await acalmar(page);
        await page.reload({ waitUntil: 'load' });
        await acalmar(page);
      }
      const c = contarGoogle(pedidos.slice(inicio));
      cenario('C', 'depois de Aceitar', '≥1 hit GA4 (collect) e ≥1 pedido Google Ads', clicou && c.collect.length > 0 && c.ads.length > 0,
        clicou ? `GA4 collect: ${c.collect.length} · Ads: ${c.ads.length} — ${resumoPedidos([...c.collect, ...c.ads]).join(', ')}` : 'botão «Aceitar» não encontrado no banner');
      await context.close();
    }
    // D — formulário, com o envio interceptado.
    if (formulario) {
      for (const [status, esperado] of [[201, 1], [422, 0]]) {
        const envios = [];
        // O envio vai quase sempre para outro domínio (CRM): a resposta local leva os cabeçalhos CORS,
        // e o preflight (OPTIONS) responde-se aqui sem contar como envio.
        const cors = { 'access-control-allow-origin': new URL(formulario).origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, PUT, PATCH, OPTIONS' };
        // Do clique em «enviar» em diante NADA sai para a rede, seja qual for o método: um
        // <form method="get"> (navegação com os dados no URL) ou a página seguinte (/obrigado) são
        // respondidos aqui — documentos com uma página vazia, o resto com 204.
        let enviado = false;
        const responder = (p) => {
          if (!eEnvio(p)) return enviado && p.tipo === 'document' ? { status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>prova marketeer</title>' } : null;
          if (p.metodo === 'OPTIONS') return { status: 204, headers: cors };
          envios.push(p);
          return { status, contentType: 'application/json', headers: cors, body: JSON.stringify(status < 300 ? { id: 0, teste: true } : { detail: 'Erro de teste (marketeer)', message: 'Erro de teste (marketeer)' }) };
        };
        const { context, page } = await sessao(browser, formulario, responder, () => enviado);
        await page.addInitScript(capturarDataLayer, parametro);
        await page.goto(formulario, { waitUntil: 'load', timeout: 30000 });
        await acalmar(page, 1000);
        await clicarBotao(page, ACEITAR);
        await page.waitForTimeout(800);
        let falha = null;
        if (abrir) await page.locator(abrir).filter({ visible: true }).first().click({ timeout: 5000 }).catch(() => { falha = `não abriu o formulário (${abrir})`; });
        if (!falha) { await page.waitForTimeout(800); falha = await preencher(page, { form, enviar, antesDeEnviar: () => { enviado = true; } }); }
        await acalmar(page);
        const eventos = await page.evaluate(() => sessionStorage.getItem('__marketeer_ev') ?? '').catch(() => '');
        const leads = eventos.split('\n').filter(Boolean).map((l) => l.split('\t')).filter(([e]) => e === evento);
        const n = leads.length;
        // No 201 o lead tem de levar o parâmetro do plano: vazio chega vazio ao GA4 (varredura I3).
        const semParametro = esperado > 0 && parametro ? leads.filter(([, v]) => !v).length : 0;
        cenario(`D${status}`, `formulário com o envio respondido ${status}`,
          `${esperado} evento ${evento}${esperado > 0 && parametro ? ` com «${parametro}» preenchido` : ''}, 0 envios reais`,
          !falha && envios.length > 0 && n === esperado && !semParametro,
          falha ?? `${envios.length} envio(s) interceptado(s) (${resumoPedidos(envios).join(', ') || 'nenhum'}) · ${n} evento(s) ${evento} no dataLayer`
            + (semParametro ? ` · ${evento} sem o parâmetro «${parametro}» (vazio) — o GA4 recebe-o vazio; o site tem de enviar ${parametro}: '<nome do formulário>'` : ''));
        await context.close();
      }
    }
    return { cenarios };
  } catch (e) {
    return { erro: limparErro(String(e?.message ?? e).split('\n')[0], 300), cenarios };
  } finally {
    await browser.close().catch(() => {});
  }
}

export function textoDaProva(url, r) {
  return [
    `Prova de rede do consentimento — ${url} (chromium headless; hits e envios respondidos localmente, nada sai para as contas nem para o servidor)`,
    ...r.cenarios.map((c) => `  ${c.ok ? '✓' : '✗'} ${c.id} ${c.nome}: ${c.detalhe}  [esperado: ${c.esperado}]`),
    ...(r.erro ? [`  ✗ erro: ${r.erro}`] : []),
  ].join('\n');
}

// Rótulo Ads do contentor mais recente do cliente (para a checklist), se houver.
function rotuloDoContentor(raiz, slug) {
  try {
    const pasta = join(raiz, 'clientes', slug, 'tracking');
    const f = readdirSync(pasta).filter((x) => /^contentor-GTM-.*\.json$/.test(x)).sort().pop();
    const tags = JSON.parse(readFileSync(join(pasta, f), 'utf8')).containerVersion.tag;
    return tags.find((t) => t.type === 'awct')?.parameter.find((p) => p.key === 'conversionLabel')?.value;
  } catch {
    return undefined;
  }
}

export async function relatorio(slug, url, r, { raiz = raizDados(), hoje = new Date(), login, ligar, comando } = {}) {
  const lista = await checklist(slug, { raiz, login, rotulo: rotuloDoContentor(raiz, slug), ...(ligar ? { ligar } : {}) });
  const texto = [
    `# ${slug}: prova de tracking — ${dataLocal(hoje)}`,
    '',
    `Site: ${url} · só leitura: nenhum hit saiu para as contas e nenhum formulário foi enviado (D-021).`,
    ...(comando ? ['', 'Para reproduzir:', '', '```bash', comando, '```'] : []),
    '',
    '## Prova de rede',
    '',
    '| | Cenário | Esperado | Medido |',
    '|---|---|---|---|',
    ...r.cenarios.map((c) => `| ${c.ok ? '✓' : '✗'} | ${c.id} ${c.nome} | ${c.esperado} | ${c.detalhe.replace(/\|/g, '\\|')} |`),
    ...(r.erro ? ['', `Erro: ${r.erro}`] : []),
    '',
    '## Checklist GA4 / Google Ads',
    '',
    checklistMarkdown(lista),
    '',
  ].join('\n');
  const pasta = join(raiz, 'clientes', slug, 'tracking');
  mkdirSync(pasta, { recursive: true });
  for (let i = 1; ; i++) {
    const caminho = join(pasta, `relatorio-${dataLocal(hoje)}${i === 1 ? '' : `-${i}`}.md`);
    try {
      writeFileSync(caminho, texto, { flag: 'wx' });
      return { caminho: relative(raiz, caminho), checklist: lista };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
}

if (eEntrada(import.meta.url)) {
  const args = process.argv.slice(2);
  const OPCOES = ['--formulario', '--abrir', '--form', '--enviar', '--evento', '--parametro', '--cliente', '--login'];
  const valor = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const livres = args.filter((a, j) => !a.startsWith('--') && !OPCOES.includes(args[j - 1]));
  const [url, raiz = raizDados()] = livres;
  try {
    if (!url || !/^https?:\/\//.test(url)) throw new Error('uso: node "<MKT>/scripts/tracking/prova.mjs" <url> [--formulario <url> [--abrir <seletor>] [--form <seletor>] [--enviar <seletor>] [--evento generate_lead] [--parametro formulario]] [--cliente <slug> [--login <id|mcc>]]');
    const slug = valor('--cliente');
    const evento = valor('--evento') ?? EVENTO_LEAD;
    const parametro = valor('--parametro') ?? (slug && parametroDoPlano(raiz, slug, evento)) ?? PARAMETRO_LEAD;
    const o = { formulario: valor('--formulario'), abrir: valor('--abrir'), form: valor('--form'), enviar: valor('--enviar'), evento, parametro };
    const r = await provar(url, o);
    console.log(textoDaProva(url, r));
    if (slug) {
      const { caminho, checklist: l } = await relatorio(slug, url, r, { raiz, login: valor('--login'), comando: comandoDaProva(url, { ...o, cliente: slug }) });
      console.log(`\nRelatório gravado em ${caminho}`);
      console.log(checklistMarkdown(l));
    }
    if (r.erro || !r.cenarios.length || r.cenarios.some((c) => !c.ok)) process.exit(1);
  } catch (e) {
    console.error(`✗ ${limparErro(e.message, 400)}`);
    process.exit(1);
  }
}
