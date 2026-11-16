// Recolha do toolkit nas duas estruturas do Brain (toolkit-registry.recolherToolkit): a antiga
// (`.claude/skills/*.md`) e a v2 (`.agents/skills/<x>/SKILL.md` com atalhos em `.claude/skills/`,
// e `skills/<x>/SKILL.md`), sem repetir. Pastas temporárias, caminhos de exemplo.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { recolherToolkit, pastasDeSkillsDoBrain, collectToolkitItems } from '../toolkit-registry';

let root: string;
const escrever = (rel: string, txt: string) => {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, txt);
};
const skill = (nome: string, desc = 'x') => `---\nname: ${nome}\ndescription: ${desc}\n---\ncorpo\n`;
const nomes = (r: ReturnType<typeof recolherToolkit>) => r.skills.map((s) => s.name).sort();

beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-toolkit-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('recolherToolkit', () => {
  it('Brain antigo: commands, agents e skills planas em .claude/', () => {
    escrever('.claude/commands/save.md', '---\ndescription: guardar\n---\n');
    escrever('.claude/commands/_privado.md', 'x');
    escrever('.claude/agents/executor.md', '---\ndescription: faz\n---\n');
    escrever('.claude/skills/frontend.md', skill('frontend'));
    escrever('.claude/skills/legado/SKILL.md', skill('legado'));
    const r = recolherToolkit(path.join(root, '.claude'), pastasDeSkillsDoBrain(root));
    expect(r.commands.map((c) => c.insert)).toEqual(['/save']);
    expect(r.agents.map((a) => a.name)).toEqual(['executor']);
    expect(nomes(r)).toEqual(['frontend', 'legado']);
  });

  it('Brain v2: segue os atalhos de .claude/skills para .agents/skills e não repete', () => {
    escrever('.agents/skills/design/SKILL.md', skill('design'));
    escrever('.agents/skills/design/referencias/notas.md', 'não é skill');
    escrever('.agents/skills/sites/SKILL.md', skill('sites'));
    escrever('.agents/globais/maquina/SKILL.md', skill('maquina'));
    fs.mkdirSync(path.join(root, '.claude', 'skills'), { recursive: true });
    fs.symlinkSync('../../.agents/skills/design', path.join(root, '.claude', 'skills', 'design'));
    fs.symlinkSync('../../.agents/skills/sites', path.join(root, '.claude', 'skills', 'sites'));
    const r = recolherToolkit(path.join(root, '.claude'), pastasDeSkillsDoBrain(root));
    expect(nomes(r)).toEqual(['design', 'maquina', 'sites']);
    // A primeira pasta ganha: o caminho mostrado é o do atalho em .claude/skills.
    expect(r.skills.find((s) => s.name === 'design')!.path).toBe(path.join(root, '.claude', 'skills', 'design', 'SKILL.md'));
  });

  it('as duas estruturas juntas: o mesmo nome entra uma vez (a antiga primeiro)', () => {
    escrever('.claude/skills/frontend.md', skill('frontend', 'antiga'));
    escrever('skills/frontend/SKILL.md', skill('frontend', 'nova'));
    escrever('skills/novidade/SKILL.md', skill('novidade'));
    const r = recolherToolkit(path.join(root, '.claude'), pastasDeSkillsDoBrain(root));
    expect(nomes(r)).toEqual(['frontend', 'novidade']);
    expect(r.skills.find((s) => s.name === 'frontend')!.description).toBe('antiga');
  });

  it('atalho partido não rebenta a recolha', () => {
    escrever('.agents/skills/viva/SKILL.md', skill('viva'));
    fs.mkdirSync(path.join(root, '.claude', 'skills'), { recursive: true });
    fs.symlinkSync('../../.agents/skills/morta', path.join(root, '.claude', 'skills', 'morta'));
    const r = recolherToolkit(path.join(root, '.claude'), pastasDeSkillsDoBrain(root));
    expect(nomes(r)).toEqual(['viva']);
  });

  it('pasta .claude de um projecto: só lê a própria pasta (não varre .agents nem skills/ do projecto)', () => {
    escrever('.claude/skills/so-do-projecto.md', skill('so-do-projecto'));
    escrever('skills/codigo/SKILL.md', skill('codigo'));
    const r = collectToolkitItems(path.join(root, '.claude'));
    expect(nomes(r)).toEqual(['so-do-projecto']);
  });
});
