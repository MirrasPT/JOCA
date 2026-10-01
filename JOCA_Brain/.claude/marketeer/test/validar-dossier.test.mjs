import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validarDossier, procurarSegredos } from '../scripts/validar-dossier.mjs';

const exemplo = readFileSync(new URL('./fixtures/clientes/_exemplo/dossier.md', import.meta.url), 'utf8');

test('o dossier de exemplo é válido', () => {
  assert.deepEqual(validarDossier(exemplo, '_exemplo'), []);
});

test('slug diferente da pasta falha', () => {
  assert.ok(validarDossier(exemplo, 'outro').some((e) => e.includes('não bate com a pasta')));
});

test('sem frontmatter falha', () => {
  assert.ok(validarDossier('# só texto', 'x').some((e) => e.includes('sem frontmatter')));
});

test('acesso que não é boolean falha', () => {
  const t = exemplo.replace('acesso: false', 'acesso: talvez');
  assert.ok(validarDossier(t, '_exemplo').some((e) => e.includes('acesso tem de ser true/false')));
});

test('um segredo no corpo é recusado', () => {
  const t = exemplo + '\nchave: AIza' + 'A'.repeat(35) + '\n';
  assert.ok(validarDossier(t, '_exemplo').some((e) => e.includes('chave Google API')));
});

test('um campo de credencial no frontmatter é recusado', () => {
  const t = exemplo.replace('    acesso: false', '    acesso: false\n    password: x');
  assert.ok(validarDossier(t, '_exemplo').some((e) => e.includes('campo proibido')));
});

test('palavra-passe em texto livre no corpo é recusada', () => {
  assert.ok(validarDossier(exemplo + '\nPassword do GA4: Abc!2345xyz\n', '_exemplo').length > 0);
});

test('access_token no frontmatter é recusado', () => {
  const t = exemplo.replace('    acesso: false', '    acesso: false\n    access_token: x');
  assert.ok(validarDossier(t, '_exemplo').some((e) => e.includes('campo proibido')));
});

test('dossier gravado com BOM continua válido', () => {
  assert.deepEqual(validarDossier('﻿' + exemplo, '_exemplo'), []);
});

test('procurarSegredos apanha tokens de marketing comuns', () => {
  for (const s of ['GOCSPX-' + 'a'.repeat(28), '1//0' + 'a'.repeat(40), 'https://u:p@host.pt', 'AKIA' + 'A'.repeat(16)]) {
    assert.ok(procurarSegredos(s).length > 0, s);
  }
});

test('slug com maiúsculas é recusado (D-013)', () => {
  const t = exemplo.replace('slug: _exemplo', 'slug: _Exemplo');
  assert.ok(validarDossier(t, '_Exemplo').some((e) => e.includes('só pode ter minúsculas')));
});

// #25: o _exemplo (https://exemplo.invalid, sem barra final) continua válido; o resto recusa-se.
test('#25 cliente.site: URL http(s) com domínio ou <sem fonte>; o _exemplo continua válido', () => {
  assert.match(exemplo, /site: https:\/\/exemplo\.invalid\n/);
  assert.deepEqual(validarDossier(exemplo, '_exemplo'), []);
  for (const site of ['http://exemplo.invalid/x', "'<sem fonte>'"]) {
    assert.deepEqual(validarDossier(exemplo.replace('site: https://exemplo.invalid', `site: ${site}`), '_exemplo'), [], site);
  }
  for (const site of ['exemplo.invalid', 'ftp://exemplo.invalid', 'javascript:alert(1)', 'https://localhost', 'texto livre']) {
    const erros = validarDossier(exemplo.replace('site: https://exemplo.invalid', `site: ${site}`), '_exemplo');
    assert.ok(erros.some((e) => e.includes('cliente.site')), site);
  }
});

// B1 (varredura 2026-10-01): clientes/<slug>/estado.json (CONTRATO §3) é aceite e validado pela forma
// do estadoPadrao; chave estranha ou segredo → saída 1.
test('B1 validar-dossier aceita o estado.json do estado.mjs e recusa chave estranha ou segredo', async () => {
  const { mkdtempSync, mkdirSync, readFileSync: ler_, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const script = (n) => fileURLToPath(new URL(`../scripts/${n}`, import.meta.url));
  const raiz = mkdtempSync(join(tmpdir(), 'mkt-b1-'));
  const S = 'padaria-exemplo';
  mkdirSync(join(raiz, 'clientes', S), { recursive: true });
  writeFileSync(join(raiz, 'clientes', S, 'dossier.md'), exemplo.replace('slug: _exemplo', `slug: ${S}`));
  const env = { ...process.env, MARKETEER_RAIZ: raiz };
  const correr = (n, ...a) => spawnSync(process.execPath, [script(n), ...a], { encoding: 'utf8', env, cwd: tmpdir(), input: '' });
  assert.equal(correr('estado.mjs', 'ler', S).status, 0);
  assert.equal(correr('estado.mjs', 'revisao', S, 'seo', '2020-01-01', 'rever posições').status, 0);
  assert.equal(correr('estado.mjs', 'ciclo-novo', S).status, 0);
  let r = correr('validar-dossier.mjs');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /✓ .*padaria-exemplo[\\/]estado\.json/);
  const f = join(raiz, 'clientes', S, 'estado.json');
  const bom = ler_(f, 'utf8');
  const casos = [
    [(e) => { e.extra = 'x'; }, /chave desconhecida "extra"/],
    [(e) => { e.access_token = 'x'; }, /chave desconhecida "access_token"/],
    [(e) => { e.proxima_accao = 'chave AIza' + 'B'.repeat(35); }, /chave Google API/],
    [(e) => { e.passos.F2 = 'acabado'; }, /passos\.F2 inválido/],
    [(e) => { e.ciclo = '2026-10-1'; }, /"ciclo" inválido/],
    [(e) => { e.revisoes = [{ canal: 'myspace', data: '2026-10-15', motivo: 'x' }]; }, /canal inválido/],
    [(e) => { e.slug = 'outro'; }, /não bate com a pasta/],
  ];
  for (const [mudar, re] of casos) {
    const e = JSON.parse(bom);
    mudar(e);
    writeFileSync(f, JSON.stringify(e));
    r = correr('validar-dossier.mjs');
    assert.equal(r.status, 1, re.source);
    assert.match(r.stderr, re);
  }
  writeFileSync(f, bom);
  assert.equal(correr('validar-dossier.mjs').status, 0);
});
