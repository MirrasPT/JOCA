// F2.9 — escolha de modelo/effort por agente (modelos-agentes.mjs + gerador skill-agents.mjs).
// Corre numa raiz temporária (cópia dos 2 scripts + agentes/skills falsos); nunca toca no repo.
// Uso: node --test .claude/scripts/test/modelos-agentes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');

const CURADO = '---\r\nname: curado\r\ndescription: "curado de teste"\r\ntools:\r\n  - Bash\r\nmodel: opus\r\neffort: xhigh\r\n'
  + 'modelo-sugerido: sonnet\r\neffort-sugerido: low\r\nporque-modelo: "teste"\r\n---\r\ncorpo\r\n';
const SEM_SUGESTAO = '---\nname: semsug\ndescription: "pack"\nmodel: opus\neffort: high\n---\ncorpo\n';

function raiz() {
  const d = mkdtempSync(join(tmpdir(), 'joca-modelos-'));
  for (const p of ['.claude/scripts', '.claude/skills', '.claude/agents']) mkdirSync(join(d, p), { recursive: true });
  for (const s of ['modelos-agentes.mjs', 'skill-agents.mjs']) copyFileSync(join(SCRIPTS, s), join(d, '.claude/scripts', s));
  writeFileSync(join(d, '.claude/skills/frontend.md'), '---\nname: frontend\ndescription: "Frontend. Invoke on: website, webapp"\ntriggers: website, ui\n---\nx\n');
  writeFileSync(join(d, '.claude/agents/curado.md'), CURADO);
  writeFileSync(join(d, '.claude/agents/semsug.md'), SEM_SUGESTAO);
  const run = (script, ...args) => spawnSync(process.execPath, [join(d, '.claude/scripts', script), ...args], { cwd: d, encoding: 'utf8' });
  const ag = (n) => readFileSync(join(d, '.claude/agents', `${n}.md`), 'utf8');
  return { d, run, ag, limpar: () => rmSync(d, { recursive: true, force: true }) };
}
const linha = (txt, k) => (txt.match(new RegExp(`^${k}: (.*?)\\r?$`, 'm')) || [])[1];

test('aplicar: grava escolhas, muda só model/effort e preserva CRLF', () => {
  const r = raiz();
  try {
    assert.equal(r.run('skill-agents.mjs').status, 0);
    // Modo público: sem escolha, o gerado sai com `model: inherit`, sem `effort:`, e a sugestão inactiva.
    const g0 = r.ag('frontend-agent');
    assert.equal(linha(g0, 'model'), 'inherit');
    assert.equal(linha(g0, 'effort'), undefined);
    assert.equal(linha(g0, 'modelo-sugerido'), 'opus');
    const esc = join(r.d, 'esc.json');
    writeFileSync(esc, JSON.stringify({ agentes: { curado: { model: 'sonnet', effort: 'low' }, 'frontend-agent': { model: 'inherit', effort: null } } }));
    const out = r.run('modelos-agentes.mjs', '--aplicar', esc);
    assert.equal(out.status, 0, out.stderr);
    const c = r.ag('curado');
    assert.equal(linha(c, 'model'), 'sonnet');
    assert.equal(linha(c, 'effort'), 'low');
    assert.ok(c.includes('\r\n') && !/[^\r]\n/.test(c), 'CRLF preservado');
    assert.match(c, /tools:\r\n {2}- Bash/);
    const f = r.ag('frontend-agent');
    assert.equal(linha(f, 'model'), 'inherit');
    assert.equal(linha(f, 'effort'), undefined, 'effort null tira a linha');
    const guardado = JSON.parse(readFileSync(join(r.d, '.claude/modelos-agentes.local.json'), 'utf8'));
    assert.deepEqual(Object.keys(guardado.agentes).sort(), ['curado', 'frontend-agent']);
    // Gerado re-selado: o gerador continua a regenerá-lo e respeita a escolha.
    const g = r.run('skill-agents.mjs');
    assert.doesNotMatch(g.stdout, /preservados/);
    assert.equal(linha(r.ag('frontend-agent'), 'model'), 'inherit');
  } finally { r.limpar(); }
});

test('reaplicar: repõe as escolhas depois de um update simulado', () => {
  const r = raiz();
  try {
    r.run('skill-agents.mjs');
    const esc = join(r.d, 'esc.json');
    writeFileSync(esc, JSON.stringify({ agentes: { curado: { model: 'sonnet', effort: 'low' }, 'frontend-agent': { model: 'haiku', effort: 'low' } } }));
    r.run('modelos-agentes.mjs', '--aplicar', esc);
    // «Update»: o curado volta ao upstream e o gerado é regenerado sem escolhas.
    writeFileSync(join(r.d, '.claude/agents/curado.md'), CURADO);
    const loc = join(r.d, '.claude/modelos-agentes.local.json');
    const guardado = readFileSync(loc, 'utf8');
    rmSync(loc);
    r.run('skill-agents.mjs', '--force');
    assert.equal(linha(r.ag('frontend-agent'), 'model'), 'inherit', 'sem escolhas o gerador volta ao inherit');
    writeFileSync(loc, guardado);
    const out = r.run('modelos-agentes.mjs', '--reaplicar');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(linha(r.ag('curado'), 'model'), 'sonnet');
    assert.equal(linha(r.ag('frontend-agent'), 'model'), 'haiku');
    // Agente novo aparece na tabela; os já escolhidos não.
    writeFileSync(join(r.d, '.claude/agents/novo.md'), '---\nname: novo\ndescription: "x"\nmodel: inherit\n---\n');
    const t = r.run('modelos-agentes.mjs', '--tabela').stdout;
    assert.match(t, /\| novo \|/);
    assert.doesNotMatch(t, /\| curado \|/);
  } finally { r.limpar(); }
});

