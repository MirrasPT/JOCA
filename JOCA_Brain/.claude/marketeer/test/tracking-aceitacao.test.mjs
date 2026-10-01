// Suite de aceitação do módulo tracking, escrita a partir dos critérios do issue, do
// SKILL (`## tracking`), da D-021 e dos modelos produto/modelos/tracking-*.md — não a partir do corpo
// dos scripts. Os comandos correm como o operador os corre (CLI, raiz temporária em argumento).
// Sem rede real: o HOME é uma pasta temporária (cofre falso com sentinelas), a Google Ads é um `fetch`
// falso que grava cada pedido e a prova corre contra páginas de teste servidas aqui, com o Chromium
// atrás de um proxy desta suite que regista tudo o que tenta sair.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { parse } from 'yaml';
import { SEGREDOS, CID, ROTULO, escreverCofre, googleFalsa } from './fixtures/tracking-aceitacao/google-falsa.mjs';

const pastas = [];
const novaPasta = (pref) => { const p = mkdtempSync(join(tmpdir(), pref)); pastas.push(p); return p; };

// HOME falso antes de qualquer import do módulo: o cofre real nunca é tocado. O Chromium do
// Playwright continua a vir da cache do utilizador (só binários), no sítio onde o Playwright a põe
// em cada SO — `~/.cache` só vale no Linux; no macOS fixá-lo dava "chromium em falta" (10 falhas).
const CACHE_PW = process.platform === 'darwin' ? join(process.env.HOME, 'Library', 'Caches')
  : process.platform === 'win32' ? (process.env.LOCALAPPDATA ?? join(process.env.HOME ?? process.env.USERPROFILE, 'AppData', 'Local'))
    : (process.env.XDG_CACHE_HOME ?? join(process.env.HOME, '.cache'));
process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(CACHE_PW, 'ms-playwright');
const HOME = novaPasta('marketeer-tracking-home-');
process.env.HOME = HOME;

const { validarContentor } = await import('../scripts/tracking/gtm.mjs');
const { checklist, checklistMarkdown } = await import('../scripts/tracking/checklist.mjs');

const REPO = fileURLToPath(new URL('..', import.meta.url));
const FIX = join(REPO, 'test', 'fixtures', 'tracking-aceitacao');
const CONTENTOR_FIXTURE = JSON.parse(readFileSync(join(FIX, 'contentor-GTM-XXXXXXX.json'), 'utf8'));
const SETUP = ['--ga4', 'G-XXXXXXXXXX', '--ads', 'AW-100000000/RotuloFicticio001', '--conta', '1000000001', '--contentor', '1000002', '--gtm', 'GTM-XXXXXXX'];

function semSegredos(texto, onde) {
  for (const s of Object.values(SEGREDOS)) assert.ok(!String(texto).includes(s), `${onde} contém um segredo (${s.slice(0, 14)}…)`);
}

// ---- comandos como o operador os corre (assíncrono: o servidor de teste corre neste processo) ----
function correr(script, args, { env = {}, preload = false } = {}) {
  const pre = preload ? ['--import', join(FIX, 'rede-vigiada.mjs')] : [];
  return new Promise((res) => {
    const p = spawn(process.execPath, [...pre, join(REPO, 'scripts', 'tracking', script), ...args], {
      cwd: REPO, env: { ...process.env, HOME, ...env },
    });
    let stdout = '', stderr = '';
    p.stdout.on('data', (d) => { stdout += d; });
    p.stderr.on('data', (d) => { stderr += d; });
    p.on('close', (status) => res({ status, stdout, stderr }));
  });
}

function dossier(raiz, slug, { site = 'https://cliente-teste.pt/', canais = '' } = {}) {
  mkdirSync(join(raiz, 'clientes', slug), { recursive: true });
  writeFileSync(join(raiz, 'clientes', slug, 'dossier.md'), `---
cliente:
  nome: Cliente Teste
  slug: ${slug}
  sector: <sem fonte>
  site: ${site}
  responsavel: <sem fonte>
marca: <sem fonte>
publico: <sem fonte>
objectivos: <sem fonte>
concorrentes: <sem fonte>
canais:${canais || ' []'}
estado: novo
actualizado: 2026-09-30
---

# Cliente Teste

<sem fonte>
`);
}
const CANAL_ADS = `\n  - tipo: google-ads\n    id: 123-456-7890\n    acesso: true`;

const lerPlanoMd = (raiz, slug) => readFileSync(join(raiz, 'clientes', slug, 'tracking', 'plano.md'), 'utf8');
const frontmatter = (texto) => parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(texto)[1]);
const ficheirosTracking = (raiz, slug) => { try { return readdirSync(join(raiz, 'clientes', slug, 'tracking')).sort(); } catch { return []; } };

async function raizComPlano(slug, planoArgs, dossierOpc = {}) {
  const raiz = novaPasta('marketeer-tracking-raiz-');
  dossier(raiz, slug, dossierOpc);
  const r = await correr('plano.mjs', [slug, ...planoArgs, raiz]);
  assert.equal(r.status, 0, `plano falhou: ${r.stderr}`);
  return raiz;
}

// ==================================================================================================
// 1. plano
// ==================================================================================================

