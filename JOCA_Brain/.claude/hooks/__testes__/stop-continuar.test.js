// Testes do stop-continuar.js — `node --test ".claude/hooks/__testes__/*.test.js"`
// Cada teste corre o hook num diretório temporário com um contrato de sessão FALSA; nunca toca em
// .joca/loop/*.json reais. HOOK_STOP=<caminho> aponta a uma cópia (teste de mutação).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = process.env.HOOK_STOP || path.join(__dirname, '..', 'stop-continuar.js');
const SID = 'teste-falso-stop';
const H = 3600 * 1000;

function cenario(contrato, { mtimeHorasAtras = 0 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-stop-'));
  fs.mkdirSync(path.join(dir, '.joca', 'loop'), { recursive: true });
  const f = path.join(dir, '.joca', 'loop', `${SID}.json`);
  if (contrato) {
    fs.writeFileSync(f, JSON.stringify({ sessao: SID, criado: new Date().toISOString(), ...contrato }, null, 2));
    if (mtimeHorasAtras) { const t = new Date(Date.now() - mtimeHorasAtras * H); fs.utimesSync(f, t, t); }
  }
  return { dir, f };
}
function correr(dir, extra = {}) {
  const r = spawnSync(process.execPath, [HOOK], { cwd: dir, input: JSON.stringify({ session_id: SID, ...extra }), encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  let json = null; try { json = JSON.parse(out); } catch (_) {}
  return { out, bloqueia: Boolean(json && json.decision === 'block'), reason: (json && json.reason) || '' };
}
const ler = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

test('sem contrato → silêncio', () => {
  const { dir } = cenario(null);
  assert.strictEqual(correr(dir).out, '');
});

test('passo pendente simples → bloqueia', () => {
  const { dir } = cenario({ passos: [{ id: 'a', estado: 'pendente', desc: 'x' }] });
  const r = correr(dir);
  assert.ok(r.bloqueia); assert.match(r.reason, /passo pendente "a"/);
});

test('stop_hook_active → nunca bloqueia', () => {
  const { dir } = cenario({ passos: [{ id: 'a', estado: 'pendente' }] });
  assert.strictEqual(correr(dir, { stop_hook_active: true }).out, '');
});

// C1a — T129 T203 T205 T233 T245
test('depende_de de passo em_curso → não insiste nem conta iteração', () => {
  const { dir, f } = cenario({ iteracao: 1, passos: [
    { id: 'a', estado: 'em_curso', agente: 'ag1' },
    { id: 'b', estado: 'pendente', depende_de: ['a'] },
  ] });
  const r = correr(dir);
  assert.ok(!r.bloqueia, r.out); assert.match(r.out, /à espera \(depende_de\): b←a/);
  assert.strictEqual(ler(f).iteracao, 1);
});

test('depende_de em string também é aceite', () => {
  const { dir } = cenario({ passos: [{ id: 'a', estado: 'em_curso', agente: 'ag1' }, { id: 'b', estado: 'pendente', depende_de: 'a' }] });
  assert.ok(!correr(dir).bloqueia);
});

test('depende_de de passo pendente → insiste no predecessor, não no dependente', () => {
  const { dir } = cenario({ passos: [{ id: 'b', estado: 'pendente', depende_de: ['a'] }, { id: 'a', estado: 'pendente' }] });
  const r = correr(dir);
  assert.ok(r.bloqueia); assert.match(r.reason, /passo pendente "a"/);
});

test('depende_de de passo verificado → o dependente é exigido', () => {
  const { dir } = cenario({ passos: [{ id: 'a', estado: 'verificado', produtor: 'x', verificador: 'y' }, { id: 'b', estado: 'pendente', depende_de: ['a'] }] });
  const r = correr(dir);
  assert.ok(r.bloqueia); assert.match(r.reason, /passo pendente "b"/);
});

test('ciclo de depende_de sem nada em curso → bloqueia a avisar', () => {
  const { dir } = cenario({ passos: [{ id: 'a', estado: 'pendente', depende_de: ['b'] }, { id: 'b', estado: 'pendente', depende_de: ['a'] }] });
  const r = correr(dir);
  assert.ok(r.bloqueia); assert.match(r.reason, /ciclo/);
});

test('depende_de de id inexistente é ignorado', () => {
  const { dir } = cenario({ passos: [{ id: 'b', estado: 'pendente', depende_de: ['nao-existe'] }] });
  const r = correr(dir);
  assert.ok(r.bloqueia); assert.match(r.reason, /passo pendente "b"/);
});

// C1b — T008 T025 T029 T120 T129 T259 (verificação conjunta)
test('feitos com verificacao conjunta pendente → insiste na varredura, não pede verificador por passo', () => {
  const { dir } = cenario({ passos: [
    { id: 'p1', estado: 'feito', produtor: 'ag1', verificacao: 'v' },
    { id: 'p2', estado: 'feito', produtor: 'ag2', verificacao: 'varredura:v' },
    { id: 'v', estado: 'pendente', depende_de: ['p1', 'p2'] },
  ] });
  const r = correr(dir);
  assert.ok(r.bloqueia); assert.match(r.reason, /passo pendente "v"/);
  assert.doesNotMatch(r.reason, /FEITO mas por VERIFICAR/);
});

test('varredura em curso → turno termina sem insistir', () => {
  const { dir } = cenario({ passos: [
    { id: 'p1', estado: 'feito', verificacao: 'v' }, { id: 'p2', estado: 'feito', verificacao: 'v' },
    { id: 'v', estado: 'em_curso', agente: 'rev1' },
  ] });
  const r = correr(dir);
  assert.ok(!r.bloqueia, r.out); assert.match(r.out, /verificação conjunta por correr: p1→v, p2→v/);
});

test('varredura feita → pede para marcar os passos cobertos verificado', () => {
  const { dir } = cenario({ passos: [
    { id: 'p1', estado: 'feito', produtor: 'ag1', verificacao: 'v' },
    { id: 'v', estado: 'verificado', produtor: 'rev1', verificador: 'rev2' },
  ] });
  const r = correr(dir);
  assert.ok(r.bloqueia); assert.match(r.reason, /verificação conjunta "v" já correu — marca o passo "p1"/);
});

test('verificacao para id inexistente → tratado como feito sem verificação', () => {
  const { dir } = cenario({ passos: [{ id: 'p1', estado: 'feito', verificacao: 'fantasma' }] });
  const r = correr(dir);
  assert.ok(r.bloqueia); assert.match(r.reason, /FEITO mas por VERIFICAR/);
});

// T167 — diferida
test('verificacao diferida → aceite e listada', () => {
  const { dir } = cenario({ passos: [{ id: 'ci', estado: 'feito', verificacao: 'diferida:após o push' }] });
  const r = correr(dir);
  assert.ok(!r.bloqueia, r.out); assert.match(r.out, /verificação diferida: ci \(após o push\)/);
});

// T214 — bloqueada
test('verificacao bloqueada com motivo → aceite e manda reportar', () => {
  const { dir } = cenario({ passos: [{ id: 'cron', estado: 'feito', verificacao: 'bloqueada:sem SSH, browser exclusivo' }] });
  const r = correr(dir);
  assert.ok(!r.bloqueia, r.out); assert.match(r.out, /BLOQUEADA — reporta ao utilizador: cron \(sem SSH/);
});

test('verificacao bloqueada sem motivo → não conta', () => {
  const { dir } = cenario({ passos: [{ id: 'cron', estado: 'feito', verificacao: 'bloqueada:' }] });
  const r = correr(dir);
  assert.ok(r.bloqueia); assert.match(r.reason, /FEITO mas por VERIFICAR/);
});

test('passo por fechar + aceites → bloqueia pelo por fechar e lista os aceites', () => {
  const { dir } = cenario({ passos: [{ id: 'ci', estado: 'feito', verificacao: 'diferida:push' }, { id: 'x', estado: 'pendente' }] });
  const r = correr(dir);
  assert.ok(r.bloqueia); assert.match(r.reason, /passo pendente "x"/); assert.match(r.reason, /Não insisto — verificação diferida: ci/);
});

// C3 — T219: TTL desde a última escrita
test('criado há 7 h mas escrito agora → não expira', () => {
  const { dir, f } = cenario({ criado: new Date(Date.now() - 7 * H).toISOString(), passos: [{ id: 'a', estado: 'pendente' }] });
  const r = correr(dir);
  assert.ok(r.bloqueia, r.out); assert.ok(fs.existsSync(f));
});

test('sem escrita há 7 h → expira, apaga e regista em _apagados.log', () => {
  const { dir, f } = cenario({ criado: new Date(Date.now() - 7 * H).toISOString(), passos: [{ id: 'a', estado: 'pendente' }] }, { mtimeHorasAtras: 7 });
  const r = correr(dir);
  assert.ok(!r.bloqueia); assert.match(r.out, /expirado/); assert.ok(!fs.existsSync(f));
  assert.match(fs.readFileSync(path.join(dir, '.joca', 'loop', '_apagados.log'), 'utf8'), /expirado/);
});

test('expirado com passos em_curso → NÃO é apagado', () => {
  const { dir, f } = cenario({ criado: new Date(Date.now() - 7 * H).toISOString(), passos: [{ id: 'a', estado: 'em_curso', agente: 'x' }, { id: 'b', estado: 'pendente' }] }, { mtimeHorasAtras: 7 });
  const r = correr(dir);
  assert.match(r.out, /NÃO removido/); assert.ok(fs.existsSync(f));
});

test('a escrita do próprio hook não renova o TTL', () => {
  const { dir, f } = cenario({ criado: new Date(Date.now() - 5 * H).toISOString(), passos: [{ id: 'a', estado: 'pendente' }] }, { mtimeHorasAtras: 5 });
  const antes = fs.statSync(f).mtimeMs;
  assert.ok(correr(dir).bloqueia);
  assert.ok(Math.abs(fs.statSync(f).mtimeMs - antes) < 2000, 'mtime mudou');
  assert.strictEqual(ler(f).iteracao, 1);
});

test('contrato sem criado: o hook não grava «agora» (não renova o TTL)', () => {
  const { dir, f } = cenario({ criado: undefined, passos: [{ id: 'a', estado: 'pendente' }] }, { mtimeHorasAtras: 5 });
  assert.ok(correr(dir).bloqueia);
  assert.ok(Date.now() - Date.parse(ler(f).criado) > 4.9 * H, `criado gravado: ${ler(f).criado}`);
  // 2 h depois (7 h sem escrita do modelo) tem de expirar
  const t = new Date(Date.now() - 7 * H); fs.utimesSync(f, t, t);
  const c = ler(f); c.criado = new Date(Date.parse(c.criado) - 2 * H).toISOString(); fs.writeFileSync(f, JSON.stringify(c)); fs.utimesSync(f, t, t);
  assert.match(correr(dir).out, /expirado/); assert.ok(!fs.existsSync(f));
});

// Comportamento de hoje (regressão)
test('todos verificado → apaga o contrato e regista', () => {
  const { dir, f } = cenario({ passos: [{ id: 'a', estado: 'verificado', produtor: 'x', verificador: 'y' }] });
  const r = correr(dir);
  assert.match(r.out, /contrato fechado/); assert.ok(!fs.existsSync(f));
  assert.match(fs.readFileSync(path.join(dir, '.joca', 'loop', '_apagados.log'), 'utf8'), /todos os passos verificados/);
});

test('verificado pelo próprio produtor → bloqueia', () => {
  const { dir } = cenario({ passos: [{ id: 'a', estado: 'verificado', produtor: 'x', verificador: 'x' }] });
  assert.match(correr(dir).reason, /verificado pelo próprio produtor/);
});

test('turno de espera não sobe a iteração', () => {
  const { dir, f } = cenario({ passos: [{ id: 'a', estado: 'em_curso', agente: 'x' }, { id: 'b', estado: 'pendente' }] });
  correr(dir); const i1 = ler(f).iteracao;
  correr(dir); assert.strictEqual(ler(f).iteracao, i1);
});

test('travão max_iteracoes', () => {
  const { dir } = cenario({ iteracao: 4, max_iteracoes: 4, passos: [{ id: 'a', estado: 'pendente' }] });
  const r = correr(dir);
  assert.ok(!r.bloqueia); assert.match(r.out, /Travão: 5 iterações/);
});

test('aguarda_utilizador → silêncio', () => {
  const { dir } = cenario({ aguarda_utilizador: true, passos: [{ id: 'a', estado: 'pendente' }] });
  assert.strictEqual(correr(dir).out, '');
});
