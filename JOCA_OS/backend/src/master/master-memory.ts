// Master conversational memory — FUTUROS.md Fase 7, three layers.
//
//   CURTA  (curta.md)        rolling continuation summary — what we're talking about now.
//   LONGA  (longa/*.md + index.json)  detailed per-window summaries, searchable — find the
//                            right window without loading whole conversations.
//   DIARIO (diario/*.jsonl)  full per-window archive — exact detail on demand.
//
// Sliding compression: verbatim = chat.slice(curtaUpTo). When it grows past WINDOW+BLOCK, the
// oldest BLOCK turns form a "window" that gets ARCHIVED: full turns → diário, a detailed summary
// → longa (+ index), and curta is refreshed for continuity. curtaUpTo advances. The brain always
// sees curta + every turn since (no gaps); older detail is reachable via search_memory/read_diary.
import fs from 'fs';
import path from 'path';
import { loadMasterChat, DATA_DIR, writeFileAtomic } from '../project-store';
import type { MasterChatEntry } from '../project-store';
import { claudeProvider } from './provider';

// Reuse project-store's DATA_DIR so the memory files land in the SAME data dir as master-chat,
// regardless of this module's nesting depth (it lives one level deeper than project-store).
const MEM_DIR = path.join(DATA_DIR, 'master-memory');
const CURTA_FILE = path.join(MEM_DIR, 'curta.md');
const STATE_FILE = path.join(MEM_DIR, 'state.json');
const LONGA_DIR = path.join(MEM_DIR, 'longa');
const DIARIO_DIR = path.join(MEM_DIR, 'diario');
const INDEX_FILE = path.join(LONGA_DIR, 'index.json');

const WINDOW = 10; // recent turns always kept verbatim in the brain context
const BLOCK = 8;   // turns archived per compression step (archive when verbatim > WINDOW+BLOCK)

export interface LongMemoryEntry {
  id: string;       // win-<boundaryIndex>
  fromTs: number;
  toTs: number;
  turns: number;
  title: string;
  tags: string[];
}

// ── low-level io ─────────────────────────────────────────────────────
function readCurta(): string {
  try { return fs.readFileSync(CURTA_FILE, 'utf8').trim(); } catch { return ''; }
}
function readState(): { curtaUpTo: number } {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { curtaUpTo: 0 }; }
}
function writeState(s: { curtaUpTo: number }): void {
  writeFileAtomic(STATE_FILE, JSON.stringify(s));
}
function readIndex(): LongMemoryEntry[] {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); } catch { return []; }
}
function writeIndex(entries: LongMemoryEntry[]): void {
  writeFileAtomic(INDEX_FILE, JSON.stringify(entries, null, 2));
}
function readSummary(id: string): string {
  try { return fs.readFileSync(path.join(LONGA_DIR, `${id}.md`), 'utf8').trim(); } catch { return ''; }
}

function who(e: MasterChatEntry): string {
  return e.role === 'user' ? 'Utilizador' : e.role === 'error' ? 'JOCA(erro)' : 'JOCA';
}
function transcriptOf(turns: MasterChatEntry[]): string {
  return turns.map((e) => `${who(e)}: ${e.text}`).join('\n');
}

// ── brain context (curta + recent verbatim) ─────────────────────────
export function buildMemoryContext(): string {
  const chat = loadMasterChat();
  if (chat.length === 0) return '';
  const { curtaUpTo } = readState();
  const verbatim = chat.slice(Math.min(curtaUpTo, chat.length));
  const curta = readCurta();
  const idx = readIndex();
  const lines: string[] = ['MEMORIA DA CONVERSA (usa para continuidade — referencias a "o que falamos", decisoes, workers ja abertos):'];
  if (curta) lines.push(`\n[Resumo da conversa anterior]\n${curta}`);
  if (idx.length) {
    lines.push(`\n[Memoria longa — ${idx.length} janelas arquivadas; usa search_memory(query) para recordar detalhe antigo e read_diary(id) para a conversa completa]`);
  }
  if (verbatim.length) {
    lines.push('\n[Conversa recente — mais antigo para mais novo]');
    for (const e of verbatim) lines.push(`${who(e)}: ${e.text}`);
  }
  return lines.join('\n');
}

// Re-entrância: dois turnos concorrentes não podem arquivar o mesmo bloco (win-N duplicado).
// Guard em memória ao nível do módulo (o backend é single-process).
let archiving = false;

