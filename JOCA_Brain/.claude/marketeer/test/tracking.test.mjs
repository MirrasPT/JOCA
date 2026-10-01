// Testes de fumo do módulo tracking. A suite dos critérios do issue escreve-se
// noutra sessão; aqui só o mínimo: equivalência ao CONTENTOR_FIXTURE, ID em falta, plano → gtm, classificação.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gerarContentor, validarContentor, gtm, lerPlano } from '../scripts/tracking/gtm.mjs';
import { plano, eventosDaCasa } from '../scripts/tracking/plano.mjs';
import { classificar, eEnvio, EVENTO_LEAD, PARAMETRO_LEAD, parametroDoPlano } from '../scripts/tracking/prova.mjs';
import { avaliar } from '../scripts/tracking/checklist.mjs';

const CONTENTOR_FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/tracking/contentor-GTM-XXXXXXX.json', import.meta.url), 'utf8'));
const SETUP = {
  ga4: 'G-XXXXXXXXXX', ads: 'AW-100000000', rotulos: { generate_lead: 'RotuloFicticio001' },
  conta: '1000000001', contentor: '1000002', gtm: 'GTM-XXXXXXX', nome: 'exemplo.invalid',
  eventos: [
    { nome: 'generate_lead', parametros: ['formulario'], conversao_ads: { nome: 'Lead (formulário)', valor: 1, moeda: 'EUR' } },
    { nome: 'clique_telefone', parametros: ['numero'] },
  ],
};

test('gtm: com os parâmetros do exemplo gera o contentor GTM-XXXXXXX (importado e validado)', () => {
  assert.deepEqual(gerarContentor({ ...SETUP, exportTime: CONTENTOR_FIXTURE.exportTime }), CONTENTOR_FIXTURE);
});

test('gtm: todas as tags exigem consentimento; o validar recusa uma que não exija', () => {
  const c = gerarContentor(SETUP);
  assert.deepEqual(validarContentor(JSON.stringify(c)), []);
  c.containerVersion.tag[0].consentSettings = { consentStatus: 'NOT_NEEDED' };
  assert.equal(validarContentor(JSON.stringify(c)).length, 1);
});

test('gtm: ID em falta → erro que diz qual (nunca inventado)', () => {
  const { contentor, ...semContentor } = SETUP;
  assert.throws(() => gerarContentor(semContentor), /--contentor/);
  const { ads, ...semAds } = SETUP;
  assert.throws(() => gerarContentor(semAds), /--ads: .*generate_lead/);
  assert.throws(() => gerarContentor({ ...SETUP, rotulos: {} }), /--rotulo generate_lead=/);
});

