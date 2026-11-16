// Descoberta do JOCA Brain (brain-locator.ts): cada via, a ordem entre elas, pasta inválida e
// «sem Brain». Tudo em pastas temporárias com caminhos de exemplo — nunca lê a máquina real: o
// `env` e a `homedir` são injectados e o settings.json é um ficheiro falso.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { localizarBrain, eBrain, jocaBrainDoSettings } from '../brain-locator';

let tmp: string;
let home: string;
let jocaOsDir: string;

function criarBrain(dir: string, tipo: 'antigo' | 'v2' = 'v2') {
  fs.mkdirSync(dir, { recursive: true });
  if (tipo === 'antigo') {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Brain\n');
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  } else {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Brain\n');
    fs.mkdirSync(path.join(dir, 'skills'), { recursive: true });
  }
  return dir;
}

function escreverSettings(conteudo: unknown) {
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify(conteudo));
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-brain-locator-'));
  home = path.join(tmp, 'home');
  fs.mkdirSync(home, { recursive: true });
  // Instalação de exemplo: <tmp>/instalacao/JOCA_OS (a irmã seria <tmp>/instalacao/JOCA_Brain).
  jocaOsDir = path.join(tmp, 'instalacao', 'JOCA_OS');
  fs.mkdirSync(jocaOsDir, { recursive: true });
});
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('eBrain', () => {
  it('aceita o Brain antigo (CLAUDE.md + .claude/) e o v2 (AGENTS.md + skills/)', () => {
    expect(eBrain(criarBrain(path.join(tmp, 'a'), 'antigo'))).toBe(true);
    expect(eBrain(criarBrain(path.join(tmp, 'b'), 'v2'))).toBe(true);
  });
  it('recusa pasta sem instruções, sem toolkit, ou inexistente', () => {
    const soToolkit = path.join(tmp, 'so-toolkit');
    fs.mkdirSync(path.join(soToolkit, '.claude'), { recursive: true });
    const soInstrucoes = path.join(tmp, 'so-instrucoes');
    fs.mkdirSync(soInstrucoes, { recursive: true });
    fs.writeFileSync(path.join(soInstrucoes, 'AGENTS.md'), '#');
    expect(eBrain(soToolkit)).toBe(false);
    expect(eBrain(soInstrucoes)).toBe(false);
    expect(eBrain(path.join(tmp, 'nao-existe'))).toBe(false);
  });
});

describe('localizarBrain — cada via', () => {
  it('1. variável JOCA_BRAIN', () => {
    const b = criarBrain(path.join(tmp, 'brain-env'));
    const r = localizarBrain({ env: { JOCA_BRAIN: b }, homedir: home, jocaOsDir });
    expect(r.brain).toEqual({ root: b, via: 'env-joca-brain' });
    expect(r.avisos).toEqual([]);
  });

  it('2. variável JOCA_LOGIC_PATH (legado)', () => {
    const b = criarBrain(path.join(tmp, 'brain-legado'), 'antigo');
    const r = localizarBrain({ env: { JOCA_LOGIC_PATH: b }, homedir: home, jocaOsDir });
    expect(r.brain).toEqual({ root: b, via: 'env-joca-logic-path' });
  });

  it('3. env.JOCA_BRAIN no ~/.claude/settings.json', () => {
    const b = criarBrain(path.join(tmp, 'brain-settings'));
    escreverSettings({ env: { JOCA_BRAIN: b, OUTRA: 'x' }, hooks: {} });
    const r = localizarBrain({ env: {}, homedir: home, jocaOsDir });
    expect(r.brain).toEqual({ root: b, via: 'settings-claude' });
  });

  it('4. pasta irmã ../JOCA_Brain (legado)', () => {
    const b = criarBrain(path.join(tmp, 'instalacao', 'JOCA_Brain'), 'antigo');
    const r = localizarBrain({ env: {}, homedir: home, jocaOsDir });
    expect(r.brain).toEqual({ root: b, via: 'pasta-irma' });
  });

  it('5. nenhuma → sem Brain, sem avisos', () => {
    const r = localizarBrain({ env: {}, homedir: home, jocaOsDir });
    expect(r).toEqual({ brain: null, avisos: [] });
  });

  it('expande ~/ a partir da homedir injectada', () => {
    const b = criarBrain(path.join(home, 'Brains', 'JOCA'));
    const r = localizarBrain({ env: { JOCA_BRAIN: '~/Brains/JOCA' }, homedir: home, jocaOsDir });
    expect(r.brain?.root).toBe(b);
  });
});

describe('localizarBrain — ordem e pasta inválida', () => {
  it('JOCA_BRAIN ganha a todas as outras', () => {
    const a = criarBrain(path.join(tmp, 'a'));
    const b = criarBrain(path.join(tmp, 'b'));
    const c = criarBrain(path.join(tmp, 'c'));
    criarBrain(path.join(tmp, 'instalacao', 'JOCA_Brain'));
    escreverSettings({ env: { JOCA_BRAIN: c } });
    const r = localizarBrain({ env: { JOCA_BRAIN: a, JOCA_LOGIC_PATH: b }, homedir: home, jocaOsDir });
    expect(r.brain?.via).toBe('env-joca-brain');
  });

  it('settings.json ganha à pasta irmã', () => {
    const c = criarBrain(path.join(tmp, 'c'));
    criarBrain(path.join(tmp, 'instalacao', 'JOCA_Brain'));
    escreverSettings({ env: { JOCA_BRAIN: c } });
    expect(localizarBrain({ env: {}, homedir: home, jocaOsDir }).brain).toEqual({ root: c, via: 'settings-claude' });
  });

  it('pasta inválida não ganha: aviso e passa à via seguinte', () => {
    const naoBrain = path.join(tmp, 'pasta-qualquer');
    fs.mkdirSync(naoBrain, { recursive: true });
    const b = criarBrain(path.join(tmp, 'brain-bom'));
    const r = localizarBrain({ env: { JOCA_BRAIN: naoBrain, JOCA_LOGIC_PATH: b }, homedir: home, jocaOsDir });
    expect(r.brain).toEqual({ root: b, via: 'env-joca-logic-path' });
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toContain('JOCA_BRAIN');
    expect(r.avisos[0]).toContain(naoBrain);
  });

  it('todas inválidas → sem Brain, com um aviso por via que apontava para algo', () => {
    escreverSettings({ env: { JOCA_BRAIN: path.join(tmp, 'nao-existe-1') } });
    const r = localizarBrain({ env: { JOCA_BRAIN: path.join(tmp, 'nao-existe-2') }, homedir: home, jocaOsDir });
    expect(r.brain).toBeNull();
    expect(r.avisos).toHaveLength(2);
  });
});

describe('jocaBrainDoSettings', () => {
  it('lê só env.JOCA_BRAIN; ficheiro em falta, JSON partido ou chave ausente → null', () => {
    expect(jocaBrainDoSettings(home)).toBeNull();
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), '{ partido');
    expect(jocaBrainDoSettings(home)).toBeNull();
    escreverSettings({ env: { OUTRA: 'x' } });
    expect(jocaBrainDoSettings(home)).toBeNull();
    escreverSettings({ env: { JOCA_BRAIN: 42 } });
    expect(jocaBrainDoSettings(home)).toBeNull();
    escreverSettings({ env: { JOCA_BRAIN: '/exemplo/JOCA_Brain' } });
    expect(jocaBrainDoSettings(home)).toBe('/exemplo/JOCA_Brain');
  });
});
