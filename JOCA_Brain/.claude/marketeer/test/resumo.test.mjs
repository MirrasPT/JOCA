// Testes do resumo.mjs (#10), escritos a partir dos critérios de aceitação do issue, do comentário
// da varredura da onda 2 (acesso confirmado pelo cofre) e de D-012/D-013 — não a partir do corpo de
// resumo.mjs. Tudo corre em raízes temporárias; o cofre é sempre injectado (ou, no CLI, um HOME
// temporário). Nunca se lê o cofre real nem há rede.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { verCliente, mostrarResumo, ordenarAuditorias, listarClientes } from '../scripts/resumo.mjs';
import { CHAVES_DO_COFRE } from '../scripts/chaves.mjs';
import { validarDossier } from '../scripts/validar-dossier.mjs';
import { validarAuditoria } from '../scripts/auditoria/formato.mjs';
import { guardar } from '../scripts/cofre.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const RESUMO = join(RAIZ, 'scripts', 'resumo.mjs');
const SLUG = 'padaria-teste';
const SEGREDO = `sk-TESTE-${randomBytes(16).toString('hex')}`;

const pastas = [];
after(() => pastas.forEach((p) => rmSync(p, { recursive: true, force: true })));
const novaPasta = () => {
  const p = mkdtempSync(join(tmpdir(), 'marketeer-ver-'));
  pastas.push(p);
  return p;
};

// Cofre injectado: nunca devolve nada (nenhuma credencial guardada).
const cofreVazio = () => null;
// Chaves próprias dos testes: não dependem da tabela real (que pode crescer com o #8).
const CHAVES = { ga4: ['GA4_KEY'], meta: ['META_TOKEN'] };

const dossier = (slug, canais = [{ tipo: 'ga4', acesso: false }]) => `---
cliente:
  nome: Padaria Teste
  slug: ${slug}
  sector: restauração
  site: https://padaria.invalid
  responsavel: equipa
marca: <sem fonte>
publico: <sem fonte>
objectivos: []
concorrentes: []
canais:
${canais.map((c) => `  - tipo: ${c.tipo}\n    id: <sem fonte>\n    acesso: ${c.acesso}`).join('\n')}
estado: auditoria em curso
actualizado: 2026-09-20
---

# Padaria Teste
`;

function criarCliente(raiz, slug = SLUG, canais) {
  const pasta = join(raiz, 'clientes', slug);
  mkdirSync(pasta, { recursive: true });
  const texto = dossier(slug, canais);
  assert.deepEqual(validarDossier(texto, slug), [], 'a fixture do dossier tem de ser válida');
  writeFileSync(join(pasta, 'dossier.md'), texto);
  return pasta;
}

const achado = (severidade, n) => ({
  area: 'seo',
  regra: `seo.regra-${severidade}-${n}`,
  severidade,
  evidencia: `https://padaria.invalid/ — medição ${severidade} ${n}`,
  recomendacao: `Corrigir ${severidade} ${n}.`,
  skill: 'seo',
});

function auditoria(data, achados = []) {
  return {
    cliente: SLUG,
    data,
    metodo: '0.1.0',
    areas: [
      { area: 'seo', estado: 'verificado' },
      { area: 'contas.ga4', estado: 'nao-verificado', nota: 'sem credencial no cofre' },
    ],
    achados,
  };
}

// nome: sem ".json" (ex.: "2026-09-24-2"). A fixture é validada pelo formato real (D-012).
function gravarAuditoria(raiz, nome, a, slug = SLUG) {
  const dir = join(raiz, 'clientes', slug, 'auditorias');
  mkdirSync(dir, { recursive: true });
  const texto = JSON.stringify({ ...a, cliente: slug }, null, 2);
  assert.deepEqual(validarAuditoria(texto, slug, nome), [], `a fixture ${nome} tem de ser válida`);
  writeFileSync(join(dir, `${nome}.json`), texto);
}

const correrCli = (args, env = {}) =>
  spawnSync(process.execPath, [RESUMO, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });

// --- Critério 1: data e top dos achados críticos/altos da última auditoria ---