test('plano: grava clientes/<slug>/tracking/plano.md com o contrato do dataLayer (lead só no 2xx, clique_telefone{numero})', async () => {
  const raiz = await raizComPlano('cli', ['--formularios', 'contacto,orcamento', '--telefones', '212345678', '--com-ads']);
  const texto = lerPlanoMd(raiz, 'cli');
  assert.ok(!/\{\{/.test(texto), 'ficou um marcador {{…}} por preencher');

  // Contrato no frontmatter (é dele que o gtm gera o contentor).
  const ev = frontmatter(texto).tracking.eventos;
  const porNome = Object.fromEntries(ev.map((e) => [e.nome, e]));
  assert.ok(porNome.generate_lead, 'sem generate_lead no frontmatter');
  assert.ok(porNome.clique_telefone, 'sem clique_telefone no frontmatter');
  assert.match(JSON.stringify(porNome.generate_lead), /formulario/);
  assert.match(JSON.stringify(porNome.clique_telefone), /numero/);
  assert.ok(porNome.generate_lead.conversao_ads, 'com --com-ads o lead tem de ser conversão Ads');

  // Contrato no corpo: push com os parâmetros, lead SÓ no 2xx.
  assert.match(texto, /event:\s*'generate_lead',\s*\n\s*formulario:/);
  assert.match(texto, /event:\s*'clique_telefone',\s*numero:/);
  const bloco = texto.slice(texto.indexOf('## 3.'), texto.indexOf('## 4.'));
  assert.match(bloco, /SÓ quando o servidor responde 2xx/);
  assert.match(bloco, /nunca[\s\S]{0,40}4xx\/5xx/);
  // Valores dados pelo operador aparecem; o telefone sem 351.
  assert.match(texto, /contacto/);
  assert.match(texto, /orcamento/);
  assert.match(texto, /212345678/);
});

test('plano: campos sem dados ficam por preencher (<sem fonte>/TODO), nada inventado', async () => {
  const raiz = await raizComPlano('vazio', ['--sem-ads']);
  const texto = lerPlanoMd(raiz, 'vazio');
  assert.ok(!/\{\{/.test(texto), 'ficou um marcador {{…}} por preencher');
  // Nenhum ID de conta plausível inventado.
  assert.ok(!/\bG-[A-Z0-9]{6,}\b/.test(texto), 'ID GA4 inventado');
  assert.ok(!/\bAW-\d{5,}/.test(texto), 'ID Google Ads inventado');
  assert.ok(!/\bGTM-[A-Z0-9]{4,}\b/.test(texto), 'ID GTM inventado');
  // Sem formulários nem telefones dados: nada de exemplos plausíveis no contrato.
  const bloco = texto.slice(texto.indexOf('## 3.'), texto.indexOf('## 4.'));
  assert.ok(!/\b9\d{8}\b|\b2\d{8}\b/.test(bloco), `telefone inventado no contrato:\n${bloco}`);
  assert.match(bloco, /formulario:\s*'(<sem fonte>|TODO[^']*)'/, 'formulário sem fonte tem de ficar <sem fonte>/TODO');
  assert.match(bloco, /numero:\s*'(<sem fonte>|TODO[^']*)'/, 'telefone sem fonte tem de ficar <sem fonte>/TODO');
  // Contas e IDs: sem fonte.
  const contas = texto.slice(texto.indexOf('## 7.'), texto.indexOf('## 8.'));
  assert.ok((contas.match(/<sem fonte>|TODO/g) ?? []).length >= 4, `contas/IDs sem fonte não ficaram marcados:\n${contas}`);
  // --sem-ads: nenhuma conversão Ads no frontmatter.
  assert.ok(!frontmatter(texto).tracking.eventos.some((e) => e.conversao_ads), 'conversão Ads num plano --sem-ads');
});

test('plano: nunca sobrescreve um plano existente', async () => {
  const raiz = await raizComPlano('dois', ['--formularios', 'contacto', '--com-ads']);
  const f = join(raiz, 'clientes', 'dois', 'tracking', 'plano.md');
  const editado = `${readFileSync(f, 'utf8')}\n<!-- edição à mão do operador -->\n`;
  writeFileSync(f, editado);
  await correr('plano.mjs', ['dois', '--formularios', 'outro', '--sem-ads', raiz]);
  assert.equal(readFileSync(f, 'utf8'), editado, 'o plano existente foi sobrescrito');
});

// ==================================================================================================
// 2. gtm
// ==================================================================================================

const lerContentor = (raiz, slug, gtm) => JSON.parse(readFileSync(join(raiz, 'clientes', slug, 'tracking', `contentor-${gtm}.json`), 'utf8'));
const consentimento = (t) => t.consentSettings?.consentStatus === 'NEEDED' ? (t.consentSettings.consentType?.list ?? []).map((x) => x.value) : null;
const eGA4 = (t) => t.type === 'gaawe' || (t.type === 'googtag' && /^G-/.test(t.parameter?.find((p) => p.key === 'tagId')?.value ?? ''));
const eAds = (t) => ['awct', 'gclidw'].includes(t.type) || (t.type === 'googtag' && /^AW-/.test(t.parameter?.find((p) => p.key === 'tagId')?.value ?? ''));

function todasComConsentimento(c) {
  const tags = c.containerVersion.tag;
  assert.ok(tags.length > 0, 'contentor sem tags');
  for (const t of tags) {
    const lista = consentimento(t);
    assert.ok(lista && lista.length, `tag "${t.name}" não exige consentimento`);
    if (eGA4(t)) assert.ok(lista.includes('analytics_storage'), `tag GA4 "${t.name}" sem analytics_storage (${lista})`);
    else if (eAds(t)) assert.ok(lista.includes('ad_storage'), `tag Ads "${t.name}" sem ad_storage (${lista})`);
    else assert.fail(`tag "${t.name}" (${t.type}) não é GA4 nem Ads — tipo inesperado`);
  }
}

test('gtm: com os parâmetros do exemplo o contentor é o GTM-XXXXXXX (tirando o exportTime)', async () => {
  const raiz = await raizComPlano('exemplo-ads', ['--formularios', 'contacto', '--telefones', '212345678', '--com-ads'], { site: 'https://exemplo.invalid/' });
  const r = await correr('gtm.mjs', ['exemplo-ads', ...SETUP, raiz]);
  assert.equal(r.status, 0, r.stderr);
  const c = lerContentor(raiz, 'exemplo-ads', 'GTM-XXXXXXX');
  assert.match(c.exportTime, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  const { exportTime: _a, ...gerado } = c;
  const { exportTime: _b, ...referencia } = CONTENTOR_FIXTURE;
  assert.deepEqual(gerado, referencia);
});

test('gtm: todas as tags exigem consentimento (GA4 → analytics_storage; Ads e Conversion Linker → ad_storage)', async () => {
  const raiz = await raizComPlano('st', ['--formularios', 'contacto', '--telefones', '212345678', '--com-ads']);
  const r = await correr('gtm.mjs', ['st', ...SETUP, raiz]);
  assert.equal(r.status, 0, r.stderr);
  const c = lerContentor(raiz, 'st', 'GTM-XXXXXXX');
  todasComConsentimento(c);
  const tipos = c.containerVersion.tag.map((t) => t.type);
  for (const tipo of ['googtag', 'gclidw', 'awct', 'gaawe']) assert.ok(tipos.includes(tipo), `falta a tag ${tipo}`);
  assert.deepEqual(validarContentor(JSON.stringify(c)), [], 'o próprio validar recusa o contentor gerado');
});

test('gtm: accountId/containerId em tudo e variáveis built-in', async () => {
  const raiz = await raizComPlano('ids', ['--formularios', 'contacto', '--com-ads']);
  const r = await correr('gtm.mjs', ['ids', '--ga4', 'G-ABCDEF1234', '--ads', 'AW-1234567/rotuloTeste', '--conta', '111222', '--contentor', '333444', '--gtm', 'GTM-ABC123', raiz]);
  assert.equal(r.status, 0, r.stderr);
  const v = lerContentor(raiz, 'ids', 'GTM-ABC123').containerVersion;
  assert.equal(v.accountId, '111222');
  assert.equal(v.containerId, '333444');
  assert.equal(v.container.publicId, 'GTM-ABC123');
  assert.equal(v.container.path, 'accounts/111222/containers/333444');
  assert.ok(Array.isArray(v.builtInVariable) && v.builtInVariable.length > 0, 'sem built-ins');
  for (const tipo of ['PAGE_URL', 'EVENT']) assert.ok(v.builtInVariable.some((b) => b.type === tipo), `sem built-in ${tipo}`);
  for (const [grupo, lista] of Object.entries({ tag: v.tag, trigger: v.trigger ?? [], variable: v.variable ?? [], builtInVariable: v.builtInVariable })) {
    for (const x of lista) {
      assert.equal(x.accountId, '111222', `${grupo} "${x.name}" sem accountId`);
      assert.equal(x.containerId, '333444', `${grupo} "${x.name}" sem containerId`);
    }
  }
  todasComConsentimento({ containerVersion: v });
});

test('gtm: sem Ads não gera tags Ads (nem Conversion Linker)', async () => {
  const raiz = await raizComPlano('sem', ['--formularios', 'contacto', '--telefones', '212345678', '--sem-ads']);
  const r = await correr('gtm.mjs', ['sem', '--ga4', 'G-XXXXXXXXXX', '--conta', '1000000001', '--contentor', '1000002', '--gtm', 'GTM-XXXXXXX', raiz]);
  assert.equal(r.status, 0, r.stderr);
  const c = lerContentor(raiz, 'sem', 'GTM-XXXXXXX');
  assert.ok(c.containerVersion.tag.length > 0);
  assert.deepEqual(c.containerVersion.tag.filter(eAds).map((t) => t.name), [], 'tags Ads num contentor sem Ads');
  assert.ok(!JSON.stringify(c).includes('AW-'), 'referência a AW- num contentor sem Ads');
  todasComConsentimento(c);
});

// Parâmetro em falta → saída 1, nada gravado, e a mensagem diz QUAL falta.
const SEM = (chave) => { const a = [...SETUP]; const i = a.indexOf(chave); a.splice(i, 2); return a; };
const FALTAS = [
  ['--ga4', /GA4|G-/],
  ['--conta', /conta|accountId/i],
  ['--contentor', /contentor|containerId/i],
  ['--gtm', /GTM-/],
];
for (const [chave, re] of FALTAS) {
  test(`gtm: sem ${chave} → erro que diz o que falta, nada gravado`, async () => {
    const raiz = await raizComPlano('falta', ['--formularios', 'contacto', '--com-ads']);
    const r = await correr('gtm.mjs', ['falta', ...SEM(chave), raiz]);
    assert.equal(r.status, 1, `aceitou sem ${chave}: ${r.stdout}`);
    assert.match(r.stderr, re, `a mensagem não diz que falta ${chave}: ${r.stderr}`);
    assert.deepEqual(ficheirosTracking(raiz, 'falta').filter((f) => f.startsWith('contentor')), [], 'gravou um contentor apesar do erro');
  });
}

test('gtm: as mensagens de falta distinguem-se (não é um erro genérico)', async () => {
  const raiz = await raizComPlano('falta2', ['--formularios', 'contacto', '--com-ads']);
  const msgs = [];
  for (const [chave] of FALTAS) msgs.push((await correr('gtm.mjs', ['falta2', ...SEM(chave), raiz])).stderr);
  assert.equal(new Set(msgs).size, FALTAS.length, `mensagens iguais para faltas diferentes:\n${msgs.join('\n')}`);
  const todas = await correr('gtm.mjs', ['falta2', raiz]);
  assert.equal(todas.status, 1);
  for (const [chave, re] of FALTAS) assert.match(todas.stderr, re, `sem nenhum ID a mensagem não refere ${chave}`);
});

test('gtm: com Ads no plano, faltar o rótulo da conversão → erro que o diz', async () => {
  const raiz = await raizComPlano('rot', ['--formularios', 'contacto', '--com-ads']);
  const r = await correr('gtm.mjs', ['rot', '--ga4', 'G-XXXXXXXXXX', '--ads', 'AW-100000000', '--conta', '1000000001', '--contentor', '1000002', '--gtm', 'GTM-XXXXXXX', raiz]);
  assert.equal(r.status, 1, `aceitou Ads sem rótulo: ${r.stdout}`);
  assert.match(r.stderr, /r[óo]tulo/i);
  assert.deepEqual(ficheirosTracking(raiz, 'rot').filter((f) => f.startsWith('contentor')), []);
});

test('gtm: com Ads no plano, faltar o AW- → erro', async () => {
  const raiz = await raizComPlano('semaw', ['--formularios', 'contacto', '--com-ads']);
  const r = await correr('gtm.mjs', ['semaw', ...SEM('--ads'), raiz]);
  assert.equal(r.status, 1, `plano com Ads gerou contentor sem --ads: ${r.stdout}`);
  assert.match(r.stderr, /AW-|Ads/);
});

const MAL = [
  ['--ga4', 'UA-12345-1'], ['--ga4', 'NZGKWMDWLX'], ['--ga4', 'G-'],
  ['--ads', '100000000/RotuloFicticio001'], ['--ads', 'AW-abc/RotuloFicticio001'], ['--ads', 'AW-100000000/'],
  ['--gtm', 'CONTENTOR_FIXTURE'], ['--gtm', 'GTM-'], ['--gtm', 'G-XXXXXXXXXX'],
];
for (const [chave, valor] of MAL) {
  test(`gtm: ${chave} ${valor} mal formatado → erro, nada gravado`, async () => {
    const raiz = await raizComPlano('mal', ['--formularios', 'contacto', '--com-ads']);
    const a = [...SETUP]; a[a.indexOf(chave) + 1] = valor;
    const r = await correr('gtm.mjs', ['mal', ...a, raiz]);
    assert.equal(r.status, 1, `aceitou ${chave} ${valor}: ${r.stdout}`);
    assert.deepEqual(ficheirosTracking(raiz, 'mal').filter((f) => f.startsWith('contentor')), []);
  });
}

test('gtm: nunca sobrescreve um contentor já gerado', async () => {
  const raiz = await raizComPlano('rep', ['--formularios', 'contacto', '--com-ads']);
  assert.equal((await correr('gtm.mjs', ['rep', ...SETUP, raiz])).status, 0);
  const f = join(raiz, 'clientes', 'rep', 'tracking', 'contentor-GTM-XXXXXXX.json');
  writeFileSync(f, `${readFileSync(f, 'utf8')} `);
  const antes = readFileSync(f, 'utf8');
  await correr('gtm.mjs', ['rep', ...SETUP, raiz]);
  assert.equal(readFileSync(f, 'utf8'), antes, 'o contentor existente foi sobrescrito');
});

// ==================================================================================================
// 3. validar
// ==================================================================================================

function contentorBom() { return structuredClone(CONTENTOR_FIXTURE); }

test('validar: o contentor de referência passa; uma tag sem consentimento é recusada', () => {
  assert.deepEqual(validarContentor(JSON.stringify(contentorBom())), []);
  const variantes = {
    'sem consentSettings': (t) => { delete t.consentSettings; },
    'NOT_NEEDED': (t) => { t.consentSettings = { consentStatus: 'NOT_NEEDED' }; },
    'NOT_SET': (t) => { t.consentSettings = { consentStatus: 'NOT_SET' }; },
    'NEEDED sem tipos': (t) => { t.consentSettings = { consentStatus: 'NEEDED', consentType: { type: 'LIST', list: [] } }; },
  };
  for (const [nome, estragar] of Object.entries(variantes)) {
    for (let i = 0; i < CONTENTOR_FIXTURE.containerVersion.tag.length; i++) {
      const c = contentorBom();
      estragar(c.containerVersion.tag[i]);
      const erros = validarContentor(JSON.stringify(c));
      assert.ok(erros.length > 0, `${nome} na tag "${c.containerVersion.tag[i].name}" passou`);
      assert.ok(erros.some((e) => e.includes(c.containerVersion.tag[i].name)), `o erro não diz que tag: ${erros}`);
    }
  }
});

test('validar (CLI do dossier): recusa clientes/<slug>/tracking/contentor-GTM-….json com uma tag sem consentimento', async () => {
  const raiz = novaPasta('marketeer-tracking-validar-');
  dossier(raiz, 'val', { site: 'https://exemplo.invalid/' });
  const pasta = join(raiz, 'clientes', 'val', 'tracking');
  mkdirSync(pasta, { recursive: true });
  const validar = () => new Promise((res) => {
    const p = spawn(process.execPath, [join(REPO, 'scripts', 'validar-dossier.mjs'), join(raiz, 'clientes')], { cwd: REPO, env: { ...process.env, HOME } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (status) => res({ status, out }));
  });
  writeFileSync(join(pasta, 'contentor-GTM-XXXXXXX.json'), JSON.stringify(contentorBom(), null, 1));
  const bom = await validar();
  assert.equal(bom.status, 0, `contentor válido recusado: ${bom.out}`);
  const mau = contentorBom();
  delete mau.containerVersion.tag.find((t) => t.type === 'gclidw').consentSettings;
  writeFileSync(join(pasta, 'contentor-GTM-XXXXXXX.json'), JSON.stringify(mau, null, 1));
  const r = await validar();
  assert.notEqual(r.status, 0, 'o validar aceitou uma tag sem consentimento');
  assert.match(r.out, /Conversion Linker/);
});

// ==================================================================================================
// 4. prova — páginas de teste locais; Chromium atrás do proxy da suite; nada sai para a rede
// ==================================================================================================

const CONSENT_DEFAULT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});`;
// O que o GTM faria com consentimento (sem carregar o GTM real): collect GA4 (beacon POST, como o gtag) e hits Ads.
const HITS = `function hits(){
  navigator.sendBeacon('https://region1.google-analytics.com/g/collect?v=2&tid=G-TESTE00001&cid=1.1&en=page_view&dl='+encodeURIComponent(location.href));
  new Image().src='https://googleads.g.doubleclick.net/pagead/viewthroughconversion/100000001/?random=1&cv=11&fst=1&num=1&guid=ON';
  new Image().src='https://www.googleadservices.com/pagead/conversion/100000001/?label=TESTE&guid=ON&script=0';
}`;
function paginaBanner({ antes = false, naRecusa = false, naAceitacao = true } = {}) {
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Teste</title>
<script>${CONSENT_DEFAULT}\n${HITS}${antes ? '\nhits();' : ''}</script></head><body>
<h1>Página de teste do marketeer</h1><p>Conteúdo.</p><a href="tel:+351212345678">222 000 111</a>
<div class="ck" data-cookies role="dialog" aria-labelledby="ck-t"><h2 id="ck-t">Cookies neste site</h2>
<button type="button" class="ck__btn" data-cookies-accao="recusar">Recusar</button>
<button type="button" class="ck__btn" data-cookies-accao="aceitar">Aceitar todos</button></div>
<script>
var ck=document.querySelector('[data-cookies]');
ck.querySelector('[data-cookies-accao="recusar"]').addEventListener('click',function(){
  gtag('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
  ck.hidden=true;${naRecusa ? ' hits();' : ''}});
ck.querySelector('[data-cookies-accao="aceitar"]').addEventListener('click',function(){
  gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});
  ck.hidden=true;${naAceitacao ? ' hits();' : ''}});
</script></body></html>`;
}
function paginaFormulario({ endpoint = '/api/lead', lead = 'ok', push = "dataLayer.push({event:'generate_lead',formulario:'contacto'});" } = {}) {
  const aoResponder = {
    ok: `if(r.ok){${push}}else{erro.hidden=false;}`,
    duplicado: `if(r.ok){${push}${push}}else{erro.hidden=false;}`,
    sempre: `${push}if(!r.ok){erro.hidden=false;}`,
    nunca: 'if(!r.ok){erro.hidden=false;}',
  }[lead];
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Contacto</title>
<script>${CONSENT_DEFAULT}</script></head><body><h1>Contacto</h1>
<form id="f" action="${endpoint}" method="post">
<label>Nome <input name="nome" required></label>
<label>Email <input type="email" name="email" required></label>
<label>Telefone <input type="tel" name="telefone"></label>
<label>Mensagem <textarea name="mensagem" required></textarea></label>
<button type="submit">Enviar</button></form><p id="erro" hidden>Erro no envio.</p>
<script>
var f=document.getElementById('f'),erro=document.getElementById('erro');
f.addEventListener('submit',function(e){e.preventDefault();
  var dados={};new FormData(f).forEach(function(v,k){dados[k]=v;});
  fetch(${JSON.stringify(endpoint)},{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(dados)})
    .then(function(r){${aoResponder}}).catch(function(){erro.hidden=false;});
});
</script></body></html>`;
}
const PAGINAS = {
  '/correcta.html': paginaBanner(),
  '/dispara-antes.html': paginaBanner({ antes: true }),
  '/ignora-recusa.html': paginaBanner({ naRecusa: true }),
  '/sem-hits.html': paginaBanner({ naAceitacao: false }),
  '/contacto.html': paginaFormulario(),
  '/contacto-externo.html': paginaFormulario({ endpoint: 'https://api.cliente-teste.invalid/v1/lead' }),
  '/contacto-duplicado.html': paginaFormulario({ lead: 'duplicado' }),
  '/contacto-sempre.html': paginaFormulario({ lead: 'sempre' }),
  '/contacto-nunca.html': paginaFormulario({ lead: 'nunca' }),
  '/contacto-sem-parametro.html': paginaFormulario({ push: "dataLayer.push({event:'generate_lead'});" }),
  '/contacto-parametro-vazio.html': paginaFormulario({ push: "dataLayer.push({event:'generate_lead',formulario:''});" }),
  '/contacto-form.html': paginaFormulario({ push: "dataLayer.push({event:'generate_lead',form:'contacto'});" }),
};

// Um só servidor: site de teste (pedidos directos ou via proxy para 127.0.0.1:<porta>) e proxy do
// Chromium. Tudo o que não é o site de teste é registado e recusado — nunca reencaminhado.
const rede = { site: [], fora: [] };
let servidor, BASE, PROXY;
before(async () => {
  servidor = createServer((req, res) => {
    let host = req.headers.host, caminho = req.url;
    if (/^https?:\/\//.test(req.url)) { const u = new URL(req.url); host = u.host; caminho = u.pathname; }
    if (host !== `127.0.0.1:${servidor.address().port}`) {
      rede.fora.push({ metodo: req.method, url: req.url });
      res.writeHead(502).end();
      return;
    }
    rede.site.push({ metodo: req.method, caminho });
    const html = req.method === 'GET' ? PAGINAS[caminho] : undefined;
    if (html) res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
    else res.writeHead(req.method === 'GET' ? 404 : 500).end();
  });
  // O Chromium com proxy pede túnel (CONNECT) mesmo para http: só o do site de teste é aberto.
  servidor.on('connect', (req, socket, cabeca) => {
    const porta = servidor.address().port;
    if (req.url !== `127.0.0.1:${porta}`) { rede.fora.push({ metodo: 'CONNECT', url: req.url }); socket.destroy(); return; }
    const alvo = connect(porta, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (cabeca?.length) alvo.write(cabeca);
      alvo.pipe(socket); socket.pipe(alvo);
    });
    alvo.on('error', () => socket.destroy()); socket.on('error', () => alvo.destroy());
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  BASE = `http://127.0.0.1:${servidor.address().port}`;
  PROXY = BASE;
});
after(async () => {
  await new Promise((r) => (servidor ? servidor.close(r) : r()));
  pastas.forEach((p) => rmSync(p, { recursive: true, force: true }));
});