// ── archive cycle (called after each turn; no-op until window overflows) ─────
export async function refreshShortMemory(): Promise<void> {
  if (archiving) return;
  archiving = true;
  try {
    const chat = loadMasterChat();
    const state = readState();
    const verbatimLen = chat.length - state.curtaUpTo;
    if (verbatimLen <= WINDOW + BLOCK) return; // window not full enough to archive yet

    const foldEnd = state.curtaUpTo + BLOCK;
    const windowTurns = chat.slice(state.curtaUpTo, foldEnd);
    if (windowTurns.length === 0) return;

    const id = `win-${foldEnd}`;
    const fromTs = windowTurns[0]?.ts ?? 0;
    const toTs = windowTurns[windowTurns.length - 1]?.ts ?? 0;

    // One LLM call produces the detailed window summary + a title + tags (longa), which also becomes
    // the refreshed curta (continuity). Subscription auth via the provider.
    const prompt = [
      'Arquiva esta JANELA da conversa entre o utilizador e o JOCA (Master orquestrador).',
      'Devolve EXACTAMENTE neste formato, em pt-pt:',
      'TITULO: <uma linha curta que identifique a janela>',
      'TAGS: <3 a 6 etiquetas separadas por virgulas — projectos, temas, palavras-chave>',
      'RESUMO: <8-14 linhas, factual: decisoes tomadas, projectos/workers mencionados, o que ficou por fazer, preferencias do utilizador>',
      '',
      `JANELA:\n${transcriptOf(windowTurns)}`,
    ].join('\n');

    let raw = '';
    try {
      for await (const ev of claudeProvider.run(prompt, {
        systemPrompt: 'Es um arquivista de memoria. Segue o formato exacto (TITULO/TAGS/RESUMO). Sem preambulo nem comentarios.',
      })) {
        if (ev.type === 'result') raw = ev.text;
      }
    } catch {
      return; // archive failed → leave state untouched; retried next turn, verbatim still carries continuity
    }
    if (!raw.trim()) return;

    const title = (raw.match(/TITULO:\s*(.+)/i)?.[1] ?? windowTurns[0]?.text.slice(0, 60) ?? id).trim();
    const tags = (raw.match(/TAGS:\s*(.+)/i)?.[1] ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    const resumo = (raw.match(/RESUMO:\s*([\s\S]+)/i)?.[1] ?? raw).trim();

    // DIARIO — full window (one JSON turn per line).
    writeFileAtomic(path.join(DIARIO_DIR, `${id}.jsonl`), windowTurns.map((e) => JSON.stringify(e)).join('\n'));

    // LONGA — detailed summary file + index entry.
    const header = `# ${title}\n\nTAGS: ${tags.join(', ')}\nJANELA: ${id} (${windowTurns.length} turnos)\n\n`;
    writeFileAtomic(path.join(LONGA_DIR, `${id}.md`), header + resumo);
    const idx = readIndex();
    idx.push({ id, fromTs, toTs, turns: windowTurns.length, title, tags });
    writeIndex(idx);

    // CURTA — refreshed continuation summary.
    writeFileAtomic(CURTA_FILE, resumo);
    writeState({ curtaUpTo: foldEnd }); // commit-point — última escrita do ciclo
  } finally {
    archiving = false;
  }
}

// ── retrieval (exposed to the brain via master tools) ───────────────
export interface MemorySearchHit { id: string; title: string; tags: string[]; fromTs: number; toTs: number; summary: string }

// Keyword scoring over title+tags+summary (FUTUROS leaves embeddings as a future option; grep-style
// matching is the pragmatic first pass). No query → most recent windows.
export function searchLongMemory(query: string, limit = 5): MemorySearchHit[] {
  const idx = readIndex();
  if (idx.length === 0) return [];
  const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  const scored = idx.map((e) => {
    const summary = readSummary(e.id);
    if (terms.length === 0) return { e, summary, score: e.toTs }; // recency as score
    const hay = `${e.title} ${e.tags.join(' ')} ${summary}`.toLowerCase();
    const score = terms.reduce((s, t) => s + (hay.split(t).length - 1), 0);
    return { e, summary, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ e, summary }) => ({ id: e.id, title: e.title, tags: e.tags, fromTs: e.fromTs, toTs: e.toTs, summary }));
}

export function readDiary(id: string): string | null {
  try {
    const raw = fs.readFileSync(path.join(DIARIO_DIR, `${id}.jsonl`), 'utf8');
    const turns = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l) as MasterChatEntry);
    return transcriptOf(turns);
  } catch {
    return null;
  }
}

// ── teardown ────────────────────────────────────────────────────────
export function clearMasterMemory(): void {
  try { fs.rmSync(MEM_DIR, { recursive: true, force: true }); } catch {}
}