test('mostra a data da última auditoria e só achados críticos/altos no top', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  gravarAuditoria(raiz, '2026-09-24', auditoria('2026-09-24', [
    achado('media', 1), achado('alta', 1), achado('baixa', 1), achado('critica', 1),
  ]));
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.equal(r.existe, true);
  assert.equal(r.slug, SLUG);
  assert.equal(r.nome, 'Padaria Teste');
  assert.ok(r.auditoria, 'há auditoria');
  assert.equal(r.auditoria.data, '2026-09-24');
  assert.match(r.auditoria.ficheiro, /2026-09-24\.json$/);
  const regras = r.auditoria.graves.map((g) => g.regra);
  assert.deepEqual([...regras].sort(), ['seo.regra-alta-1', 'seo.regra-critica-1']);
  assert.equal(regras[0], 'seo.regra-critica-1', 'a crítica vem antes da alta');
  assert.ok(r.auditoria.graves.every((g) => ['critica', 'alta'].includes(g.severidade)));
  assert.equal(r.auditoria.gravesOmitidos, 0);

  const texto = mostrarResumo(r);
  assert.match(texto, /2026-09-24/);
  assert.match(texto, /seo\.regra-critica-1/);
  assert.match(texto, /seo\.regra-alta-1/);
  assert.doesNotMatch(texto, /seo\.regra-media-1/);
  assert.doesNotMatch(texto, /seo\.regra-baixa-1/);
});

test('com mais de 5 achados graves: top de 5, críticos primeiro, e o resto contado em gravesOmitidos', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  const achados = [
    achado('alta', 1), achado('alta', 2), achado('alta', 3), achado('alta', 4),
    achado('critica', 1), achado('critica', 2), achado('critica', 3), achado('media', 1),
  ];
  gravarAuditoria(raiz, '2026-09-24', auditoria('2026-09-24', achados));
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.equal(r.auditoria.graves.length, 5);
  assert.equal(r.auditoria.gravesOmitidos, 2);
  const regras = r.auditoria.graves.map((g) => g.regra);
  for (const n of [1, 2, 3]) assert.ok(regras.includes(`seo.regra-critica-${n}`), `falta a crítica ${n}`);
  assert.deepEqual(r.auditoria.graves.slice(0, 3).map((g) => g.severidade), ['critica', 'critica', 'critica']);
  assert.ok(!regras.includes('seo.regra-media-1'));
  assert.match(mostrarResumo(r), /\+\s*2\b|\b2\b[^\n]*omitid/i, 'o texto indica os graves omitidos');
});

test('auditoria só com achados médios/baixos → top vazio, mas a data aparece', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  gravarAuditoria(raiz, '2026-09-24', auditoria('2026-09-24', [achado('media', 1), achado('baixa', 1)]));
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.deepEqual(r.auditoria.graves, []);
  assert.equal(r.auditoria.gravesOmitidos, 0);
  const texto = mostrarResumo(r);
  assert.match(texto, /2026-09-24/);
  assert.doesNotMatch(texto, /seo\.regra-media-1|seo\.regra-baixa-1/);
});

// --- Critério 1 (cont.): qual é a "última" auditoria (D-012: sufixo no mesmo dia) ---

test('ordenarAuditorias: data desc e, no mesmo dia, sufixo numérico (-10 > -9 > -2 > sem sufixo)', () => {
  const nomes = ['2026-09-24.json', '2026-09-24-2.json', '2026-09-23-9.json', '2026-09-24-10.json', '2026-09-24-9.json'];
  assert.deepEqual(ordenarAuditorias(nomes), [
    '2026-09-24-10.json', '2026-09-24-9.json', '2026-09-24-2.json', '2026-09-24.json', '2026-09-23-9.json',
  ]);
  assert.deepEqual(ordenarAuditorias(['2026-09-30-10.json', '2026-10-01.json'])[0], '2026-10-01.json');
});

test('verCliente escolhe a -10 e não a -2 do mesmo dia', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  gravarAuditoria(raiz, '2026-09-24', auditoria('2026-09-24', [achado('critica', 1)]));
  gravarAuditoria(raiz, '2026-09-24-2', auditoria('2026-09-24', [achado('critica', 2)]));
  gravarAuditoria(raiz, '2026-09-24-10', auditoria('2026-09-24', [achado('critica', 10)]));
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.match(r.auditoria.ficheiro, /2026-09-24-10\.json$/);
  assert.deepEqual(r.auditoria.graves.map((g) => g.regra), ['seo.regra-critica-10']);
});

test('verCliente: data mais recente ganha a um sufixo alto de um dia anterior', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  gravarAuditoria(raiz, '2026-09-30-10', auditoria('2026-09-30', [achado('critica', 30)]));
  gravarAuditoria(raiz, '2026-10-01', auditoria('2026-10-01', [achado('alta', 1)]));
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.equal(r.auditoria.data, '2026-10-01');
  assert.deepEqual(r.auditoria.graves.map((g) => g.regra), ['seo.regra-alta-1']);
});