async function provar(pagina, { formulario, extra = [], env = {} } = {}) {
  rede.site.length = 0; rede.fora.length = 0;
  const log = join(novaPasta('marketeer-tracking-rede-'), 'rede.jsonl');
  writeFileSync(log, '');
  const args = [`${BASE}${pagina}`, ...(formulario ? ['--formulario', `${BASE}${formulario}`] : []), ...extra];
  const r = await correr('prova.mjs', args, { preload: true, env: { REDE_LOG: log, REDE_PROXY: PROXY, ...env } });
  const eventos = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return { ...r, eventos, site: [...rede.site], fora: [...rede.fora] };
}

// Nada saiu para a rede: o browser passou pelo proxy da suite (senão a verificação é vazia), o proxy
// não viu nenhum pedido para fora do site de teste, o site não recebeu nenhum envio e o Node não fez fetch.
function nadaSaiu(p, { fetchPermitido = false } = {}) {
  assert.ok(p.eventos.some((e) => e.tipo === 'launch'), 'a prova não arrancou o Chromium pelo caminho vigiado');
  assert.ok(p.site.some((x) => x.metodo === 'GET'), 'o browser não passou pelo servidor de teste (verificação vazia)');
  assert.deepEqual(p.fora, [], `pedidos tentaram sair para a rede: ${JSON.stringify(p.fora)}`);
  assert.deepEqual(p.site.filter((x) => x.metodo !== 'GET'), [], `envios chegaram ao servidor: ${JSON.stringify(p.site)}`);
  if (!fetchPermitido) assert.deepEqual(p.eventos.filter((e) => e.tipo === 'fetch'), [], 'o Node fez pedidos de rede');
  assert.deepEqual(p.eventos.filter((e) => e.tipo === 'fetch-local' && e.metodo !== 'GET'), [], 'o Node enviou para o site de teste');
}
const saida = (p) => `status ${p.status}\n${p.stdout}\n${p.stderr}`;

