// Testes escritos a partir dos critérios de aceitação do issue #4 (criar-dossier.mjs), não da implementação.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { criarDossier, gerarSlug, DossierJaExiste } from '../scripts/criar-dossier.mjs';
import { validarDossier } from '../scripts/validar-dossier.mjs';
import { ler } from '../scripts/cofre.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CRIAR = join(RAIZ, 'scripts', 'criar-dossier.mjs');
const VALIDAR = join(RAIZ, 'scripts', 'validar-dossier.mjs');
const GUARDAR = join(RAIZ, 'scripts', 'guardar-credencial.mjs');
const HOJE = new Date(2026, 8, 24);
const SEGREDO = 'Tk-Muito-Unico-7a6b5c4d3e2f1a0b';

const pastas = [];
after(() => pastas.forEach((p) => rmSync(p, { recursive: true, force: true })));
const novaRaiz = () => {
  const p = mkdtempSync(join(tmpdir(), 'marketeer-novo-'));
  pastas.push(p);
  return p;
};

const completo = () => ({
  nome: 'Padaria Teste',
  sector: 'restauração',
  site: 'https://padaria.invalid',
  responsavel: 'equipa',
  marca: 'tons quentes',
  publico: 'famílias do bairro',
  objectivos: ['mais encomendas'],
  concorrentes: ['Pastelaria Vizinha'],
  canais: [{ tipo: 'ga4', id: 'G-TESTE', acesso: true }, { tipo: 'gbp', acesso: false }],
  notas: 'Cliente desde setembro.',
});

function frontmatter(texto) {
  const m = texto.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  assert.ok(m, 'o dossier tem de ter frontmatter');
  return { d: parse(m[1]), corpo: m[2] };
}

const correrCriar = (raiz, entrada, opts = {}) =>
  spawnSync(process.execPath, [CRIAR, raiz], { input: entrada, encoding: 'utf8', ...opts });

// Mesmo comando do "npm run validar", sem passar pelo npm (npm.cmd no Windows).
const correrValidar = (raiz) =>
  spawnSync(process.execPath, [VALIDAR, 'clientes'], { cwd: raiz, encoding: 'utf8' });

// --- Critério 1: o dossier criado passa `npm run validar` ---

test('o dossier criado com todos os campos passa validarDossier', () => {
  const raiz = novaRaiz();
  const { slug, caminho } = criarDossier(raiz, completo(), { hoje: HOJE });
  assert.equal(slug, 'padaria-teste');
  assert.equal(caminho, join(raiz, 'clientes', 'padaria-teste', 'dossier.md'));
  assert.deepEqual(validarDossier(readFileSync(caminho, 'utf8'), slug), []);
});

test('o dossier criado só com o nome passa validarDossier', () => {
  const raiz = novaRaiz();
  const { slug, caminho } = criarDossier(raiz, { nome: 'Só Nome' }, { hoje: HOJE });
  assert.deepEqual(validarDossier(readFileSync(caminho, 'utf8'), slug), []);
});

test('o dossier criado pelo CLI passa o validador (CLI) sobre a raiz', () => {
  const raiz = novaRaiz();
  const r = correrCriar(raiz, JSON.stringify(completo()));
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(raiz, 'clientes', 'padaria-teste', 'dossier.md')));
  assert.match(r.stdout, /padaria-teste[\\/]dossier\.md/);
  const v = correrValidar(raiz);
  assert.equal(v.status, 0, v.stderr + v.stdout);
  assert.match(v.stdout, /padaria-teste[\\/]dossier\.md/);
});

test('o dossier mínimo criado pelo CLI passa o validador (CLI)', () => {
  const raiz = novaRaiz();
  assert.equal(correrCriar(raiz, JSON.stringify({ nome: 'Mínimo' })).status, 0);
  assert.equal(correrValidar(raiz).status, 0);
});

test('actualizado é a data de hoje em AAAA-MM-DD', () => {
  const raiz = novaRaiz();
  const { caminho } = criarDossier(raiz, { nome: 'Data' }, { hoje: HOJE });
  assert.equal(String(frontmatter(readFileSync(caminho, 'utf8')).d.actualizado), '2026-09-24');
});

