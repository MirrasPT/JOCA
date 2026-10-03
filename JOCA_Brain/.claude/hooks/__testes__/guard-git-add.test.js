// Testes do guard-git-add.js — `node --test ".claude/hooks/__testes__/*.test.js"`
// Cada teste cria um repo git temporário; o estado do hook vai para uma pasta temporária
// (JOCA_GUARD_GIT_DIR) com session_id FALSO. HOOK_GIT=<caminho> aponta a uma cópia (mutação).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const HOOK = process.env.HOOK_GIT || path.join(__dirname, '..', 'guard-git-add.js');
let n = 0;

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-git-'));
  const g = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, stdio: 'pipe' });
  g('init', '-q');
  for (const f of ['a.txt', 'b.txt', 'alheio.txt']) fs.writeFileSync(path.join(dir, f), 'v1\n');
  g('add', '.'); g('commit', '-q', '-m', 'base');
  const estado = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-guard-estado-'));
  const sid = `teste-falso-git-${process.pid}-${n++}`;
  const hook = (command, extra = {}) => {
    const r = spawnSync(process.execPath, [HOOK], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, JOCA_GUARD_GIT_DIR: estado },
      input: JSON.stringify({ session_id: sid, cwd: dir, tool_input: { command }, ...extra }),
    });
    const out = (r.stdout || '').trim();
    return { nega: /"permissionDecision":"deny"/.test(out), out };
  };
  return { dir, g, hook };
}

test('commit sem nada staged alheio → passa', () => {
  const { hook } = repo();
  assert.ok(!hook('git commit -m "x"').nega);
});

test('T164: deleção alheia staged + git commit sem --only → recusa e nomeia o ficheiro', () => {
  const { g, hook } = repo();
  g('rm', '-q', 'alheio.txt');                 // outra sessão deixou isto staged
  const r = hook('git commit -m "x"');
  assert.ok(r.nega, r.out); assert.match(r.out, /alheio\.txt/);
});

test('git add do próprio comando cobre o que ele põe no índice', () => {
  const { dir, g, hook } = repo();
  fs.writeFileSync(path.join(dir, 'a.txt'), 'v2\n');
  g('add', 'a.txt');                           // já staged por fora do hook (ex.: script)
  assert.ok(!hook('git add a.txt && git commit -m "x"').nega);
  assert.ok(!hook('git add . && git commit -m "x"').nega);
});

test('git add num comando anterior desta sessão fica registado', () => {
  const { dir, g, hook } = repo();
  fs.writeFileSync(path.join(dir, 'a.txt'), 'v2\n');
  assert.ok(!hook('git add a.txt').nega); g('add', 'a.txt');
  assert.ok(!hook('git commit -m "x"').nega);
});

test('o próprio add não cobre o alheio', () => {
  const { dir, g, hook } = repo();
  g('rm', '-q', 'alheio.txt');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'v2\n');
  const r = hook('git add a.txt && git commit -m "x"');
  assert.ok(r.nega); assert.match(r.out, /alheio\.txt/); assert.doesNotMatch(r.out, /a\.txt[,)]/);
});

test('git commit --only <caminhos> e git commit <caminhos> passam', () => {
  const { g, hook } = repo();
  g('rm', '-q', 'alheio.txt');
  assert.ok(!hook('git commit --only a.txt -m "x"').nega);
  assert.ok(!hook('git commit -m "x" -- a.txt').nega);
  assert.ok(!hook('git commit -m "x" a.txt').nega);
});

test('-am conta como commit do índice', () => {
  const { g, hook } = repo();
  g('rm', '-q', 'alheio.txt');
  assert.ok(hook('git commit -am "x"').nega);
});

test('git -C <repo> commit também é verificado', () => {
  const { dir, g, hook } = repo();
  g('rm', '-q', 'alheio.txt');
  const r = spawnSync(process.execPath, [HOOK], {
    encoding: 'utf8', env: { ...process.env, JOCA_GUARD_GIT_DIR: os.tmpdir() },
    input: JSON.stringify({ session_id: 'teste-falso-git-C', cwd: os.tmpdir(), tool_input: { command: `git -C ${dir.replace(/\\/g, '/')} commit -m x` } }),
  });
  assert.match(r.stdout, /alheio\.txt/);
});

test('merge em curso → passa', () => {
  const { dir, g, hook } = repo();
  g('rm', '-q', 'alheio.txt');
  const gd = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: dir, encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(gd, 'MERGE_HEAD'), '0000000000000000000000000000000000000000\n');
  assert.ok(!hook('git commit --no-edit').nega);
});

test('texto entre aspas não é comando', () => {
  const { g, hook } = repo();
  g('rm', '-q', 'alheio.txt');
  assert.ok(!hook('echo "git commit -m x"').nega);
});