test('prova: página correcta → 0 hits sem interacção e depois de Recusar, hits depois de Aceitar (saída 0)', { timeout: 180_000 }, async () => {
  const p = await provar('/correcta.html');
  assert.equal(p.status, 0, saida(p));
  assert.ok(!/✗/.test(p.stdout), saida(p));
  nadaSaiu(p);
});

test('prova: página que dispara GA antes do consentimento → FALHA', { timeout: 180_000 }, async () => {
  const p = await provar('/dispara-antes.html');
  assert.equal(p.status, 1, saida(p));
  assert.match(p.stdout, /✗[^\n]*sem interac/i, saida(p));
  nadaSaiu(p);
});

test('prova: página que envia hits depois de Recusar → FALHA', { timeout: 180_000 }, async () => {
  const p = await provar('/ignora-recusa.html');
  assert.equal(p.status, 1, saida(p));
  assert.match(p.stdout, /✗[^\n]*Recusar/, saida(p));
  nadaSaiu(p);
});

test('prova: página sem hits depois de Aceitar → FALHA (o cenário C tem de medir alguma coisa)', { timeout: 180_000 }, async () => {
  const p = await provar('/sem-hits.html');
  assert.equal(p.status, 1, saida(p));
  assert.match(p.stdout, /✗[^\n]*Aceitar/, saida(p));
  nadaSaiu(p);
});