test('sem nome não cria nada', () => {
  const raiz = novaRaiz();
  for (const dados of [{}, { nome: '' }, { nome: '   ' }, { nome: '&&&' }]) {
    assert.throws(() => criarDossier(raiz, dados, { hoje: HOJE }));
  }
  assert.ok(!existsSync(join(raiz, 'clientes')) || readdirSync(join(raiz, 'clientes')).length === 0);
});

test('slug explícito no JSON é usado em vez do gerado', () => {
  const raiz = novaRaiz();
  const { slug, caminho } = criarDossier(raiz, { nome: '&&&', slug: 'e-comercial' }, { hoje: HOJE });
  assert.equal(slug, 'e-comercial');
  assert.equal(caminho, join(raiz, 'clientes', 'e-comercial', 'dossier.md'));
  const { d } = frontmatter(readFileSync(caminho, 'utf8'));
  assert.equal(d.cliente.slug, 'e-comercial');
  assert.equal(d.cliente.nome, '&&&');
  assert.deepEqual(validarDossier(readFileSync(caminho, 'utf8'), slug), []);
});

test('slug explícito resolve a colisão: outro cliente com o mesmo slug gerado', () => {
  const raiz = novaRaiz();
  const { f, antigo } = dossierExistente(raiz, 'cafe-pao');
  const { caminho } = criarDossier(raiz, { nome: 'Café Pão', slug: 'cafe-pao-porto' }, { hoje: HOJE });
  assert.equal(caminho, join(raiz, 'clientes', 'cafe-pao-porto', 'dossier.md'));
  assert.ok(readFileSync(f).equals(antigo));
});

test('slug explícito inválido é recusado e nada é escrito', () => {
  const raiz = novaRaiz();
  for (const slug of ['', 'Maiusculas', '../fora', 'a/b', '-hifen', '_exemplo', 'com espaço', 'ação', 42, null]) {
    assert.throws(() => criarDossier(raiz, { nome: 'Slug Mau', slug }, { hoje: HOJE }), /slug/, String(slug));
  }
  assert.ok(!existsSync(join(raiz, 'clientes')));
  const r = correrCriar(raiz, JSON.stringify({ nome: 'Slug Mau', slug: '../fora' }));
  assert.equal(r.status, 1);
  assert.ok(!existsSync(join(raiz, 'fora')) && !existsSync(join(raiz, 'clientes')));
});

test('um nome que não gera slug pede "slug" na mensagem', () => {
  assert.throws(() => criarDossier(novaRaiz(), { nome: '&&&' }, { hoje: HOJE }), /"slug"/);
});

// --- Critério 2: se o dossier já existe, não sobrescreve ---

function dossierExistente(raiz, slug) {
  const pasta = join(raiz, 'clientes', slug);
  mkdirSync(pasta, { recursive: true });
  const f = join(pasta, 'dossier.md');
  // Bytes arbitrários (BOM, CRLF, byte não-UTF8): qualquer reescrita muda-os.
  const antigo = Buffer.concat([Buffer.from('﻿---\r\nconteúdo antigo\r\n---\r\n', 'utf8'), Buffer.from([0xff, 0x00, 0x7f])]);
  writeFileSync(f, antigo);
  return { f, antigo };
}

test('criarDossier sobre um dossier existente lança DossierJaExiste e deixa-o intacto', () => {
  const raiz = novaRaiz();
  const { f, antigo } = dossierExistente(raiz, 'padaria-teste');
  assert.throws(() => criarDossier(raiz, completo(), { hoje: HOJE }), (e) => e instanceof DossierJaExiste);
  assert.ok(readFileSync(f).equals(antigo), 'o conteúdo antigo mudou');
});

test('um nome diferente que dá o mesmo slug também não sobrescreve', () => {
  const raiz = novaRaiz();
  const { f, antigo } = dossierExistente(raiz, 'cafe-pao');
  assert.throws(() => criarDossier(raiz, { nome: 'CAFÉ  Pão' }, { hoje: HOJE }), (e) => e instanceof DossierJaExiste);
  assert.ok(readFileSync(f).equals(antigo));
});

test('criar duas vezes o mesmo cliente: a segunda falha e a primeira fica igual', () => {
  const raiz = novaRaiz();
  const { caminho } = criarDossier(raiz, completo(), { hoje: HOJE });
  const antes = readFileSync(caminho);
  assert.throws(() => criarDossier(raiz, { ...completo(), sector: 'outro' }, { hoje: new Date(2027, 0, 1) }), DossierJaExiste);
  assert.ok(readFileSync(caminho).equals(antes));
});