// --- Critério 2: sem auditoria → di-lo e sugere /marketeer <marca> (I11: os subcomandos auditar/novo já não existem) ---

test('cliente sem pasta de auditorias → auditoria null e o texto sugere /marketeer <slug>', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.equal(r.existe, true);
  assert.equal(r.auditoria, null);
  const texto = mostrarResumo(r);
  assert.match(texto, /auditoria/i);
  assert.ok(texto.includes(`/marketeer ${SLUG}`), texto);
  assert.doesNotMatch(texto, /\/marketeer (novo|auditar)\b/);
});

test('pasta de auditorias vazia conta como sem auditoria', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  mkdirSync(join(raiz, 'clientes', SLUG, 'auditorias'));
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.equal(r.auditoria, null);
  assert.ok(mostrarResumo(r).includes(`/marketeer ${SLUG}`));
});

test('cliente com auditoria não recebe a sugestão de auditar como se não tivesse', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  gravarAuditoria(raiz, '2026-09-24', auditoria('2026-09-24', []));
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.ok(r.auditoria);
  assert.equal(r.auditoria.data, '2026-09-24');
});

// --- Critério 3: inexistente → lista os slugs existentes ---

function raizComVarios() {
  const raiz = novaPasta();
  criarCliente(raiz, 'alfa');
  criarCliente(raiz, 'beta');
  criarCliente(raiz, '_exemplo');
  mkdirSync(join(raiz, 'clientes', 'sem-dossier'), { recursive: true }); // pasta sem dossier.md
  return raiz;
}

test('listarClientes devolve os slugs com dossier, sem os que começam por "_"', () => {
  const raiz = raizComVarios();
  assert.deepEqual([...listarClientes(raiz)].sort(), ['alfa', 'beta']);
});

test('cliente inexistente → existe:false e lista os slugs existentes (sem _exemplo)', () => {
  const raiz = raizComVarios();
  const r = verCliente('gama', { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.equal(r.existe, false);
  assert.equal(r.slug, 'gama');
  assert.deepEqual([...r.clientes].sort(), ['alfa', 'beta']);
});

test('slug inválido (vazio, maiúsculas, com barra) → inexistente, sem lançar', () => {
  const raiz = raizComVarios();
  for (const s of ['', 'Alfa', 'alfa/..', 'alfa\\x']) {
    const r = verCliente(s, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
    assert.equal(r.existe, false, `"${s}" devia ser inexistente`);
    assert.deepEqual([...r.clientes].sort(), ['alfa', 'beta']);
  }
});

test('"../x" é inexistente e não lê o dossier de fora da raiz nem o cofre', () => {
  const base = novaPasta();
  const raiz = join(base, 'repo');
  criarCliente(raiz, 'alfa');
  // Um dossier válido fora de clientes/, exactamente onde "../x" apontaria.
  mkdirSync(join(raiz, 'x'), { recursive: true });
  writeFileSync(join(raiz, 'x', 'dossier.md'), dossier('x'));
  mkdirSync(join(raiz, 'clientes', '..', '..', 'x'), { recursive: true });
  writeFileSync(join(base, 'x', 'dossier.md'), dossier('x'));
  let chamadas = 0;
  const r = verCliente('../x', { raiz, lerCofre: () => { chamadas++; return SEGREDO; }, chaves: CHAVES });
  assert.equal(r.existe, false);
  assert.deepEqual(r.clientes, ['alfa']);
  assert.equal(chamadas, 0, 'o cofre não pode ser lido para um slug inválido');
});

test('CLI: cliente inexistente sai com 2 e lista os slugs em stderr (sem _exemplo)', () => {
  const raiz = raizComVarios();
  const r = correrCli(['gama', raiz], { HOME: novaPasta(), USERPROFILE: novaPasta() });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /alfa/);
  assert.match(r.stderr, /beta/);
  assert.doesNotMatch(r.stderr, /_exemplo/);
});

test('CLI: "../x" sai com 2', () => {
  const raiz = raizComVarios();
  const r = correrCli(['../x', raiz], { HOME: novaPasta(), USERPROFILE: novaPasta() });
  assert.equal(r.status, 2);
});

test('CLI: sem slug sai com 1', () => {
  const r = correrCli([], { HOME: novaPasta(), USERPROFILE: novaPasta() });
  assert.equal(r.status, 1);
});

test('dossier com YAML ilegível: verCliente lança e o CLI sai com 1', () => {
  const raiz = novaPasta();
  mkdirSync(join(raiz, 'clientes', SLUG), { recursive: true });
  writeFileSync(join(raiz, 'clientes', SLUG, 'dossier.md'), '---\ncliente: [aberto\n  nome: : :\n---\n');
  assert.throws(() => verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES }));
  const r = correrCli([SLUG, raiz], { HOME: novaPasta(), USERPROFILE: novaPasta() });
  assert.equal(r.status, 1);
});

