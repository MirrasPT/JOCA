// Auditoria de contas autenticadas (#8): com a credencial do cofre, lê a GA4 Data API e produz
// achados. O Search Console fica por implementar (sem acesso). Formato em formato.mjs.
//
//   auditar({ site, cliente: { slug, canais }, obter?, lerCofre?, lerFicheiro?, agora? })
//     obter(url, init) → Response-like ({ ok, status, json() }) · default: fetch
//     lerCofre(slug, chave) → valor | null · default: cofre.ler
//     lerFicheiro(caminho) → texto · default: readFileSync utf8
//     agora() → ms desde 1970 · default: Date.now
//
// - Só leitura (D-008): scope analytics.readonly e só runReport. Sem dependências npm (D-017):
//   OAuth2 JWT bearer da service account assinado com node:crypto (RS256).
// - Sem canal ga4 com property ID numérico, ou sem credencial no cofre → "nao-verificado", sem
//   nenhuma chamada. A credencial no cofre não prova permissão: um 403 é "erro", não achado.
// - O valor do cofre (GOOGLE_SERVICE_ACCOUNT) é o CAMINHO do JSON. O JSON, o token e a assertion
//   nunca saem desta função; as mensagens de erro passam por limparErro antes de ir para notas.

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { ler } from '../cofre.mjs';
import { CHAVES_DO_COFRE } from '../chaves.mjs';
import { SEM_FONTE } from '../validar-dossier.mjs';
import { limparErro } from './limpar.mjs';

const GA4 = 'contas.ga4';
const SC = 'contas.search-console';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://analyticsdata.googleapis.com/v1beta';
const PERIODO = { startDate: '7daysAgo', endDate: 'yesterday' };
const VALIDADE_S = 3600;
const PRAZO_MS = 20_000;
const PROPERTY_ID = /^\d+$/;

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

// Erro com mensagem já própria para nota (sem segredos): o que sai daqui vai para a auditoria.
class ErroConta extends Error {}

async function pedir(obter, url, init) {
  let r;
  try {
    r = await obter(url, { ...init, signal: AbortSignal.timeout(PRAZO_MS) });
  } catch (e) {
    throw new ErroConta(`erro de rede (${limparErro(e?.cause?.code ?? e?.name ?? 'erro')})`);
  }
  let corpo = null;
  try { corpo = await r.json(); } catch { /* corpo não-JSON: fica o status */ }
  return { ok: r.ok, status: r.status, corpo };
}

// Credencial → { email, chave }. Erros nomeiam o problema, nunca o caminho nem o conteúdo.
function lerServiceAccount(caminho, lerFicheiro) {
  let texto;
  try {
    texto = lerFicheiro(caminho);
  } catch (e) {
    throw new ErroConta(`o ficheiro da service account indicado no cofre não se lê (${e?.code ?? 'erro'})`);
  }
  let sa;
  try { sa = JSON.parse(texto); } catch {
    throw new ErroConta('o ficheiro da service account indicado no cofre não é JSON válido');
  }
  if (typeof sa?.client_email !== 'string' || typeof sa?.private_key !== 'string') {
    throw new ErroConta('o JSON da service account não tem client_email e private_key');
  }
  return { email: sa.client_email, chave: sa.private_key };
}

async function obterToken(sa, { obter, agora }) {
  const iat = Math.floor(agora() / 1000);
  const dados = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({ iss: sa.email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + VALIDADE_S })}`;
  let assinatura;
  try {
    assinatura = createSign('RSA-SHA256').update(dados).sign(sa.chave, 'base64url');
  } catch {
    throw new ErroConta('a private_key da service account não é uma chave RSA válida');
  }
  const r = await pedir(obter, TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${dados}.${assinatura}` }).toString(),
  });
  if (!r.ok || typeof r.corpo?.access_token !== 'string') {
    const porque = typeof r.corpo?.error === 'string' ? `: ${limparErro(r.corpo.error, 60)}` : '';
    throw new ErroConta(`a Google recusou a credencial da service account (HTTP ${r.status}${porque})`);
  }
  return r.corpo.access_token;
}