test('CLI sobre um dossier existente sai com 2 e deixa-o intacto', () => {
  const raiz = novaRaiz();
  const { f, antigo } = dossierExistente(raiz, 'padaria-teste');
  const r = correrCriar(raiz, JSON.stringify(completo()));
  assert.equal(r.status, 2, r.stderr);
  assert.ok(readFileSync(f).equals(antigo), 'o conteúdo antigo mudou');
});

// --- Critério 3: campo sem resposta fica <sem fonte>, nunca inventado ---

test('campos em falta ficam <sem fonte>', () => {
  const raiz = novaRaiz();
  const { caminho } = criarDossier(raiz, { nome: 'Vazio' }, { hoje: HOJE });
  const { d, corpo } = frontmatter(readFileSync(caminho, 'utf8'));
  for (const campo of ['sector', 'site', 'responsavel']) assert.equal(d.cliente[campo], '<sem fonte>', `cliente.${campo}`);
  for (const campo of ['marca', 'publico', 'objectivos', 'concorrentes']) assert.equal(d[campo], '<sem fonte>', campo);
  assert.deepEqual(d.canais, []);
  assert.match(corpo, /<sem fonte>/);
});

test('respostas vazias ou só espaços ficam <sem fonte>', () => {
  const raiz = novaRaiz();
  const { caminho } = criarDossier(raiz, { nome: 'Espaços', sector: '', site: '   ', publico: '\n', marca: null }, { hoje: HOJE });
  const { d } = frontmatter(readFileSync(caminho, 'utf8'));
  assert.equal(d.cliente.sector, '<sem fonte>');
  assert.equal(d.cliente.site, '<sem fonte>');
  assert.equal(d.publico, '<sem fonte>');
  assert.equal(d.marca, '<sem fonte>');
});

test('canal sem id fica com id <sem fonte> e sem acesso inventado', () => {
  const raiz = novaRaiz();
  const { caminho } = criarDossier(raiz, { nome: 'Canal', canais: [{ tipo: 'meta' }] }, { hoje: HOJE });
  const { d } = frontmatter(readFileSync(caminho, 'utf8'));
  assert.equal(d.canais.length, 1);
  assert.equal(d.canais[0].tipo, 'meta');
  assert.equal(d.canais[0].id, '<sem fonte>');
  assert.equal(d.canais[0].acesso, false);
});

test('"Nenhum" (lista vazia) é diferente de "Não sei" (<sem fonte>)', () => {
  const raiz = novaRaiz();
  const { caminho } = criarDossier(raiz, { nome: 'Listas', concorrentes: [] }, { hoje: HOJE });
  const { d } = frontmatter(readFileSync(caminho, 'utf8'));
  assert.deepEqual(d.concorrentes, []);
  assert.equal(d.objectivos, '<sem fonte>');
});

test('as respostas dadas passam tal como vieram', () => {
  const raiz = novaRaiz();
  const { caminho } = criarDossier(raiz, completo(), { hoje: HOJE });
  const { d, corpo } = frontmatter(readFileSync(caminho, 'utf8'));
  assert.equal(d.cliente.nome, 'Padaria Teste');
  // Gravado normalizado (`new URL().href`, #25): só ganha a barra final.
  assert.equal(d.cliente.site, 'https://padaria.invalid/');
  assert.equal(d.publico, 'famílias do bairro');
  assert.deepEqual(d.objectivos, ['mais encomendas']);
  assert.deepEqual(d.concorrentes, ['Pastelaria Vizinha']);
  assert.deepEqual(d.canais[0], { tipo: 'ga4', id: 'G-TESTE', acesso: true });
  assert.equal(d.canais[1].id, '<sem fonte>');
  assert.match(corpo, /Cliente desde setembro\./);
});

