// Tests for the project manager's pure logic: chat persistence, wake budget, and the worker pool's
// area invariants. The SDK turn itself is not unit-tested (it talks to a real model); it is covered
// by the end-to-end smoke run documented in docs/ARQUITECTURA.md.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../project-store';
import { appendMessage, loadChat, clearChat, getState, patchState, clearAllBusy, rotateChat, searchChat } from '../manager/store';

const PROJECT = 'test-project-0000';
const chatFile = path.join(DATA_DIR, 'manager-chats', `${PROJECT}.jsonl`);
const stateFile = path.join(DATA_DIR, 'manager-state.json');

function wipe() {
  try { fs.rmSync(chatFile, { force: true }); } catch { /* ok */ }
  try { fs.rmSync(stateFile, { force: true }); } catch { /* ok */ }
  // Arquivos criados pela rotação nos testes de memória.
  try {
    const dir = path.join(DATA_DIR, 'manager-chats');
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(`${PROJECT}.`) && f.endsWith('.archive.jsonl')) fs.rmSync(path.join(dir, f), { force: true });
    }
  } catch { /* ok */ }
}

describe('manager chat store', () => {
  beforeEach(wipe);
  afterEach(wipe);

  it('starts empty and appends in order', () => {
    expect(loadChat(PROJECT)).toEqual([]);
    appendMessage(PROJECT, { role: 'user', text: 'primeira' });
    appendMessage(PROJECT, { role: 'manager', text: 'segunda' });
    const chat = loadChat(PROJECT);
    expect(chat.map((m) => m.text)).toEqual(['primeira', 'segunda']);
    expect(chat[0].role).toBe('user');
    expect(chat[1].role).toBe('manager');
  });

  it('keeps actions and cost on a manager message', () => {
    appendMessage(PROJECT, {
      role: 'manager', text: 'já mandei', costUsd: 0.02,
      actions: ['abriu worker de design'],
    });
    const [m] = loadChat(PROJECT);
    expect(m.actions).toEqual(['abriu worker de design']);
    expect(m.costUsd).toBe(0.02);
  });

  it('limit returns the most recent messages, still in order', () => {
    for (let i = 0; i < 10; i++) appendMessage(PROJECT, { role: 'user', text: `m${i}` });
    const chat = loadChat(PROJECT, 3);
    expect(chat.map((m) => m.text)).toEqual(['m7', 'm8', 'm9']);
  });

  it('clearing the chat also drops the SDK session (next turn starts fresh)', () => {
    appendMessage(PROJECT, { role: 'user', text: 'olá' });
    patchState(PROJECT, { sdkSessionId: 'abc-123', autoWakeCount: 4 });
    expect(getState(PROJECT).sdkSessionId).toBe('abc-123');

    clearChat(PROJECT);
    expect(loadChat(PROJECT)).toEqual([]);
    expect(getState(PROJECT).sdkSessionId).toBeUndefined();
    expect(getState(PROJECT).autoWakeCount).toBe(0);
  });

  it('survives a corrupt line instead of losing the whole conversation', () => {
    appendMessage(PROJECT, { role: 'user', text: 'boa' });
    fs.appendFileSync(chatFile, 'isto não é json\n');
    appendMessage(PROJECT, { role: 'manager', text: 'continua' });
    expect(loadChat(PROJECT).map((m) => m.text)).toEqual(['boa', 'continua']);
  });
});

describe('manager state', () => {
  beforeEach(wipe);
  afterEach(wipe);

  it('defaults to a zeroed wake budget', () => {
    const s = getState(PROJECT);
    expect(s.autoWakeCount).toBe(0);
    expect(s.sdkSessionId).toBeUndefined();
  });

  it('patch merges instead of replacing', () => {
    patchState(PROJECT, { sdkSessionId: 'sess-1' });
    patchState(PROJECT, { autoWakeCount: 2 });
    const s = getState(PROJECT);
    expect(s.sdkSessionId).toBe('sess-1');
    expect(s.autoWakeCount).toBe(2);
  });

  it('clearAllBusy unsticks a manager left mid-turn by a crash', () => {
    patchState(PROJECT, { busy: true });
    expect(getState(PROJECT).busy).toBe(true);
    clearAllBusy();
    expect(getState(PROJECT).busy).toBe(false);
  });
});

describe('manager memory (dossier + archive + search)', () => {
  beforeEach(wipe);
  afterEach(wipe);

  it('rotateChat archives the old half instead of destroying it', () => {
    // 4001 mensagens força a rotação (MAX_LINES=4000, mantém as 2000 mais novas).
    for (let i = 0; i < 4001; i++) appendMessage(PROJECT, { role: 'user', text: `msg-${i}` });
    rotateChat(PROJECT);
    const live = loadChat(PROJECT, 5000);
    expect(live.length).toBe(2000);
    expect(live[0].text).toBe('msg-2001');
    // A metade antiga tem de estar num arquivo, não no lixo.
    const dir = path.join(DATA_DIR, 'manager-chats');
    const archives = fs.readdirSync(dir).filter((f) => f.startsWith(`${PROJECT}.`) && f.endsWith('.archive.jsonl'));
    expect(archives.length).toBe(1);
    const archived = fs.readFileSync(path.join(dir, archives[0]), 'utf8').split('\n').filter(Boolean);
    expect(archived.length).toBe(2001);
    expect(JSON.parse(archived[0]).text).toBe('msg-0');
  });

  it('searchChat finds hits in the live file AND in archives, newest first', () => {
    for (let i = 0; i < 4001; i++) {
      appendMessage(PROJECT, { role: 'user', text: i === 10 ? 'o orcamento antigo era 500 euros' : `ruido-${i}` });
    }
    rotateChat(PROJECT);
    appendMessage(PROJECT, { role: 'manager', text: 'orcamento novo aprovado: 900 euros' });
    const hits = searchChat(PROJECT, 'ORCAMENTO'); // case-insensitive
    expect(hits.length).toBe(2);
    expect(hits[0].excerpt).toContain('900');   // mais recente primeiro (ficheiro vivo)
    expect(hits[1].excerpt).toContain('500');   // veio do arquivo
  });

  it('searchChat returns empty for blank terms and unknown projects', () => {
    expect(searchChat(PROJECT, '   ')).toEqual([]);
    expect(searchChat('nunca-existiu-0000', 'x')).toEqual([]);
  });

  it('dossier persists via patchState and survives state reload', () => {
    patchState(PROJECT, { dossier: 'Cliente prefere PT-PT. Deploy só à sexta.' });
    expect(getState(PROJECT).dossier).toContain('Deploy só à sexta');
  });
});
