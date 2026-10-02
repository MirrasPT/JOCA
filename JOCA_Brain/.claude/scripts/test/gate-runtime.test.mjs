// B02a — glifos de copy (→ ✓ ✗) não contam como ícone; um glifo real (⚙) conta.
// B03  — captura de ecrã que falha não duplica a página no relatório.
// Servidor HTTP local numa porta livre (porta 0 → o SO escolhe; nunca 7491/7492/7371/7372).
// Precisa de Playwright resolvível (receita da skill browser-automate); sem ele o teste é saltado.
// Uso: node --test .claude/scripts/test/gate-runtime.test.mjs   (JOCA_TEST_SCRIPT=<cópia> para mutação)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const ALVO = process.env.JOCA_TEST_SCRIPT || join(dirname(fileURLToPath(import.meta.url)), '..', 'gate-runtime.mjs');
const RESERVADAS = new Set([7491, 7492, 7371, 7372]);
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head>
<body style="background:#fff;color:#111;font:16px sans-serif">
<h1>Página de teste</h1>
<p>Ver mais →</p><p>✓ entregue</p><p>✗ recusado</p>
<p>⚙ definições</p>
</body></html>`;

function servidor() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(HTML); });
    s.listen(0, '127.0.0.1', () => {
      if (RESERVADAS.has(s.address().port)) { s.close(); return ok(servidor()); }
      ok(s);
    });
  });
}

function gate(args) {
  return new Promise((ok) => execFile(process.execPath, [ALVO, ...args], { env: { ...process.env, MSYS_NO_PATHCONV: '1' }, timeout: 120000 },
    (err, stdout, stderr) => ok({ code: err ? err.code : 0, stdout, stderr })));
}

test('B02a + B03 no gate-runtime', async (t) => {
  const s = await servidor();
  const out = mkdtempSync(join(tmpdir(), 'gate-runtime-b03-'));
  // B03: uma PASTA com o nome do screenshot faz a captura falhar de forma determinística.
  mkdirSync(join(out, 'home__default_800x600.png'));
  try {
    const r = await gate(['--base', `http://127.0.0.1:${s.address().port}`, '--rotas', '/', '--viewports', '800x600', '--medir', 'icones', '--out', out]);
    if (/Playwright não encontrado|Nenhum browser arrancou/.test(r.stderr)) { t.skip('Playwright/browser indisponível'); return; }
    const rel = JSON.parse(readFileSync(join(out, 'relatorio.json'), 'utf8'));
    assert.equal(rel.length, 1, `B03: a página saiu ${rel.length}x no relatório`);
    assert.ok(!rel[0].erroFatal, `B03: falha da captura virou erroFatal: ${rel[0].erroFatal}`);
    assert.ok(rel[0].capturaFalhou, 'B03: a falha da captura não ficou anotada');
    const ic = rel[0].medidores.icones;
    assert.equal(ic.glifosTotal, 1, `B02a: glifos contados ${JSON.stringify(ic.glifos)}`);
    assert.equal(ic.glifos[0].codigo, 'U+2699');
    assert.equal(ic.glifosCopia, 3, 'B02a: glifos de copy não contados à parte');
    assert.match(r.stdout, /3 glifo\(s\) de copy/);
  } finally {
    s.close();
    rmSync(out, { recursive: true, force: true });
  }
});
