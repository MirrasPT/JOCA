#!/usr/bin/env node
// `node "<MKT>/scripts/tracking/gtm.mjs" <cliente>` — gera o JSON de importação de um contentor GTM.
// Não publica nada: o operador importa-o no GTM (Admin → Importar contentor → Substituir) e publica
// à mão depois de pré-visualizar (D-021).
//
//   node "<MKT>/scripts/tracking/gtm.mjs" <slug> --ga4 G-… --conta <accountId> --contentor <containerId> \
//     --gtm GTM-… [--ads AW-…[/<rótulo>]] [--rotulo <evento>=<rótulo>]... [--nome <nome>] [raiz]
//
// Eventos: do frontmatter `tracking.eventos` de clientes/<slug>/tracking/plano.md (`tracking/plano.mjs`).
// IDs: só dos argumentos — nunca se inventam; o que faltar dá erro com o nome do que falta.
// Todas as tags exigem consentimento: Google tag GA4 e eventos GA4 → analytics_storage; Google tag
// Ads, Conversion Linker e conversões Ads → ad_storage. Com os parâmetros da EXEMPLO o resultado
// é o contentor GTM-XXXXXXX, validado e importado (test/fixtures/tracking/).
// Gravado em clientes/<slug>/tracking/contentor-<GTM-ID>.json, nunca sobrescreve (-2, -3, …).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { eEntrada } from '../validar-dossier.mjs';
import { raizDados } from '../raiz.mjs';

// Activadores incorporados do GTM (não se declaram no JSON).
export const INICIALIZACAO = '2147479573'; // Initialization - All Pages
export const TODAS_AS_PAGINAS = '2147479553'; // All Pages
const BUILTINS = [['PAGE_URL', 'Page URL'], ['PAGE_HOSTNAME', 'Page Hostname'], ['PAGE_PATH', 'Page Path'], ['REFERRER', 'Referrer'], ['EVENT', 'Event']];

export class ErroTracking extends Error {}

const T = (key, value) => ({ type: 'TEMPLATE', key, value });
const B = (key, value) => ({ type: 'BOOLEAN', key, value: String(value) });
const consentimento = (tipo) => ({
  consentStatus: 'NEEDED',
  consentType: { type: 'LIST', list: [{ type: 'TEMPLATE', value: tipo }] },
});
const NOME = /^[a-z][a-z0-9_]{0,39}$/;