test('prova --formulario: 201 → 1 lead, 422 → 0; o POST nunca sai (mesma origem)', { timeout: 180_000 }, async () => {
  const p = await provar('/correcta.html', { formulario: '/contacto.html' });
  assert.equal(p.status, 0, saida(p));
  assert.ok(p.site.some((x) => x.caminho === '/contacto.html'), 'a página do formulário não foi aberta');
  nadaSaiu(p);
});

test('prova --formulario: endpoint noutra origem (CORS) também é interceptado', { timeout: 180_000 }, async () => {
  const p = await provar('/correcta.html', { formulario: '/contacto-externo.html' });
  assert.equal(p.status, 0, saida(p));
  nadaSaiu(p);
});

test('prova --formulario: lead duplicado no 201 → FALHA', { timeout: 180_000 }, async () => {
  const p = await provar('/correcta.html', { formulario: '/contacto-duplicado.html' });
  assert.equal(p.status, 1, saida(p));
  assert.match(p.stdout, /✗[^\n]*201/, saida(p));
  nadaSaiu(p);
});

test('prova --formulario: lead também no 422 → FALHA', { timeout: 180_000 }, async () => {
  const p = await provar('/correcta.html', { formulario: '/contacto-sempre.html' });
  assert.equal(p.status, 1, saida(p));
  assert.match(p.stdout, /✗[^\n]*422/, saida(p));
  nadaSaiu(p);
});

