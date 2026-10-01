// Regressões da revisão do PR #23: o que chega ao cofre é exactamente o valor escrito, ou nada.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lerTeclas, ERRO_VARIAS_LINHAS, ERRO_CONTROLO, AVISO_STDIN } from '../scripts/guardar-credencial.mjs';
import { ler } from '../scripts/cofre.mjs';

const GUARDAR = fileURLToPath(new URL('../scripts/guardar-credencial.mjs', import.meta.url));
const SEGREDO = 'Tk-Muito-Unico-7a6b5c4d3e2f1a0b';

const pastas = [];
after(() => pastas.forEach((p) => rmSync(p, { recursive: true, force: true })));
function novoHome() {
  const p = mkdtempSync(join(tmpdir(), 'marketeer-guardar-'));
  pastas.push(p);
  return p;
}

// HOME/USERPROFILE temporários: nunca se toca no cofre real.
function correr(home, args, entrada) {
  return spawnSync(process.execPath, [GUARDAR, ...args], {
    input: entrada,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}
const cofre = (home, slug) => join(home, '.config', 'marketeer', `${slug}.env`);

// Aplica os blocos em sequência, como chegariam do terminal.
function teclas(...blocos) {
  let e = { valor: '', colar: false, fim: null };
  for (const b of blocos) {
    e = lerTeclas(e, b);
    if (e.fim) break;
  }
  return e;
}

// --- parser de teclas (modo escondido) ---

test('lerTeclas: escrever e Enter devolve o valor', () => {
  assert.deepEqual(teclas('abc', 'def\r'), { valor: 'abcdef', colar: false, fim: 'ok' });
});

test('lerTeclas: backspace apaga o último carácter', () => {
  assert.equal(teclas('abcX\x7fd\r').valor, 'abcd');
  assert.equal(teclas('ab\b\r').valor, 'a');
});

test('lerTeclas: Ctrl+C cancela', () => {
  assert.equal(teclas('segredo\x03').fim, 'cancelado');
});

test('lerTeclas: colagem com várias linhas num bloco é recusada, não truncada', () => {
  assert.equal(teclas('linha1\r\nlinha2\r').fim, 'varias-linhas');
  assert.equal(teclas('linha1\nlinha2').fim, 'varias-linhas');
  assert.equal(teclas('{\n  "type": "service_account"\n}\r').fim, 'varias-linhas');
});

test('lerTeclas: \\r\\n no fim do bloco é um Enter só', () => {
  assert.equal(teclas('valor\r\n').fim, 'ok');
});

test('lerTeclas: bracketed paste de uma linha passa sem os marcadores', () => {
  assert.deepEqual(teclas('\x1b[200~colado\x1b[201~', '\r'), { valor: 'colado', colar: false, fim: 'ok' });
});

test('lerTeclas: bracketed paste com quebra de linha é recusado, mesmo em blocos separados', () => {
  assert.equal(teclas('\x1b[200~linha1', '\rlinha2\x1b[201~').fim, 'varias-linhas');
  assert.equal(teclas('\x1b[200~linha1\nlinha2\x1b[201~\r').fim, 'varias-linhas');
});

test('lerTeclas: setas, Esc, Tab e outros caracteres de controlo são recusados', () => {
  for (const b of ['ab\x1b[Dc\r', '\x1b\r', 'a\tb\r', 'a\x00b\r', 'a\x9bb\r']) {
    assert.equal(teclas(b).fim, 'controlo', JSON.stringify(b));
  }
  // Em blocos separados (seta escrita depois de parte do valor), também.
  assert.equal(teclas('abc', '\x1b[A', 'd\r').fim, 'controlo');
});

test('lerTeclas: acentos e símbolos normais passam', () => {
  assert.equal(teclas('pão-€_ção!@#\r').valor, 'pão-€_ção!@#');
});

// --- sem TTY (stdin em pipe) ---

test('stdin com caracteres de controlo: sai com 1 e não guarda nada', () => {
  for (const v of ['ab\x1b[Dc', 'a\tb', 'a\x00b']) {
    const home = novoHome();
    const r = correr(home, ['controlo', 'TOKEN'], v + '\n');
    assert.equal(r.status, 1, JSON.stringify(v));
    assert.ok(r.stderr.includes(ERRO_CONTROLO));
    assert.ok(!existsSync(cofre(home, 'controlo')));
  }
});

test('stdin com várias linhas: sai com 1, não guarda nada e sugere o caminho do ficheiro', () => {
  const home = novoHome();
  const r = correr(home, ['multi', 'SA_JSON'], `{\n"private_key": "${SEGREDO}"\n}\n`);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /várias linhas/);
  assert.match(r.stderr, /caminho do ficheiro/);
  assert.ok(!r.stdout.includes(SEGREDO) && !r.stderr.includes(SEGREDO));
  assert.ok(!existsSync(cofre(home, 'multi')));
  assert.ok(ERRO_VARIAS_LINHAS.includes('nada foi guardado'));
});

test('sem TTY avisa no stderr que está a ler do stdin e que o valor pode aparecer', () => {
  const home = novoHome();
  const r = correr(home, ['aviso', 'TOKEN'], SEGREDO + '\n');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stderr.includes(AVISO_STDIN), r.stderr);
  assert.match(AVISO_STDIN, /PODE aparecer no ecrã/);
  assert.match(AVISO_STDIN, /Ctrl\+D/);
  assert.ok(!r.stdout.includes(SEGREDO) && !r.stderr.includes(SEGREDO));
});