test('CLI: cliente existente sai com 0 e imprime o resumo', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  gravarAuditoria(raiz, '2026-09-24', auditoria('2026-09-24', [achado('critica', 1)]));
  const r = correrCli([SLUG, raiz], { HOME: novaPasta(), USERPROFILE: novaPasta() });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /2026-09-24/);
  assert.match(r.stdout, /seo\.regra-critica-1/);
});

// --- Critério 4: não mostra valores do cofre, só se há acesso ---

test('o valor do cofre nunca aparece no resultado nem no texto — só booleanos', () => {
  const raiz = novaPasta();
  criarCliente(raiz, SLUG, [{ tipo: 'ga4', acesso: true }, { tipo: 'meta', acesso: true }]);
  const r = verCliente(SLUG, { raiz, lerCofre: () => SEGREDO, chaves: CHAVES });
  assert.ok(!JSON.stringify(r).includes(SEGREDO), 'o segredo aparece no resultado');
  assert.ok(!mostrarResumo(r).includes(SEGREDO), 'o segredo aparece no texto');
  // Nem um pedaço do valor (ex.: truncado ou mascarado só no fim).
  assert.ok(!JSON.stringify(r).includes(SEGREDO.slice(9, 25)));
  for (const c of r.contas) {
    assert.equal(c.cofre, true);
    assert.equal(c.acesso, true);
    assert.ok(Array.isArray(c.chaves) ? c.chaves.every((k) => typeof k === 'string' && !k.includes('sk-TESTE')) : true);
  }
});

test('CLI: com um cofre temporário que tem a credencial, o segredo não sai em stdout/stderr', () => {
  const raiz = novaPasta();
  criarCliente(raiz, SLUG, [{ tipo: 'ga4', acesso: true }]);
  const [chave] = CHAVES_DO_COFRE.ga4;
  assert.ok(chave, 'o ga4 tem de ter chave no cofre');

  const homeSem = novaPasta();
  const sem = correrCli([SLUG, raiz], { HOME: homeSem, USERPROFILE: homeSem });

  const home = novaPasta();
  guardar(SLUG, chave, SEGREDO, { base: join(home, '.config', 'marketeer') });
  const com = correrCli([SLUG, raiz], { HOME: home, USERPROFILE: home });

  assert.equal(com.status, 0, com.stderr);
  assert.ok(!com.stdout.includes(SEGREDO) && !com.stderr.includes(SEGREDO), 'o segredo saiu no CLI');
  // Prova de que o CLI leu mesmo o cofre temporário: com e sem credencial o resumo é diferente.
  assert.notEqual(com.stdout, sem.stdout, 'o CLI não leu o cofre do HOME temporário');
});

// --- Varredura da onda 2: o acesso confirma-se pelo cofre, não só pelo dossier ---

test('dossier diz acesso:true mas o cofre está vazio → acesso false e diverge', () => {
  const raiz = novaPasta();
  criarCliente(raiz, SLUG, [{ tipo: 'ga4', acesso: true }]);
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  const [c] = r.contas;
  assert.equal(c.tipo, 'ga4');
  assert.equal(c.dossier, true);
  assert.equal(c.cofre, false);
  assert.equal(c.acesso, false);
  assert.equal(c.diverge, true);
  assert.match(mostrarResumo(r), /⚠/, 'a divergência é sinalizada no texto');
});

test('dossier diz acesso:false mas o cofre tem a chave → acesso true e diverge', () => {
  const raiz = novaPasta();
  criarCliente(raiz, SLUG, [{ tipo: 'meta', acesso: false }]);
  const lidas = [];
  const r = verCliente(SLUG, { raiz, lerCofre: (s, k) => { lidas.push([s, k]); return k === 'META_TOKEN' ? SEGREDO : null; }, chaves: CHAVES });
  const [c] = r.contas;
  assert.equal(c.dossier, false);
  assert.equal(c.cofre, true);
  assert.equal(c.acesso, true);
  assert.equal(c.diverge, true);
  assert.deepEqual(lidas, [[SLUG, 'META_TOKEN']], 'o cofre é consultado com o slug e a chave do canal');
});

