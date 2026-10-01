#!/usr/bin/env node
// Raiz dos dados das marcas (CONTRATO §2): a pasta de trabalho que contém `clientes/`. Nunca o pack.
//
//   raizDados() → MARKETEER_RAIZ, senão a pasta atual. É o que TODOS os scripts usam por omissão
//                 (o operador/skill exporta MARKETEER_RAIZ antes de os correr).
//   resolverRaiz({ env, cwd, config }) → { raiz, origem } | null — a ordem completa do contrato:
//                 1. MARKETEER_RAIZ · 2. cwd com `clientes/` · 3. ~/.config/marketeer/config.json → `raiz`.
//                 null = ninguém sabe; a skill pergunta (AskUserQuestion) e grava com --definir.
//   definirRaiz(pasta, { config }) → grava config.json (pasta ~/.config/marketeer com 700 se faltar).
//
// CLI:
//   node raiz.mjs                    imprime a raiz e sai 0; sai 2 se for preciso perguntar.
//   node raiz.mjs --definir <pasta>  grava `raiz` no config.json (caminho absoluto) e imprime-o.
// Só lê/escreve config.json: nunca toca nos <slug>.env do cofre.

import { existsSync, statSync, realpathSync, readFileSync, writeFileSync, renameSync, mkdirSync, chmodSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function raizDados() {
  return resolve(process.env.MARKETEER_RAIZ || process.cwd());
}

export const configPadrao = () => join(homedir(), '.config', 'marketeer', 'config.json');

const ePasta = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

function lerConfig(config) {
  if (!existsSync(config)) return null;
  try {
    const c = JSON.parse(readFileSync(config, 'utf8').replace(/^﻿/, ''));
    return c && typeof c === 'object' && typeof c.raiz === 'string' && c.raiz.trim() ? c : null;
  } catch {
    throw new Error(`config ilegível: ${config} — corrigir ou regravar com node raiz.mjs --definir <pasta>`);
  }
}

export function resolverRaiz({ env = process.env, cwd = process.cwd(), config = configPadrao() } = {}) {
  if (env.MARKETEER_RAIZ) return { raiz: resolve(env.MARKETEER_RAIZ), origem: 'MARKETEER_RAIZ' };
  if (ePasta(join(cwd, 'clientes'))) return { raiz: resolve(cwd), origem: 'pasta atual' };
  const c = lerConfig(config);
  if (c) return { raiz: resolve(c.raiz), origem: config };
  return null;
}

export function definirRaiz(pasta, { config = configPadrao() } = {}) {
  if (typeof pasta !== 'string' || !pasta.trim()) throw new Error('pasta vazia');
  const raiz = resolve(pasta.replace(/^~(?=$|\/)/, homedir()));
  const dir = dirname(config);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') chmodSync(dir, 0o700);
  }
  let atual = {};
  try { atual = lerConfig(config) ?? {}; } catch { atual = {}; }
  const tmp = `${config}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify({ ...atual, raiz }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(tmp, config);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw new Error(`não foi possível gravar ${config} (${e.code ?? e.message})`);
  }
  return raiz;
}

// Sem dependências (nem yaml): corre antes do `npm ci`. Mesmo critério do eEntrada de validar-dossier.mjs.
function eEntrada() {
  try {
    const a = realpathSync(process.argv[1] ?? '');
    const b = realpathSync(fileURLToPath(import.meta.url));
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch { return false; }
}

if (eEntrada()) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--definir') {
      if (!args[1]) throw new Error('uso: node raiz.mjs --definir <pasta>');
      console.log(definirRaiz(args[1]));
    } else if (args.length) {
      throw new Error('uso: node raiz.mjs [--definir <pasta>]');
    } else {
      const r = resolverRaiz();
      if (!r) {
        console.error('raiz dos dados por definir: perguntar ao operador (recomendado ~/Marketeer) e gravar com node raiz.mjs --definir <pasta>');
        process.exit(2);
      }
      console.log(r.raiz);
    }
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
