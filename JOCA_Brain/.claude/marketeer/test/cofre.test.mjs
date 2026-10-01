// Testes escritos a partir dos critérios de aceitação do issue #2, não da implementação.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, statSync, lstatSync, writeFileSync, readFileSync, chmodSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { guardar, ler } from '../scripts/cofre.mjs';

const WINDOWS = process.platform === 'win32';
const SEGREDO = 'S3gr3do-Muito-Unico-9f8e7d6c';

// Base isolada: nunca tocar no ~/.config real. Apagadas no fim, mesmo que um teste falhe (#29).
const pastas = [];
after(() => pastas.forEach((p) => rmSync(p, { recursive: true, force: true })));
const novaBase = (prefixo = 'marketeer-cofre-') => {
  const p = mkdtempSync(join(tmpdir(), prefixo));
  pastas.push(p);
  return p;
};

// Todos os ficheiros (caminho completo) debaixo de uma pasta.
function ficheiros(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...ficheiros(p));
    else out.push(p);
  }
  return out;
}

const ficheiroDoSlug = (base, slug) => {
  const f = ficheiros(base).filter((p) => p.endsWith(`${slug}.env`));
  assert.equal(f.length, 1, `esperava exactamente um ${slug}.env debaixo da base`);
  return f[0];
};

// Captura tudo o que sai por stdout/stderr/console durante fn. Devolve { saida, avisos, erro, valor }.
function capturar(fn) {
  const saida = [];
  const avisos = [];
  const origOut = process.stdout.write;
  const origErr = process.stderr.write;
  const origConsole = {};
  const metodos = ['log', 'info', 'debug', 'warn', 'error', 'trace'];
  process.stdout.write = (c, ...r) => { saida.push(String(c)); return true; };
  process.stderr.write = (c, ...r) => { saida.push(String(c)); return true; };
  for (const m of metodos) {
    origConsole[m] = console[m];
    console[m] = (...args) => {
      const txt = args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a))).join(' ');
      saida.push(txt);
      if (m === 'warn') avisos.push(txt);
    };
  }
  let erro = null;
  let valor;
  try {
    valor = fn();
  } catch (e) {
    erro = e;
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
    for (const m of metodos) console[m] = origConsole[m];
  }
  return { saida: saida.join('\n'), avisos, erro, valor };
}

// --- Critério 1: guardar cria o ficheiro com permissões 600 em Linux/macOS ---

test('guardar cria o ficheiro <slug>.env dentro da base', () => {
  const base = novaBase();
  guardar('cliente-a', 'GA4_ID', SEGREDO, { base });
  const f = ficheiroDoSlug(base, 'cliente-a');
  assert.ok(statSync(f).isFile());
});

test('guardar deixa o ficheiro com permissões 600', { skip: WINDOWS && 'permissões POSIX não se aplicam no Windows' }, () => {
  const base = novaBase();
  guardar('cliente-a', 'GA4_ID', SEGREDO, { base });
  const modo = statSync(ficheiroDoSlug(base, 'cliente-a')).mode & 0o777;
  assert.equal(modo.toString(8), '600');
});

test('guardar numa chave nova mantém as permissões 600', { skip: WINDOWS && 'permissões POSIX não se aplicam no Windows' }, () => {
  const base = novaBase();
  guardar('cliente-a', 'GA4_ID', 'um', { base });
  guardar('cliente-a', 'GSC_TOKEN', 'dois', { base });
  const modo = statSync(ficheiroDoSlug(base, 'cliente-a')).mode & 0o777;
  assert.equal(modo.toString(8), '600');
});

test('guardar corrige para 600 um ficheiro existente demasiado aberto', { skip: WINDOWS && 'permissões POSIX não se aplicam no Windows' }, () => {
  const base = novaBase();
  guardar('cliente-a', 'GA4_ID', 'um', { base });
  const f = ficheiroDoSlug(base, 'cliente-a');
  chmodSync(f, 0o644);
  guardar('cliente-a', 'GA4_ID', 'dois', { base });
  assert.equal((statSync(ficheiroDoSlug(base, 'cliente-a')).mode & 0o777).toString(8), '600');
});

test('guardar uma segunda chave não apaga a primeira', () => {
  const base = novaBase();
  guardar('cliente-a', 'GA4_ID', 'valor-ga4', { base });
  guardar('cliente-a', 'GSC_TOKEN', 'valor-gsc', { base });
  assert.equal(ler('cliente-a', 'GA4_ID', { base }), 'valor-ga4');
  assert.equal(ler('cliente-a', 'GSC_TOKEN', { base }), 'valor-gsc');
});

test('guardar a mesma chave substitui o valor', () => {
  const base = novaBase();
  guardar('cliente-a', 'GA4_ID', 'antigo', { base });
  guardar('cliente-a', 'GA4_ID', 'novo', { base });
  assert.equal(ler('cliente-a', 'GA4_ID', { base }), 'novo');
});

