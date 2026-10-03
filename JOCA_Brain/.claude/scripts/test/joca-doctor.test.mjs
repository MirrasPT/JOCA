// T134 — Playwright MCP em qualquer scope do ~/.claude.json (ou .mcp.json) é ✗.
// B08  — ficha com `directorio_estado: quebrado` aparece no doctor.
// Memória por pastas — limites da memória por pastas (lint do lib) e ficha plana antiga = ✗.
// Corre o doctor numa árvore descartável (BRAIN pelo __dirname) com HOME/USERPROFILE falsos —
// nunca lê o ~/.claude.json real. Uso: node --test .claude/scripts/test/joca-doctor.test.mjs
// (JOCA_TEST_SCRIPT=<cópia> para mutação)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ALVO = process.env.JOCA_TEST_SCRIPT || join(dirname(fileURLToPath(import.meta.url)), '..', 'joca-doctor.mjs');

function doctor({ claudeJson, fichas, pastas, extra, skills }) {
  const raiz = mkdtempSync(join(tmpdir(), 'joca-doctor-t134-'));
  const brain = join(raiz, 'JOCA_Brain');
  const home = join(raiz, 'home');
  mkdirSync(join(brain, '.claude', 'scripts'), { recursive: true });
  mkdirSync(join(brain, 'memory', 'projects'), { recursive: true });
  mkdirSync(home, { recursive: true });
  copyFileSync(ALVO, join(brain, '.claude', 'scripts', 'joca-doctor.mjs'));
  mkdirSync(join(brain, '.claude', 'scripts', 'lib'), { recursive: true });
  copyFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'memoria-projecto.cjs'), join(brain, '.claude', 'scripts', 'lib', 'memoria-projecto.cjs'));
  if (claudeJson) writeFileSync(join(home, '.claude.json'), JSON.stringify(claudeJson));
  // ficha plana antiga (já não se lê; só serve para provar que o doctor a acusa)
  for (const [nome, estado] of Object.entries(fichas || {})) {
    writeFileSync(join(brain, 'memory', 'projects', `${nome}.md`), `---\nname: ${nome}\ndirectorio_estado: ${estado}\n---\ncorpo\n`);
  }
  // pasta: memory/projects/<slug>/index.md (+ extra: { '<slug>/<f>.md': texto }, por cima)
  for (const [nome, estado] of Object.entries(pastas || {})) {
    mkdirSync(join(brain, 'memory', 'projects', nome), { recursive: true });
    writeFileSync(join(brain, 'memory', 'projects', nome, 'index.md'), `---\nname: ${nome}\ndirectorio_estado: ${estado}\n---\n# ${nome}\n`);
  }
  for (const [rel, texto] of Object.entries(extra || {})) writeFileSync(join(brain, 'memory', 'projects', rel), texto);
  // skills: { '<nome>.md': texto } em .claude/skills/ (§9b, ponteiros mortos)
  if (skills) mkdirSync(join(brain, '.claude', 'skills'), { recursive: true });
  for (const [nome, texto] of Object.entries(skills || {})) writeFileSync(join(brain, '.claude', 'skills', nome), texto);
  const r = spawnSync(process.execPath, [join(brain, '.claude', 'scripts', 'joca-doctor.mjs')],
    { cwd: brain, encoding: 'utf8', timeout: 120000, env: { ...process.env, HOME: home, USERPROFILE: home } });
  rmSync(raiz, { recursive: true, force: true });
  return r.stdout || '';
}

