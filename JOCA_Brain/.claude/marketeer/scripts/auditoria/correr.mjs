#!/usr/bin/env node
// `node "<MKT>/scripts/auditoria/correr.mjs" <cliente>` (#9): corre os módulos de auditoria, agrega o resultado em
// clientes/<slug>/auditorias/<AAAA-MM-DD>.json e actualiza "estado" e "actualizado" no dossier.
// Uso: node "<MKT>/scripts/auditoria/correr.mjs" <slug> [raiz]   (raiz default: MARKETEER_RAIZ ou a pasta atual)
// Sai com 0 e imprime o resumo (achados por severidade); 1 em erro — nada gravado.
//
//   auditarCliente(slug, { raiz, modulos = MODULOS, hoje = new Date() }) → { caminho, auditoria }
//
// - Cada módulo importa-se à parte (await import): sem `playwright` o tracking nem carrega, e isso
//   não pode levar os outros — a área fica "erro" com "dependências em falta (npm ci)". Um módulo
//   que lança, ou devolve algo fora do formato, também fica "erro" sozinho.
// - Os módulos são chamados SEM `obter`: um obter custom desliga, no tracking, a verificação dos
//   redireccionamentos salto a salto (D-015 c). Só os testes injectam.
// - `site: <sem fonte>` → áreas web "nao-verificado", sem chamar os módulos. O site normaliza-se
//   uma vez, aqui (normalizarSite, #25).
// - 2.ª auditoria no mesmo dia → AAAA-MM-DD-2.json, -3, … (D-012); nunca se sobrescreve.
// - Só leitura sobre o cliente (D-008): o que se escreve é o JSON e o dossier, no repo.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseDocument } from 'yaml';
import { validarAuditoria, SEVERIDADES } from './formato.mjs';
import { validarDossier, validarFicheiroAuditoria, normalizarSite, eEntrada, SEM_FONTE } from '../validar-dossier.mjs';
import { dataLocal } from '../criar-dossier.mjs';
import { limparErro } from './limpar.mjs';
import { raizDados } from '../raiz.mjs';

// Versão do método de auditoria (vai em "metodo"): sobe quando muda o que se verifica ou como.
export const METODO = '0.1.0';

const SLUG = /^[a-z0-9_][a-z0-9_-]*$/;

// Registo dos módulos, por esta ordem nas "areas".
//   web: precisa de cliente.site (sem site → "nao-verificado", não é chamado)
//   porImplementar + areas: módulo que ainda não existe → essas áreas "nao-verificado", sem chamadas.
//   areas (sem porImplementar): áreas do módulo, usadas só se ele não carregar ou falhar.
// O auditar() recebe { site, cliente: { slug, canais } }. "contas" (#8) não é web: corre sem site,
// com as credenciais do cofre.
export const MODULOS = [
  { nome: 'seo', web: true, importar: () => import('./seo.mjs') },
  { nome: 'presenca', web: true, importar: () => import('./presenca.mjs') },
  // Google Business Profile pela Places API (New), com a chave do cofre de agência (D-023).
  { nome: 'gbp', web: true, importar: () => import('./gbp.mjs') },
  { nome: 'tracking', web: true, importar: () => import('./tracking.mjs') },
  { nome: 'contas', areas: ['contas.ga4', 'contas.search-console'], importar: () => import('./contas.mjs') },
];

// Sem tokens/chaves e cortada (limpar.mjs): a nota vai para um ficheiro partilhado no git.
const primeiraLinha = (e) => limparErro(e?.message ?? e);
const FRONTMATTER = /^(﻿?---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/;

// → { areas, achados } de um módulo; nunca lança.
async function correrModulo(m, { site, slug, canais, data }) {
  const so = (estado, nota) => ({ areas: (m.areas ?? [m.nome]).map((area) => ({ area, estado, nota })), achados: [] });
  if (m.porImplementar) return so('nao-verificado', `módulo por implementar (${m.porImplementar})`);
  if (m.web && site === SEM_FONTE) return so('nao-verificado', `sem site no dossier (cliente.site: ${SEM_FONTE})`);

  let mod;
  try {
    mod = await m.importar();
  } catch (e) {
    // Sem o caminho absoluto da mensagem do Node: a nota vai para um ficheiro partilhado no git.
    const pacote = /Cannot find (?:package|module) '([^']+)'/.exec(e?.message ?? '')?.[1];
    const falta = e?.code === 'ERR_MODULE_NOT_FOUND' && pacote && !pacote.startsWith('/') && !pacote.startsWith('.');
    return so('erro', falta ? `dependências em falta (npm ci): ${pacote}` : `o módulo não carregou (${e?.name ?? 'erro'})`);
  }

  let r;
  try {
    r = await mod.auditar({ site, cliente: { slug, canais } });
  } catch (e) {
    return so('erro', `o módulo falhou: ${primeiraLinha(e)}`);
  }

  // O que o módulo devolveu tem de passar o formato sozinho e ficar dentro do seu nome de área:
  // senão invalidava a auditoria toda (e os outros módulos com ela).
  const areas = Array.isArray(r?.areas) ? r.areas : null;
  const erros = areas
    ? validarAuditoria(JSON.stringify({ cliente: slug, data, metodo: METODO, areas, achados: r.achados }), slug)
    : ['sem "areas"'];
  const alheia = areas?.find((a) => typeof a?.area === 'string' && a.area !== m.nome && !a.area.startsWith(`${m.nome}.`));
  if (alheia) erros.push(`área "${alheia.area}" fora de "${m.nome}"`);
  if (erros.length) return so('erro', `resultado inválido do módulo: ${erros.slice(0, 3).join('; ')}`);
  return { areas, achados: r.achados };
}

