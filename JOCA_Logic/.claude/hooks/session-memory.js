#!/usr/bin/env node
// SessionEnd hook — Diário (camada 3 da memória).
// Arquiva o transcript completo da sessão (JSONL do Claude Code) em
// memory/diario/ e gera um extracto legível .md (user/assistant) para grep.
// Sem daemon, sem APIs: corre 1× no fim de cada sessão.
const fs = require('fs');
const path = require('path');

const repoRoot = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '../..');
const diaryDir = path.join(repoRoot, 'memory', 'diario');

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {}

const transcriptPath = input.transcript_path || '';
if (!transcriptPath || !fs.existsSync(transcriptPath)) process.exit(0);

const raw = fs.readFileSync(transcriptPath, 'utf8').trim();
if (!raw) process.exit(0);

// Extrair turnos legíveis user/assistant do JSONL do Claude Code.
function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === 'text' && b.text)
      .map((b) => b.text)
      .join('\n');
  }
  return '';
}

const turns = [];
let toolCalls = 0;
for (const line of raw.split('\n')) {
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }
  const msg = entry.message;
  if (!msg || !msg.role) continue;
  if (Array.isArray(msg.content)) {
    toolCalls += msg.content.filter((b) => b && (b.type === 'tool_use' || b.type === 'tool_result')).length;
  }
  const text = textOf(msg.content).trim();
  // Saltar tool results injectados como user e mensagens vazias
  if (!text || (entry.type === 'user' && entry.toolUseResult)) continue;
  if (msg.role !== 'user' && msg.role !== 'assistant') continue;
  turns.push({ role: msg.role, text });
}

// Sessões triviais (<2 turnos de conversa real) não entram no diário.
if (turns.length < 2) process.exit(0);

fs.mkdirSync(diaryDir, { recursive: true });

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}`;
const sess = String(input.session_id || 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 8);
const base = path.join(diaryDir, `${stamp}_${sess}`);

// Idempotência: SessionEnd pode disparar mais de uma vez para a mesma sessão.
const existing = fs.readdirSync(diaryDir).find((f) => f.includes(`_${sess}.jsonl`));
if (existing) process.exit(0);

// 1) Gravação completa (registo total, sem cortes)
fs.copyFileSync(transcriptPath, `${base}.jsonl`);

// 2) Extracto legível para pesquisa (memory-search.py / grep)
const cwd = input.cwd || process.cwd();
const lines = [
  `# Diário — ${stamp}`,
  '',
  `- session: ${input.session_id || 'unknown'}`,
  `- cwd: ${cwd}`,
  `- turnos: ${turns.length} | tool calls: ${toolCalls}`,
  `- raw: ${path.basename(base)}.jsonl`,
  '',
];
for (const t of turns) {
  lines.push(t.role === 'user' ? '## User' : '## Assistant', '', t.text, '');
}
fs.writeFileSync(`${base}.md`, lines.join('\n'));
