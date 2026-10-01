// Formato de clientes/<slug>/auditorias/<nome>.json (D-004; entidades Auditoria/Achado no PRD §9).
//
// Nome do ficheiro: AAAA-MM-DD.json, ou AAAA-MM-DD-<sufixo>.json (sufixo em kebab-case: "2",
// "tarde") para mais de uma auditoria no mesmo dia — uma auditoria nunca sobrescreve outra.
// A data do nome tem de ser igual a "data".
//
// {
//   "ficticio": true,                 // opcional; só o _exemplo o usa
//   "nota": "texto livre",            // opcional
//   "cliente": "<slug>",              // igual à pasta do cliente
//   "data": "AAAA-MM-DD",             // igual à data no nome do ficheiro
//   "metodo": "0.1.0",                // versão do método de auditoria
//   "areas": [                        // âmbito: todas as áreas tentadas, com o estado de cada uma
//     { "area": "seo", "estado": "verificado" | "nao-verificado" | "erro", "nota": "..." }
//   ],                                // "nota" obrigatória em nao-verificado e erro (porquê)
//   "achados": [
//     {
//       "area": "seo",                // tem de estar em "areas" e não pode ser "nao-verificado"
//       "regra": "seo.title-ausente", // id estável do achado: <area>.<slug-kebab>; permite o diff
//                                     // entre auditorias (fase 2). O prefixo é a "area" do achado.
//       "severidade": "critica" | "alta" | "media" | "baixa",
//       "evidencia": "URL ou medição", // obrigatória: achado sem evidência é inventado
//       "recomendacao": "o que fazer",
//       "skill": "seo",               // skill JOCA que resolve
//       "alvo": "ga4"                 // opcional: o que a regra apanhou (fornecedor, tag, rede)
//     }                               // quando a mesma regra se repete; "regra"+"alvo" é único
//                                     // dentro da auditoria (D-016) — é a chave do diff F4.
//   ]
// }
//
// "area" = nome do módulo de auditoria ("seo") ou modulo.subarea ("presenca.instagram").
// Estados: verificado = área vista por inteiro; nao-verificado = sem acesso, logo sem achados;
// erro = verificação parcial ou falhada — só entram achados com evidência real do que se viu.
// "data" é uma data de calendário real (2026-02-31 é recusada).
//
// Segredos e campos de credenciais verificam-se em validar-dossier.mjs, como no resto de clientes/.

export const ESTADOS_DE_AREA = ['verificado', 'nao-verificado', 'erro'];
export const SEVERIDADES = ['critica', 'alta', 'media', 'baixa'];

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const NOME_DE_FICHEIRO = /^(\d{4}-\d{2}-\d{2})(-[a-z0-9]+(-[a-z0-9]+)*)?$/;
const SLUG_KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Round-trip com Date: 2026-02-31 passa na regex mas o Date normaliza-a para 03-03; mês 13 dá
// Invalid Date, e aí o toISOString lançaria.
const dataReal = (d) => {
  const t = new Date(`${d}T00:00:00Z`);
  return DATA.test(d) && !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
};
const temTexto = (v) => typeof v === 'string' && v.trim() !== '';
// "<sem fonte>" é o marcador de campo sem fonte: numa evidência equivale a não ter evidência.
const semFonte = (v) => v.trim() === '<sem fonte>';

