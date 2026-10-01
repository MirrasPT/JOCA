// scripts/conectores.mjs — rascunho da matriz do CONTRATO §4 (só leitura, cofre só como booleano).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { matriz, tabela } from '../scripts/conectores.mjs';
import { guardar } from '../scripts/cofre.mjs';

const CLI = fileURLToPath(new URL('../scripts/conectores.mjs', import.meta.url));
const SEGREDO = 'sentinela-SEGREDO-nao-pode-sair-9f8e7d';
const CANAIS_CONTRATO = ['google-ads', 'ga4', 'search-console', 'gbp', 'meta-ads', 'facebook', 'instagram', 'linkedin', 'linkedin-ads', 'email', 'trypost', 'gtm', 'site'];

function raizCom(slug, canais, site = 'https://exemplo.invalid/') {
  const raiz = mkdtempSync(join(tmpdir(), 'mkt-con-'));
  mkdirSync(join(raiz, 'clientes', slug), { recursive: true });
  const yaml = canais.map(([tipo, id]) => `  - tipo: ${tipo}\n    id: ${id}\n    acesso: true`).join('\n');
  writeFileSync(join(raiz, 'clientes', slug, 'dossier.md'), `---\ncliente:\n  nome: Marca\n  slug: ${slug}\n  site: ${site}\ncanais:\n${yaml || '  []'}\n---\n`);
  return raiz;
}

test('uma linha por canal do dossier (+ site), canais do contrato, tudo "não verificado"', () => {
  const raiz = raizCom('m', [['ga4', '123456'], ['meta', '<sem fonte>'], ['google-ads', '111-222-3333'], ['tiktok', 'conta-m'], ['trypost', '<sem fonte>']]);
  const r = matriz('m', { raiz, lerCofre: () => null });
  assert.deepEqual(r.linhas.map((l) => l.canal), ['site', 'ga4', 'meta-ads', 'google-ads', 'trypost']);
  for (const l of r.linhas) {
    assert.ok(CANAIS_CONTRATO.includes(l.canal), l.canal);
    assert.equal(l.acesso, 'não verificado');
    assert.equal(l.verificado, 'não verificado');
    assert.ok(['api', 'mcp', 'cli', 'csv', 'manual', 'público'].includes(l.via), l.via);
  }
  assert.deepEqual(r.fora, ['tiktok']);
  const t = tabela(r);
  assert.match(t.split('\n')[0], /^\| canal \| conta\/id \| acesso \| via \| dados que dá \| verificado em \| como ligar \|$/);
  assert.match(t, /Fora do contrato.*tiktok/);
});

test('cofre: só "chave no cofre: sim/não", nunca o valor; chave presente não vira acesso "sim"', () => {
  const raiz = raizCom('m', [['ga4', '123456'], ['google-ads', '111-222-3333']]);
  const lidas = [];
  const lerCofre = (s, c) => { lidas.push(`${s}/${c}`); return c === 'GOOGLE_SERVICE_ACCOUNT' ? SEGREDO : null; };
  const r = matriz('m', { raiz, lerCofre });
  const ga4 = r.linhas.find((l) => l.canal === 'ga4');
  const ads = r.linhas.find((l) => l.canal === 'google-ads');
  assert.match(ga4.ligar, /chave no cofre: sim/);
  assert.equal(ga4.acesso, 'não verificado');
  assert.match(ads.ligar, /chave no cofre: não/);
  assert.ok(!tabela(r).includes(SEGREDO));
  assert.ok(lidas.includes('m/GOOGLE_SERVICE_ACCOUNT') && lidas.includes('google-ads/GOOGLE_ADS_REFRESH_TOKEN'));
});

test('cofre ilegível não rebenta nem inventa acesso', () => {
  const raiz = raizCom('m', [['ga4', '123456']]);
  const r = matriz('m', { raiz, lerCofre: () => { throw new Error('EACCES'); } });
  assert.match(r.linhas.find((l) => l.canal === 'ga4').ligar, /cofre ilegível/);
});

test('CLI com o cofre real (HOME temporário): não imprime o valor e não escreve nada', () => {
  const raiz = raizCom('cli-m', [['ga4', '123456']], '<sem fonte>');
  const home = mkdtempSync(join(tmpdir(), 'mkt-con-home-'));
  guardar('cli-m', 'GOOGLE_SERVICE_ACCOUNT', SEGREDO, { base: join(home, '.config', 'marketeer') });
  const antes = readdirSync(join(raiz, 'clientes', 'cli-m'));
  const r = spawnSync(process.execPath, [CLI, 'cli-m'], { encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home, MARKETEER_RAIZ: raiz } });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes(SEGREDO) && !r.stderr.includes(SEGREDO));
  assert.match(r.stdout, /\| ga4 \| 123456 \| não verificado \|.*chave no cofre: sim/);
  assert.doesNotMatch(r.stdout, /\| site \|/, 'site <sem fonte> não entra');
  assert.deepEqual(readdirSync(join(raiz, 'clientes', 'cli-m')), antes);
  const sem = spawnSync(process.execPath, [CLI, 'nao-existe'], { encoding: 'utf8', env: { ...process.env, HOME: home, MARKETEER_RAIZ: raiz } });
  assert.equal(sem.status, 1);
});
