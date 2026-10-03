// F1.2 — lint de skills/agentes/referências (validate-skill.py + hook skill-lint.js).
// Quebras deliberadas em cópias numa pasta temporária; nunca toca no repo.
// Uso: node --test .claude/scripts/test/validate-skill.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const BRAIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = join(BRAIN, '.claude', 'scripts', 'validate-skill.py');
const HOOK = join(BRAIN, '.claude', 'hooks', 'skill-lint.js');
const PY = spawnSync('python', ['--version']).status === 0 ? 'python' : 'python3';

function lint(...args) {
  return spawnSync(PY, [SCRIPT, ...args], { cwd: BRAIN, encoding: 'utf8' });
}
function tmpFile(kind, name, text) {
  const d = mkdtempSync(join(tmpdir(), 'joca-lint-'));
  mkdirSync(join(d, kind));
  const f = join(d, kind, name);
  writeFileSync(f, text);
  return { f, limpar: () => rmSync(d, { recursive: true, force: true }) };
}
const skillReal = readFileSync(join(BRAIN, '.claude', 'skills', 'caveman.md'), 'utf8');

test('referência partida numa cópia de skill é acusada (aviso, exit 0)', () => {
  const { f, limpar } = tmpFile('skills', 'caveman.md', skillReal + '\nLê `Read(".claude/reference/ponteiro-partido-f12.md")`.\n');
  try {
    const r = lint(f);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /\[WARN\][\s\S]*\[ponteiro\][^\n]*ponteiro-partido-f12\.md/);
  } finally { limpar(); }
});

test('controlo: a mesma citação marcada como opcional não é acusada (excepção do doctor)', () => {
  const { f, limpar } = tmpFile('skills', 'caveman.md', skillReal + '\nSe existir, `Read(".claude/reference/ponteiro-partido-f12.md")`.\n');
  try { assert.doesNotMatch(lint(f).stdout, /\[ponteiro\]/); } finally { limpar(); }
});

// Ponteiro morto — a palavra «opcional» só conta se qualificar o caminho (janela à volta da citação), não a linha inteira.
const BASE88 = 'Antes de escrever código: `Read(".claude/reference/ponteiro-partido-f12.md")` — escada + guard-rails.';
for (const [nome, sufixo, acusa] of [
  ['sem qualificador → acusa', '', true],
  ['«Se existir.» perto do caminho → não acusa', ' Se existir.', false],
  ['«(opcional)» junto ao caminho → não acusa', ' (opcional)', false],
  ['«quando houver código» (não qualifica) → acusa', ' quando houver código', true],
  ['«Se existir.» longe do caminho, noutro sítio da linha → acusa', ' Ver também a tabela de exemplos lá em baixo. Se existir.', true],
]) {
  test(`ponteiro opcional: ${nome}`, () => {
    const { f, limpar } = tmpFile('skills', 'caveman.md', skillReal + '\n' + BASE88 + sufixo + '\n');
    try {
      const out = lint(f).stdout;
      if (acusa) assert.match(out, /\[ponteiro\][^\n]*ponteiro-partido-f12\.md/);
      else assert.doesNotMatch(out, /\[ponteiro\]/);
    } finally { limpar(); }
  });
}

test('ponteiro morto --strict: ponteiro morto dá exit 1; sem ponteiro morto, exit 0', () => {
  const a = tmpFile('skills', 'caveman.md', skillReal + '\n' + BASE88 + '\n');
  const b = tmpFile('skills', 'caveman.md', skillReal);
  try {
    assert.equal(lint(a.f).status, 0);
    assert.equal(lint('--strict', a.f).status, 1);
    assert.equal(lint('--strict', b.f).status, 0);
  } finally { a.limpar(); b.limpar(); }
});

test('Step 0 de agente para ficheiro inexistente é acusado mesmo com «does not exist» na linha', () => {
  const txt = '---\nname: x-agent\ndescription: teste\n---\n\n## Step 0\n\n`Read(".claude/skills/ponteiro-partido-f12.md")` — if it does not exist, say so.\n\n## Resto\n';
  const { f, limpar } = tmpFile('agents', 'x-agent.md', txt);
  try { assert.match(lint(f).stdout, /\[step0\][^\n]*ponteiro-partido-f12\.md/); } finally { limpar(); }
});

test('referência >100 linhas sem índice avisa; com «## Conteúdo» não', () => {
  const corpo = Array.from({ length: 120 }, (_, i) => `linha ${i}`).join('\n');
  const a = tmpFile('reference', 'r.md', '# R\n\n' + corpo);
  const b = tmpFile('reference', 'r.md', '# R\n\n## Conteúdo\n- x\n\n' + corpo);
  try {
    assert.match(lint(a.f).stdout, /\[indice\]/);
    assert.doesNotMatch(lint(b.f).stdout, /\[indice\]/);
  } finally { a.limpar(); b.limpar(); }
});

test('created-skills/<x>/SKILL.md e skills-globais/<x>/SKILL.md sem description: FAIL e exit 1 (gate do create-skill)', () => {
  for (const sub of [join('.claude', 'skills', 'created-skills', 'x'), join('skills-globais', 'x')]) {
    const d = mkdtempSync(join(tmpdir(), 'joca-lint-'));
    try {
      mkdirSync(join(d, sub), { recursive: true });
      const f = join(d, sub, 'SKILL.md');
      writeFileSync(f, '---\nname: x\n---\ncorpo\n');
      const r = lint(f);
      assert.equal(r.status, 1, sub);
      assert.match(r.stdout, /\[FAIL\][\s\S]*description` em falta/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  }
});

test('skill >500 linhas avisa', () => {
  const { f, limpar } = tmpFile('skills', 'caveman.md', skillReal + '\n'.repeat(520));
  try { assert.match(lint(f).stdout, /\[>500\]/); } finally { limpar(); }
});

test('hook: edição com regra nova a falhar não bloqueia (exit 0) e mostra o aviso', () => {
  // ficheiro temporário >500 linhas num caminho .claude/skills/ (o hook só olha para esse padrão)
  const d = mkdtempSync(join(tmpdir(), 'joca-lint-'));
  try {
    mkdirSync(join(d, '.claude', 'skills'), { recursive: true });
    const f = join(d, '.claude', 'skills', 'caveman.md');
    writeFileSync(f, skillReal + '\n'.repeat(520));
    const r = spawnSync('node', [HOOK], { input: JSON.stringify({ tool_input: { file_path: f } }), encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /avisos \(não bloqueia\)[\s\S]*\[>500\]/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('--all: corre (exit 0) e tem todas as secções do relatório', () => {
  // a detecção de >500 linhas prova-se no teste por-ficheiro (temp); aqui não se depende do estado das skills reais
  const r = lint('--all');
  assert.equal(r.status, 0);
  for (const h of ['Skills com >500 linhas', 'sem indice', 'Cadeias', 'Pares confundiveis', 'Caminhos citados', 'Step 0', 'orfas']) assert.match(r.stdout, new RegExp(h));
});