test('prova --formulario: nenhum lead no 201 → FALHA', { timeout: 180_000 }, async () => {
  const p = await provar('/correcta.html', { formulario: '/contacto-nunca.html' });
  assert.equal(p.status, 1, saida(p));
  assert.match(p.stdout, /✗[^\n]*201/, saida(p));
  nadaSaiu(p);
});

// I3 (varredura 2026-10-01): o lead do 201 tem de levar o parâmetro do plano (formulario por omissão).
test('I3 prova --formulario: generate_lead sem o parâmetro formulario (ou vazio) → FALHA com mensagem clara', { timeout: 240_000 }, async () => {
  for (const pagina of ['/contacto-sem-parametro.html', '/contacto-parametro-vazio.html']) {
    const p = await provar('/correcta.html', { formulario: pagina });
    assert.equal(p.status, 1, saida(p));
    assert.match(p.stdout, /✗ D201 [^\n]*sem o parâmetro «formulario» \(vazio\)/, saida(p));
    assert.match(p.stdout, /✓ D422 /, saida(p));
    nadaSaiu(p);
  }
});

test('I3 prova --formulario --parametro form: o parâmetro escolhido manda', { timeout: 180_000 }, async () => {
  let p = await provar('/correcta.html', { formulario: '/contacto-form.html' });
  assert.equal(p.status, 1, saida(p));
  p = await provar('/correcta.html', { formulario: '/contacto-form.html', extra: ['--parametro', 'form'] });
  assert.equal(p.status, 0, saida(p));
  nadaSaiu(p);
});

