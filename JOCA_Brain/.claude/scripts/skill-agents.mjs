#!/usr/bin/env node
// Generates execution agents from skills — one agent per skill that produces artifacts.
//
// WHY: a skill is read by the main loop and executed IN the main context. That serializes the
// work: while the main loop writes CSS, it does nothing else. An agent with the same doctrine runs
// in its own context, and several run at the same time. The skill is neither converted nor copied —
// it stays the source of truth, and the agent reads it as Step 0. Editing the skill updates both.
//
// What the orchestrator gains: for the same work it can now choose
//   (a) read the skill and do it inline — one thing at a time, no extra context cost
//   (b) dispatch <skill>-agent          — parallel, isolated context, ~15x tokens
// The choice is his; this list is what makes (b) possible without inventing a brief from scratch.
//
// Does NOT generate for: doctrine/guard-rails (yagni, karpathy-guidelines, freeze…) nor routers —
// those shape the session's behavior, do not produce isolable work, and as agents would be only
// noise in the list to choose from.
//
// Usage:  node .claude/scripts/skill-agents.mjs [--dry] [--force]
//   --dry    shows what it would do, writes nothing
//   --force  also rewrites generated agents that were hand-edited
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS = path.join(ROOT, '.claude', 'skills');
const AGENTS = path.join(ROOT, '.claude', 'agents');
const MARKER = 'generated-from:';           // generated-agent marker (allows safe regeneration)

const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');

// ── Curated list ─────────────────────────────────────────────────────────────
// DIRECT EXECUTION skills: they produce code, design, content or infrastructure. Each becomes a
// dispatchable agent. Keep it grouped by category — that is how you decide if a new skill enters.
const EXECUTION_SKILLS = {
  'code': [
    'frontend', 'react-composition', 'react-patterns', 'react-email', 'tailwind', 'shadcn',
    'component-system', 'mobile', 'laravel-specialist', 'laravel-react', 'filament', 'rest-api',
    'auth', 'caching', 'queues', 'mysql', 'search', 'webhooks', 'file-storage', 'saas-patterns',
    'transactional-email', 'browser-automate',
  ],
  'wordpress': [
    'wp-block-development', 'wp-block-themes', 'wp-interactivity-api', 'wp-plugin-development',
    'wp-rest-api', 'wp-wpcli-and-ops', 'wpds', 'woocommerce-elementor',
  ],
  'platforms': ['shopify-app', 'shopify-theme', 'shopify-store-fixer', 'wix-cli', 'notion'],
  'design': [
    'design-html', 'design-shotgun', 'design-system', 'design-tokens', 'anima', 'lottie-animator',
    'graphic-design', 'img-gen', 'slides', 'remotion', 'landing-page',
  ],
  'content': [
    'copywriting', 'content-calendar', 'email-sequence', 'social-content', 'social-scheduler',
    'seo', 'seo-local', 'pt-pt-translator', 'stop-slop',
  ],
  'deploy': [
    'deploy-vps', 'deploy-cpanel', 'deploy-docker', 'deploy-ploi', 'cpanel', 'cloudflare-dns',
    'selfhosted-arr',
  ],
  'portugal': ['portugal-payments', 'portugal-invoicing'],
  '3d': ['blender', 'blender-scripting', 'blender-render', 'meshy', 'meshy-3d-print'],
};

