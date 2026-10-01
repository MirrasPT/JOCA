// Pré-carregado (`node --import`) no processo do `tracking/prova.mjs` pela suite de aceitação:
// - o Chromium arranca com um proxy da suite (REDE_PROXY) que regista TUDO o que tenta sair do
//   browser e só serve o site de teste local — nenhum pedido chega à rede real;
// - o `fetch` do Node regista cada chamada: o site de teste local passa; com GOOGLE_FALSA=1 responde a
//   Google Ads falsa; o resto é recusado (nenhum pedido sai).
import { appendFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { googleFalsa } from './google-falsa.mjs';

const LOG = process.env.REDE_LOG;
const registar = (o) => appendFileSync(LOG, `${JSON.stringify(o)}\n`);

const lancar = chromium.launch.bind(chromium);
chromium.launch = (opcoes = {}) => {
  registar({ tipo: 'launch' });
  return lancar({ ...opcoes, proxy: { server: process.env.REDE_PROXY } });
};

const google = googleFalsa({ registar: (p) => registar({ tipo: 'fetch', url: p.url, metodo: p.metodo }) });
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = new URL(String(url?.url ?? url));
  const metodo = String(init?.method ?? url?.method ?? 'GET').toUpperCase();
  // O site de teste é local (127.0.0.1): pode ser lido; fica registado à parte.
  if (u.hostname === '127.0.0.1') {
    registar({ tipo: 'fetch-local', url: u.href, metodo });
    return fetchOriginal(url, init);
  }
  if (process.env.GOOGLE_FALSA === '1') return google(url, init);
  registar({ tipo: 'fetch', url: u.href, metodo });
  throw new TypeError('fetch failed (rede bloqueada pela suite)');
};
