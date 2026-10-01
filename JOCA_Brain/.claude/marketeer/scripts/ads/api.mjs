// Cliente mínimo da Google Ads API (REST) para o módulo `ads` (D-019). Sem dependências (D-017).
//
//   const api = await ligarApi({ slug, customerId, login?, obter?, lerCofre?, lerFicheiro? })
//   await api.gaql(query)                  → linhas (todas as páginas)
//   await api.mutate(servico, ops, { validar })  → corpo da resposta (validateOnly quando validar)
//
// Credenciais (lidas por código, nunca impressas — .claude/rules/dados-de-clientes.md):
//   agência  ~/.config/marketeer/google-ads.env (cofre, slug `google-ads`):
//              GOOGLE_ADS_DEVELOPER_TOKEN · GOOGLE_ADS_OAUTH_CLIENT (caminho do JSON; opcional)
//              GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC; usado só com login "mcc")
//              GOOGLE_ADS_REFRESH_TOKEN (legado: fallback quando o cliente não tem o seu)
//   cliente  ~/.config/marketeer/<slug>.env: GOOGLE_ADS_REFRESH_TOKEN
//   customer_id  dossier, canal `google-ads` (não é segredo)
//
// Rede: a rede local tem timeouts intermitentes a *.googleapis.com — cada pedido tem prazo
// (AbortSignal.timeout) e as leituras têm 1 retry. Os mutates NÃO se repetem: um timeout pode ter
// aplicado a alteração; quem chama verifica por GAQL. Se os timeouts persistirem, correr com
// `node --network-family-autoselection-attempt-timeout=2000 …` (IPv6 que não responde).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ler } from '../cofre.mjs';
import { CHAVES_DO_COFRE } from '../chaves.mjs';
import { limparErro } from '../auditoria/limpar.mjs';
import { parse } from 'yaml';

// v25 medida em 2026-09-29 (a v26 dá 404). Subir aqui quando a Google a descontinuar.
export const VERSAO = 'v25';
export const BASE = `https://googleads.googleapis.com/${VERSAO}`;
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const COFRE_AGENCIA = 'google-ads';
const PRAZO_MS = 30_000;

export class ErroAds extends Error {}

export const idConta = (v) => String(v ?? '').replace(/-/g, '').trim();
export const eIdConta = (v) => /^\d{10}$/.test(idConta(v));

export function caminhoClienteOAuth(lerCofre = ler) {
  const c = lerCofre(COFRE_AGENCIA, 'GOOGLE_ADS_OAUTH_CLIENT');
  return c && c.trim() ? c.trim() : join(homedir(), '.config', 'marketeer', 'google-ads-oauth-client.json');
}

// → { client_id, client_secret }. Erros sem caminho nem conteúdo.
export function lerClienteOAuth({ lerCofre = ler, lerFicheiro = (p) => readFileSync(p, 'utf8') } = {}) {
  let j;
  try {
    j = JSON.parse(lerFicheiro(caminhoClienteOAuth(lerCofre)));
  } catch (e) {
    throw new ErroAds(`o JSON do OAuth client da agência não se lê (${e?.code ?? 'JSON inválido'}) — ver D-019`);
  }
  const c = j?.installed ?? j?.web;
  if (typeof c?.client_id !== 'string' || typeof c?.client_secret !== 'string') {
    throw new ErroAds('o JSON do OAuth client não tem installed.client_id/client_secret');
  }
  return { client_id: c.client_id, client_secret: c.client_secret };
}

// Tapa os valores conhecidos (tokens, client_secret) onde quer que apareçam — a API pode ecoá-los.
export function tapar(texto, segredos = []) {
  let t = String(texto ?? '');
  for (const v of segredos) if (typeof v === 'string' && v.length >= 6) t = t.split(v).join('[removido]');
  return t;
}

// Resumo dos erros da API sem segredos: código + mensagem + campo.
export function errosDaApi(corpo, segredos = []) {
  const lista = corpo?.error?.details?.flatMap((d) => d?.errors ?? []) ?? [];
  const txt = lista.length
    ? lista.map((x) => {
      const cod = Object.values(x?.errorCode ?? {})[0] ?? '?';
      const campo = x?.location?.fieldPathElements?.map((f) => f.fieldName + (f.index !== undefined ? `[${f.index}]` : '')).join('.');
      return `${cod}: ${x?.message ?? ''}${campo ? ` @ ${campo}` : ''}`;
    })
    : [corpo?.error?.message ?? corpo?.error ?? 'resposta sem detalhe'];
  return txt.map((t) => limparErro(tapar(t, segredos), 300));
}

