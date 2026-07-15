#!/usr/bin/env node
/**
 * pack-context — empacota uma árvore de código num único ficheiro AI-readable
 * (repomix-style, node puro, zero dependências). Para briefs de sub-agentes
 * (1 ficheiro em vez de N paths) e modelos de contexto longo (gemini-brain 1M).
 *
 * Uso:
 *   node pack-context.mjs <dir> [--out <file>] [--max-kb 512] [--ext ts,tsx,php] [--exclude glob1,glob2]
 *
 * Regras:
 * - Respeita .gitignore via `git ls-files` (fallback: walk com exclusões standard).
 * - Output NUNCA por omissão dentro da árvore do projecto-alvo (gotcha content-scan
 *   Tailwind v4 — ver rules/orchestration-patterns.md #4). Default: %TEMP%.
 * - Corta ao budget (--max-kb, default 512): ficheiros maiores primeiro ficam de fora,
 *   listados no cabeçalho como "excluídos por budget" (sem truncar a meio — sem caps silenciosos).
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, statSync, readdirSync, existsSync } from 'fs';
import { join, resolve, relative, extname, basename } from 'path';
import { tmpdir } from 'os';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}

const root = resolve(process.argv[2] || '.');
if (!existsSync(root)) { console.error(`pack-context: directório não existe: ${root}`); process.exit(1); }

const maxBytes = parseInt(arg('max-kb', '512'), 10) * 1024;
const extFilter = arg('ext', '') ? arg('ext', '').split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase()) : null;
const excludes = arg('exclude', '') ? arg('exclude', '').split(',').map((e) => e.trim()) : [];
const out = resolve(arg('out', join(tmpdir(), `pack-${basename(root)}-${Date.now()}.md`)));

const DEFAULT_SKIP = /(^|[\\/])(node_modules|vendor|dist|build|out|storage|\.git|\.next|coverage|__pycache__|bin|obj)([\\/]|$)/i;
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|mp[34]|mov|avi|zip|gz|rar|pdf|psd|exe|dll|so|bin|lock|min\.js|min\.css)$/i;

function gitFiles() {
  try {
    return execSync('git ls-files --cached --others --exclude-standard', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
      .toString().split('\n').filter(Boolean);
  } catch (_) { return null; }
}
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (DEFAULT_SKIP.test(p)) continue;
    if (e.isDirectory()) walk(p, acc);
    else acc.push(relative(root, p));
  }
  return acc;
}

let files = (gitFiles() || walk(root))
  .map((f) => f.replace(/\\/g, '/'))
  .filter((f) => !DEFAULT_SKIP.test(f) && !BINARY_EXT.test(f))
  .filter((f) => !extFilter || extFilter.includes(extname(f).slice(1).toLowerCase()))
  .filter((f) => !excludes.some((g) => f.includes(g)));

// budget: pequenos primeiro maximiza cobertura; grandes de fora ficam listados
const sized = files.map((f) => {
  try { return { f, size: statSync(join(root, f)).size }; } catch (_) { return null; }
}).filter(Boolean).sort((a, b) => a.size - b.size);

const included = [], skipped = [];
let used = 0;
for (const { f, size } of sized) {
  if (used + size <= maxBytes) { included.push(f); used += size; }
  else skipped.push(`${f} (${(size / 1024).toFixed(1)}kb)`);
}

let outStr = `# pack-context — ${root}\n`;
outStr += `# ${included.length} ficheiros incluídos, ${(used / 1024).toFixed(0)}kb de ${(maxBytes / 1024).toFixed(0)}kb budget\n`;
if (skipped.length) outStr += `# EXCLUÍDOS POR BUDGET (${skipped.length}): ${skipped.join(', ')}\n`;
outStr += '\n';
for (const f of included) {
  let body;
  try { body = readFileSync(join(root, f), 'utf8'); } catch (_) { continue; }
  outStr += `=== ${f} ===\n\`\`\`\n${body}\n\`\`\`\n\n`;
}
writeFileSync(out, outStr, 'utf8');
console.log(`[pack-context] ${included.length} ficheiros (${(used / 1024).toFixed(0)}kb)${skipped.length ? `, ${skipped.length} fora por budget` : ''} → ${out}`);