// ── Frontmatter ──────────────────────────────────────────────────────────────
function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return {};
  const fm = {};
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim();
    if (['|', '>', '|-', '>-'].includes(val)) {          // block scalar
      const block = [];
      while (++i < lines.length && (!lines[i].trim() || /^[ \t]/.test(lines[i]))) block.push(lines[i].trim());
      i--;
      fm[key] = block.filter(Boolean).join(val.startsWith('>') ? ' ' : '\n');
    } else if (val === '') {
      // Key with no value on its own line → it may be a YAML list on the following lines
      // (`triggers:` followed by `  - cpanel`). Without this, skills that declare their triggers as
      // a list looked like they had none, and the agent left the generator with no triggers.
      const items = [];
      while (++i < lines.length && /^\s+-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''));
      }
      i--;
      fm[key] = items.join(', ');
    } else {
      fm[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return fm;
}

// The agent's description says WHEN to dispatch it, it does not repeat the skill: name+description
// of ALL agents go into the system prompt of EVERY session, so every character here is a recurring
// cost. Without this squeeze, 65 agents cost ~9.5k tokens per session instead of ~2k.
const MAX_DESC = 100;

function agentDescription(skillName, fm, category) {
  const first = (fm.description || '')
    .split(/(?:\.\s|MUST be invoked|SHOULD also invoke|Invoke on|Invoke when|Invoke at|Invocar quando|Triggers?:)/)[0]
    .replace(/^["']|["']$/g, '')
    .trim();
  // Cut on a word boundary — 'dark.' in the middle of 'dark mode' helps nobody decide.
  let what = first;
  if (what.length > MAX_DESC) {
    what = what.slice(0, MAX_DESC);
    const cut = what.lastIndexOf(' ');
    if (cut > 40) what = what.slice(0, cut);
  }
  what = what.replace(/[,;:\s—-]+$/, '');
  return `${category} · ${what}. Dispatch for isolable work in this domain, in parallel.`;
}

// Inherited triggers reach 22 entries (tailwind). They serve discovery in the SKILL_INDEX, not
// fine activation — 6 are enough, and the skill keeps the full list.
//
// Not every skill has `triggers:` in the frontmatter: in many the triggers live as prose inside the
// description ("Invoke on: a, b, c"). Without extracting them from here too, the agent entered the
// index with no trigger at all — unreachable by keyword, which is exactly the problem we have just
// fixed in the skills. Same patterns as build-skill-index.py.
const PROSE_TRIGGERS = /(?:MUST be invoked when(?:ever)? the user (?:says|mentions)|SHOULD also invoke when|Invocar quando o utilizador disser|Invocar quando|Invoke on|Invoke when|Triggers?):\s*([^\n]+?)(?:\.\s|\.$|$)/gi;

function agentTriggers(fm) {
  let list = [];
  if (fm.triggers) {
    list = fm.triggers.split(',').map((t) => t.trim()).filter(Boolean);
  } else {
    for (const m of (fm.description || '').matchAll(PROSE_TRIGGERS)) {
      for (const item of m[1].split(',')) {
        const clean = item.trim().replace(/^["'`]|["'`]$/g, '').replace(/\.$/, '').trim();
        if (clean && clean.length <= 60 && clean.split(' ').length <= 7) list.push(clean);
      }
    }
  }
  const seen = new Set();
  const unique = list.filter((t) => !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
  return unique.length ? `triggers: ${unique.slice(0, 6).join(', ')}\n` : '';
}

function agentBody(skillName, fm) {
  const triggers = fm.triggers ? `\n**Triggers:** ${fm.triggers}\n` : '\n';
  return `# ${skillName} — execution agent

${skillName} specialist. Runs in its own context so the orchestrator can dispatch several jobs at
the same time without blocking the main conversation.
${triggers}
## Step 0 — mandatory, before any action

\`\`\`
Read(".claude/skills/${skillName}.md")
\`\`\`

That skill is this agent's source of truth. It was deliberately **not** copied in here: when the
skill is edited, this agent follows the new version without being regenerated. Do not act before
reading it — the frontmatter \`skills:\` field does not load it on its own.

If the brief mentions other skills, read those too before starting.

## How to work

1. Read the skill (Step 0) and the brief you were given.
2. Confirm the real state before changing anything: read the files you are about to touch. Do not
   assume structure.
3. Do **only** what the brief asks. Do not "improve" adjacent code, do not add features nobody
   asked for.
4. Follow the conventions of the project you are in (the project's CLAUDE.md, the patterns in the
   surrounding code) over the skill's defaults.
5. Validate what you did (build, tests, or whatever definition of done the brief set).

## Limits

- **You do not dispatch other agents.** The tree has one level: main loop → workers. If the work
  needs fan-out, return that as a recommendation and the caller decides.
- **You do not invent** paths, APIs, keys or endpoints. A credential is missing or you cannot find
  a file → leave \`TODO: <what is missing>\` and report it. A plausible invented value passes the
  build and only blows up in production.
- **Irreversible** (deploy, push, migration, delete, payment) → you do not execute it; return it as
  a proposal for the caller to confirm.
- Bulky output (reports, long listings) → write it to a file and return the path, do not dump it
  all into the report.

## Final report

Short and actionable:
- what got done, in one or two sentences;
- files touched (paths);
- what you validated and how;
- what is left undone (with the reason) and the next step you recommend.
`;
}

// ── Detecting manual edits ───────────────────────────────────────────────────
// The hash covers everything except the hash line itself.
const HASH_LINE = /^content-hash: .*$\n?/m;
const bodyHash = (text) => crypto.createHash('sha256').update(text.replace(HASH_LINE, '')).digest('hex').slice(0, 16);
const storedHash = (text) => (text.match(/^content-hash: (\w+)$/m) || [])[1] || '';

// ── Generation ───────────────────────────────────────────────────────────────
const written = [], skipped = [], missing = [], manual = [];

for (const [category, skills] of Object.entries(EXECUTION_SKILLS)) {
  for (const skillName of skills) {
    const skillFile = path.join(SKILLS, `${skillName}.md`);
    if (!fs.existsSync(skillFile)) { missing.push(skillName); continue; }

    const agentName = `${skillName}-agent`;
    const agentFile = path.join(AGENTS, `${agentName}.md`);

    // Never step on a hand-curated agent, nor on a manual edit inside a generated one.
    //
    // A generated agent carries the hash of what was generated. If the file on disk no longer
    // matches its own hash, someone edited it — and regenerating would silently wipe that work.
    // Without this, running the script a second time destroys any customization.
    if (fs.existsSync(agentFile)) {
      const existing = fs.readFileSync(agentFile, 'utf8');
      if (!existing.includes(MARKER)) { manual.push(agentName); continue; }   // hand-curated
      if (!FORCE && bodyHash(existing) !== storedHash(existing)) { manual.push(agentName); continue; }
    }

    const fm = parseFrontmatter(fs.readFileSync(skillFile, 'utf8'));
    const content = `---
name: ${agentName}
description: "${agentDescription(skillName, fm, category).replace(/"/g, "'")}"
skills: ${skillName}
model: opus
effort: medium
category: ${category}
${agentTriggers(fm)}${MARKER} .claude/skills/${skillName}.md
generated-by: skill-agents.mjs
---

${agentBody(skillName, fm)}`;

    if (DRY) { written.push(agentName); continue; }
    // Seal it with the hash of the content itself, so the next run knows whether it was touched.
    const sealed = content.replace(/^generated-by: skill-agents\.mjs$/m,
      `generated-by: skill-agents.mjs\ncontent-hash: ${bodyHash(content)}`);
    fs.writeFileSync(agentFile, sealed);
    written.push(agentName);
  }
}

const total = Object.values(EXECUTION_SKILLS).flat().length;
console.log(`[skill-agents] ${DRY ? '(dry) ' : ''}${written.length}/${total} agents generated in .claude/agents/`);
for (const [cat, list] of Object.entries(EXECUTION_SKILLS)) {
  console.log(`  ${cat}: ${list.length}`);
}
if (manual.length) console.log(`[skill-agents] preserved (hand-edited or curated): ${manual.join(', ')}`);
if (missing.length) console.log(`[skill-agents] WARNING — skills in the list but with no file: ${missing.join(', ')}`);
if (skipped.length) console.log(`[skill-agents] skipped: ${skipped.join(', ')}`);
console.log('[skill-agents] next: python3 .claude/scripts/build-skill-index.py');