test('plano → gtm: o plano da casa gera o mesmo contentor; o plano não se sobrescreve', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'marketeer-tracking-'));
  try {
    mkdirSync(join(raiz, 'clientes', 'cli'), { recursive: true });
    writeFileSync(join(raiz, 'clientes', 'cli', 'dossier.md'), '---\ncliente:\n  nome: Cli\n  slug: cli\n  site: https://exemplo.invalid/\ncanais:\n  - tipo: google-ads\n    id: 111-222-3333\n    acesso: true\n---\n');
    plano('cli', { formularios: ['contacto'], telefones: ['212345678'] }, { raiz });
    assert.equal(lerPlano(raiz, 'cli').eventos.length, 2);
    assert.throws(() => plano('cli', {}, { raiz }), /já existe/);
    const { caminho, contentor } = gtm('cli', { ...SETUP, nome: undefined, eventos: undefined }, { raiz });
    assert.match(caminho, /contentor-GTM-XXXXXXX\.json$/);
    const { exportTime, ...resto } = contentor;
    const { exportTime: _, ...ref } = CONTENTOR_FIXTURE;
    assert.deepEqual(resto, ref);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('prova: classificação dos pedidos Google e do envio do formulário', () => {
  assert.equal(classificar('https://region1.analytics.google.com/g/collect?v=2&tid=G-X'), 'ga');
  assert.equal(classificar('https://googleads.g.doubleclick.net/pagead/viewthroughconversion/1/'), 'ads');
  assert.equal(classificar('https://www.googleadservices.com/pagead/conversion_async.js'), 'ads');
  assert.equal(classificar('https://www.googletagmanager.com/gtm.js?id=GTM-X'), null);
  assert.equal(eEnvio({ url: 'https://crm.exemplo.pt/api/v1/leads', metodo: 'POST' }), true);
  assert.equal(eEnvio({ url: 'https://region1.analytics.google.com/g/collect', metodo: 'POST' }), false);
});

test('checklist: rótulo do contentor e objectivos fora do plano lidos das linhas GAQL', () => {
  const itens = avaliar({
    conta: [{ customer: { id: '1', autoTaggingEnabled: true } }],
    conversoes: [{ conversionAction: { name: 'Lead', status: 'ENABLED', type: 'WEBPAGE', category: 'SUBMIT_LEAD_FORM', primaryForGoal: true, tagSnippets: [{ eventSnippet: "gtag('event','conversion',{'send_to':'AW-1/abc'})" }] } }],
    objectivos: [{ campaign: { name: 'C1', status: 'PAUSED' }, campaignConversionGoal: { category: 'DOWNLOAD', origin: 'APP', biddable: true } },
      { campaign: { name: 'C1', status: 'PAUSED' }, campaignConversionGoal: { category: 'SUBMIT_LEAD_FORM', origin: 'WEBSITE', biddable: true } }],
  }, { rotulo: 'abc' });
  const por = Object.fromEntries(itens.map((x) => [x.item.split(' (')[0], x.estado]));
  assert.equal(por['Acção de conversão do rótulo do contentor'], 'ok');
  assert.equal(por['Objectivos de conversão por campanha'], 'falta');
});

// Evento de lead = generate_lead (recomendado GA4), com o parâmetro formulario; a prova usa o mesmo por omissão.
test('evento de lead por omissão: generate_lead{formulario} no plano e na prova', () => {
  const lead = eventosDaCasa({ comAds: true }).find((e) => e.conversao_ads);
  assert.equal(lead.nome, 'generate_lead');
  assert.deepEqual(lead.parametros, ['formulario']);
  assert.equal(EVENTO_LEAD, lead.nome);
  assert.ok(!JSON.stringify(eventosDaCasa({ comAds: false })).includes('lead_enviado'));
});

// Planos já gravados não se tocam: um plano antigo com lead_enviado continua a gerar lead_enviado.
test('plano antigo com lead_enviado: o gtm usa o nome do plano gravado, não o novo', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'marketeer-tracking-'));
  try {
    mkdirSync(join(raiz, 'clientes', 'velho'), { recursive: true });
    writeFileSync(join(raiz, 'clientes', 'velho', 'dossier.md'), '---\ncliente:\n  nome: Velho\n  slug: velho\n  site: https://exemplo.invalid/\ncanais:\n  - tipo: google-ads\n    id: 111-222-3333\n    acesso: true\n---\n');
    plano('velho', { formularios: ['contacto'] }, { raiz });
    const f = join(raiz, 'clientes', 'velho', 'tracking', 'plano.md');
    writeFileSync(f, readFileSync(f, 'utf8').split('generate_lead').join('lead_enviado'));
    const { contentor } = gtm('velho', { ...SETUP, rotulos: { lead_enviado: 'RotuloFicticio001' }, nome: undefined, eventos: undefined }, { raiz });
    const texto = JSON.stringify(contentor);
    assert.ok(texto.includes('"lead_enviado"'), 'o contentor perdeu o lead_enviado do plano gravado');
    assert.ok(!texto.includes('generate_lead'), 'o gtm reescreveu o evento do plano gravado');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

// I3: a prova verifica o parâmetro do plano da marca; sem plano, o da casa (formulario).
test('I3 parametroDoPlano: lê o 1.º parâmetro do evento no plano; sem plano → undefined', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'mkt-i3-'));
  assert.equal(PARAMETRO_LEAD, 'formulario');
  assert.equal(parametroDoPlano(raiz, 'sem-plano'), undefined);
  mkdirSync(join(raiz, 'clientes', 'p', 'tracking'), { recursive: true });
  writeFileSync(join(raiz, 'clientes', 'p', 'tracking', 'plano.md'),
    '---\ntracking:\n  eventos:\n    - nome: lead_enviado\n      parametros: [form]\n    - nome: generate_lead\n      parametros: [nome_form]\n---\n# plano\n');
  assert.equal(parametroDoPlano(raiz, 'p'), 'nome_form');
  assert.equal(parametroDoPlano(raiz, 'p', 'lead_enviado'), 'form');
  assert.equal(parametroDoPlano(raiz, 'p', 'outro'), undefined);
  rmSync(raiz, { recursive: true, force: true });
});