test('ida e volta YAML: ":", "#", aspas e quebras de linha voltam iguais', () => {
  const raiz = novaRaiz();
  const dados = {
    nome: 'Loja: "A" #1 \'B\'',
    sector: 'retalho: roupa # e calçado',
    site: 'https://x.invalid/?a=1#topo',
    publico: 'linha 1\nlinha 2: "citada"\n# não é comentário',
    marca: "'aspas simples' e \"duplas\"",
    objectivos: ['#1: vender', '- lista?', 'a: b'],
    concorrentes: ['"Aspas" Lda', 'Nome # com cardinal'],
    canais: [{ tipo: 'gbp', id: 'https://g.page/x?y=1#z', acesso: false }],
  };
  const { slug, caminho } = criarDossier(raiz, dados, { hoje: HOJE });
  const texto = readFileSync(caminho, 'utf8');
  assert.deepEqual(validarDossier(texto, slug), []);
  const { d } = frontmatter(texto);
  assert.equal(d.cliente.nome, dados.nome);
  assert.equal(d.cliente.sector, dados.sector);
  assert.equal(d.cliente.site, dados.site);
  assert.equal(d.publico, dados.publico);
  assert.equal(d.marca, dados.marca);
  assert.deepEqual(d.objectivos, dados.objectivos);
  assert.deepEqual(d.concorrentes, dados.concorrentes);
  assert.deepEqual(d.canais, dados.canais);
});

// --- Critério 4: credencial vai para o cofre; o dossier regista só acesso: true ---

test('campos desconhecidos (token, password, api_key) são descartados', () => {
  const raiz = novaRaiz();
  const dados = {
    ...completo(),
    token: SEGREDO,
    password: SEGREDO + 'p',
    api_key: SEGREDO + 'k',
    cliente: { segredo: SEGREDO + 'c' },
    canais: [{ tipo: 'meta', id: 'act_1', acesso: true, token: SEGREDO + 'm', password: SEGREDO + 'x' }],
  };
  const { slug, caminho } = criarDossier(raiz, dados, { hoje: HOJE });
  const texto = readFileSync(caminho, 'utf8');
  assert.ok(!texto.includes(SEGREDO), 'o valor da credencial chegou ao dossier');
  assert.doesNotMatch(texto, /\b(token|password|api_key|segredo)\b/i);
  const { d } = frontmatter(texto);
  assert.deepEqual(d.canais, [{ tipo: 'meta', id: 'act_1', acesso: true }]);
  assert.deepEqual(validarDossier(texto, slug), []);
});

test('pelo CLI, um token na entrada também não chega ao ficheiro nem à saída', () => {
  const raiz = novaRaiz();
  const r = correrCriar(raiz, JSON.stringify({ nome: 'Cli Token', token: SEGREDO, canais: [{ tipo: 'ga4', acesso: true, token: SEGREDO }] }));
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes(SEGREDO) && !r.stderr.includes(SEGREDO));
  const texto = readFileSync(join(raiz, 'clientes', 'cli-token', 'dossier.md'), 'utf8');
  assert.ok(!texto.includes(SEGREDO));
  assert.equal(frontmatter(texto).d.canais[0].acesso, true);
});

test('acesso só é true quando a resposta é true (não "sim", não 1)', () => {
  const raiz = novaRaiz();
  const { caminho } = criarDossier(raiz, { nome: 'Acesso', canais: [{ tipo: 'ga4', acesso: 'sim' }, { tipo: 'gtm', acesso: 1 }, { tipo: 'gbp', acesso: true }] }, { hoje: HOJE });
  const { d } = frontmatter(readFileSync(caminho, 'utf8'));
  assert.deepEqual(d.canais.map((c) => c.acesso), [false, false, true]);
});

