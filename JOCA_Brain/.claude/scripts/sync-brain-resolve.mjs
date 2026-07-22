#!/usr/bin/env node
/**
 * sync-brain-resolve — resolução semântica dos ficheiros JOCA_OS/data/*.json
 * marcados `merge=binary` (.gitattributes) durante um `git merge` em conflito.
 *
 * Cobre os 4 ficheiros de estado conhecidos: automacoes.json, master-chat.json,
 * projects.json, project-memory.json. Qualquer outro ficheiro em conflito é
 * reportado e deixado por resolver (nunca adivinha fora deste conjunto).
 *
 * Uso (a partir da raiz do repo JOCA, DEPOIS de `git merge origin/master --no-commit --no-ff`
 * ter parado em conflito):
 *   node .claude/scripts/sync-brain-resolve.mjs
 *
 * Não corre `git add`/`git commit` — só escreve os ficheiros resolvidos no working tree.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const KNOWN = [
  'JOCA_OS/data/automacoes.json',
  'JOCA_OS/data/master-chat.json',
  'JOCA_OS/data/projects.json',
  'JOCA_OS/data/project-memory.json',
];

const PLACEHOLDER_RE = /a inicializar|a processar|aguardo re-invoca|worker.{0,20}inicializ/i;

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}

function conflictedFiles() {
  const out = sh('git status --porcelain');
  return out
    .split('\n')
    .filter((l) => l.startsWith('UU '))
    .map((l) => l.slice(3).trim());
}

function showBlob(stage, path) {
  try {
    return sh(`git show :${stage}:${path}`);
  } catch {
    return null; // ficheiro não existia nesse lado (ex.: novo)
  }
}

function loadJson(stage, path) {
  const raw = showBlob(stage, path);
  if (raw == null) return null;
  return JSON.parse(raw);
}

function isPlaceholder(text) {
  return typeof text === 'string' && PLACEHOLDER_RE.test(text);
}

function resolveAutomacoes(base, ours, theirs) {
  const byId = new Map();
  for (const a of base || []) byId.set(a.id, { base: a });
  for (const a of ours || []) byId.set(a.id, { ...(byId.get(a.id) || {}), ours: a });
  for (const a of theirs || []) byId.set(a.id, { ...(byId.get(a.id) || {}), theirs: a });

  const result = [];
  for (const [, { ours: o, theirs: t, base: b }] of byId) {
    if (o && t) {
      const oPlaceholder = isPlaceholder(o.lastResult);
      const tPlaceholder = isPlaceholder(t.lastResult);
      if (oPlaceholder !== tPlaceholder) {
        result.push(oPlaceholder ? t : o); // versão completa vence sobre o placeholder
      } else {
        result.push((o.lastRunAt || 0) >= (t.lastRunAt || 0) ? o : t);
      }
    } else {
      result.push(o || t || b);
    }
  }
  return result;
}

function resolveMasterChat(base, ours, theirs) {
  const baseIds = new Set((base || []).map((m) => m.id));
  const newOurs = (ours || []).filter((m) => !baseIds.has(m.id));
  const newTheirs = (theirs || []).filter((m) => !baseIds.has(m.id));

  let extra = [...newOurs, ...newTheirs];

  // par correlacionado: 1 mensagem nova de cada lado, timestamps próximos (<5min),
  // pelo menos uma delas placeholder -> mesma automação, não união.
  if (newOurs.length === 1 && newTheirs.length === 1) {
    const [a] = newOurs, [b] = newTheirs;
    const closeInTime = Math.abs((a.ts || 0) - (b.ts || 0)) < 5 * 60 * 1000;
    const eitherPlaceholder = isPlaceholder(a.text) || isPlaceholder(b.text);
    if (closeInTime && eitherPlaceholder) {
      extra = [isPlaceholder(a.text) ? b : a];
    }
  }

  const merged = [...(base || []), ...extra];
  merged.sort((x, y) => (x.ts || 0) - (y.ts || 0));
  return merged;
}

function resolveProjects(base, ours, theirs) {
  const baseById = new Map((base || []).map((p) => [p.id, p]));
  const oursById = new Map((ours || []).map((p) => [p.id, p]));
  const theirsById = new Map((theirs || []).map((p) => [p.id, p]));
  const ids = new Set([...baseById.keys(), ...oursById.keys(), ...theirsById.keys()]);

  const result = [];
  const manualConflicts = [];
  for (const id of ids) {
    const b = baseById.get(id), o = oursById.get(id), t = theirsById.get(id);
    const oChanged = o && JSON.stringify(o) !== JSON.stringify(b);
    const tChanged = t && JSON.stringify(t) !== JSON.stringify(b);
    if (oChanged && tChanged && JSON.stringify(o) !== JSON.stringify(t)) {
      manualConflicts.push(id);
      result.push(o); // placeholder para não perder a entrada; sinalizado abaixo
    } else {
      result.push(o || t || b);
    }
  }
  return { result, manualConflicts };
}

function resolveProjectMemory(base, ours, theirs) {
  const b = base || {}, o = ours || {}, t = theirs || {};
  const keys = new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(t)]);
  const result = {};
  for (const k of keys) {
    const bo = b[k], oo = o[k], to = t[k];
    if (oo && to) {
      const oTs = Date.parse(oo.updatedAt || 0) || 0;
      const tTs = Date.parse(to.updatedAt || 0) || 0;
      result[k] = oTs >= tTs ? oo : to;
    } else {
      result[k] = oo || to || bo;
    }
  }
  return result;
}

function main() {
  const conflicts = conflictedFiles();
  if (conflicts.length === 0) {
    console.log('Sem ficheiros em conflito (UU). Nada a resolver.');
    return;
  }

  const unknown = conflicts.filter((f) => !KNOWN.includes(f));
  const known = conflicts.filter((f) => KNOWN.includes(f));

  for (const file of known) {
    const base = loadJson(1, file);
    const ours = loadJson(2, file);
    const theirs = loadJson(3, file);
    let resolved;
    let warn = [];

    if (file.endsWith('automacoes.json')) {
      resolved = resolveAutomacoes(base, ours, theirs);
    } else if (file.endsWith('master-chat.json')) {
      resolved = resolveMasterChat(base, ours, theirs);
    } else if (file.endsWith('projects.json')) {
      const r = resolveProjects(base, ours, theirs);
      resolved = r.result;
      warn = r.manualConflicts;
    } else if (file.endsWith('project-memory.json')) {
      resolved = resolveProjectMemory(base, ours, theirs);
    }

    writeFileSync(file, JSON.stringify(resolved, null, 2) + '\n');
    console.log(`Resolvido: ${file}${warn.length ? ` (⚠ conflito genuíno nos ids: ${warn.join(', ')} — reveja antes de commitar)` : ''}`);
  }

  if (unknown.length) {
    console.log('\n⚠ Ficheiros em conflito FORA do conjunto conhecido — resolver manualmente antes de continuar:');
    unknown.forEach((f) => console.log(`  - ${f}`));
  }
}

main();