test('prova --cliente: relatório com checklist, só leitura na Google Ads e nenhum segredo na saída', { timeout: 180_000 }, async () => {
  const raiz = novaPasta('marketeer-tracking-relatorio-');
  dossier(raiz, 'rel', { canais: CANAL_ADS });
  escreverCofre(HOME, 'rel');
  const p = await provar('/correcta.html', { formulario: '/contacto.html', extra: ['--cliente', 'rel', raiz], env: { GOOGLE_FALSA: '1' } });
  nadaSaiu(p, { fetchPermitido: true });
  const fetches = p.eventos.filter((e) => e.tipo === 'fetch');
  assert.ok(fetches.some((f) => /googleAds:search/.test(f.url)), `a checklist não leu a API (${JSON.stringify(fetches)})`);
  assert.deepEqual(fetches.filter((f) => /:mutate/.test(f.url)), [], 'a checklist fez :mutate');
  for (const f of fetches) assert.ok(f.url === 'https://oauth2.googleapis.com/token' || /googleAds:search(Stream)?$/.test(f.url), `pedido fora do só-leitura: ${f.url}`);
  const rel = ficheirosTracking(raiz, 'rel').filter((f) => /^relatorio-.*\.md$/.test(f));
  assert.equal(rel.length, 1, `relatório não gravado (${ficheirosTracking(raiz, 'rel')}) ${saida(p)}`);
  const texto = readFileSync(join(raiz, 'clientes', 'rel', 'tracking', rel[0]), 'utf8');
  semSegredos(texto, 'relatório');
  semSegredos(p.stdout, 'stdout');
  semSegredos(p.stderr, 'stderr');
});

// ==================================================================================================
// 5. checklist — só leitura; itens GA4 manuais
// ==================================================================================================

async function correrChecklist(opcoes = {}) {
  const raiz = novaPasta('marketeer-tracking-check-');
  dossier(raiz, 'chk', { canais: CANAL_ADS });
  escreverCofre(HOME, 'chk');
  const pedidos = [];
  const obter = googleFalsa({ registar: (p) => pedidos.push(p), ...opcoes });
  const consola = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  for (const k of Object.keys(orig)) console[k] = (...a) => consola.push(a.join(' '));
  let r, e;
  try { r = await checklist('chk', { raiz, obter, rotulo: ROTULO }); } catch (x) { e = x; } finally { Object.assign(console, orig); }
  const md = r ? checklistMarkdown(r) : '';
  return { r, e, md, pedidos, consola: consola.join('\n') };
}