// guardar-credencial usa o cofre em ~/.config/marketeer: o HOME/USERPROFILE do processo filho aponta
// para uma pasta temporária, nunca para o ~ real.
function correrGuardar(home, args, entrada) {
  return spawnSync(process.execPath, [GUARDAR, ...args], {
    input: entrada,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

test('guardar-credencial lê o valor do stdin e guarda-o no cofre, sem o mostrar', () => {
  const home = novaRaiz();
  const slug = 'teste-cofre-' + process.pid;
  const real = join(homedir(), '.config', 'marketeer', `${slug}.env`);
  assert.ok(!existsSync(real));
  const r = correrGuardar(home, [slug, 'META_TOKEN'], SEGREDO + '\n');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes(SEGREDO) && !r.stderr.includes(SEGREDO), 'o valor apareceu na saída');
  assert.equal(ler(slug, 'META_TOKEN', { base: join(home, '.config', 'marketeer') }), SEGREDO);
  assert.ok(!existsSync(real), 'tocou no cofre real');
});

test('guardar-credencial não aceita o valor pelos argumentos', () => {
  const home = novaRaiz();
  // Sem stdin: o valor vazio não pode ser substituído por um argumento extra.
  const r = correrGuardar(home, ['teste-args', 'META_TOKEN', SEGREDO], '');
  assert.notEqual(r.status, 0);
  assert.ok(!r.stdout.includes(SEGREDO) && !r.stderr.includes(SEGREDO));
  assert.ok(!existsSync(join(home, '.config', 'marketeer', 'teste-args.env')));
});

test('guardar-credencial com valor vazio sai com erro e não guarda nada', () => {
  const home = novaRaiz();
  const r = correrGuardar(home, ['teste-vazio', 'META_TOKEN'], '');
  assert.equal(r.status, 1);
  assert.ok(!existsSync(join(home, '.config', 'marketeer', 'teste-vazio.env')));
});

test('guardar-credencial sem slug ou chave sai com 1 e não ecoa o stdin', () => {
  const home = novaRaiz();
  const r = correrGuardar(home, [], SEGREDO);
  assert.equal(r.status, 1);
  assert.ok(!r.stdout.includes(SEGREDO) && !r.stderr.includes(SEGREDO));
});

// Receita do cofre por heredoc com aspas (contrato que as skills do pack usam): valor literal.
test('guardar-credencial por heredoc <<\'FIM\' guarda o valor literal (sem expandir $ nem `)', { skip: process.platform === 'win32' && 'bash do heredoc' }, () => {
  const home = novaRaiz();
  const valor = 'Ab$HOME`id`\\n"q\'#:x';
  const cmd = `node "${GUARDAR}" heredoc META_TOKEN <<'FIM'\n${valor}\nFIM`;
  const r = spawnSync('/bin/bash', ['-c', cmd], { encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes(valor) && !r.stderr.includes(valor));
  assert.equal(ler('heredoc', 'META_TOKEN', { base: join(home, '.config', 'marketeer') }), valor);
});

// --- Issue #28: slug por subcomando CLI (`criar-dossier.mjs --slug`), sem `node -e` com import ---

const NOMES_SLUG = [
  'Café Pão & Cia.',
  'Açores, Madeira e Algarve',
  'Nome "com" aspas',
  'Custa $HOME e $(id)',
  'Com `crases` `id`',
  "D'Ouro Pastelaria",
  "Tudo: 'a' \"b\" $x `y` \\ fim",
];

const correrSlug = (args) => spawnSync(process.execPath, [CRIAR, ...args], { encoding: 'utf8' });

test('#28 --slug imprime exactamente gerarSlug(nome) numa linha, com exit 0', () => {
  for (const nome of NOMES_SLUG) {
    const esperado = gerarSlug(nome);
    assert.ok(esperado, `o nome de teste tem de dar slug não vazio: ${nome}`);
    const r = correrSlug(['--slug', nome]);
    assert.equal(r.status, 0, `${nome}: ${r.stderr}`);
    assert.match(r.stdout, /^[^\n]*\r?\n$/, `uma só linha: ${JSON.stringify(r.stdout)}`);
    assert.equal(r.stdout.trimEnd(), esperado, nome);
  }
});

test('#28 --slug não cria nada no disco nem lê o stdin', () => {
  const raiz = novaRaiz();
  const r = spawnSync(process.execPath, [CRIAR, '--slug', 'Padaria Teste'], { cwd: raiz, input: JSON.stringify(completo()), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trimEnd(), 'padaria-teste');
  assert.deepEqual(readdirSync(raiz), []);
});

test('#28 --slug sem nome sai com exit ≠ 0 e mensagem em stderr', () => {
  for (const args of [['--slug'], ['--slug', '']]) {
    const r = correrSlug(args);
    assert.notEqual(r.status, 0, JSON.stringify(args));
    assert.ok(r.stderr.trim().length > 0, `sem mensagem em stderr: ${JSON.stringify(args)}`);
    assert.equal(r.stdout.trim(), '', JSON.stringify(args));
  }
});

test('#28 --slug com nome que dá slug vazio sai com exit ≠ 0 e mensagem em stderr', () => {
  for (const nome of ['&&&', '   ', '!!! ???']) {
    assert.equal(gerarSlug(nome), '', `pressuposto: ${nome} dá slug vazio`);
    const r = correrSlug(['--slug', nome]);
    assert.notEqual(r.status, 0, nome);
    assert.ok(r.stderr.trim().length > 0, `sem mensagem em stderr: ${nome}`);
    assert.equal(r.stdout.trim(), '', nome);
  }
});

// #28: com o nome em "$(cat <<'NOME' …)" o bash 3.2 do macOS (/bin/bash) parte nomes com nº ímpar
// de apóstrofos (D'Ouro). `--slug -` lê o nome do stdin: heredoc direto, sem substituição de comando.
test('#28 --slug - <<\'NOME\' dá o mesmo que gerarSlug no /bin/bash (inclui \', ", $ e `)', { skip: process.platform === 'win32' && 'bash' }, () => {
  for (const nome of NOMES_SLUG) {
    const r = spawnSync('/bin/bash', ['-c', `node "${CRIAR}" --slug - <<'NOME'\n${nome}\nNOME`], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${nome}: ${r.stderr}`);
    assert.equal(r.stdout.trim(), gerarSlug(nome), nome);
  }
  const vazio = spawnSync('/bin/bash', ['-c', `node "${CRIAR}" --slug - <<'NOME'\n&&&\nNOME`], { encoding: 'utf8' });
  assert.notEqual(vazio.status, 0);
  assert.equal(vazio.stdout.trim(), '');
});

// --- gerarSlug (D-013) ---

test('gerarSlug: acentos, &, espaços e maiúsculas dão só minúsculas kebab', () => {
  assert.equal(gerarSlug('Café Pão & Cia.'), 'cafe-pao-cia');
  assert.equal(gerarSlug('  ÁGUA   Viva  '), 'agua-viva');
  assert.equal(gerarSlug('Açores & Madeira'), 'acores-madeira');
  assert.equal(gerarSlug('ÉÇÃÕ'), 'ecao');
  for (const s of ['Café Pão & Cia.', 'MAIÚSCULAS', 'Ñandú Ölçü', 'x & y']) {
    assert.match(gerarSlug(s), /^[a-z0-9]+(-[a-z0-9]+)*$/, s);
  }
});

test('gerarSlug de nomes que só diferem em maiúsculas dá o mesmo slug', () => {
  assert.equal(gerarSlug('Cliente'), gerarSlug('cliente'));
  assert.equal(gerarSlug('CAFÉ'), gerarSlug('café'));
});

test('gerarSlug translitera ø, ł e ß em vez de os perder', () => {
  assert.equal(gerarSlug('Søren Łódź Straße'), 'soren-lodz-strasse');
  assert.equal(gerarSlug('ØLAND ŁAD'), 'oland-lad');
});

test('gerarSlug corta a 60 caracteres sem hífen no fim', () => {
  const s = gerarSlug('Empresa '.repeat(20));
  assert.ok(s.length <= 60, String(s.length));
  assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.equal(gerarSlug('a'.repeat(59) + ' b'), 'a'.repeat(59));
});

test('o nome com quebras de linha e espaços repetidos fica numa linha só', () => {
  const raiz = novaRaiz();
  const { caminho } = criarDossier(raiz, { nome: '  Loja\n\n#  Norte\t ' }, { hoje: HOJE });
  const texto = readFileSync(caminho, 'utf8');
  const { d, corpo } = frontmatter(texto);
  assert.equal(d.cliente.nome, 'Loja # Norte');
  assert.match(corpo, /^\n?# Loja # Norte\n/);
});

// --- Uma validação que falha não cria a pasta ---

test('notas com "senha: abc123" são recusadas e a pasta não é criada', () => {
  const raiz = novaRaiz();
  assert.throws(() => criarDossier(raiz, { nome: 'Com Senha', notas: 'senha: abc123' }, { hoje: HOJE }));
  assert.ok(!existsSync(join(raiz, 'clientes', 'com-senha')));
});

test('pelo CLI, notas com senha saem com 1, sem pasta e sem ecoar a senha', () => {
  const raiz = novaRaiz();
  const r = correrCriar(raiz, JSON.stringify({ nome: 'Com Senha', notas: 'senha: abc123XYZ' }));
  assert.equal(r.status, 1);
  assert.ok(!existsSync(join(raiz, 'clientes', 'com-senha')));
  assert.ok(!r.stdout.includes('abc123XYZ') && !r.stderr.includes('abc123XYZ'));
});

test('um canal com tipo inválido é recusado e nada é escrito', () => {
  const raiz = novaRaiz();
  for (const tipo of ['myspace', undefined, '', 'GA4']) {
    assert.throws(() => criarDossier(raiz, { nome: 'Tipo Mau', canais: [{ tipo, acesso: false }] }, { hoje: HOJE }), String(tipo));
  }
  assert.ok(!existsSync(join(raiz, 'clientes', 'tipo-mau')));
  const r = correrCriar(raiz, JSON.stringify({ nome: 'Tipo Mau', canais: [{ tipo: 'myspace', acesso: true }] }));
  assert.equal(r.status, 1);
  assert.ok(!existsSync(join(raiz, 'clientes', 'tipo-mau')));
});

// --- CLI com stdin que não é JSON ---

test('CLI com stdin que não é JSON sai com 1 e não ecoa a entrada', () => {
  const raiz = novaRaiz();
  // Entrada curta: o JSON.parse do Node cita-a por inteiro na mensagem de erro.
  for (const [entrada, marca] of [[`{"nome": "X", META_TOKEN=${SEGREDO}`, SEGREDO], ['Qz7-pw9x', 'Qz7-pw9x'], ['Tk9Xq2Lm7Rw', 'Tk9X']]) {
    const r = correrCriar(raiz, entrada);
    assert.equal(r.status, 1);
    assert.ok(!r.stdout.includes(marca) && !r.stderr.includes(marca), `a entrada foi ecoada: ${marca}`);
  }
  assert.ok(!existsSync(join(raiz, 'clientes')));
});

test('CLI com stdin vazio sai com 1', () => {
  const raiz = novaRaiz();
  const r = correrCriar(raiz, '');
  assert.equal(r.status, 1);
  assert.ok(!existsSync(join(raiz, 'clientes')));
});

// --- #25: o site do dossier é um URL http(s) absoluto ou <sem fonte> ---

test('#25 site sem esquema grava-se com https:// e barra final', () => {
  for (const [entrada, gravado] of [['padaria.pt', 'https://padaria.pt/'], ['www.padaria.pt', 'https://www.padaria.pt/']]) {
    const raiz = novaRaiz();
    const { slug, caminho } = criarDossier(raiz, { ...completo(), site: entrada }, { hoje: HOJE });
    const texto = readFileSync(caminho, 'utf8');
    assert.equal(frontmatter(texto).d.cliente.site, gravado, entrada);
    assert.deepEqual(validarDossier(texto, slug), [], entrada);
  }
});

test('#25 ftp:, javascript: e texto livre são recusados com mensagem clara e nada é escrito', () => {
  for (const site of ['ftp://x', 'javascript:alert(1)', 'a minha padaria']) {
    const raiz = novaRaiz();
    assert.throws(() => criarDossier(raiz, { ...completo(), site }, { hoje: HOJE }), (e) => {
      assert.match(e.message, /cliente\.site.*URL http\(s\)/, site);
      assert.ok(!e.message.includes(site), `a mensagem não ecoa a entrada: ${site}`);
      return true;
    }, site);
    assert.ok(!existsSync(join(raiz, 'clientes')), `nada foi escrito: ${site}`);
    const r = correrCriar(raiz, JSON.stringify({ ...completo(), site }));
    assert.equal(r.status, 1, site);
    assert.match(r.stderr, /cliente\.site/, site);
  }
});

test('#25 <sem fonte> explícito continua aceite tal e qual', () => {
  const raiz = novaRaiz();
  const { slug, caminho } = criarDossier(raiz, { ...completo(), site: '<sem fonte>' }, { hoje: HOJE });
  const texto = readFileSync(caminho, 'utf8');
  assert.equal(frontmatter(texto).d.cliente.site, '<sem fonte>');
  assert.deepEqual(validarDossier(texto, slug), []);
});

test('#25 npm run validar recusa um dossier com site sem esquema', () => {
  const raiz = novaRaiz();
  const { caminho } = criarDossier(raiz, completo(), { hoje: HOJE });
  const texto = readFileSync(caminho, 'utf8');
  writeFileSync(caminho, texto.replace('site: https://padaria.invalid/', 'site: padaria.pt'));
  assert.match(readFileSync(caminho, 'utf8'), /site: padaria\.pt\n/);
  const r = correrValidar(raiz);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /cliente\.site/);
});
