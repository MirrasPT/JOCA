// scripts/estado.mjs — CONTRATO §3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ler, marcar, aprovar, revisao, cicloNovo, estadoPadrao, validarEstado, CANAIS } from '../scripts/estado.mjs';

const ESTADO = fileURLToPath(new URL('../scripts/estado.mjs', import.meta.url));
const novaRaiz = () => mkdtempSync(join(tmpdir(), 'mkt-estado-'));
const HOJE = new Date(2026, 9, 1);
const f = (raiz, slug) => join(raiz, 'clientes', slug, 'estado.json');

test('ler: cria o default (ciclo do mês, F0, passos pendentes) e grava-o', () => {
  const raiz = novaRaiz();
  const e = ler('marca', { raiz, hoje: HOJE });
  assert.equal(e.ciclo, '2026-10');
  assert.equal(e.fase, 'F0');
  assert.deepEqual(e.aprovacoes, { proposta: null, artes: null });
  assert.ok(Object.values(e.passos).every((p) => p === 'pendente'));
  assert.deepEqual(JSON.parse(readFileSync(f(raiz, 'marca'), 'utf8')), e);
  // 2.ª leitura não reescreve
  assert.deepEqual(ler('marca', { raiz, hoje: new Date(2027, 0, 1) }), e);
});

test('marcar: fase passa para a primeira não-feita; próxima ação opcional', () => {
  const raiz = novaRaiz();
  let e = marcar('m', 'F0', 'feito', undefined, { raiz, hoje: HOJE });
  assert.equal(e.fase, 'F1');
  e = marcar('m', 'F1', 'em_curso', 'correr mkt-auditoria', { raiz, hoje: HOJE });
  assert.equal(e.fase, 'F1');
  assert.equal(e.proxima_accao, 'correr mkt-auditoria');
  e = marcar('m', 'F1', 'feito', undefined, { raiz, hoje: HOJE });
  assert.equal(e.fase, 'F2');
  assert.equal(e.proxima_accao, 'correr mkt-auditoria');
  assert.throws(() => marcar('m', 'F9', 'feito', undefined, { raiz }), /fase inválida/);
  assert.throws(() => marcar('m', 'F2', 'acabado', undefined, { raiz }), /estado inválido/);
});

test('aprovar e revisao: data de hoje; canal e data validados', () => {
  const raiz = novaRaiz();
  assert.equal(aprovar('m', 'proposta', { raiz, hoje: HOJE }).aprovacoes.proposta, '2026-10-01');
  assert.throws(() => aprovar('m', 'tudo', { raiz }), /aprovação inválida/);
  const e = revisao('m', 'google-ads', '2026-10-15', 'fim da aprendizagem (14 dias)', { raiz, hoje: HOJE });
  assert.deepEqual(e.revisoes, [{ canal: 'google-ads', data: '2026-10-15', motivo: 'fim da aprendizagem (14 dias)' }]);
  assert.throws(() => revisao('m', 'myspace', '2026-10-15', 'x', { raiz }), /canal inválido/);
  assert.throws(() => revisao('m', 'ga4', '2026-02-30', 'x', { raiz }), /data inválida/);
  assert.throws(() => revisao('m', 'ga4', '2026-10-15', '  ', { raiz }), /motivo/);
});

test('ciclo-novo: mês atual, F0 feito, F1 a seguir, aprovações limpas, revisões futuras mantidas', () => {
  const raiz = novaRaiz();
  const set = new Date(2026, 8, 3);
  for (const fase of ['F0', 'F1', 'F2', 'F3', 'F4', 'F5']) marcar('m', fase, 'feito', undefined, { raiz, hoje: set });
  aprovar('m', 'artes', { raiz, hoje: set });
  revisao('m', 'ga4', '2026-10-20', 'rever', { raiz, hoje: set });
  const e = cicloNovo('m', { raiz, hoje: HOJE });
  assert.equal(e.ciclo, '2026-10');
  assert.equal(e.fase, 'F1');
  assert.equal(e.passos.F0, 'feito');
  assert.equal(e.passos.F5, 'pendente');
  assert.deepEqual(e.aprovacoes, { proposta: null, artes: null });
  assert.equal(e.revisoes.length, 1);
  assert.deepEqual(e.revisoes_anteriores, []);
});

// B3 (CONTRATO §3): no mesmo mês abre AAAA-MM-2, depois -3…; não exige F5 feito.
test('B3 ciclo-novo no mesmo mês abre AAAA-MM-2, depois -3; noutro mês volta a AAAA-MM', () => {
  const raiz = novaRaiz();
  ler('m', { raiz, hoje: HOJE });
  let e = cicloNovo('m', { raiz, hoje: HOJE });
  assert.equal(e.ciclo, '2026-10-2');
  assert.equal(e.fase, 'F1');
  e = cicloNovo('m', { raiz, hoje: new Date(2026, 9, 20) });
  assert.equal(e.ciclo, '2026-10-3');
  e = cicloNovo('m', { raiz, hoje: new Date(2026, 10, 2) });
  assert.equal(e.ciclo, '2026-11');
  assert.deepEqual(validarEstado(e, 'm'), []);
});