test('checklist: só leitura (nenhum :mutate, só token + GAQL) e itens GA4 manuais assinalados como tal', async () => {
  const x = await correrChecklist();
  assert.ok(!x.e, x.e?.message);
  assert.ok(x.pedidos.some((p) => /googleAds:search/.test(p.url)), 'não leu a API');
  assert.deepEqual(x.pedidos.filter((p) => /:mutate/.test(p.url) || /"validateOnly"/.test(p.corpo)), [], 'fez :mutate');
  for (const p of x.pedidos) assert.ok(p.url === 'https://oauth2.googleapis.com/token' || /googleAds:search(Stream)?$/.test(p.url), `pedido fora do só-leitura: ${p.url}`);
  for (const p of x.pedidos.filter((q) => /googleAds:search/.test(q.url))) {
    assert.ok(!/\b(UPDATE|INSERT|DELETE|MUTATE)\b/i.test(JSON.parse(p.corpo).query ?? ''), 'query não é só leitura');
  }
  // Itens do GA4: manuais, mesmo com a API toda verde.
  const linhas = x.md.split('\n');
  // Marca de item manual (SKILL: "o resto fica ☐ manual"): ☐, nunca ✓/✗, e diz onde se verifica no GA4.
  const coluna = (s) => s.split('|').map((c) => c.trim());
  for (const [item, re] of [['ligação GA4↔Ads', /^Liga[çc][ãa]o\s+GA4/i], ['retenção de 14 meses', /14 meses/], ['tráfego interno', /tr[áa]fego interno/i], ['eventos-chave', /eventos?-chave/i]]) {
    const l = linhas.filter((s) => s.startsWith('|') && re.test(coluna(s)[2] ?? ''));
    assert.ok(l.length, `item "${item}" ausente da checklist:\n${x.md}`);
    for (const s of l) {
      assert.equal(coluna(s)[1], '☐', `item "${item}" não está assinalado como manual: ${s}`);
      assert.match(coluna(s)[3] ?? '', /GA4\s*→/, `item "${item}" sem o caminho para verificar à mão: ${s}`);
    }
  }
  semSegredos(x.md, 'checklist');
  semSegredos(x.consola, 'consola');
  semSegredos(JSON.stringify(x.r), 'resultado');
});

test('checklist: com o token recusado reporta o erro sem segredos e sem :mutate', async () => {
  const x = await correrChecklist({ erroToken: true });
  const tudo = [x.md, x.consola, JSON.stringify(x.r ?? null), x.e ? `${x.e.message}\n${x.e.stack}` : ''].join('\n');
  assert.ok(x.e || x.r?.erro, 'um token recusado não pode passar em silêncio');
  assert.deepEqual(x.pedidos.filter((p) => /:mutate/.test(p.url)), []);
  semSegredos(tudo, 'erro da checklist');
});

// ==================================================================================================
// 6. modelos
// ==================================================================================================

const MODELOS = join(REPO, 'modelos');

test('modelo da política de cookies: revisão jurídica obrigatória', () => {
  const t = readFileSync(join(MODELOS, 'tracking-politica-cookies.md'), 'utf8');
  assert.match(t, /revis[ãa]o jur[íi]dica obrigat[óo]ria/i);
});

test('modelo do banner: default denied ANTES do GTM', () => {
  const t = readFileSync(join(MODELOS, 'tracking-banner.md'), 'utf8');
  const blocos = [...t.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1]);
  const cabeca = blocos.find((b) => /gtag\(\s*'consent',\s*'default'/.test(b));
  assert.ok(cabeca, 'sem bloco com o consentimento default');
  const iDefault = cabeca.search(/gtag\(\s*'consent',\s*'default'/);
  const iGtm = cabeca.search(/googletagmanager\.com\/gtm\.js|snippet do GTM/);
  assert.ok(iGtm > iDefault, 'o GTM não vem depois do default denied');
  const def = cabeca.slice(iDefault, cabeca.indexOf('});', iDefault));
  for (const s of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
    assert.match(def, new RegExp(`${s}:\\s*'denied'`), `${s} não é denied no default`);
  }
  // Nenhum GTM real carregado antes do default em nenhum bloco.
  for (const b of blocos) {
    const g = b.search(/googletagmanager\.com\/gtm\.js/);
    if (g >= 0) assert.ok(b.search(/gtag\(\s*'consent',\s*'default'/) >= 0 && b.search(/gtag\(\s*'consent',\s*'default'/) < g, 'GTM carregado antes do default');
  }
  assert.match(t, /antes\s+do snippet do GTM/);
});

test('modelo do banner: Recusar com o mesmo peso que Aceitar', () => {
  const t = readFileSync(join(MODELOS, 'tracking-banner.md'), 'utf8');
  const botao = (accao) => {
    const m = new RegExp(`<(\\w+)([^>]*data-cookies-accao="${accao}"[^>]*)>([^<]*)<`).exec(t);
    assert.ok(m, `sem botão ${accao}`);
    return { tag: m[1], classe: (/class="([^"]*)"/.exec(m[2]) ?? [])[1], texto: m[3].trim(), hidden: /\bhidden\b/.test(m[2]) };
  };
  const recusar = botao('recusar'), aceitar = botao('aceitar');
  assert.equal(recusar.tag, aceitar.tag);
  assert.ok(recusar.classe, 'Recusar sem classe');
  assert.equal(recusar.classe, aceitar.classe, 'Recusar e Aceitar com pesos visuais diferentes');
  assert.ok(!recusar.hidden && !aceitar.hidden, 'um dos botões começa escondido');
  assert.match(recusar.texto, /Recusar/);
  assert.match(aceitar.texto, /Aceitar/);
  // Recusar e Aceitar lado a lado (nenhum outro elemento entre eles).
  const iR = t.indexOf('data-cookies-accao="recusar"'), iA = t.indexOf('data-cookies-accao="aceitar"');
  const entre = t.slice(Math.min(iR, iA), Math.max(iR, iA));
  assert.equal((entre.match(/<button/g) ?? []).length, 1, 'há outro botão entre Recusar e Aceitar');
});
