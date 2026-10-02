#!/usr/bin/env node
// PostToolUse (Read|Skill|Agent|Task|Edit|Write) — registo de uso de skills e agentes (F1.1).
// Uma linha JSONL por uso em `<CLAUDE_PROJECT_DIR>/.joca/uso-skills.jsonl` (gitignored):
//   {ts, tipo: skill|agente|manut|sugerida, nome, sessao, maquina}
// - Read de `.claude/skills/<nome>.md` ou tool Skill → skill; Agent/Task → agente (subagent_type).
// - Edit/Write de uma skill → manut; Read de uma skill que a MESMA sessão já editou → manut
//   (o relatório reclassifica também as leituras anteriores à edição).
// - `sugerida` vem do prompt-triage.js (função `registar` exportada).
// Nunca bloqueia, nunca escreve no stdout (0 tokens), falha em silêncio. Sem session_id → nada.
// `maquina` = JOCA_MAQUINA, senão a plataforma (win32→win, darwin→mac, outra→local) — nunca o hostname. Nenhum conteúdo de prompt entra.
const fs = require('fs');
const path = require('path');

const SKILL_MD = /\/\.claude\/skills\/([^/]+)\.md$/;

function ficheiro() {
  const raiz = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
  return path.join(raiz, '.joca', 'uso-skills.jsonl');
}

function maquina(plataforma = process.platform) {
  const pad = { win32: 'win', darwin: 'mac' }[plataforma] || 'local';
  return String(process.env.JOCA_MAQUINA || pad).replace(/[^\w.-]/g, '').slice(0, 40) || pad;
}

function sessaoValida(s) {
  return typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s) ? s : '';
}

// linhas: [{tipo, nome}] — acrescenta-as de uma vez.
function registar(linhas, sessao) {
  try {
    const sid = sessaoValida(sessao);
    if (!sid || !linhas.length) return;
    const ts = new Date().toISOString();
    const f = ficheiro();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, linhas.map((l) => JSON.stringify({ ts, tipo: l.tipo, nome: l.nome, sessao: sid, maquina: maquina() }) + '\n').join(''));
  } catch (_) { /* falha em silêncio */ }
}

// A sessão já editou esta skill? (lê o registo local; pequeno e só no Read de uma skill)
function jaEditada(nome, sid) {
  try {
    return fs.readFileSync(ficheiro(), 'utf8').split('\n').some((l) => {
      if (!l.includes('"manut"')) return false;
      try { const o = JSON.parse(l); return o.tipo === 'manut' && o.nome === nome && o.sessao === sid; } catch (_) { return false; }
    });
  } catch (_) { return false; }
}

function main() {
  let p = {};
  try { p = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { return; }
  const sid = sessaoValida(p.session_id);
  if (!sid) return;
  const tool = String(p.tool_name || '');
  const ti = p.tool_input || {};

  if (tool === 'Agent' || tool === 'Task') {
    return registar([{ tipo: 'agente', nome: String(ti.subagent_type || 'general-purpose') }], sid);
  }
  if (tool === 'Skill') {
    return ti.skill ? registar([{ tipo: 'skill', nome: String(ti.skill) }], sid) : undefined;
  }
  const m = String(ti.file_path || '').replace(/\\/g, '/').match(SKILL_MD);
  if (!m) return;
  const nome = m[1];
  if (tool === 'Edit' || tool === 'Write') return registar([{ tipo: 'manut', nome }], sid);
  if (tool === 'Read') registar([{ tipo: jaEditada(nome, sid) ? 'manut' : 'skill', nome }], sid);
}

if (require.main === module) {
  try { main(); } catch (_) { /* nunca falha o turno */ }
  process.exit(0);
}

module.exports = { registar, maquina };