test('T134 Playwright MCP no scope local e no user → ✗ com os dois scopes', () => {
  const out = doctor({ claudeJson: { mcpServers: { playwright: { command: 'x' } }, projects: { 'C:/p': { mcpServers: { 'playwright-mcp': {} } } } } });
  assert.match(out, /✗ Playwright MCP instalado \(2 scope/);
  assert.match(out, /user: playwright/);
  assert.match(out, /local \(C:\/p\): playwright-mcp/);
});

test('T134 sem Playwright → ✓', () => {
  const out = doctor({ claudeJson: { mcpServers: { outro: {} }, projects: {} } });
  assert.match(out, /✓ sem Playwright MCP em nenhum scope/);
});

test('B08 directorio_estado: quebrado aparece no doctor (pastas)', () => {
  const out = doctor({ claudeJson: {}, pastas: { nova: 'quebrado', outra: 'ambos' } });
  assert.match(out, /⚠ 1 projecto\(s\) com `directorio_estado: quebrado`.*: nova$/m);
  const ok = doctor({ claudeJson: {}, pastas: { outra: 'so-win' } });
  assert.match(ok, /✓ memory\/projects\/: 1 ficha\(s\) com directorio_estado, nenhuma quebrada/);
  assert.match(ok, /✓ memory\/projects\/: 1 pasta\(s\) dentro dos limites/);
});

test('memória por pastas: ficha plana antiga já não se lê: não conta no B08 e é ✗', () => {
  const out = doctor({ claudeJson: {}, fichas: { velha: 'quebrado' }, pastas: { outra: 'ambos' } });
  assert.match(out, /✓ memory\/projects\/: 1 ficha\(s\) com directorio_estado, nenhuma quebrada/);
  assert.match(out, /✗ 1 problema\(s\) na memória por pastas/);
  assert.match(out, /velha: ficha plana antiga velha\.md \(sem pasta\)/);
});

test('memória por pastas: limites: corpo do index, mini-estado, ficheiro não listado, área >40 KB', () => {
  const corpo = Array.from({ length: 41 }, (_, i) => `linha ${i}`).join('\n');
  const out = doctor({ claudeJson: {}, pastas: { a: 'ambos', b: 'ambos', c: 'ambos' }, extra: {
    'a/index.md': `---\nname: a\n---\n# a\n${corpo}\n`,
    'b/index.md': '---\nname: b\n---\n# b\n## Ficheiros\n- geral.md — x\n- fantasma.md — y\n## Áreas\n- **geral** — 1\n  2\n  3\n  4\n',
    'b/geral.md': '# geral\n',
    'b/solta.md': '# solta\n',
    'c/index.md': '---\nname: c\n---\n# c\n## Ficheiros\n- loja.md — cita CLAUDE.md e ../archive/c.md, que não contam\n',
    'c/loja.md': 'x'.repeat(41 * 1024),
  } });
  assert.match(out, /a: corpo do index com 42 linhas não vazias \(máx\. 40\)/);
  assert.match(out, /b: mini-estado da área «geral» com 4 linhas \(máx\. 3\)/);
  assert.match(out, /b: solta\.md não está listado em §Ficheiros/);
  assert.match(out, /b: §Ficheiros lista fantasma\.md, que não existe na pasta/);
  assert.match(out, /⚠ 1 aviso\(s\) de tamanho[\s\S]*c: loja\.md com 41 KB/);
  assert.doesNotMatch(out, /\n\s+c: (?!loja\.md com)/);
});

test('ponteiro morto §9b: «opcional» só conta junto ao caminho (mesma regra do validate-skill)', () => {
  const base = 'Antes de escrever código: `Read(".claude/reference/ponteiro-partido-f12.md")` — escada + guard-rails.';
  const casos = { 'a.md': base, 'b.md': base + ' Se existir.', 'c.md': base + ' (opcional)',
    'd.md': base + ' quando houver código', 'e.md': base + ' Ver também a tabela de exemplos lá em baixo. Se existir.' };
  const out = doctor({ claudeJson: {}, skills: Object.fromEntries(Object.entries(casos).map(([n, t]) => [n, `# ${n}\n\n${t}\n`])) });
  assert.match(out, /✗ 3 ponteiro\(s\) morto\(s\)/);
  for (const n of ['a.md', 'd.md', 'e.md']) assert.ok(out.includes(`skills${sep}${n} → `), n);
  for (const n of ['b.md', 'c.md']) assert.ok(!out.includes(`${n} → `), n);
});
