#!/usr/bin/env node
// `node "<MKT>/scripts/ads/ligar.mjs" <cliente>` — liga uma conta Google Ads por OAuth (app desktop, loopback).
// Uso: node "<MKT>/scripts/ads/ligar.mjs" <slug> [--scope <url>]... [--login <id|mcc>] [--sem-browser]
//
// - Servidor em 127.0.0.1, porta aleatória; `state` aleatório; PKCE S256; prompt=consent;
//   access_type=offline; scope adwords (+ os --scope extra).
// - O refresh token vai para o cofre do cliente (GOOGLE_ADS_REFRESH_TOKEN, D-019) e NUNCA é
//   impresso. Depois lê `customer` da conta do dossier (só leitura) para provar o acesso.
// - Espera no máximo 10 min pela autorização no browser.

import http from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { guardar } from '../cofre.mjs';
import { CHAVES_DO_COFRE } from '../chaves.mjs';
import { eEntrada } from '../validar-dossier.mjs';
import { limparErro } from '../auditoria/limpar.mjs';
import { raizDados } from '../raiz.mjs';
import {
  lerClienteOAuth, pedir, tapar, ligarApi, canaisDoDossier, customerIdDoDossier, TOKEN_URL, ErroAds,
} from './api.mjs';

export const SCOPE_ADS = 'https://www.googleapis.com/auth/adwords';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const ESPERA_MS = 10 * 60_000;

export function urlDeAutorizacao({ clientId, redirect, state, desafio, scopes }) {
  return `${AUTH_URL}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: [SCOPE_ADS, ...scopes.filter((s) => s !== SCOPE_ADS)].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: desafio,
    code_challenge_method: 'S256',
  })}`;
}

function abrirBrowser(url) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  try { spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* fica o URL impresso */ }
}

// Espera pelo redirect com o `code`; devolve { code, redirect }.
function esperarCodigo({ clientId, state, desafio, scopes, semBrowser }) {
  return new Promise((resolve, reject) => {
    let redirect;
    const fim = (erro, valor) => { clearTimeout(t); srv.close(); erro ? reject(erro) : resolve(valor); };
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/') { res.writeHead(404).end(); return; }
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      if (u.searchParams.get('state') !== state) {
        res.end('Pedido recusado (state inválido). Volte ao terminal.');
        return fim(new ErroAds('state inválido no redirect — nada foi guardado'));
      }
      const code = u.searchParams.get('code');
      if (!code) {
        res.end('Autorização recusada. Volte ao terminal.');
        return fim(new ErroAds(`autorização recusada (${limparErro(u.searchParams.get('error') ?? 'sem code', 60)})`));
      }
      res.end('Feito. Pode fechar esta janela e voltar ao terminal.');
      fim(null, { code, redirect });
    });
    const t = setTimeout(() => fim(new ErroAds('tempo esgotado (10 min) — nada foi guardado')), ESPERA_MS);
    srv.on('error', (e) => fim(new ErroAds(`o servidor local não arrancou (${e.code})`)));
    srv.listen(0, '127.0.0.1', () => {
      redirect = `http://127.0.0.1:${srv.address().port}`;
      const url = urlDeAutorizacao({ clientId, redirect, state, desafio, scopes });
      console.log('Abrir no browser e autorizar com o utilizador Google que tem acesso à conta Google Ads:');
      console.log(url);
      if (!semBrowser) abrirBrowser(url);
      console.log('À espera da autorização (máx. 10 min)…');
    });
  });
}

export async function ligar(slug, { scopes = [], login, semBrowser = false, raiz = raizDados(), obter = globalThis.fetch } = {}) {
  const customerId = customerIdDoDossier(canaisDoDossier(raiz, slug));
  if (!customerId) throw new ErroAds(`o dossier de ${slug} não tem canal google-ads com customer_id de 10 algarismos`);
  const cliente = lerClienteOAuth();
  const state = randomBytes(16).toString('hex');
  const verificador = randomBytes(32).toString('base64url');
  const desafio = createHash('sha256').update(verificador).digest('base64url');

  const { code, redirect } = await esperarCodigo({ clientId: cliente.client_id, state, desafio, scopes, semBrowser });
  const r = await pedir(obter, TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...cliente, code, code_verifier: verificador, redirect_uri: redirect, grant_type: 'authorization_code',
    }).toString(),
  });
  if (!r.ok || typeof r.corpo?.refresh_token !== 'string') {
    const porque = r.corpo?.error ? `: ${limparErro(tapar(r.corpo.error, [cliente.client_secret, r.corpo?.refresh_token, r.corpo?.access_token, code]), 60)}` : '';
    throw new ErroAds(`a troca do código falhou (HTTP ${r.status}${porque}) — nada foi guardado`);
  }
  guardar(slug, CHAVES_DO_COFRE['google-ads'][0], r.corpo.refresh_token);
  console.log(`✓ refresh token guardado no cofre de ${slug} (scope: ${limparErro(r.corpo.scope ?? '?', 300)})`);

  // Prova de acesso só de leitura. O erro sai sem o token acabado de guardar.
  const segredos = [cliente.client_secret, r.corpo.refresh_token, r.corpo.access_token];
  let linha;
  try {
    const api = await ligarApi({ slug, customerId, login, obter });
    [linha] = await api.gaql('SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer');
  } catch (e) {
    throw new ErroAds(`token guardado, mas a confirmação do acesso falhou: ${limparErro(tapar(e.message, segredos), 300)}`);
  }
  const c = linha?.customer ?? {};
  console.log(`✓ acesso confirmado à conta ${c.id ?? customerId} (${c.descriptiveName ?? 'sem nome'}, ${c.currencyCode ?? '?'})`);
  console.log(`  Actualizar no dossier: canal google-ads → acesso: true`);
}

if (eEntrada(import.meta.url)) {
  const args = process.argv.slice(2);
  const valores = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []));
  const slug = args.find((a, i) => !a.startsWith('--') && !['--scope', '--login'].includes(args[i - 1]));
  try {
    if (!slug) throw new Error('uso: node "<MKT>/scripts/ads/ligar.mjs" <slug> [--scope <url>]... [--login <id|mcc>] [--sem-browser]');
    await ligar(slug, { scopes: valores('--scope'), login: valores('--login')[0], semBrowser: args.includes('--sem-browser') });
  } catch (e) {
    console.error(`✗ ${limparErro(e.message, 400)}`);
    process.exit(1);
  }
}
