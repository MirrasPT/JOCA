// T107 — `supersede`/`redact` de um id de aprendizagem tira-a do recall e do search.
// Corre numa cópia descartável do Brain (o script resolve a memória pelo __dirname), nunca na real.
// Uso: node --test .claude/scripts/test/joca-brain.test.mjs   (JOCA_TEST_SCRIPT=<cópia> para mutação)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALVO = process.env.JOCA_TEST_SCRIPT || join(SCRIPTS, 'joca-brain.mjs');

function brainDescartavel() {
  const raiz = mkdtempSync(join(tmpdir(), 'joca-brain-t107-'));
  const sc = join(raiz, '.claude', 'scripts');
  mkdirSync(sc, { recursive: true });
  mkdirSync(join(raiz, 'memory'), { recursive: true });
  copyFileSync(ALVO, join(sc, 'joca-brain.mjs'));
  for (const f of ['joca-slug.cjs', 'joca-memory-index.mjs']) copyFileSync(join(SCRIPTS, f), join(sc, f));
  const run = (args, env = {}) => execFileSync(process.execPath, [join(sc, 'joca-brain.mjs'), ...args],
    { cwd: raiz, encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  return { raiz, run };
}

for (const modo of ['substring', 'fts']) {
  test(`T107 aprendizagem retirada sai do recall e do search (${modo})`, () => {
    const { raiz, run } = brainDescartavel();
    const env = modo === 'substring' ? { JOCA_BRAIN_NO_FTS: '1' } : {};
    try {
      const out = run(['learn', 'aprendizagem errada zebra', '--slug', 't107']);
      const id = out.match(/id=([0-9a-f-]{36})/)[1];
      run(['learn', 'aprendizagem certa zebra', '--slug', 't107']);
      assert.match(run(['recall', '--slug', 't107']), /errada/);
      run(['supersede', id, '--slug', 't107']);
      const recall = run(['recall', '--slug', 't107']);
      assert.doesNotMatch(recall, /errada/, 'recall ainda mostra a aprendizagem retirada');
      assert.match(recall, /certa/);
      const busca = run(['search', 'zebra', '--slug', 't107'], env);
      assert.doesNotMatch(busca, /errada/, 'search ainda mostra a aprendizagem retirada');
      assert.match(busca, /certa/);
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });
}
