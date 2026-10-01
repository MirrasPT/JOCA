// Correcções da verificação independente do #6: negativas fora de tabela avisadas, csv valida antes
// de gerar, falha nos objectivos depois de criar não perde a campanha nem a verificação.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validar } from '../scripts/campanha/validar.mjs';
import { gerarCsv } from '../scripts/campanha/csv.mjs';
import { criar } from '../scripts/campanha/criar.mjs';
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
  objectivos: { contar: [SUBMIT_LEAD_FORM] }
---
# Teste

**G1 · Empresa de apps**
\`\`\`
"empresa de apps"
[empresa de apps]
\`\`\`

## 5. Palavras-chave negativas

| Tema | Negativas |
|---|---|
| Grátis | \`gratis\` |

### 5.3 Negativas entre campanhas

Na campanha nova excluir \`"software à medida"\`, \`faturas\` e "automação".

## 6. RSA

### G1 · Empresa de apps

| # | Título | Car. |
|---|---|---|
| 1 | Empresa de apps | 15 |
| 2 | Apps à medida | 13 |
| 3 | Fale connosco | 13 |

| # | Descrição | Car. |
|---|---|---|
| D1 | Desenvolvemos apps para empresas. | 33 |
| D2 | Peça orçamento pelo site. | 25 |
`;

const ok200 = async () => ({ status: 200, headers: { get: () => null } });

function raizCom(texto) {
  const raiz = mkdtempSync(join(tmpdir(), 'mkt-corr-'));
  mkdirSync(join(raiz, 'clientes', 'teste', 'campanhas'), { recursive: true });
  writeFileSync(join(raiz, 'clientes', 'teste', 'dossier.md'), '---\ncanais:\n  - tipo: google-ads\n    id: 111-222-3333\n    acesso: true\n---\n');
  writeFileSync(join(raiz, 'clientes', 'teste', 'campanhas', 'GADS_Teste_2026-10.md'), texto);
  return raiz;
}

test('validar: negativas em prosa numa secção de negativas → aviso com secção e contagem; não entram', async () => {
  const r = await validar(ESPEC, { obter: ok200 });
  assert.deepEqual(r.erros, []);
  const aviso = r.avisos.find((a) => /fora de tabela/.test(a));
  assert.ok(aviso, r.avisos.join(' | '));
  assert.match(aviso, /5\.3 Negativas entre campanhas/);
  assert.match(aviso, /\b3 termo/);
  assert.equal(r.resumo.negativas, 1, 'só a da tabela conta');
  const semProsa = await validar(ESPEC.replace(/Na campanha nova excluir.*\n/, ''), { obter: ok200 });
  assert.ok(!semProsa.avisos.some((a) => /fora de tabela/.test(a)));
});

test('csv: especificação que não passa o validador → nada gerado e ok=false', async () => {
  const mas = [
    ESPEC.replace('| 2 | Apps à medida | 13 |', '| 2 | Ligue 222 000 111 | 17 |'),
    ESPEC.replace('| 3 | Fale connosco | 13 |', '| 3 | TODO | 4 |'),
    ESPEC.replace('| 3 | Fale connosco | 13 |', '| 3 | Um título demasiado comprido para caber | 39 |'),
    ESPEC.replace('`gratis`', '`apps`'),
  ];
  for (const texto of mas) {
    const raiz = raizCom(texto);
    try {
      const r = await gerarCsv('teste', 'GADS_Teste_2026-10', { raiz });
      assert.equal(r.ok, false);
      assert.ok(r.linhas.some((l) => l.startsWith('✗')));
      assert.ok(!existsSync(join(raiz, 'clientes', 'teste', 'campanhas', 'GADS_Teste_2026-10-carregamento')));
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  }
  const raiz = raizCom(ESPEC);
  try {
    assert.equal((await gerarCsv('teste', 'GADS_Teste_2026-10', { raiz })).ok, true);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('criar --confirmar: falha nos objectivos reporta a campanha criada e corre a verificação GAQL', async () => {
  const raiz = raizCom(ESPEC);
  try {
    const consultas = [];
    const ligar = async () => ({
      gaql: async (q) => {
        consultas.push(q);
        if (/FROM campaign_conversion_goal/.test(q)) return [{ campaignConversionGoal: { resourceName: 'customers/1/campaignConversionGoals/9~SUBMIT_LEAD_FORM~WEBSITE', category: 'SUBMIT_LEAD_FORM', origin: 'WEBSITE', biddable: false } }];
        return [];
      },
      mutateTudo: async () => ({ mutateOperationResponses: [{ campaignResult: { resourceName: 'customers/1112223333/campaigns/777' } }] }),
      mutate: async () => { throw new ErroAds('mutate campaignConversionGoals falhou (HTTP 400): X'); },
    });
    const r = await criar('teste', 'GADS_Teste_2026-10', { raiz, obter: ok200, ligar, confirmar: true });
    assert.equal(r.ok, false);
    assert.ok(r.linhas.some((l) => /criada em pausa: customers\/1112223333\/campaigns\/777/.test(l)));
    assert.ok(r.linhas.some((l) => /objectivos não aplicados/.test(l) && /777/.test(l)));
    assert.ok(r.linhas.some((l) => /campanhas activas novas/.test(l)), 'verificação GAQL não correu');
    assert.ok(consultas.some((q) => /campaign.id = 777/.test(q) && /FROM campaign WHERE/.test(q)));
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});
