// Fronteira dos itens do toolkit (helpers.assertClaudePath): conta o caminho REAL. As skills do
// Brain v2 vivem em `.agents/skills` e `.agents/globais`, atrás de atalhos em `.claude/skills` —
// abri-las/editá-las não pode dar 403; `../`, atalho para fora e atalho partido continuam recusados.
// Brain de exemplo numa pasta temporária; a raiz do Brain é passada explicitamente.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { assertClaudePath } from '../http/helpers';

let tmp: string;
let brain: string;
let fora: string;
const escrever = (f: string, txt = 'x') => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); };
const status = (fn: () => unknown) => { try { fn(); return 200; } catch (e) { return (e as { status?: number }).status ?? 500; } };

beforeEach(() => {
  // Já resolvida: no macOS /var é atalho para /private/var, e isso recusaria por acaso.
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'joca-toolkit-path-')));
  brain = path.join(tmp, 'JOCA_Brain');
  fora = path.join(tmp, 'fora-do-brain');
  escrever(path.join(brain, 'AGENTS.md'));
  escrever(path.join(brain, '.claude', 'commands', 'save.md'));
  escrever(path.join(brain, '.agents', 'skills', 'design', 'SKILL.md'));
  escrever(path.join(brain, '.agents', 'globais', 'maquina', 'SKILL.md'));
  fs.mkdirSync(path.join(brain, '.claude', 'skills'), { recursive: true });
  fs.symlinkSync('../../.agents/skills/design', path.join(brain, '.claude', 'skills', 'design'), 'dir');
  escrever(path.join(fora, 'segredo.md'));
});
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('assertClaudePath — aceite', () => {
  it('item da estrutura antiga em .claude/', () => {
    const f = path.join(brain, '.claude', 'commands', 'save.md');
    expect(assertClaudePath(f, brain)).toBe(f);
  });
  it('skill v2 pelo atalho de .claude/skills (caminho real em .agents/skills)', () => {
    const f = path.join(brain, '.claude', 'skills', 'design', 'SKILL.md');
    expect(assertClaudePath(f, brain)).toBe(f);
  });
  it('skill v2 directamente em .agents/skills e .agents/globais', () => {
    expect(status(() => assertClaudePath(path.join(brain, '.agents', 'skills', 'design', 'SKILL.md'), brain))).toBe(200);
    expect(status(() => assertClaudePath(path.join(brain, '.agents', 'globais', 'maquina', 'SKILL.md'), brain))).toBe(200);
  });
  it('ficheiro novo (ainda não existe) atrás de um atalho que fica dentro do Brain', () => {
    expect(status(() => assertClaudePath(path.join(brain, '.claude', 'skills', 'design', 'referencias', 'nova.md'), brain))).toBe(200);
  });
});

describe('assertClaudePath — recusado (403)', () => {
  it('../ para fora do Brain', () => {
    expect(status(() => assertClaudePath(path.join(brain, '.claude', '..', '..', 'fora-do-brain', 'segredo.md'), brain))).toBe(403);
  });
  it('atalho dentro do Brain que aponta para fora (ficheiro existente e ficheiro novo)', () => {
    fs.symlinkSync(fora, path.join(brain, '.claude', 'skills', 'fuga'), 'dir');
    expect(status(() => assertClaudePath(path.join(brain, '.claude', 'skills', 'fuga', 'segredo.md'), brain))).toBe(403);
    expect(status(() => assertClaudePath(path.join(brain, '.claude', 'skills', 'fuga', 'novo', 'SKILL.md'), brain))).toBe(403);
  });
  it('atalho partido pelo caminho', () => {
    fs.symlinkSync(path.join(tmp, 'nao-existe'), path.join(brain, '.claude', 'skills', 'partido'), 'dir');
    expect(status(() => assertClaudePath(path.join(brain, '.claude', 'skills', 'partido', 'SKILL.md'), brain))).toBe(403);
  });
  it('ficheiros do Brain fora das pastas de toolkit (raiz, memory/)', () => {
    escrever(path.join(brain, 'memory', 'soul.md'));
    expect(status(() => assertClaudePath(path.join(brain, 'AGENTS.md'), brain))).toBe(403);
    expect(status(() => assertClaudePath(path.join(brain, 'memory', 'soul.md'), brain))).toBe(403);
  });
  it('sem Brain, ou caminho vazio', () => {
    expect(status(() => assertClaudePath(path.join(brain, '.claude', 'commands', 'save.md'), null))).toBe(403);
    expect(status(() => assertClaudePath('', brain))).toBe(403);
  });
});