const ordem = (s) => SEVERIDADES.indexOf(s);
export const ordenarAchados = (achados) => [...achados].sort((a, b) => ordem(a.severidade) - ordem(b.severidade));

export async function auditarCliente(slug, { raiz = raizDados(), modulos = MODULOS, hoje = new Date() } = {}) {
  if (typeof slug !== 'string' || !SLUG.test(slug)) throw new Error(`slug inválido "${slug}" — minúsculas, algarismos, "-" e "_"`);
  const pasta = join(raiz, 'clientes', slug);
  const caminhoDossier = join(pasta, 'dossier.md');
  if (!existsSync(caminhoDossier)) throw new Error(`não existe dossier em ${caminhoDossier} — criar com /marketeer ${slug}`);

  const texto = readFileSync(caminhoDossier, 'utf8');
  const invalido = validarDossier(texto, slug);
  if (invalido.length) throw new Error(`dossier inválido, corrigir antes de auditar:\n  - ${invalido.join('\n  - ')}`);
  const partes = FRONTMATTER.exec(texto);
  const doc = parseDocument(partes[2]);
  const d = doc.toJS();
  const site = normalizarSite(d.cliente.site);
  const data = dataLocal(hoje);

  const resultados = await Promise.all(modulos.map((m) => correrModulo(m, { site, slug, canais: d.canais, data })));
  const auditoria = {
    cliente: slug,
    data,
    metodo: METODO,
    areas: resultados.flatMap((r) => r.areas),
    achados: ordenarAchados(resultados.flatMap((r) => r.achados)),
  };
  const json = `${JSON.stringify(auditoria, null, 2)}\n`;

  // Dossier novo preparado e validado ANTES de gravar a auditoria: se falhar, nada fica no disco.
  const pastaAuditorias = join(pasta, 'auditorias');
  mkdirSync(pastaAuditorias, { recursive: true });
  for (let n = 1; ; n++) {
    const nome = n === 1 ? data : `${data}-${n}`;
    const caminho = join(pastaAuditorias, `${nome}.json`);
    if (existsSync(caminho)) continue;

    const erros = validarFicheiroAuditoria(json, slug, nome);
    if (erros.length) throw new Error(`auditoria inválida, nada foi gravado:\n  - ${erros.join('\n  - ')}`);

    doc.set('estado', `auditado — auditorias/${nome}.json`);
    doc.set('actualizado', data);
    const dossier = `${partes[1]}${doc.toString().replace(/\n$/, '')}${partes[3]}${partes[4]}`;
    const errosDossier = validarDossier(dossier, slug);
    if (errosDossier.length) throw new Error(`dossier actualizado inválido, nada foi gravado:\n  - ${errosDossier.join('\n  - ')}`);

    try {
      // `wx`: outra auditoria que tenha gravado este nome entretanto → tenta o sufixo seguinte.
      writeFileSync(caminho, json, { flag: 'wx' });
    } catch (e) {
      if (e.code === 'EEXIST') continue;
      throw e;
    }
    writeFileSync(caminhoDossier, dossier);
    return { caminho, auditoria };
  }
}

// Resumo para o operador: estado de cada área e achados por severidade (critica > … > baixa).
export function resumir(auditoria, caminho) {
  const icone = { verificado: '✓', 'nao-verificado': '–', erro: '✗' };
  const linhas = [`Auditoria de ${auditoria.cliente} — ${auditoria.data} (método ${auditoria.metodo})`];
  if (caminho) linhas.push(`Gravada em ${caminho}`);
  linhas.push('', 'Áreas:');
  for (const a of auditoria.areas) linhas.push(`  ${icone[a.estado] ?? '?'} ${a.area} — ${a.estado}${a.nota ? `: ${a.nota}` : ''}`);
  const achados = ordenarAchados(auditoria.achados);
  linhas.push('', achados.length ? `Achados (${achados.length}), por severidade:` : 'Sem achados nas áreas verificadas.');
  for (const ac of achados) {
    linhas.push(`  [${ac.severidade}] ${ac.regra}${ac.alvo ? ` (${ac.alvo})` : ''} — ${ac.evidencia}`);
    linhas.push(`      → ${ac.recomendacao} (skill: ${ac.skill})`);
  }
  return linhas.join('\n');
}

if (eEntrada(import.meta.url)) {
  try {
    const [slug, raiz] = process.argv.slice(2);
    if (!slug) throw new Error('uso: node "<MKT>/scripts/auditoria/correr.mjs" <slug> [raiz]');
    const { caminho, auditoria } = await auditarCliente(slug, raiz ? { raiz } : {});
    console.log(resumir(auditoria, relative(raiz ?? raizDados(), caminho)));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