export const codigosDaApi = (corpo) =>
  (corpo?.error?.details?.flatMap((d) => d?.errors ?? []) ?? []).map((x) => Object.values(x?.errorCode ?? {})[0]);

// Um pedido com prazo; `repetir` = 1 retry em erro de rede/timeout ou 5xx (só leituras).
export async function pedir(obter, url, init, { repetir = false } = {}) {
  for (let tentativa = 0; ; tentativa++) {
    let r;
    try {
      r = await obter(url, { ...init, signal: AbortSignal.timeout(PRAZO_MS) });
    } catch (e) {
      if (repetir && tentativa === 0) continue;
      const cod = e?.cause?.code ?? e?.name ?? 'erro';
      throw new ErroAds(`erro de rede (${limparErro(cod)}) em ${new URL(url).host}` +
        ' — se repetir, correr com node --network-family-autoselection-attempt-timeout=2000');
    }
    if (repetir && tentativa === 0 && r.status >= 500) continue;
    let corpo = null;
    try { corpo = await r.json(); } catch { /* corpo não-JSON: fica o status */ }
    return { ok: r.ok, status: r.status, corpo };
  }
}

export async function trocarRefreshToken({ cliente, refreshToken, obter }) {
  const r = await pedir(obter, TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...cliente, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString(),
  }, { repetir: true });
  if (!r.ok || typeof r.corpo?.access_token !== 'string') {
    const porque = typeof r.corpo?.error === 'string' ? `: ${limparErro(tapar(r.corpo.error, [refreshToken, cliente.client_secret]), 60)}` : '';
    throw new ErroAds(`a Google recusou o refresh token (HTTP ${r.status}${porque}) — refazer \`node "<MKT>/scripts/ads/ligar.mjs" <slug>\``);
  }
  return r.corpo.access_token;
}

// login: undefined → a própria conta do cliente (enquanto não está ligada à MCC) · 'mcc' → MCC da
// agência · '<id>' → esse id.
export function resolverLogin(login, customerId, lerCofre = ler) {
  if (!login) return customerId;
  if (login === 'mcc') {
    // Sem MCC por omissão no pack: cada agência guarda a sua no cofre.
    const mcc = lerCofre(COFRE_AGENCIA, 'GOOGLE_ADS_LOGIN_CUSTOMER_ID');
    if (!mcc) throw new ErroAds(`--login mcc: falta GOOGLE_ADS_LOGIN_CUSTOMER_ID no cofre "${COFRE_AGENCIA}" — guardar com node "<MKT>/scripts/guardar-credencial.mjs" ${COFRE_AGENCIA} GOOGLE_ADS_LOGIN_CUSTOMER_ID`);
    return idConta(mcc);
  }
  if (!eIdConta(login)) throw new ErroAds('login-customer-id tem de ter 10 algarismos (ou "mcc")');
  return idConta(login);
}

