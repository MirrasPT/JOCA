// Testes de fumo do módulo campanha. A suite completa do issue é escrita noutra sessão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validar } from '../scripts/campanha/validar.mjs';
import { plano, operacoes, garantirPausa, criar, CAMPANHA_PAUSADA } from '../scripts/campanha/criar.mjs';
import { ideiasDoPlaneador } from '../scripts/campanha/pesquisa.mjs';
import { ficheiros } from '../scripts/campanha/csv.mjs';
import { horarioTexto } from '../scripts/campanha/investimento.mjs';
import { ErroAds } from '../scripts/ads/api.mjs';

const ESPEC = `---
cliente: teste
campanha:
  nome: GADS_Teste_2026-10
  orcamento_dia: 5
  licitacao: maximizar-cliques
  cpc_max: 2.30
  localizacoes: [{ id: 2620, nome: "Portugal" }]
  idiomas: [1014]
  url_final: https://exemplo.pt/apps
  caminho: [apps, medida]
  telefone: "222 000 111"
---
# Teste

## 4. Grupos

**G1 · Empresa de apps**
\`\`\`
"empresa de apps"
[empresa de apps]
\`\`\`

## 5. Palavras-chave negativas

| Tema | Negativas |
|---|---|
| Grátis | \`gratis\` \`"como criar"\` |

## 6. RSA

### G1 · Empresa de apps

| # | Título | Car. | Fixar |
|---|---|---|---|
| 1 | Empresa de apps | 15 | 1 |
| 2 | Apps à medida | 13 | |
| 3 | Fale connosco | 13 | |

| # | Descrição | Car. | Fixar |
|---|---|---|---|
| D1 | Desenvolvemos apps para empresas. | 33 | |
| D2 | Peça orçamento pelo site. | 25 | |

## 7. Recursos

| Texto | Car. | Descrição 1 | Car. | Descrição 2 | Car. | URL |
|---|---|---|---|---|---|---|
| Portfólio | 9 | Apps feitas | 11 | Veja os casos | 13 | https://exemplo.pt/portfolio |
`;

const ok200 = async () => ({ status: 200, headers: { get: () => null } });

test('validar: especificação limpa passa; cada defeito dá erro', async () => {
  assert.deepEqual((await validar(ESPEC, { obter: ok200 })).erros, []);
  const casos = [
    [ESPEC.replace('| 2 | Apps à medida | 13 |', '| 2 | Ligue 222 000 111 | 17 |'), /telefone/],
    [ESPEC.replace('| 1 | Empresa de apps | 15 |', '| 1 | Empresa de apps | 14 |'), /declara 14/],
    [ESPEC.replace('`gratis`', '`apps`'), /bloqueia G1/],
    [ESPEC.replace('| 3 | Fale connosco | 13 |', '| 3 | Um título demasiado comprido para caber | 39 |'), /> 30/],
    [ESPEC.replace('[empresa de apps]', 'empresa de apps'), /ampla/],
  ];
  for (const [texto, re] of casos) assert.ok((await validar(texto, { obter: ok200 })).erros.some((e) => re.test(e)), String(re));
  const r404 = await validar(ESPEC, { obter: async (u) => ({ status: u.endsWith('portfolio') ? 404 : 200, headers: { get: () => null } }) });
  assert.ok(r404.erros.some((e) => /portfolio responde 404/.test(e)));
});

test('criar: operações só com campanha em PAUSED; garantirPausa recusa o resto', () => {
  const { erros, p } = plano(ESPEC);
  assert.deepEqual(erros, []);
  const { ops } = operacoes(p, '1112223333');
  const camp = ops.filter((o) => o.campaignOperation);
  assert.equal(camp.length, 1);
  assert.equal(camp[0].campaignOperation.create.status, CAMPANHA_PAUSADA);
  assert.equal(camp[0].campaignOperation.create.targetSpend.cpcBidCeilingMicros, '2300000');
  assert.equal(ops.find((o) => o.adGroupAdOperation).adGroupAdOperation.create.ad.responsiveSearchAd.headlines[0].pinnedField, 'HEADLINE_1');
  assert.throws(() => garantirPausa([{ campaignOperation: { create: { status: 'ENABLED' } } }]), ErroAds);
  assert.throws(() => garantirPausa([{ campaignOperation: { update: { status: 'ENABLED' } } }]), ErroAds);
});

test('criar: sem --confirmar só validateOnly, e aborta se o nome já existe', async () => {
  const raiz = mkdtempSync(join(tmpdir(), 'mkt-camp-'));
  try {
    mkdirSync(join(raiz, 'clientes', 'teste', 'campanhas'), { recursive: true });
    writeFileSync(join(raiz, 'clientes', 'teste', 'dossier.md'), '---\ncanais:\n  - tipo: google-ads\n    id: 111-222-3333\n    acesso: true\n---\n');
    writeFileSync(join(raiz, 'clientes', 'teste', 'campanhas', 'GADS_Teste_2026-10.md'), ESPEC);
    const envios = [];
    const api = (existe) => async () => ({
      gaql: async (q) => (existe && /FROM campaign WHERE campaign.name/.test(q) ? [{ campaign: { id: 1, name: 'GADS_Teste_2026-10', status: 'PAUSED' } }] : []),
      mutateTudo: async (ops, o) => { envios.push(o); return {}; },
    });
    const r = await criar('teste', 'GADS_Teste_2026-10', { raiz, obter: ok200, ligar: api(false) });
    assert.ok(r.ok, r.linhas.join('\n'));
    assert.deepEqual(envios, [{ validar: true }]);
    const r2 = await criar('teste', 'GADS_Teste_2026-10', { raiz, obter: ok200, ligar: api(true) });
    assert.equal(r2.ok, false);
    assert.equal(envios.length, 1, 'nada enviado quando já existe');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('pesquisa: Planeador com acesso Explorer → recusa declarada, sem volumes', async () => {
  const api = { chamar: async () => { const e = new ErroAds('403'); e.codigos = ['DEVELOPER_TOKEN_NOT_APPROVED']; throw e; } };
  const r = await ideiasDoPlaneador(api, ['empresa de apps']);
  assert.match(r.recusado, /DEVELOPER_TOKEN_NOT_APPROVED/);
  assert.equal(r.ideias, undefined);
});

test('csv e investimento: Paused, BOM, horário legível', () => {
  const { out } = ficheiros(plano(ESPEC).p, '1112223333');
  assert.ok(out['01a-campanhas.csv'].startsWith('﻿Action,'));
  assert.match(out['01a-campanhas.csv'], /,Paused,GADS_Teste_2026-10,/);
  assert.equal(horarioTexto(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].map((dia) => ({ dia, inicio: 8, fim: 20 }))), 'seg–sex 08–20');
});
