#!/usr/bin/env node
// Estado do ciclo de uma marca (CONTRATO §3): <RAIZ>/clientes/<slug>/estado.json. Único sítio que o
// lê e escreve — as skills chamam isto, nunca editam o JSON à mão.
//
//   node "<MKT>/scripts/estado.mjs" ler <slug>                         imprime o JSON (cria o default se faltar)
//   node "<MKT>/scripts/estado.mjs" marcar <slug> <F0..F5> <pendente|em_curso|feito> ["<próxima ação>"]
//   node "<MKT>/scripts/estado.mjs" aprovar <slug> <proposta|artes>    aprovação com a data de hoje
//   node "<MKT>/scripts/estado.mjs" revisao <slug> <canal> <AAAA-MM-DD> "<motivo>"   substitui a do mesmo canal
//   node "<MKT>/scripts/estado.mjs" ciclo-novo <slug>                  abre o ciclo seguinte (F1 a seguir)
// Raiz: MARKETEER_RAIZ (ou a pasta atual). Sai 0 e imprime o estado; 1 em erro (nada é escrito).
//
// - Default: ciclo = AAAA-MM atual, fase F0, passos F0..F5 pendentes, aprovações null.
// - `fase` = a primeira fase não-feita (todas feitas → F5).
// - Ciclo = AAAA-MM; no mesmo mês o seguinte é AAAA-MM-2, depois -3… (CONTRATO §3).
// - `ciclo-novo` move as revisões com data ≤ hoje para `revisoes_anteriores` e mantém as futuras.
// - Escrita atómica: ficheiro temporário + rename. Um estado.json ilegível nunca é sobrescrito.