test('escolha inválida é recusada sem escrever nada', () => {
  const r = raiz();
  try {
    const esc = join(r.d, 'esc.json');
    writeFileSync(esc, JSON.stringify({ agentes: { curado: { model: 'sonnet', effort: 'low' }, semsug: { model: 'gpt5' } } }));
    const out = r.run('modelos-agentes.mjs', '--aplicar', esc);
    assert.equal(out.status, 1);
    assert.match(out.stderr, /model inválido/);
    assert.equal(r.ag('curado'), CURADO);
    assert.equal(existsSync(join(r.d, '.claude/modelos-agentes.local.json')), false);
  } finally { r.limpar(); }
});

test('sem sugestão = manter: «aplicar todas» não muda model nem effort', () => {
  const r = raiz();
  try {
    const json = r.run('modelos-agentes.mjs', '--tabela', '--json');
    const todas = JSON.parse(json.stdout);
    assert.equal(todas.agentes.semsug.model, 'manter');
    const esc = join(r.d, 'todas.json');
    writeFileSync(esc, json.stdout);
    assert.equal(r.run('modelos-agentes.mjs', '--aplicar', esc).status, 0);
    assert.equal(r.ag('semsug'), SEM_SUGESTAO, 'ficheiro intacto');
    const guardado = JSON.parse(readFileSync(join(r.d, '.claude/modelos-agentes.local.json'), 'utf8'));
    assert.deepEqual({ m: guardado.agentes.semsug.model, e: guardado.agentes.semsug.effort }, { m: 'opus', e: 'high' });
  } finally { r.limpar(); }
});

test('gerador: gerado com hash que não bate recebe só as 3 linhas de sugestão', () => {
  const r = raiz();
  try {
    r.run('skill-agents.mjs');
    const f = join(r.d, '.claude/agents/frontend-agent.md');
    // Simula o estado da produção: edição posterior (effort por tier) sem re-selar, sem linhas de sugestão.
    const antes = r.ag('frontend-agent').replace(/^(modelo-sugerido|effort-sugerido|porque-modelo):.*\n/gm, '')
      .replace('model: inherit', 'model: opus\neffort: high') + '\nNota manual.\n';
    writeFileSync(f, antes);
    const g = r.run('skill-agents.mjs');
    assert.match(g.stdout, /só sugestão de modelo actualizada .*: 1/);
    const depois = r.ag('frontend-agent');
    const semSug = depois.replace(/^(modelo-sugerido|effort-sugerido|porque-modelo):.*\n/gm, '');
    assert.equal(semSug, antes, 'só as 3 linhas mudaram');
    assert.equal(linha(depois, 'modelo-sugerido'), 'opus');
    // Idempotente.
    assert.doesNotMatch(r.run('skill-agents.mjs').stdout, /só sugestão/);
  } finally { r.limpar(); }
});

test('gerador (F2B.3): linha do código mínimo — no gerado e, cirúrgica, no de hash velho', () => {
  const r = raiz();
  try {
    r.run('skill-agents.mjs');
    const LINHA = 'Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")`';
    const ANCORA = 'Se o brief mencionar outras skills, lê-as também antes de começar.';
    assert.ok(r.ag('frontend-agent').includes(`${ANCORA}\n${LINHA}`), 'gerado traz a linha a seguir ao Step 0');
    // Hash velho sem a linha: só +1 linha, corpo intacto, hash não re-selado.
    const f = join(r.d, '.claude/agents/frontend-agent.md');
    const antes = r.ag('frontend-agent').split('\n').filter((l) => !l.includes('codigo-minimo')).join('\n') + '\nNota manual.\n';
    writeFileSync(f, antes);
    const g = r.run('skill-agents.mjs');
    assert.match(g.stdout, /só linha do código mínimo acrescentada .*: 1/);
    const depois = r.ag('frontend-agent');
    assert.equal(depois.split('\n').filter((l) => !l.includes('codigo-minimo')).join('\n'), antes);
    assert.equal(depois.split('\n').length, antes.split('\n').length + 1);
    // Idempotente.
    assert.doesNotMatch(r.run('skill-agents.mjs').stdout, /código mínimo/);
  } finally { r.limpar(); }
});
