// Slug da memória do Brain (learnings · decisions · checkpoints) — FONTE ÚNICA.
// Usado por joca-brain.mjs, joca-checkpoint.mjs, hooks/auto-checkpoint.js e hooks/stop-checkpoint.js.
//
// Porquê: cada um calculava o slug à sua maneira (basename do git toplevel, com e sem minúsculas)
// e o mesmo projecto partiu-se em várias grafias (ex.: `JOCA` vs `--slug joca` num FS case-insensitive,
// ou uma grafia diferente da pasta do toolkit entre instalações) → centenas de aprendizagens e
// decisões invisíveis ao recall do arranque (medido a 2026-09-15).
// Regra: identificador em minúsculas (igual no Windows e no macOS) + alias de nomes de pasta
// para o slug da memória do projecto (`memory/projects/<slug>/`).
//
// Desde 2026-10-01 os aliases de PROJECTO vivem no `aliases:` do `memory/projects/<slug>/index.md`
// (fonte única, desenho da memória por pastas §1.1). Aqui ficam só os do toolkit. Um alias de ÁREA
// (`nome#area`) NÃO muda o slug: a área fica com as decisões/aprendizagens que já tinha com o nome antigo.
const path = require('path');

const ALIASES = {
  joca_brain: 'joca',          // pasta do Brain como git toplevel
  joca_open_source: 'joca-open-source', // clone do repo público com este nome de pasta
};

let _projecto = null;   // alias → slug, lido dos index (lazy; sem lib/memória → vazio)
function aliasesDeProjecto() {
  if (_projecto) return _projecto;
  _projecto = new Map();
  try {
    const memoria = require(path.join(__dirname, 'lib', 'memoria-projecto.cjs'));
    const dir = path.resolve(__dirname, '..', '..', 'memory', 'projects');
    for (const [nome, v] of memoria.mapaAliases(dir)) if (v && !v.area) _projecto.set(nome, v.slug);
  } catch (_) { /* instalação sem lib ou sem memória — só os do toolkit */ }
  return _projecto;
}

function normalizeSlug(s) {
  const n = String(s).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80).toLowerCase() || 'unknown';
  return ALIASES[n] || aliasesDeProjecto().get(n) || n;
}

module.exports = { normalizeSlug, ALIASES };