test('clientes diferentes ficam em ficheiros diferentes', () => {
  const base = novaBase();
  guardar('cliente-a', 'GA4_ID', 'do-a', { base });
  guardar('cliente-b', 'GA4_ID', 'do-b', { base });
  assert.equal(ler('cliente-a', 'GA4_ID', { base }), 'do-a');
  assert.equal(ler('cliente-b', 'GA4_ID', { base }), 'do-b');
  ficheiroDoSlug(base, 'cliente-a');
  ficheiroDoSlug(base, 'cliente-b');
});

// --- Critério 2: no Windows grava e avisa que as permissões não são restringidas ---

test('no Windows guardar grava e emite aviso sobre as permissões', { skip: !WINDOWS && 'só se aplica no Windows' }, () => {
  const base = novaBase();
  const r = capturar(() => guardar('cliente-a', 'GA4_ID', SEGREDO, { base }));
  assert.equal(r.erro, null, 'guardar não pode falhar no Windows');
  assert.ok(r.avisos.length > 0, 'esperava um console.warn');
  assert.match(r.avisos.join('\n'), /permiss/i);
  assert.ok(!r.avisos.join('\n').includes(SEGREDO), 'o aviso não pode conter o valor');
  assert.equal(ler('cliente-a', 'GA4_ID', { base }), SEGREDO);
});

// --- Critério 3: ler devolve o valor sem o escrever em stdout/stderr nem em mensagens de erro ---

test('ler devolve o valor guardado', () => {
  const base = novaBase();
  guardar('cliente-a', 'GA4_ID', SEGREDO, { base });
  assert.equal(ler('cliente-a', 'GA4_ID', { base }), SEGREDO);
});

test('ler devolve valores com = e espaços intactos', () => {
  const base = novaBase();
  const valor = 'a=b c==d  e';
  guardar('cliente-a', 'TOKEN', valor, { base });
  assert.equal(ler('cliente-a', 'TOKEN', { base }), valor);
});

test('guardar e ler não imprimem o valor em stdout/stderr/console', () => {
  const base = novaBase();
  const g = capturar(() => guardar('cliente-a', 'GA4_ID', SEGREDO, { base }));
  const l = capturar(() => ler('cliente-a', 'GA4_ID', { base }));
  assert.equal(g.erro, null);
  assert.equal(l.erro, null);
  assert.equal(l.valor, SEGREDO, 'a captura tem de devolver o valor, senão o teste não prova nada');
  assert.ok(!g.saida.includes(SEGREDO), 'guardar imprimiu o valor');
  assert.ok(!l.saida.includes(SEGREDO), 'ler imprimiu o valor');
});

test('um erro em guardar não inclui o valor na mensagem nem na saída', () => {
  const base = novaBase();
  const r = capturar(() => guardar('../fora', 'GA4_ID', SEGREDO, { base }));
  assert.ok(r.erro, 'um slug inválido tem de dar erro');
  assert.ok(!String(r.erro.message).includes(SEGREDO), 'a mensagem de erro contém o valor');
  assert.ok(!String(r.erro.stack ?? '').includes(SEGREDO), 'o stack contém o valor');
  assert.ok(!r.saida.includes(SEGREDO), 'o erro imprimiu o valor');
});

test('um erro em ler não inclui valores guardados na mensagem', () => {
  const base = novaBase();
  guardar('cliente-a', 'GA4_ID', SEGREDO, { base });
  const r = capturar(() => ler('../cliente-a', 'GA4_ID', { base }));
  assert.ok(r.erro, 'um slug inválido tem de dar erro');
  assert.ok(!String(r.erro.message).includes(SEGREDO));
  assert.ok(!r.saida.includes(SEGREDO));
});

// --- Critério 4: valor inexistente devolve null, sem excepção com o nome do ficheiro ---

test('ler de um cliente sem ficheiro devolve null', () => {
  const base = novaBase();
  const r = capturar(() => ler('cliente-inexistente', 'GA4_ID', { base }));
  assert.equal(r.erro, null, `não devia lançar: ${r.erro?.message}`);
  assert.equal(r.valor, null);
});

test('ler de uma base que ainda não existe devolve null', () => {
  const base = join(novaBase(), 'ainda-nao-existe');
  const r = capturar(() => ler('cliente-a', 'GA4_ID', { base }));
  assert.equal(r.erro, null, `não devia lançar: ${r.erro?.message}`);
  assert.equal(r.valor, null);
});

test('ler uma chave inexistente num ficheiro existente devolve null', () => {
  const base = novaBase();
  guardar('cliente-a', 'GA4_ID', SEGREDO, { base });
  assert.equal(ler('cliente-a', 'OUTRA_CHAVE', { base }), null);
});