test('dossier e cofre de acordo → não diverge', () => {
  const raiz = novaPasta();
  criarCliente(raiz, SLUG, [{ tipo: 'ga4', acesso: true }, { tipo: 'meta', acesso: false }]);
  const r = verCliente(SLUG, { raiz, lerCofre: (s, k) => (k === 'GA4_KEY' ? SEGREDO : null), chaves: CHAVES });
  const porTipo = Object.fromEntries(r.contas.map((c) => [c.tipo, c]));
  assert.equal(porTipo.ga4.acesso, true);
  assert.equal(porTipo.ga4.diverge, false);
  assert.equal(porTipo.meta.acesso, false);
  assert.equal(porTipo.meta.diverge, false);
});

test('cofre a lançar → cofre e acesso null (por confirmar), sem lançar nem vazar a mensagem', () => {
  const raiz = novaPasta();
  criarCliente(raiz, SLUG, [{ tipo: 'ga4', acesso: true }]);
  const r = verCliente(SLUG, { raiz, lerCofre: () => { throw new Error(`EACCES ${SEGREDO}`); }, chaves: CHAVES });
  const [c] = r.contas;
  assert.equal(c.cofre, null);
  assert.equal(c.acesso, null);
  assert.ok(!JSON.stringify(r).includes(SEGREDO));
  assert.ok(!mostrarResumo(r).includes(SEGREDO));
});

test('canal sem chave conhecida no cofre → por confirmar (null), nunca "sim" pelo dossier', () => {
  const raiz = novaPasta();
  criarCliente(raiz, SLUG, [{ tipo: 'gbp', acesso: true }]);
  const r = verCliente(SLUG, { raiz, lerCofre: () => SEGREDO, chaves: CHAVES });
  const [c] = r.contas;
  assert.equal(c.cofre, null);
  assert.equal(c.acesso, null);
});

// --- Auditoria corrompida ou inválida → aviso e a anterior válida ---

test('última auditoria com JSON inválido → aviso e mostra a anterior válida, sem lançar', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  gravarAuditoria(raiz, '2026-09-20', auditoria('2026-09-20', [achado('critica', 1)]));
  writeFileSync(join(raiz, 'clientes', SLUG, 'auditorias', '2026-09-24.json'), '{ "cliente": "padaria-teste", ');
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.equal(r.auditoria.data, '2026-09-20');
  assert.match(r.auditoria.ficheiro, /2026-09-20\.json$/);
  assert.ok(r.avisos.some((a) => a.includes('2026-09-24')), JSON.stringify(r.avisos));
  assert.match(mostrarResumo(r), /2026-09-24/, 'o aviso chega ao texto');
});

test('última auditoria parseável mas inválida (sem evidência) → aviso e a anterior válida', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  gravarAuditoria(raiz, '2026-09-20', auditoria('2026-09-20', [achado('alta', 1)]));
  const ma = auditoria('2026-09-24', [{ ...achado('critica', 9), evidencia: '' }]);
  writeFileSync(join(raiz, 'clientes', SLUG, 'auditorias', '2026-09-24.json'), JSON.stringify({ ...ma, cliente: SLUG }));
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.equal(r.auditoria.data, '2026-09-20');
  assert.ok(!r.auditoria.graves.some((g) => g.regra === 'seo.regra-critica-9'));
  assert.ok(r.avisos.some((a) => a.includes('2026-09-24')));
});

test('única auditoria corrompida → sem auditoria, com aviso e sugestão de auditar', () => {
  const raiz = novaPasta();
  criarCliente(raiz);
  mkdirSync(join(raiz, 'clientes', SLUG, 'auditorias'));
  writeFileSync(join(raiz, 'clientes', SLUG, 'auditorias', '2026-09-24.json'), 'não é json');
  const r = verCliente(SLUG, { raiz, lerCofre: cofreVazio, chaves: CHAVES });
  assert.equal(r.auditoria, null);
  assert.ok(r.avisos.length > 0);
  assert.ok(mostrarResumo(r).includes(`/marketeer ${SLUG}`));
});

// --- Varredura: a skill `novo` deixa acesso:false quando o operador não tem a credencial ---