export async function ligarApi({
  slug, customerId, login,
  obter = globalThis.fetch,
  lerCofre = (s, c) => ler(s, c),
  lerFicheiro,
}) {
  const cid = idConta(customerId);
  if (!eIdConta(cid)) throw new ErroAds('customer_id do Google Ads inválido ou em falta no dossier (canal google-ads, 10 algarismos)');
  const dev = lerCofre(COFRE_AGENCIA, 'GOOGLE_ADS_DEVELOPER_TOKEN');
  if (!dev) throw new ErroAds('falta GOOGLE_ADS_DEVELOPER_TOKEN no cofre da agência (google-ads) — ver D-019');
  const [CHAVE] = CHAVES_DO_COFRE['google-ads'];
  const refreshToken = lerCofre(slug, CHAVE) || lerCofre(COFRE_AGENCIA, CHAVE); // agência = legado (D-019)
  if (!refreshToken) throw new ErroAds(`sem GOOGLE_ADS_REFRESH_TOKEN para ${slug} — correr \`node "<MKT>/scripts/ads/ligar.mjs" ${slug}\``);
  const cliente = lerClienteOAuth({ lerCofre, ...(lerFicheiro ? { lerFicheiro } : {}) });
  const token = await trocarRefreshToken({ cliente, refreshToken, obter });
  const segredos = [dev, refreshToken, cliente.client_secret, token];
  const cabecalhos = {
    authorization: `Bearer ${token}`,
    'developer-token': dev,
    'login-customer-id': resolverLogin(login, cid, lerCofre),
    'content-type': 'application/json',
  };

  async function gaql(query) {
    const linhas = [];
    let pageToken;
    do {
      const r = await pedir(obter, `${BASE}/customers/${cid}/googleAds:search`, {
        method: 'POST', headers: cabecalhos, body: JSON.stringify({ query, ...(pageToken ? { pageToken } : {}) }),
      }, { repetir: true });
      if (!r.ok) throw new ErroAds(`GAQL falhou (HTTP ${r.status}): ${errosDaApi(r.corpo, segredos).join(' | ')}`);
      linhas.push(...(r.corpo?.results ?? []));
      pageToken = r.corpo?.nextPageToken;
    } while (pageToken);
    return linhas;
  }

  // servico: 'campaigns' | 'campaignConversionGoals'. Sem retry (ver cabeçalho).
  async function mutate(servico, operations, { validar = true } = {}) {
    const r = await pedir(obter, `${BASE}/customers/${cid}/${servico}:mutate`, {
      method: 'POST', headers: cabecalhos, body: JSON.stringify({ operations, validateOnly: validar }),
    });
    if (!r.ok) {
      const e = new ErroAds(`mutate ${servico} falhou (HTTP ${r.status}): ${errosDaApi(r.corpo, segredos).join(' | ')}`);
      e.codigos = codigosDaApi(r.corpo);
      throw e;
    }
    return r.corpo ?? {};
  }

  // POST a customers/<cid><sufixo> (ex.: ':generateKeywordIdeas'). Sem retry por omissão. Erro →
  // ErroAds com `status` e `codigos` (ex.: DEVELOPER_TOKEN_NOT_APPROVED), sem segredos.
  async function chamar(sufixo, corpo, { repetir = false } = {}) {
    const r = await pedir(obter, `${BASE}/customers/${cid}${sufixo}`, {
      method: 'POST', headers: cabecalhos, body: JSON.stringify(corpo),
    }, { repetir });
    if (!r.ok) {
      const e = new ErroAds(`${sufixo} falhou (HTTP ${r.status}): ${errosDaApi(r.corpo, segredos).join(' | ')}`);
      e.status = r.status;
      e.codigos = codigosDaApi(r.corpo);
      throw e;
    }
    return r.corpo ?? {};
  }

  // googleAds:mutate — várias entidades num só pedido atómico (IDs temporários). Sem retry.
  const mutateTudo = (mutateOperations, { validar = true } = {}) =>
    chamar('/googleAds:mutate', { mutateOperations, validateOnly: validar });

  return { customerId: cid, gaql, mutate, chamar, mutateTudo };
}

// customer_id do dossier (canal google-ads) → 10 algarismos, ou null.
export function customerIdDoDossier(canais) {
  const c = (Array.isArray(canais) ? canais : []).find((x) => x?.tipo === 'google-ads');
  return c && eIdConta(c.id) ? idConta(c.id) : null;
}

// Canais do dossier clientes/<slug>/dossier.md (frontmatter YAML). Erro se não existir.
export function canaisDoDossier(raiz, slug) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(slug ?? ''))) throw new ErroAds(`slug inválido "${slug}"`);
  if (slug === COFRE_AGENCIA) throw new ErroAds(`"${COFRE_AGENCIA}" é o cofre da agência, não um cliente (D-019)`);
  let texto;
  try {
    texto = readFileSync(join(raiz, 'clientes', slug, 'dossier.md'), 'utf8');
  } catch {
    throw new ErroAds(`sem dossier para ${slug} (clientes/${slug}/dossier.md) — /marketeer ${slug}`);
  }
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(texto);
  if (!m) throw new ErroAds(`dossier de ${slug} sem frontmatter`);
  return parse(m[1])?.canais ?? [];
}
