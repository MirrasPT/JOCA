// scripts/raiz.mjs — CONTRATO §2: env → pasta atual com clientes/ → ~/.config/marketeer/config.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { raizDados, resolverRaiz, definirRaiz } from '../scripts/raiz.mjs';

const RAIZ_CLI = fileURLToPath(new URL('../scripts/raiz.mjs', import.meta.url));
const pasta = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));
const semEnv = () => { const e = { ...process.env }; delete e.MARKETEER_RAIZ; return e; };
const cli = (args, { cwd, home, env = {} }) => spawnSync(process.execPath, [RAIZ_CLI, ...args], { cwd, encoding: 'utf8', env: { ...semEnv(), HOME: home, USERPROFILE: home, ...env } });

test('raizDados: MARKETEER_RAIZ manda; sem ela, a pasta atual', () => {
  const antes = process.env.MARKETEER_RAIZ;
  try {
    process.env.MARKETEER_RAIZ = '/tmp/marketeer-x';
    assert.equal(raizDados(), '/tmp/marketeer-x');
    delete process.env.MARKETEER_RAIZ;
    assert.equal(raizDados(), process.cwd());
  } finally {
    if (antes === undefined) delete process.env.MARKETEER_RAIZ; else process.env.MARKETEER_RAIZ = antes;
  }
});

test('resolverRaiz: env > cwd com clientes/ > config.json > null', () => {
  const home = pasta('mkt-home-');
  const config = join(home, '.config', 'marketeer', 'config.json');
  const comClientes = pasta('mkt-cwd-'); mkdirSync(join(comClientes, 'clientes'));
  const semClientes = pasta('mkt-vazia-');
  assert.deepEqual(resolverRaiz({ env: { MARKETEER_RAIZ: '/a/b' }, cwd: comClientes, config }), { raiz: '/a/b', origem: 'MARKETEER_RAIZ' });
  assert.equal(resolverRaiz({ env: {}, cwd: comClientes, config }).raiz, comClientes);
  assert.equal(resolverRaiz({ env: {}, cwd: semClientes, config }), null);
  definirRaiz('/dados/marcas', { config });
  assert.deepEqual(resolverRaiz({ env: {}, cwd: semClientes, config }), { raiz: '/dados/marcas', origem: config });
  // a pasta atual com clientes/ ganha ao config
  assert.equal(resolverRaiz({ env: {}, cwd: comClientes, config }).raiz, comClientes);
});

test('CLI: sem nada sai 2 (perguntar); --definir grava config.json com 700 na pasta; depois imprime-a', () => {
  const home = pasta('mkt-home-');
  const cwd = pasta('mkt-cwd-');
  const r0 = cli([], { cwd, home });
  assert.equal(r0.status, 2, r0.stderr);
  assert.equal(r0.stdout, '');
  const dados = join(home, 'Marketeer');
  const r1 = cli(['--definir', dados], { cwd, home });
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(r1.stdout.trim(), dados);
  const dir = join(home, '.config', 'marketeer');
  if (process.platform !== 'win32') assert.equal(statSync(dir).mode & 0o777, 0o700);
  assert.equal(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).raiz, dados);
  const r2 = cli([], { cwd, home });
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(r2.stdout.trim(), dados);
  // env ganha ao config
  assert.equal(cli([], { cwd, home, env: { MARKETEER_RAIZ: '/outra' } }).stdout.trim(), '/outra');
});

test('CLI --definir não toca nos .env do cofre e preserva outros campos do config', () => {
  const home = pasta('mkt-home-');
  const dir = join(home, '.config', 'marketeer');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'cliente.env'), 'TOKEN=intacto\n');
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ raiz: '/velha', outro: 1 }));
  const r = cli(['--definir', '/nova'], { cwd: home, home });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(dir, 'cliente.env'), 'utf8'), 'TOKEN=intacto\n');
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')), { raiz: '/nova', outro: 1 });
  assert.ok(!existsSync(join(home, 'Marketeer')), 'o --definir não cria a pasta de dados');
});

test('CLI: argumentos errados saem 1', () => {
  const home = pasta('mkt-home-');
  assert.equal(cli(['--definir'], { cwd: home, home }).status, 1);
  assert.equal(cli(['xpto'], { cwd: home, home }).status, 1);
});