// nomeDoFicheiro: o nome sem ".json" (ex.: "2026-09-24" ou "2026-09-24-2").
export function validarAuditoria(texto, slugEsperado, nomeDoFicheiro) {
  let a;
  try {
    a = JSON.parse(texto.replace(/^﻿/, ''));
  } catch (e) {
    return [`JSON inválido: ${e.message}`];
  }
  if (!a || typeof a !== 'object' || Array.isArray(a)) return ['a auditoria tem de ser um objecto JSON'];

  const erros = [];
  if (!temTexto(a.cliente)) erros.push('falta "cliente"');
  else if (slugEsperado && a.cliente !== slugEsperado) erros.push(`"cliente" (${a.cliente}) não bate com a pasta (${slugEsperado})`);

  const nome = nomeDoFicheiro === undefined ? null : NOME_DE_FICHEIRO.exec(nomeDoFicheiro);
  if (nomeDoFicheiro !== undefined && !nome) erros.push(`nome do ficheiro "${nomeDoFicheiro}.json" fora da convenção AAAA-MM-DD(-<sufixo>).json`);
  if (!dataReal(String(a.data ?? ''))) erros.push('"data" tem de ser uma data AAAA-MM-DD válida');
  else if (nome && a.data !== nome[1]) erros.push(`"data" (${a.data}) não bate com o nome do ficheiro (${nomeDoFicheiro})`);

  if (!temTexto(a.metodo)) erros.push('falta "metodo" (versão do método de auditoria)');
  if (a.ficticio !== undefined && typeof a.ficticio !== 'boolean') erros.push('"ficticio" tem de ser true/false');

  const estados = new Map();
  if (!Array.isArray(a.areas) || !a.areas.length) {
    erros.push('"areas" tem de ser uma lista com pelo menos uma área');
  } else {
    a.areas.forEach((ar, i) => {
      if (!temTexto(ar?.area)) return erros.push(`areas[${i}].area em falta`);
      if (estados.has(ar.area)) erros.push(`areas[${i}].area repetida: ${ar.area}`);
      if (!ESTADOS_DE_AREA.includes(ar.estado)) erros.push(`areas[${i}].estado inválido: ${ar.estado} (${ESTADOS_DE_AREA.join(' | ')})`);
      else if (ar.estado !== 'verificado' && !temTexto(ar.nota)) erros.push(`areas[${i}] em ${ar.estado} sem "nota" (porquê)`);
      estados.set(ar.area, ar.estado);
    });
  }

  if (!Array.isArray(a.achados)) {
    erros.push('"achados" tem de ser uma lista (pode ser vazia)');
  } else {
    const vistos = new Set();
    a.achados.forEach((ac, i) => {
      const p = `achados[${i}]`;
      if (!ac || typeof ac !== 'object') return erros.push(`${p} tem de ser um objecto`);
      if (!temTexto(ac.area)) erros.push(`${p}.area em falta`);
      else if (!estados.has(ac.area)) erros.push(`${p}.area "${ac.area}" não está em "areas"`);
      else if (estados.get(ac.area) === 'nao-verificado') erros.push(`${p}.area "${ac.area}" está nao-verificado — sem acesso não há achado`);
      if (!temTexto(ac.regra)) erros.push(`${p}.regra em falta (<area>.<slug-kebab>)`);
      else if (temTexto(ac.area) && !(ac.regra.startsWith(`${ac.area}.`) && SLUG_KEBAB.test(ac.regra.slice(ac.area.length + 1)))) {
        erros.push(`${p}.regra "${ac.regra}" tem de ser "${ac.area}.<slug-kebab>"`);
      }
      if (!SEVERIDADES.includes(ac.severidade)) erros.push(`${p}.severidade inválida: ${ac.severidade} (${SEVERIDADES.join(' | ')})`);
      if (!temTexto(ac.evidencia) || semFonte(ac.evidencia)) erros.push(`${p} sem evidência (URL ou medição)`);
      if (!temTexto(ac.recomendacao)) erros.push(`${p}.recomendacao em falta`);
      if (!temTexto(ac.skill)) erros.push(`${p}.skill em falta (skill JOCA que resolve)`);
      if (ac.alvo !== undefined && !temTexto(ac.alvo)) erros.push(`${p}.alvo, quando existe, tem de ser texto não vazio`);
      if (temTexto(ac.regra)) {
        const chave = `${ac.regra}\u0000${ac.alvo ?? ''}`;
        if (vistos.has(chave)) erros.push(`${p}: regra "${ac.regra}"${ac.alvo === undefined ? ' sem alvo' : ` com alvo "${ac.alvo}"`} repetida — "regra"+"alvo" tem de ser único (D-016)`);
        vistos.add(chave);
      }
    });
  }

  return erros;
}
