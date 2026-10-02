// F4.1 — build-skill-index.py: campo `dominio` (1.º nível do router no prompt-triage.js) e dedup de
// gatilhos sem acentos. Gera o índice numa pasta temporária; nunca escreve o memory/SKILL_INDEX.json.
// Uso: node --test .claude/scripts/test/build-skill-index.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const BRAIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// BUILD_INDEX=<caminho> aponta a uma cópia do script (teste de mutação).
const SCRIPT = process.env.BUILD_INDEX || join(BRAIN, '.claude', 'scripts', 'build-skill-index.py');
const PY = spawnSync('python', ['--version']).status === 0 ? 'python' : 'python3';

// Corre código Python com o módulo carregado como `m` (o script não tem CLI de saída alternativa).
function py(codigo) {
  const pre = 'import importlib.util,sys,json\nfrom pathlib import Path\n'
    + `s=importlib.util.spec_from_file_location("b", ${JSON.stringify(SCRIPT)}); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)\n`;
  const r = spawnSync(PY, ['-c', pre + codigo], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf8' } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

test('todas as entradas do índice têm `dominio`, nenhuma cai em "geral"; o gémeo herda o da skill', () => {
  const d = mkdtempSync(join(tmpdir(), 'joca-idx-'));
  try {
    const out = join(d, 'SKILL_INDEX.json');
    py(`m.OUTPUT=Path(${JSON.stringify(out)}); m.build_index()`);
    const idx = JSON.parse(readFileSync(out, 'utf8'));
    const sem = idx.filter((e) => !e.dominio || e.dominio === 'geral').map((e) => e.name);
    assert.deepEqual(sem, [], 'entradas sem domínio — acrescentar a regra em DOMINIOS');
    const por = Object.fromEntries(idx.map((e) => [`${e.type}:${e.name}`, e.dominio]));
    assert.equal(por['skill:laravel-specialist'], 'backend');
    assert.equal(por['agent:laravel-specialist-agent'], por['skill:laravel-specialist']);
    assert.equal(por['skill:mkt-meta-ads'], 'marketeer');
    assert.equal(por['skill:marketing'], 'marketing');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('`dominio:` no frontmatter manda sobre a tabela', () => {
  assert.equal(py('print(m.dominio_de("frontend", {"dominio": "design"}))').trim(), 'design');
  assert.equal(py('print(m.dominio_de("frontend", {}))').trim(), 'frontend');
});

test('gatilhos iguais a menos de acentos ocupam um só lugar do cap', () => {
  const d = mkdtempSync(join(tmpdir(), 'joca-idx-'));
  try {
    const f = join(d, 'x.md');
    writeFileSync(f, '---\nname: x\ntriggers: autenticação, autenticacao, Autenticação, login\n---\n');
    const t = JSON.parse(py(`print(json.dumps(m.extract_triggers(Path(${JSON.stringify(f)}), "")))`));
    assert.deepEqual(t, ['autenticação', 'login']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