// Volta 2 — `cd` dentro do comando muda o repo e a base dos caminhos.
function hookEm(cwd, estado, sid, command) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd, encoding: 'utf8', env: { ...process.env, JOCA_GUARD_GIT_DIR: estado },
    input: JSON.stringify({ session_id: sid, cwd, tool_input: { command } }),
  });
  return { nega: /"permissionDecision":"deny"/.test(r.stdout || ''), out: r.stdout || '' };
}
const fwd = (p) => p.replace(/\\/g, '/');
const bash = (p) => (process.platform === 'win32' ? fwd(p).replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`) : p);

test('cd sub && git add p.txt num bloco + git commit noutro → passa', () => {
  const { dir, g, hook } = repo();
  fs.mkdirSync(path.join(dir, 'sub')); fs.writeFileSync(path.join(dir, 'sub', 'p.txt'), 'x\n');
  assert.ok(!hook('cd sub && git add p.txt').nega); g('add', 'sub/p.txt');
  const r = hook('git commit -m "x"'); assert.ok(!r.nega, r.out);
});

test('cd "dir com espaços" && git add p.txt → regista o caminho certo', () => {
  const { dir, g, hook } = repo();
  fs.mkdirSync(path.join(dir, 'com espaços')); fs.writeFileSync(path.join(dir, 'com espaços', 'p.txt'), 'x\n');
  assert.ok(!hook('cd "com espaços" && git add p.txt').nega); g('add', 'com espaços/p.txt');
  assert.ok(!hook('git commit -m x').nega);
});

test('cwd no repo B (alheio staged) + cd /abs/repoA && git add && git commit → passa', () => {
  const A = repo(); const B = repo();
  B.g('rm', '-q', 'alheio.txt');
  fs.writeFileSync(path.join(A.dir, 'a.txt'), 'v2\n');
  const est = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-guard-estado-'));
  const r = hookEm(B.dir, est, 'teste-falso-git-cdA', `cd ${fwd(A.dir)} && git add a.txt && git commit -m "x"`);
  assert.ok(!r.nega, r.out);
});

test('cwd no repo A limpo + cd /abs/repoB && git commit com alheio em B → recusa', () => {
  const A = repo(); const B = repo();
  B.g('rm', '-q', 'alheio.txt');
  const est = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-guard-estado-'));
  assert.ok(hookEm(A.dir, est, 'teste-falso-git-cdB', `cd ${fwd(B.dir)} && git commit -m x`).nega);
  assert.ok(hookEm(A.dir, est, 'teste-falso-git-cdB2', `cd "${bash(B.dir)}" && git commit -m x`).nega, 'caminho estilo Git Bash');
  assert.ok(hookEm(os.tmpdir(), est, 'teste-falso-git-cdB3', `cd ${fwd(B.dir)}; git commit -m x`).nega, 'cwd fora de repo');
});

test('cd para o repo + git -C relativo', () => {
  const { dir, g } = repo();
  const est = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-guard-estado-'));
  g('rm', '-q', 'alheio.txt');
  assert.ok(hookEm(os.tmpdir(), est, 'teste-falso-git-C2', `cd ${fwd(path.dirname(dir))} && git -C ${path.basename(dir)} commit -m x`).nega);
});

// Volta 3 — ciclo de um script de sincronização (update-index com caminho em variável) e ferramenta PowerShell.
const FASE4 = `git ls-files -s -- '*.sh' '*.command' | grep '^100644 ' | cut -f2- |
  while IFS= read -r f; do chmod +x "$f"; git update-index --chmod=+x "$f"; echo "  +x $f"; done`;

test('ciclo literal de sincronização + commit no comando seguinte → passa', () => {
  const { dir, g, hook } = repo();
  fs.writeFileSync(path.join(dir, 'lanca.sh'), 'echo\n'); g('add', 'lanca.sh'); g('commit', '-q', '-m', 'sh');
  assert.ok(!hook(FASE4).nega);
  g('update-index', '--chmod=+x', 'lanca.sh');   // efeito do comando (o hook só vê o texto)
  const r = hook('git commit -m "chore: bit de execução"'); assert.ok(!r.nega, r.out);
});

test('FASE 4 não branqueia alheio que já estava staged antes', () => {
  const { dir, g, hook } = repo();
  fs.writeFileSync(path.join(dir, 'lanca.sh'), 'echo\n'); g('add', 'lanca.sh'); g('commit', '-q', '-m', 'sh');
  g('rm', '-q', 'alheio.txt');
  assert.ok(!hook(FASE4).nega);
  g('update-index', '--chmod=+x', 'lanca.sh');
  const r = hook('git commit -m x'); assert.ok(r.nega); assert.match(r.out, /alheio\.txt/); assert.doesNotMatch(r.out, /lanca\.sh/);
});

test('git update-index --add <f> no próprio comando cobre <f>', () => {
  const { dir, g, hook } = repo();
  fs.writeFileSync(path.join(dir, 'novo.txt'), 'x\n'); g('add', 'novo.txt');
  assert.ok(!hook('git update-index --add novo.txt && git commit -m x').nega);
});

test('git add em PowerShell (Set-Location) + commit em Bash → passa', () => {
  const { dir, g, hook } = repo();
  fs.mkdirSync(path.join(dir, 'sub')); fs.writeFileSync(path.join(dir, 'sub', 'p.txt'), 'x\n');
  assert.ok(!hook('Set-Location sub; git add p.txt', { tool_name: 'PowerShell' }).nega); g('add', 'sub/p.txt');
  const r = hook('git commit -m "x"'); assert.ok(!r.nega, r.out);
});

test('PowerShell: Set-Location -Path "C:\\…\\B"; git commit com alheio → recusa (\\ é literal)', () => {
  const A = repo(); const B = repo();
  B.g('rm', '-q', 'alheio.txt');
  const r = A.hook(`Set-Location -Path "${B.dir}"; git commit -m "x"`, { tool_name: 'PowerShell' });
  assert.ok(r.nega, r.out); assert.match(r.out, /alheio\.txt/);
  assert.ok(A.hook(`git -C "${B.dir}" commit -m 'x'`, { tool_name: 'PowerShell' }).nega, 'git -C');
  assert.ok(A.hook(`cd ${B.dir}; git commit -m x`, { tool_name: 'PowerShell' }).nega, 'caminho sem aspas com \\');
  assert.ok(!A.hook(`git -C "${B.dir}" commit --only a.txt -m 'x'`, { tool_name: 'PowerShell' }).nega, '--only');
});

// Ref com caminhos — checkout/restore/reset de um ref com caminhos explícitos (forma B do /update-joca).
function comRef() {
  const r = repo();
  fs.writeFileSync(path.join(r.dir, 'a.txt'), 'v2\n'); fs.writeFileSync(path.join(r.dir, 'b.txt'), 'v2\n');
  r.g('commit', '-q', '-am', 'v2'); r.g('tag', 'outra'); r.g('reset', '-q', '--hard', 'HEAD~1');
  return r;
}

test('ref com caminhos: git checkout <ref> -- a b + git commit -m seguinte → passa', () => {
  const { g, hook } = comRef();
  assert.ok(!hook('git checkout outra -- a.txt b.txt').nega); g('checkout', 'outra', '--', 'a.txt', 'b.txt');
  const r = hook('git commit -m "x"'); assert.ok(!r.nega, r.out);
});

test('ref com caminhos: git restore --source=<ref> --staged e git reset <ref> -- <p> registam', () => {
  const a = comRef();
  assert.ok(!a.hook('git restore --source=outra --staged --worktree a.txt').nega); a.g('restore', '--source=outra', '--staged', '--worktree', 'a.txt');
  assert.ok(!a.hook('git commit -m x').nega);
  const b = comRef();
  assert.ok(!b.hook('git reset outra -- b.txt').nega); b.g('reset', '-q', 'outra', '--', 'b.txt');
  assert.ok(!b.hook('git commit -m x').nega);
});

test('ref com caminhos: git checkout <ref> sem -- não regista', () => {
  const { g, hook } = comRef();
  g('checkout', 'outra', '--', 'a.txt');                  // staged por fora
  assert.ok(!hook('git checkout outra a.txt').nega);
  assert.ok(!hook('git checkout -- a.txt').nega);       // sem ref: não mexe no índice
  const r = hook('git commit -m x'); assert.ok(r.nega, r.out); assert.match(r.out, /a\.txt/);
});

test('ref com caminhos: checkout <ref> -- a não cobre o alheio staged por outro processo', () => {
  const { g, hook } = comRef();
  g('rm', '-q', 'alheio.txt');
  const r = hook('git checkout outra -- a.txt && git commit -m x');
  assert.ok(r.nega, r.out); assert.match(r.out, /alheio\.txt/); assert.doesNotMatch(r.out, /a\.txt[,)]/);
});

// Regressão do comportamento original (stage em massa com subagente)
test('git add -A vindo de subagente → recusa', () => {
  const { hook } = repo();
  const r = hook('git add -A', { agent_id: 'ag1' });
  assert.ok(r.nega); assert.match(r.out, /git add -A/);
});
test('git add <caminho> de subagente → passa', () => {
  const { hook } = repo();
  assert.ok(!hook('git add a.txt', { agent_id: 'ag1' }).nega);
});
