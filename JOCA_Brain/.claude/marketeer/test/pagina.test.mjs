import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obterPagina, obterDeFixtures } from '../scripts/auditoria/pagina.mjs';

test('obterDeFixtures serve o mapa e dá 404 ao resto', async () => {
  const obter = obterDeFixtures({ 'https://a.pt/': '<html>', 'https://a.pt/x': { status: 500, texto: 'erro' } });
  assert.deepEqual(await obter('https://a.pt/'), { ok: true, status: 200, url: 'https://a.pt/', texto: '<html>', erro: null });
  assert.equal((await obter('https://a.pt/x')).ok, false);
  assert.equal((await obter('https://a.pt/nada')).status, 404);
});

test('obterPagina não lança num host que não existe', async () => {
  const r = await obterPagina('http://marketeer-nao-existe.invalid/', { timeout: 5000 });
  assert.equal(r.ok, false);
  assert.ok(r.erro);
});
