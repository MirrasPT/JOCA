// Testes do registo-uso.js + uso-skills.mjs (F1.1) — `node --test ".claude/hooks/__testes__/*.test.js"`
// Cada teste cria um CLAUDE_PROJECT_DIR FALSO em temp (skills/agentes de brincar) com session_id FALSO;
// nunca toca no .joca/ real. HOOK_USO=<caminho> aponta a uma cópia (teste de mutação).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = process.env.HOOK_USO || path.join(__dirname, '..', 'registo-uso.js');
const TRIAGE = path.join(__dirname, '..', 'prompt-triage.js');
const RELATORIO = path.join(__dirname, '..', '..', 'scripts', 'uso-skills.mjs');
let n = 0;

function projecto() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-uso-'));
  fs.mkdirSync(path.join(dir, '.claude', 'skills'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.claude', 'agents'), { recursive: true });
  for (const s of ['frontend', 'nunca-lida']) fs.writeFileSync(path.join(dir, '.claude', 'skills', `${s}.md`), `# ${s}\n`);
  fs.writeFileSync(path.join(dir, '.claude', 'agents', 'tester-code.md'), '# t\n');
  const sid = `teste-falso-uso-${process.pid}-${n++}`;
  const env = { ...process.env, CLAUDE_PROJECT_DIR: dir, JOCA_MAQUINA: '' };
  const hook = (tool_name, tool_input, extra = {}) => spawnSync(process.execPath, [HOOK], {
    encoding: 'utf8', env: { ...env, ...extra.env },
    input: JSON.stringify({ session_id: extra.sid === undefined ? sid : extra.sid, tool_name, tool_input }),
  });
  const registos = () => {
    try { return fs.readFileSync(path.join(dir, '.joca', 'uso-skills.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse); }
    catch { return []; }
  };
  const skill = (s) => path.join(dir, '.claude', 'skills', `${s}.md`);
  return { dir, sid, env, hook, registos, skill };
}

test('Read de skill → 1 linha skill, stdout vazio (0 tokens), maquina pela plataforma', () => {
  const p = projecto();
  const r = p.hook('Read', { file_path: p.skill('frontend') });
  assert.strictEqual(r.status, 0); assert.strictEqual(r.stdout, '');
  const l = p.registos();
  assert.strictEqual(l.length, 1);
  assert.deepStrictEqual({ tipo: l[0].tipo, nome: l[0].nome, sessao: l[0].sessao, maquina: l[0].maquina },
    { tipo: 'skill', nome: 'frontend', sessao: p.sid, maquina: { win32: 'win', darwin: 'mac' }[process.platform] || 'local' });
  assert.deepStrictEqual(Object.keys(l[0]).sort(), ['maquina', 'nome', 'sessao', 'tipo', 'ts']);
});

test('Agent → 1 linha agente; Read de skill + Agent → 2 linhas', () => {
  const p = projecto();
  p.hook('Agent', { subagent_type: 'tester-code', prompt: 'SEGREDO-DO-PROMPT' });
  assert.deepStrictEqual(p.registos().map((x) => [x.tipo, x.nome]), [['agente', 'tester-code']]);
  p.hook('Read', { file_path: p.skill('frontend').replace(/\//g, '\\') });  // caminho Windows
  assert.strictEqual(p.registos().length, 2);
  assert.doesNotMatch(fs.readFileSync(path.join(p.dir, '.joca', 'uso-skills.jsonl'), 'utf8'), /SEGREDO/);
});

test('controlo negativo: Read de ficheiro que não é skill → 0 linhas', () => {
  const p = projecto();
  p.hook('Read', { file_path: path.join(p.dir, 'README.md') });
  p.hook('Read', { file_path: path.join(p.dir, '.claude', 'skills', 'sub', 'ref.md') });  // não é skill de 1.º nível
  p.hook('Read', { file_path: path.join(p.dir, '.claude', 'agents', 'tester-code.md') });
  p.hook('Read', { file_path: p.skill('frontend') }, { sid: '' });                         // sem sessão
  assert.strictEqual(p.registos().length, 0);
});

test('Read de skill numa sessão que a edita → manut (não conta como uso)', () => {
  const p = projecto();
  p.hook('Edit', { file_path: p.skill('frontend'), old_string: 'a', new_string: 'b' });
  p.hook('Read', { file_path: p.skill('frontend') });
  assert.deepStrictEqual(p.registos().map((x) => x.tipo), ['manut', 'manut']);
  // outra sessão, mesma skill → uso normal
  p.hook('Read', { file_path: p.skill('frontend') }, { sid: `${p.sid}-outra` });
  assert.strictEqual(p.registos()[2].tipo, 'skill');
});

test('sem JOCA_MAQUINA → plataforma simulada: win32→win, darwin→mac, outra→local', () => {
  const { maquina } = require(HOOK);
  const antes = process.env.JOCA_MAQUINA; delete process.env.JOCA_MAQUINA;
  try {
    assert.deepStrictEqual(['win32', 'darwin', 'linux', 'freebsd'].map((x) => maquina(x)), ['win', 'mac', 'local', 'local']);
    process.env.JOCA_MAQUINA = 'portatil';
    assert.strictEqual(maquina('darwin'), 'portatil');            // JOCA_MAQUINA manda
  } finally { if (antes === undefined) delete process.env.JOCA_MAQUINA; else process.env.JOCA_MAQUINA = antes; }
});

test('JOCA_MAQUINA dá o nome da máquina', () => {
  const p = projecto();
  p.hook('Skill', { skill: 'frontend' }, { env: { JOCA_MAQUINA: 'pc-teste' } });
  assert.strictEqual(p.registos()[0].maquina, 'pc-teste');
});

test('prompt-triage regista as sugestões com a sessão; sem sessão não regista', () => {
  const p = projecto();
  const triar = (session_id) => spawnSync(process.execPath, [TRIAGE], {
    encoding: 'utf8', env: p.env, input: JSON.stringify({ session_id, prompt: 'cria uma landing page em react com tailwind' }),
  });
  triar(undefined);
  assert.strictEqual(p.registos().length, 0);
  const r = triar(p.sid);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /\[skill\]/);
  const l = p.registos();
  assert.ok(l.length >= 1 && l.length <= 3, JSON.stringify(l));
  assert.ok(l.every((x) => x.tipo === 'sugerida' && x.sessao === p.sid));
  assert.doesNotMatch(fs.readFileSync(path.join(p.dir, '.joca', 'uso-skills.jsonl'), 'utf8'), /landing page em react/);
});

test('relatório lista usadas, nunca usadas e sugeridas não lidas; resumo mensal sem conteúdo', () => {
  const p = projecto();
  p.hook('Read', { file_path: p.skill('frontend') });
  p.hook('Agent', { subagent_type: 'tester-code' });
  fs.appendFileSync(path.join(p.dir, '.joca', 'uso-skills.jsonl'),
    JSON.stringify({ ts: new Date().toISOString(), tipo: 'sugerida', nome: 'seo', sessao: p.sid, maquina: 'local' }) + '\n'
    + JSON.stringify({ ts: new Date().toISOString(), tipo: 'sugerida', nome: 'frontend', sessao: p.sid, maquina: 'local' }) + '\n');
  const rel = spawnSync(process.execPath, [RELATORIO], { encoding: 'utf8', env: p.env });
  assert.strictEqual(rel.status, 0, rel.stderr);
  assert.match(rel.stdout, /## Usadas — skills[\s\S]*- frontend: 1 · 11/);
  assert.match(rel.stdout, /- tester-code: 1/);
  assert.match(rel.stdout, /## Nunca usadas\n- skills: nunca-lida\n- agentes: —/);
  assert.match(rel.stdout, /## Sugeridas e não lidas[^\n]*\n- seo: 1 de 1/);
  assert.doesNotMatch(rel.stdout.split('## Sugeridas')[1], /frontend/);   // sugerida e lida → fora

  const mes = new Date().toISOString().slice(0, 7);
  const r = spawnSync(process.execPath, [RELATORIO, '--resumo-mensal'], { encoding: 'utf8', env: { ...p.env, JOCA_MAQUINA: 'win' } });
  assert.strictEqual(r.status, 0, r.stderr);
  const txt = fs.readFileSync(path.join(p.dir, 'memory', 'uso-skills', `${mes}-win.json`), 'utf8');
  const j = JSON.parse(txt);
  assert.deepStrictEqual(j.skills, { frontend: 1 });
  assert.deepStrictEqual(j.agentes, { 'tester-code': 1 });
  assert.deepStrictEqual(j.sugeridas_nao_lidas, { seo: 1 });
  assert.doesNotMatch(txt, new RegExp(p.sid));          // sem sessões
  assert.doesNotMatch(txt, /[\\/]/);                     // sem caminhos
});