test('uma chave que é prefixo de outra não devolve o valor da outra', () => {
  const base = novaBase();
  guardar('cliente-a', 'GA4_ID', SEGREDO, { base });
  assert.equal(ler('cliente-a', 'GA4', { base }), null);
});

// --- Segurança do caminho: o slug nunca permite escrever fora da base ---

const SLUGS_MAUS = ['..', '../fora', '../../fora', 'a/b', 'a\\b', '/abs', 'x/../../y', ''];

for (const slug of SLUGS_MAUS) {
  test(`guardar recusa o slug ${JSON.stringify(slug)} e não escreve fora da base`, () => {
    const raiz = novaBase();
    const base = join(raiz, 'cofre');
    mkdirSync(base);
    assert.throws(() => guardar(slug, 'GA4_ID', SEGREDO, { base }));
    const escritos = ficheiros(raiz);
    assert.deepEqual(escritos, [], `foram escritos ficheiros: ${escritos.join(', ')}`);
  });

  test(`ler recusa o slug ${JSON.stringify(slug)}`, () => {
    const raiz = novaBase();
    const base = join(raiz, 'cofre');
    mkdirSync(base);
    // Um ficheiro "alvo" fora da base: não pode ser lido através do slug.
    writeFileSync(join(raiz, 'fora.env'), `GA4_ID=${SEGREDO}\n`);
    let valor;
    assert.throws(() => { valor = ler(slug, 'GA4_ID', { base }); });
    assert.notEqual(valor, SEGREDO);
  });
}

// --- Regressões da revisão do PR #15 ---

test('guardar corrige para 700 uma pasta do cofre que já existia aberta', { skip: WINDOWS && 'permissões POSIX não se aplicam no Windows' }, () => {
  const base = novaBase();
  chmodSync(base, 0o755);
  guardar('cliente-a', 'GA4_ID', SEGREDO, { base });
  assert.equal((statSync(base).mode & 0o777).toString(8), '700');
});

test('guardar não segue um symlink plantado no caminho do temporário', { skip: WINDOWS && 'criar symlinks no Windows exige privilégios' }, () => {
  const raiz = novaBase();
  const base = join(raiz, 'cofre');
  mkdirSync(base);
  const alvo = join(raiz, 'do-atacante.txt');
  writeFileSync(alvo, 'intacto\n');
  // O nome que o temporário tinha quando era previsível (<caminho>.<pid>.tmp).
  symlinkSync(alvo, join(base, `cliente-a.env.${process.pid}.tmp`));
  guardar('cliente-a', 'GA4_ID', SEGREDO, { base });
  assert.equal(readFileSync(alvo, 'utf8'), 'intacto\n', 'o segredo foi escrito no alvo do symlink');
  const f = join(base, 'cliente-a.env');
  assert.ok(lstatSync(f).isFile() && !lstatSync(f).isSymbolicLink(), '<slug>.env tem de ser um ficheiro normal');
  assert.equal(ler('cliente-a', 'GA4_ID', { base }), SEGREDO);
});

test('uma linha sem = não coincide com a chave de que é prefixo', () => {
  const base = novaBase();
  writeFileSync(join(base, 'c.env'), 'TOKENx\n');
  assert.equal(ler('c', 'TOKEN', { base }), null);
  guardar('c', 'TOKEN', 'v', { base });
  const linhas = readFileSync(join(base, 'c.env'), 'utf8').split('\n');
  assert.ok(linhas.includes('TOKENx'), 'guardar apagou a linha TOKENx');
  assert.equal(ler('c', 'TOKEN', { base }), 'v');
});

test('ler ignora um BOM no início do ficheiro', () => {
  const base = novaBase();
  writeFileSync(join(base, 'c.env'), '﻿GA4_ID=valor\n');
  assert.equal(ler('c', 'GA4_ID', { base }), 'valor');
});

test('se guardar falha a ler o ficheiro, o erro fala em guardar, sem valor nem caminho', () => {
  const base = novaBase();
  mkdirSync(join(base, 'c.env')); // ler uma pasta dá EISDIR
  const r = capturar(() => guardar('c', 'GA4_ID', SEGREDO, { base }));
  assert.ok(r.erro, 'guardar tinha de falhar');
  assert.match(r.erro.message, /guardar/);
  assert.doesNotMatch(r.erro.message, /\bler\b/);
  assert.ok(!r.erro.message.includes(SEGREDO), 'a mensagem contém o valor');
  assert.ok(!r.erro.message.includes(base), 'a mensagem contém o caminho');
});

test('slug com maiúsculas é recusado no cofre (D-013)', () => {
  const base = novaBase('cofre-maiusc-');
  assert.throws(() => guardar('Cliente', 'K', 'v', { base }));
  assert.throws(() => ler('Cliente', 'K', { base }));
});