// Com o stdin aberto e sem dados: se o script lesse o valor antes de validar, ficava à espera.
function correrSemFecharStdin(home, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [GUARDAR, ...args], { env: { ...process.env, HOME: home, USERPROFILE: home } });
    let stderr = '';
    p.stderr.on('data', (d) => (stderr += d));
    const t = setTimeout(() => { p.kill(); reject(new Error('ficou à espera do valor antes de validar')); }, 5000);
    p.on('close', (status) => { clearTimeout(t); p.stdin.destroy(); resolve({ status, stderr }); });
  });
}

test('slug ou chave inválidos falham antes de ler o valor', async () => {
  const home = novoHome();
  for (const [args, erro] of [[['Maiusculas', 'TOKEN'], /slug inválido/], [['../fora', 'TOKEN'], /slug inválido/], [['ok', 'COM-HIFEN'], /chave inválida/], [['ok', 'A=B'], /chave inválida/]]) {
    const r = await correrSemFecharStdin(home, args);
    assert.equal(r.status, 1, args.join(' '));
    assert.match(r.stderr, erro);
    assert.ok(!r.stderr.includes(AVISO_STDIN), 'chegou a pedir o valor');
  }
  assert.ok(!existsSync(join(home, '.config')));
});

test('um erro depois de ler nunca ecoa o valor', () => {
  const home = novoHome();
  for (const v of [`${SEGREDO}\n${SEGREDO}`, `${SEGREDO}\x1b[D`]) {
    const r = correr(home, ['eco', 'TOKEN'], v);
    assert.equal(r.status, 1);
    assert.ok(!r.stdout.includes(SEGREDO) && !r.stderr.includes(SEGREDO));
  }
});

test('stdin com uma linha e \\r\\n final guarda o valor sem o \\r', () => {
  const home = novoHome();
  const r = correr(home, ['crlf', 'TOKEN'], `${SEGREDO}\r\n`);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(ler('crlf', 'TOKEN', { base: join(home, '.config', 'marketeer') }), SEGREDO);
});

// --- TTY real (pseudo-terminal via python3; sem ele, ou no Windows, salta) ---

const temPython = process.platform !== 'win32' && spawnSync('python3', ['-c', 'import pty'], { encoding: 'utf8' }).status === 0;

// Escreve os blocos no terminal com as pausas dadas; devolve o código de saída do script.
const PTY = `
import os, pty, sys, time, json, select
script, home, chave, blocos = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4])
pid, fd = pty.fork()
if pid == 0:
    os.environ['HOME'] = home
    os.execvp('node', ['node', script, 'tty', chave])
time.sleep(0.6)
for pausa, dados in blocos:
    time.sleep(pausa); os.write(fd, dados.encode('latin-1'))
end = time.time() + 4
while time.time() < end:
    r, _, _ = select.select([fd], [], [], 0.2)
    if r:
        try:
            if not os.read(fd, 4096): break
        except OSError: break
_, st = os.waitpid(pid, 0)
print(os.waitstatus_to_exitcode(st))
`;
function correrTty(home, chave, blocos) {
  const r = spawnSync('python3', ['-c', PTY, GUARDAR, home, chave, JSON.stringify(blocos)], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${join(process.execPath, '..')}:${process.env.PATH}` },
  });
  assert.equal(r.status, 0, r.stderr);
  return Number(r.stdout.trim());
}

test('TTY: valor escrito e Enter guarda-o', { skip: !temPython && 'sem python3/pty' }, () => {
  const home = novoHome();
  assert.equal(correrTty(home, 'OK', [[0, 'abcX\x7fd\r']]), 0);
  assert.equal(ler('tty', 'OK', { base: join(home, '.config', 'marketeer') }), 'abcd');
});

test('TTY: colagem com várias linhas, seta ou colagem partida no Enter não guardam nada', { skip: !temPython && 'sem python3/pty' }, () => {
  for (const [nome, blocos] of [
    ['um bloco', [[0, 'linha1\r\nlinha2\r']]],
    ['dois blocos', [[0, 'linha1\r'], [0.03, 'linha2\r']]],
    ['bracketed paste', [[0, '\x1b[200~linha1\rlinha2\x1b[201~'], [0.05, '\r']]],
    ['seta', [[0, 'ab'], [0.05, '\x1b[D'], [0.05, 'c\r']]],
  ]) {
    const home = novoHome();
    assert.equal(correrTty(home, 'MAU', blocos), 1, nome);
    assert.ok(!existsSync(cofre(home, 'tty')), nome);
  }
});