import { readFileSync, writeFileSync, renameSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { raizDados } from './raiz.mjs';
import { eEntrada } from './validar-dossier.mjs';
import { dataLocal } from './criar-dossier.mjs';

export const FASES = ['F0', 'F1', 'F2', 'F3', 'F4', 'F5'];
export const ESTADOS = ['pendente', 'em_curso', 'feito'];
export const APROVACOES = ['proposta', 'artes'];
// CONTRATO §4.
export const CANAIS = ['google-ads', 'ga4', 'search-console', 'gbp', 'meta-ads', 'facebook', 'instagram',
  'linkedin', 'linkedin-ads', 'email', 'trypost', 'gtm', 'site', 'seo', 'offline'];
const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

export class ErroEstado extends Error {}

const mes = (d) => dataLocal(d).slice(0, 7);

export function estadoPadrao(slug, hoje = new Date()) {
  return {
    slug,
    ciclo: mes(hoje),
    fase: 'F0',
    passos: Object.fromEntries(FASES.map((f) => [f, 'pendente'])),
    aprovacoes: { proposta: null, artes: null },
    proxima_accao: null,
    revisoes: [],
    actualizado: dataLocal(hoje),
  };
}

function caminho(raiz, slug) {
  if (typeof slug !== 'string' || !SLUG.test(slug)) throw new ErroEstado(`slug inválido "${slug}"`);
  return join(raiz, 'clientes', slug, 'estado.json');
}

const primeiraPorFazer = (passos) => FASES.find((f) => passos[f] !== 'feito') ?? 'F5';

function ler_(raiz, slug) {
  const f = caminho(raiz, slug);
  let texto;
  try {
    texto = readFileSync(f, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new ErroEstado(`não foi possível ler clientes/${slug}/estado.json (${e.code})`);
  }
  try {
    const e = JSON.parse(texto.replace(/^﻿/, ''));
    if (!e || typeof e !== 'object' || Array.isArray(e)) throw new Error();
    return e;
  } catch {
    throw new ErroEstado(`clientes/${slug}/estado.json ilegível — corrigir à mão (não se sobrescreve)`);
  }
}

function gravar(raiz, slug, estado) {
  const f = caminho(raiz, slug);
  mkdirSync(join(raiz, 'clientes', slug), { recursive: true });
  const tmp = `${f}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(estado, null, 2) + '\n', { flag: 'wx' });
    renameSync(tmp, f);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw new ErroEstado(`não foi possível gravar clientes/${slug}/estado.json (${e.code ?? e.message})`);
  }
  return estado;
}

// Completa um estado antigo/parcial sem perder o que tem.
function normalizar(e, slug, hoje) {
  const base = estadoPadrao(slug, hoje);
  return {
    ...base, ...e,
    passos: { ...base.passos, ...(e.passos ?? {}) },
    aprovacoes: { ...base.aprovacoes, ...(e.aprovacoes ?? {}) },
    revisoes: Array.isArray(e.revisoes) ? e.revisoes : [],
    ...(e.revisoes_anteriores !== undefined && { revisoes_anteriores: Array.isArray(e.revisoes_anteriores) ? e.revisoes_anteriores : [] }),
  };
}

function alterar(slug, { raiz, hoje }, mudar) {
  const atual = ler_(raiz, slug);
  const e = atual ? normalizar(atual, slug, hoje) : estadoPadrao(slug, hoje);
  mudar(e);
  e.actualizado = dataLocal(hoje);
  return gravar(raiz, slug, e);
}

export function ler(slug, { raiz = raizDados(), hoje = new Date() } = {}) {
  const atual = ler_(raiz, slug);
  if (atual) return atual;
  return gravar(raiz, slug, estadoPadrao(slug, hoje));
}

export function marcar(slug, fase, estado, proxima, { raiz = raizDados(), hoje = new Date() } = {}) {
  if (!FASES.includes(fase)) throw new ErroEstado(`fase inválida "${fase}" (${FASES.join('|')})`);
  if (!ESTADOS.includes(estado)) throw new ErroEstado(`estado inválido "${estado}" (${ESTADOS.join('|')})`);
  if (proxima !== undefined && (typeof proxima !== 'string' || !proxima.trim())) throw new ErroEstado('próxima ação vazia');
  caminho(raiz, slug);
  return alterar(slug, { raiz, hoje }, (e) => {
    e.passos[fase] = estado;
    e.fase = primeiraPorFazer(e.passos);
    if (proxima !== undefined) e.proxima_accao = proxima.trim();
  });
}

export function aprovar(slug, qual, { raiz = raizDados(), hoje = new Date() } = {}) {
  if (!APROVACOES.includes(qual)) throw new ErroEstado(`aprovação inválida "${qual}" (${APROVACOES.join('|')})`);
  caminho(raiz, slug);
  return alterar(slug, { raiz, hoje }, (e) => { e.aprovacoes[qual] = dataLocal(hoje); });
}

function dataValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function revisao(slug, canal, data, motivo, { raiz = raizDados(), hoje = new Date() } = {}) {
  if (!CANAIS.includes(canal)) throw new ErroEstado(`canal inválido "${canal}" (${CANAIS.join('|')})`);
  if (!dataValida(data)) throw new ErroEstado(`data inválida "${data}" (AAAA-MM-DD)`);
  if (typeof motivo !== 'string' || !motivo.trim()) throw new ErroEstado('falta o motivo da revisão');
  caminho(raiz, slug);
  return alterar(slug, { raiz, hoje }, (e) => {
    e.revisoes = e.revisoes.filter((r) => r?.canal !== canal);
    e.revisoes.push({ canal, data, motivo: motivo.trim() });
  });
}

// Ciclo seguinte ao atual: outro mês → AAAA-MM; o mesmo mês → AAAA-MM-2, -3, …
export function cicloSeguinte(atual, hoje = new Date()) {
  const base = mes(hoje);
  if (atual !== base && !String(atual ?? '').startsWith(`${base}-`)) return base;
  const m = /^\d{4}-\d{2}-(\d+)$/.exec(atual);
  return `${base}-${m ? Number(m[1]) + 1 : 2}`;
}

// Ciclo novo (depois da F5): F0 já não se repete, F1 só o delta. Não exige F5 feito — abre e reporta.
// Revisões já passadas (data ≤ hoje) → revisoes_anteriores; as futuras mantêm-se.
export function cicloNovo(slug, { raiz = raizDados(), hoje = new Date() } = {}) {
  caminho(raiz, slug);
  return alterar(slug, { raiz, hoje }, (e) => {
    e.ciclo = cicloSeguinte(e.ciclo, hoje);
    const h = dataLocal(hoje);
    const passadas = e.revisoes.filter((r) => typeof r?.data === 'string' && r.data <= h);
    e.revisoes = e.revisoes.filter((r) => !passadas.includes(r));
    e.revisoes_anteriores = [...(e.revisoes_anteriores ?? []), ...passadas];
    e.passos = Object.fromEntries(FASES.map((f) => [f, f === 'F0' ? 'feito' : 'pendente']));
    e.fase = primeiraPorFazer(e.passos);
    e.aprovacoes = { proposta: null, artes: null };
    e.proxima_accao = null;
  });
}

// Forma do estado.json (para o validar-dossier): as chaves do estadoPadrao (+ revisoes_anteriores),
// nada mais. Devolve a lista de erros (vazia = válido).
const CHAVES = ['slug', 'ciclo', 'fase', 'passos', 'aprovacoes', 'proxima_accao', 'revisoes', 'actualizado'];
export function validarEstado(e, slugEsperado) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return ['estado.json não é um objeto JSON'];
  const erros = [];
  for (const k of Object.keys(e)) if (![...CHAVES, 'revisoes_anteriores'].includes(k)) erros.push(`chave desconhecida "${k}" no estado.json`);
  for (const k of CHAVES) if (!(k in e)) erros.push(`falta "${k}" no estado.json`);
  if (slugEsperado && e.slug !== slugEsperado) erros.push(`"slug" (${e.slug}) não bate com a pasta (${slugEsperado})`);
  if ('ciclo' in e && !/^\d{4}-(0[1-9]|1[0-2])(-([2-9]|[1-9]\d+))?$/.test(String(e.ciclo))) erros.push(`"ciclo" inválido (${e.ciclo}) — AAAA-MM ou AAAA-MM-N`);
  if ('fase' in e && !FASES.includes(e.fase)) erros.push(`"fase" inválida (${e.fase})`);
  if ('passos' in e) {
    const p = e.passos;
    if (!p || typeof p !== 'object' || Array.isArray(p)) erros.push('"passos" tem de ser um objeto');
    else {
      for (const [k, v] of Object.entries(p)) {
        if (!FASES.includes(k)) erros.push(`passos: fase desconhecida "${k}"`);
        else if (!ESTADOS.includes(v)) erros.push(`passos.${k} inválido (${v})`);
      }
      for (const f of FASES) if (!(f in p)) erros.push(`passos: falta ${f}`);
    }
  }
  if ('aprovacoes' in e) {
    const a = e.aprovacoes;
    if (!a || typeof a !== 'object' || Array.isArray(a)) erros.push('"aprovacoes" tem de ser um objeto');
    else {
      for (const [k, v] of Object.entries(a)) {
        if (!APROVACOES.includes(k)) erros.push(`aprovacoes: chave desconhecida "${k}"`);
        else if (v !== null && !dataValida(v)) erros.push(`aprovacoes.${k} tem de ser null ou AAAA-MM-DD`);
      }
      for (const k of APROVACOES) if (!(k in a)) erros.push(`aprovacoes: falta ${k}`);
    }
  }
  if ('proxima_accao' in e && e.proxima_accao !== null && typeof e.proxima_accao !== 'string') erros.push('"proxima_accao" tem de ser texto ou null');
  for (const lista of ['revisoes', 'revisoes_anteriores']) {
    if (!(lista in e)) continue;
    if (!Array.isArray(e[lista])) { erros.push(`"${lista}" tem de ser uma lista`); continue; }
    e[lista].forEach((r, i) => {
      if (!r || typeof r !== 'object' || Array.isArray(r)) { erros.push(`${lista}[${i}] tem de ser um objeto`); return; }
      for (const k of Object.keys(r)) if (!['canal', 'data', 'motivo'].includes(k)) erros.push(`${lista}[${i}]: chave desconhecida "${k}"`);
      if (!CANAIS.includes(r.canal)) erros.push(`${lista}[${i}].canal inválido (${r.canal})`);
      if (!dataValida(r.data)) erros.push(`${lista}[${i}].data inválida (${r.data})`);
      if (typeof r.motivo !== 'string' || !r.motivo.trim()) erros.push(`${lista}[${i}].motivo em falta`);
    });
  }
  if ('actualizado' in e && !dataValida(e.actualizado)) erros.push('"actualizado" tem de ser uma data AAAA-MM-DD');
  return erros;
}

const USO = 'uso: node estado.mjs ler <slug> | marcar <slug> <F0..F5> <pendente|em_curso|feito> ["<próxima ação>"] | aprovar <slug> <proposta|artes> | revisao <slug> <canal> <AAAA-MM-DD> "<motivo>" | ciclo-novo <slug>';

if (eEntrada(import.meta.url)) {
  try {
    const [cmd, slug, ...r] = process.argv.slice(2);
    if (!cmd || !slug) throw new ErroEstado(USO);
    let e;
    if (cmd === 'ler' && r.length === 0) e = ler(slug);
    else if (cmd === 'marcar' && (r.length === 2 || r.length === 3)) e = marcar(slug, r[0], r[1], r[2]);
    else if (cmd === 'aprovar' && r.length === 1) e = aprovar(slug, r[0]);
    else if (cmd === 'revisao' && r.length === 3) e = revisao(slug, r[0], r[1], r[2]);
    else if (cmd === 'ciclo-novo' && r.length === 0) e = cicloNovo(slug);
    else throw new ErroEstado(USO);
    console.log(JSON.stringify(e, null, 2));
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