// → { activeUsers, eventCount } dos últimos 7 dias. Sem linhas = sem dados = 0.
async function lerPropriedade(id, token, obter) {
  const r = await pedir(obter, `${API}/properties/${id}:runReport`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ dateRanges: [PERIODO], metrics: [{ name: 'activeUsers' }, { name: 'eventCount' }] }),
  });
  if (r.status === 403) throw new ErroConta(`a service account não tem permissão na propriedade ${id}`);
  if (r.status === 404) throw new ErroConta(`a propriedade GA4 ${id} não existe (id errado no dossier?)`);
  if (r.status === 401) throw new ErroConta(`token recusado pela GA4 Data API na propriedade ${id} (HTTP 401)`);
  if (!r.ok) throw new ErroConta(`GA4 Data API respondeu HTTP ${r.status} na propriedade ${id}`);
  const valores = r.corpo?.rows?.[0]?.metricValues ?? [];
  const n = (i) => Number(valores[i]?.value ?? 0);
  const activeUsers = n(0);
  const eventCount = n(1);
  if (!Number.isFinite(activeUsers) || !Number.isFinite(eventCount)) {
    throw new ErroConta(`resposta da GA4 Data API ilegível na propriedade ${id}`);
  }
  return { activeUsers, eventCount };
}

async function auditarGa4({ slug, canais, obter, lerCofre, lerFicheiro, agora }) {
  const so = (estado, nota) => ({ area: { area: GA4, estado, nota }, achados: [] });
  const ga4 = (Array.isArray(canais) ? canais : []).filter((c) => c?.tipo === 'ga4');
  if (!ga4.length) return so('nao-verificado', 'sem GA4 no dossier');
  const ids = [...new Set(ga4.map((c) => (c.id === undefined || c.id === null ? '' : String(c.id).trim())))];
  const validos = ids.filter((id) => PROPERTY_ID.test(id));
  if (!validos.length) {
    const temId = ids.some((id) => id && id !== SEM_FONTE);
    return so('nao-verificado', temId
      ? 'o id do GA4 no dossier não é o property ID numérico (o G-… é o measurement ID)'
      : 'sem property ID do GA4 no dossier');
  }

  let caminho = null;
  try {
    for (const chave of CHAVES_DO_COFRE.ga4) {
      caminho = lerCofre(slug, chave);
      if (caminho !== null && caminho !== undefined && String(caminho).trim() !== '') break;
      caminho = null;
    }
  } catch {
    caminho = null; // slug que o cofre recusa (ex.: _exemplo) ou cofre ilegível
  }
  if (caminho === null) return so('nao-verificado', 'sem credencial no cofre');

  const notas = [];
  const erros = [];
  const achados = [];
  let token = null;
  for (const id of validos) {
    try {
      token ??= await obterToken(lerServiceAccount(String(caminho).trim(), lerFicheiro), { obter, agora });
      const { activeUsers, eventCount } = await lerPropriedade(id, token, obter);
      if (eventCount === 0) {
        achados.push({
          area: GA4,
          regra: `${GA4}.sem-eventos`,
          severidade: 'alta',
          evidencia: `GA4 Data API runReport, properties/${id}, ${PERIODO.startDate}..${PERIODO.endDate}: activeUsers=${activeUsers}, eventCount=0`,
          recomendacao: 'A propriedade GA4 não recebe dados há 7 dias: confirmar que a tag GA4 (gtag.js ou GTM) está instalada e a disparar com o measurement ID desta propriedade, e que o consentimento não a bloqueia para todos.',
          skill: 'google-analytics',
          alvo: id,
        });
      }
      notas.push(`properties/${id}, ${PERIODO.startDate}..${PERIODO.endDate}: ${activeUsers} utilizadores activos, ${eventCount} eventos`);
    } catch (e) {
      erros.push(e instanceof ErroConta ? e.message : `falha inesperada (${limparErro(e?.message ?? e)})`);
      // Credencial ilegível ou recusada vale para todas as propriedades: não se repete.
      if (!token) break;
    }
  }
  const nota = limparErro([...erros, ...notas].join('; '), 400);
  return { area: { area: GA4, estado: erros.length ? 'erro' : 'verificado', nota }, achados };
}

export async function auditar({
  cliente = {},
  obter = globalThis.fetch,
  lerCofre = (s, c) => ler(s, c),
  lerFicheiro = (p) => readFileSync(p, 'utf8'),
  agora = Date.now,
} = {}) {
  const ga4 = await auditarGa4({ slug: cliente.slug, canais: cliente.canais, obter, lerCofre, lerFicheiro, agora });
  return {
    areas: [ga4.area, { area: SC, estado: 'nao-verificado', nota: 'Search Console por implementar (#8, sem acesso)' }],
    achados: ga4.achados,
  };
}