// "2026-09-28 12:00:00" (hora local), o formato do export do GTM.
export function horaDeExport(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Valida os parâmetros; junta TODOS os erros numa só mensagem (o operador corrige tudo de uma vez).
export function validarParametros({ ga4, ads, rotulos = {}, conta, contentor, gtm, nome, eventos }) {
  const falta = [];
  if (!/^G-[A-Z0-9]{4,}$/.test(ga4 ?? '')) falta.push('--ga4: ID de medição GA4 (G-…; GA4 → Administrador → Streams de dados)');
  if (!/^\d+$/.test(conta ?? '')) falta.push('--conta: accountId do GTM (algarismos; no URL do GTM, accounts/<accountId>/…)');
  if (!/^\d+$/.test(contentor ?? '')) falta.push('--contentor: containerId do GTM (algarismos; no URL do GTM, containers/<containerId>/…) — sem ele a importação dá "Not Found"');
  if (!/^GTM-[A-Z0-9]{4,}$/.test(gtm ?? '')) falta.push('--gtm: ID público do contentor (GTM-…)');
  if (!nome || !String(nome).trim()) falta.push('--nome: nome do contentor (o dossier não tem site)');
  if (!Array.isArray(eventos) || !eventos.length) falta.push('eventos: o plano não tem tracking.eventos (correr `node "<MKT>/scripts/tracking/plano.mjs" <slug>`)');
  const conversoes = (eventos ?? []).filter((e) => e?.conversao_ads);
  if (ads !== undefined && ads !== null && !/^AW-\d+$/.test(ads)) falta.push('--ads: ID do Google Ads no formato AW-<algarismos>');
  if (conversoes.length && !ads) falta.push(`--ads: ID do Google Ads (AW-…) — o plano tem conversões Ads (${conversoes.map((e) => e.nome).join(', ')})`);
  for (const e of eventos ?? []) {
    if (!NOME.test(e?.nome ?? '')) falta.push(`evento "${e?.nome}": nome inválido (minúsculas, algarismos e _, até 40)`);
    for (const p of e?.parametros ?? []) if (!NOME.test(p)) falta.push(`evento ${e.nome}: parâmetro "${p}" inválido`);
    if (e?.conversao_ads && ads && !rotulos[e.nome]) falta.push(`--rotulo ${e.nome}=<rótulo>: rótulo da acção de conversão Ads (Objectivos → Conversões → Configuração da tag)`);
    if (e?.conversao_ads && !e.conversao_ads.nome) falta.push(`evento ${e.nome}: conversao_ads.nome em falta no plano`);
  }
  if (falta.length) throw new ErroTracking(`faltam parâmetros ou são inválidos (os IDs nunca se inventam):\n  - ${falta.join('\n  - ')}`);
}

// → objecto do export do GTM (exportFormatVersion 2). Função pura.
export function gerarContentor(p) {
  validarParametros(p);
  const { ga4, ads, rotulos = {}, conta, contentor, gtm, nome, eventos, exportTime = horaDeExport() } = p;
  const dono = { accountId: conta, containerId: contentor };
  const tags = [];
  const tag = (name, type, parameter, firingTriggerId, tipoConsentimento) => tags.push({
    tagId: String(tags.length + 1), name, type, parameter, firingTriggerId: [firingTriggerId],
    tagFiringOption: 'ONCE_PER_EVENT', consentSettings: consentimento(tipoConsentimento), ...dono,
  });

  tag(`Google tag — GA4 ${ga4}`, 'googtag', [T('tagId', ga4)], INICIALIZACAO, 'analytics_storage');
  if (ads) {
    tag(`Google tag — Google Ads ${ads}`, 'googtag', [T('tagId', ads)], INICIALIZACAO, 'ad_storage');
    tag('Conversion Linker', 'gclidw', [B('enableCrossDomain', false), B('enableUrlPassthrough', false), B('enableCookieOverrides', false)], TODAS_AS_PAGINAS, 'ad_storage');
  }

  const triggers = [];
  const variaveis = [];
  const variavel = (param) => {
    const name = `DLV - ${param}`;
    if (!variaveis.some((v) => v.name === name)) {
      variaveis.push({
        variableId: String(10 + variaveis.length), name, type: 'v',
        parameter: [{ type: 'INTEGER', key: 'dataLayerVersion', value: '2' }, B('setDefaultValue', false), T('name', param)], ...dono,
      });
    }
    return `{{${name}}}`;
  };

  eventos.forEach((e, i) => {
    const triggerId = String(100 + i);
    triggers.push({
      triggerId, name: `CE - ${e.nome}`, type: 'CUSTOM_EVENT',
      customEventFilter: [{ type: 'EQUALS', parameter: [T('arg0', '{{_event}}'), T('arg1', e.nome)] }], ...dono,
    });
    const c = e.conversao_ads;
    if (c && ads) {
      tag(`Google Ads — conversão ${c.nome}`, 'awct', [
        T('conversionId', ads.replace(/^AW-/, '')), T('conversionLabel', rotulos[e.nome]),
        ...(c.valor !== undefined ? [T('conversionValue', String(c.valor))] : []),
        ...(c.moeda ? [T('currencyCode', c.moeda)] : []),
        B('enableConversionLinker', true), T('conversionCookiePrefix', '_gcl'),
      ], triggerId, 'ad_storage');
    }
    const params = e.parametros ?? [];
    tag(`GA4 evento — ${e.nome}`, 'gaawe', [
      T('eventName', e.nome), T('measurementIdOverride', ga4),
      ...(params.length ? [{
        type: 'LIST', key: 'eventSettingsTable',
        list: params.map((x) => ({ type: 'MAP', map: [T('parameter', x), T('parameterValue', variavel(x))] })),
      }] : []),
    ], triggerId, 'analytics_storage');
  });

  return {
    exportFormatVersion: 2,
    exportTime,
    containerVersion: {
      path: `accounts/${conta}/containers/${contentor}/versions/0`,
      ...dono,
      containerVersionId: '0',
      container: { path: `accounts/${conta}/containers/${contentor}`, ...dono, name: nome, publicId: gtm, usageContext: ['WEB'] },
      tag: tags,
      trigger: triggers,
      variable: variaveis,
      builtInVariable: BUILTINS.map(([type, name]) => ({ type, name, ...dono })),
    },
  };
}

// Verificação para o `npm run validar`: JSON legível e TODAS as tags a exigir consentimento.
export function validarContentor(texto) {
  let j;
  try {
    j = JSON.parse(texto);
  } catch {
    return ['contentor GTM: JSON inválido'];
  }
  const tags = j?.containerVersion?.tag;
  if (!Array.isArray(tags)) return ['contentor GTM: sem containerVersion.tag'];
  return tags.filter((t) => t?.consentSettings?.consentStatus !== 'NEEDED' || !t.consentSettings?.consentType?.list?.length)
    .map((t) => `contentor GTM: a tag "${t?.name}" não exige consentimento (consentSettings NEEDED com analytics_storage/ad_storage)`);
}

// Frontmatter `tracking:` do plano do cliente.
export function lerPlano(raiz, slug) {
  const f = join(raiz, 'clientes', slug, 'tracking', 'plano.md');
  let texto;
  try {
    texto = readFileSync(f, 'utf8');
  } catch {
    throw new ErroTracking(`sem plano de medição (clientes/${slug}/tracking/plano.md) — correr \`node "<MKT>/scripts/tracking/plano.mjs" ${slug}\` primeiro`);
  }
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(texto);
  const t = m ? parse(m[1])?.tracking : null;
  if (!t) throw new ErroTracking(`clientes/${slug}/tracking/plano.md sem frontmatter tracking:`);
  return t;
}

export function nomeDoSite(raiz, slug) {
  try {
    const d = readFileSync(join(raiz, 'clientes', slug, 'dossier.md'), 'utf8');
    const site = (/^\s+site:\s*(\S+)/m.exec(d) ?? [])[1];
    return new URL(site).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

export function gtm(slug, opcoes, { raiz = raizDados(), hoje = new Date() } = {}) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(slug ?? ''))) throw new ErroTracking(`slug inválido "${slug}"`);
  const { eventos } = lerPlano(raiz, slug);
  const c = gerarContentor({ ...opcoes, nome: opcoes.nome ?? nomeDoSite(raiz, slug), eventos, exportTime: horaDeExport(hoje) });
  const pasta = join(raiz, 'clientes', slug, 'tracking');
  mkdirSync(pasta, { recursive: true });
  for (let i = 1; ; i++) {
    const caminho = join(pasta, `contentor-${opcoes.gtm}${i === 1 ? '' : `-${i}`}.json`);
    try {
      writeFileSync(caminho, `${JSON.stringify(c, null, 1)}\n`, { flag: 'wx' });
      return { caminho: relative(raiz, caminho), contentor: c };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
}

// "--ads AW-1/rotulo" → { ads: 'AW-1', rotulo }; "--rotulo ev=x" (repetível) → rotulos[ev] = x.
export function lerArgumentos(args) {
  const o = { rotulos: {} };
  const livres = [];
  const mapa = { '--ga4': 'ga4', '--conta': 'conta', '--contentor': 'contentor', '--gtm': 'gtm', '--nome': 'nome' };
  let rotuloAds;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (mapa[a]) o[mapa[a]] = args[++i];
    else if (a === '--ads') [o.ads, rotuloAds] = String(args[++i] ?? '').split('/');
    else if (a === '--rotulo') {
      const [ev, ...r] = String(args[++i] ?? '').split('=');
      o.rotulos[ev] = r.join('=');
    } else livres.push(a);
  }
  return { opcoes: o, livres, rotuloAds };
}

if (eEntrada(import.meta.url)) {
  const { opcoes, livres, rotuloAds } = lerArgumentos(process.argv.slice(2));
  const [slug, raiz] = livres;
  try {
    if (!slug) throw new ErroTracking('uso: node "<MKT>/scripts/tracking/gtm.mjs" <slug> --ga4 G-… --conta <n> --contentor <n> --gtm GTM-… [--ads AW-…[/<rótulo>]] [--rotulo <evento>=<rótulo>] [--nome <nome>] [raiz]');
    const r = raiz ?? raizDados();
    // "--ads AW-…/<rótulo>" vale para a conversão Ads do plano quando só há uma.
    if (rotuloAds) {
      const conv = lerPlano(r, slug).eventos?.filter((e) => e?.conversao_ads) ?? [];
      if (conv.length !== 1) throw new ErroTracking(`--ads AW-…/<rótulo> só serve com 1 conversão Ads no plano (há ${conv.length}); usar --rotulo <evento>=<rótulo>`);
      opcoes.rotulos[conv[0].nome] ??= rotuloAds;
    }
    const { caminho, contentor } = gtm(slug, opcoes, { raiz: r });
    const v = contentor.containerVersion;
    console.log([
      `Contentor ${v.container.publicId} (${v.container.name}) gravado em ${caminho}`,
      `  ${v.tag.length} tags (todas exigem consentimento) · ${v.trigger.length} activadores · ${v.variable.length} variáveis`,
      ...v.tag.map((t) => `  - ${t.name} [${t.consentSettings.consentType.list[0].value}]`),
      '',
      'Importar (o marketeer não publica nada):',
      '  1. GTM → Administrador → Importar contentor → escolher o ficheiro.',
      '  2. Espaço de trabalho existente → Substituir (Overwrite). Juntar (Merge) duplica as tags.',
      '  3. Pré-visualizar (Tag Assistant): sem consentimento nada dispara; depois de Aceitar, GA4 e Ads.',
      '  4. Publicar é manual, pelo operador, depois da prova de rede (`node "<MKT>/scripts/tracking/prova.mjs" <url do site>`).',
    ].join('\n'));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