// I4: revisao substitui a do mesmo canal; ciclo-novo arquiva as cumpridas (data ≤ hoje).
test('I4 revisao substitui a do mesmo canal; ciclo-novo move as passadas para revisoes_anteriores', () => {
  const raiz = novaRaiz();
  revisao('m', 'google-ads', '2026-09-20', 'estimada na F2', { raiz, hoje: HOJE });
  revisao('m', 'meta-ads', '2026-10-01', 'fim da aprendizagem', { raiz, hoje: HOJE });
  let e = revisao('m', 'google-ads', '2026-10-15', 'final da F4', { raiz, hoje: HOJE });
  assert.deepEqual(e.revisoes.filter((r) => r.canal === 'google-ads'), [{ canal: 'google-ads', data: '2026-10-15', motivo: 'final da F4' }]);
  assert.equal(e.revisoes.length, 2);
  e = cicloNovo('m', { raiz, hoje: HOJE });
  assert.deepEqual(e.revisoes, [{ canal: 'google-ads', data: '2026-10-15', motivo: 'final da F4' }]);
  assert.deepEqual(e.revisoes_anteriores, [{ canal: 'meta-ads', data: '2026-10-01', motivo: 'fim da aprendizagem' }]);
  e = cicloNovo('m', { raiz, hoje: new Date(2026, 9, 16) });
  assert.deepEqual(e.revisoes, []);
  assert.deepEqual(e.revisoes_anteriores.map((r) => r.canal), ['meta-ads', 'google-ads']);
});

// I5: seo e offline (CONTRATO §4, só para datas de revisão).
test('I5 revisao aceita os canais seo e offline', () => {
  const raiz = novaRaiz();
  assert.ok(CANAIS.includes('seo') && CANAIS.includes('offline'));
  revisao('m', 'seo', '2026-11-01', 'posições', { raiz, hoje: HOJE });
  const e = revisao('m', 'offline', '2026-11-05', 'folhetos', { raiz, hoje: HOJE });
  assert.deepEqual(e.revisoes.map((r) => r.canal), ['seo', 'offline']);
});

test('estado.json ilegível: erro e não se sobrescreve; slug inválido recusado', () => {
  const raiz = novaRaiz();
  mkdirSync(join(raiz, 'clientes', 'm'), { recursive: true });
  writeFileSync(f(raiz, 'm'), '{partido');
  assert.throws(() => marcar('m', 'F1', 'feito', undefined, { raiz }), /ilegível/);
  assert.equal(readFileSync(f(raiz, 'm'), 'utf8'), '{partido');
  for (const s of ['../fora', 'A', '', 'a/b']) assert.throws(() => ler(s, { raiz }), /slug inválido/);
  assert.ok(!existsSync(join(raiz, 'fora')));
});

test('escrita atómica: sem temporários deixados na pasta', () => {
  const raiz = novaRaiz();
  for (let i = 0; i < 5; i++) marcar('m', 'F1', i % 2 ? 'feito' : 'em_curso', undefined, { raiz, hoje: HOJE });
  assert.deepEqual(readdirSync(join(raiz, 'clientes', 'm')), ['estado.json']);
});

test('estado antigo parcial completa-se sem perder campos', () => {
  const raiz = novaRaiz();
  mkdirSync(join(raiz, 'clientes', 'm'), { recursive: true });
  writeFileSync(f(raiz, 'm'), JSON.stringify({ slug: 'm', ciclo: '2026-09', fase: 'F2', passos: { F1: 'feito' }, extra: 'fica' }));
  const e = marcar('m', 'F0', 'feito', undefined, { raiz, hoje: HOJE });
  assert.equal(e.extra, 'fica');
  assert.equal(e.ciclo, '2026-09');
  assert.equal(e.fase, 'F2');
  assert.deepEqual(Object.keys(e.passos), Object.keys(estadoPadrao('m').passos));
});

test('CLI: MARKETEER_RAIZ, saída JSON e erros com saída 1', () => {
  const raiz = novaRaiz();
  const env = { ...process.env, MARKETEER_RAIZ: raiz };
  const correr = (...a) => spawnSync(process.execPath, [ESTADO, ...a], { encoding: 'utf8', env, cwd: tmpdir() });
  let r = correr('ler', 'cli-teste');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).fase, 'F0');
  r = correr('marcar', 'cli-teste', 'F0', 'feito', 'arrancar F1');
  assert.equal(JSON.parse(r.stdout).fase, 'F1');
  r = correr('revisao', 'cli-teste', 'meta-ads', '2026-11-02', 'rever criativos');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(readFileSync(f(raiz, 'cli-teste'), 'utf8')).revisoes[0].canal, 'meta-ads');
  for (const a of [['xpto', 'cli-teste'], ['marcar', 'cli-teste', 'F1'], ['aprovar', 'cli-teste', 'nada'], []]) {
    const e = correr(...a);
    assert.equal(e.status, 1, a.join(' '));
    assert.equal(e.stdout, '');
  }
});
