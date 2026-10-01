// Renderiza uma página num chromium headless (Playwright) e devolve o DOM final e os pedidos de
// rede feitos durante o carregamento — é o que prova que uma tag disparou antes do consentimento.
//
//   renderizarPagina({ url, obter?, avaliar?, timeout?, prazo? })
//     → { ok, status, url, dom, pedidos, avaliado, erro }
//
//   - url:    endereço a abrir
//   - obter:  opcional; serve os pedidos PERMITIDOS por esta função (ex.: obterDeFixtures), sem
//             rede. O que ela não conhece fica 404
//   - avaliar: opcional; função corrida na página depois de acalmar (page.evaluate) — o resultado
//             vem em "avaliado" (ex.: o que está visível, que o HTML sozinho não diz)
//   - prazo:  limite do trabalho TODO (arranque, navegação, espera, leitura do DOM); ao expirar
//             fecha o browser e devolve { ok: false, erro: 'timeout' } — uma página que prende o
//             renderer (while(true) depois do load) não prende a auditoria
//   - pedidos: [{ url, metodo, tipo }] por ordem de saída (incluindo os bloqueados, WebSockets e
//             saltos de redireccionamento), sem qualquer interacção com a página
//
// Nunca lança: browser em falta, DNS, timeout → { ok: false, erro }. Falha do próprio browser
// (em falta, sandbox recusada) → também falhaDoBrowser: true — não é o site que está inacessível.
// O chromium corre SEMPRE com sandbox: se o SO a recusar (userns/AppArmor), falha e explica —
// nunca cai para --no-sandbox a abrir páginas de terceiros.
//
// Só leitura (D-008) por LISTA DO QUE É PERMITIDO, não por lista de bloqueio: sai para a rede só
//   - GET de document/script/stylesheet/font (qualquer host), e
//   - GET de qualquer tipo ao próprio site (mesmo host, com ou sem www),
// e nunca um caminho de recolha (/collect, /g|j|r/collect, /tr) nem um hit conhecido
// (eHitDeRecolha), em host nenhum — GTM server-side no domínio do cliente incluído. Tudo o resto
// (xhr/fetch/ping/beacon/image/media de terceiros, qualquer não-GET) é respondido aqui com 204.
// Cada salto de um redireccionamento passa pela mesma regra (o Playwright não encaminha
// redireccionamentos pelo route: seguem-se à mão). WebSockets fecham-se sem ligar ao servidor;
// service workers bloqueados; downloads recusados.

import { chromium } from 'playwright';

const TIMEOUT_MS = 30000;
const PRAZO_MS = 45000;
const MAX_SALTOS = 10;
export const USER_AGENT = 'marketeer-pack (auditoria)';

// Pedido que envia dados para uma conta de medição, conversão ou remarketing → fornecedor; o
// carregar da biblioteca (gtag/js, fbevents.js, insight.min.js…) → null. Serve para CLASSIFICAR
// os achados; o bloqueio não depende dele (é a lista do que é permitido, acima).
export function eHitDeRecolha(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const h = u.hostname;
  const p = u.pathname;
  const em = (dominio) => h === dominio || h.endsWith(`.${dominio}`);
  if (/^\/g\/collect\/?$/.test(p)) return 'ga4'; // google-analytics, stats.g.doubleclick e GTM server-side em qualquer host
  if ((em('google-analytics.com') || em('analytics.google.com')) && /^\/(?:[jr]\/)?collect\/?$/.test(p)) return 'ua';
  if (em('facebook.com') && /^\/(?:tr\/?$|privacy_sandbox\/pixel\/)/.test(p)) return 'meta';
  if ((em('doubleclick.net') || em('googleadservices.com') || /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h))
    && /^\/(?:pagead\/|td\/|ccm\/collect|rmkt\/collect)/.test(p) && !/\.js$/.test(p)) return 'google-ads';
  if (em('ads.linkedin.com')) return 'linkedin';
  if (em('analytics.tiktok.com') && /^\/api\//.test(p)) return 'tiktok';
  if (em('hotjar.com') && /^\/api\//.test(p)) return 'hotjar';
  if (em('clarity.ms') && /\/collect\/?$/.test(p)) return 'clarity';
  return null;
}

// Caminhos de recolha bloqueados em QUALQUER host (proxies first-party e GTM server-side).
const CAMINHO_DE_RECOLHA = /^\/(?:(?:g|j|r)\/)?collect\/?$|^\/tr\/?$/;
const TIPOS_DE_TERCEIROS = new Set(['document', 'script', 'stylesheet', 'font']);
const semWww = (host) => host.replace(/^www\./, '');

// { url, metodo, tipo } → pode sair para a rede? anfitrioes = hosts do site (sem www).
export function pedidoPermitido({ url, metodo, tipo }, anfitrioes) {
  if (metodo !== 'GET') return false;
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(u.protocol) || CAMINHO_DE_RECOLHA.test(u.pathname) || eHitDeRecolha(url)) return false;
  return TIPOS_DE_TERCEIROS.has(tipo) || anfitrioes.has(semWww(u.hostname));
}

const tipoDeConteudo = { document: 'text/html; charset=utf-8', script: 'application/javascript', stylesheet: 'text/css' };
const bloquear = (route) => route.fulfill({ status: 204, body: '' });

// Instala a regra "só leitura" (cabeçalho) num contexto do Playwright: regista cada pedido de
// qualquer página do contexto em `pedidos` e só deixa sair o permitido. `responder(pedido)`,
// opcional, dá a resposta LOCAL ({ status, body, contentType, headers }) a um pedido que não pode sair
// (ex.: o POST do formulário na prova de rede do módulo tracking); sem resposta → 204. Nunca faz
// sair um pedido que pedidoPermitido recusa. `bloquearTudo()`, opcional: enquanto devolver true,
// NADA sai para a rede (nem GET) — tudo passa pelo `responder`/204. → { pedidos, anfitrioes }
export async function vigiarContexto(context, url, { obter, responder, bloquearTudo } = {}) {
  const pedidos = [];
  const anfitrioes = new Set([semWww(new URL(url).hostname)]);
  context.on('request', (r) => pedidos.push({ url: r.url(), metodo: r.method(), tipo: r.resourceType() }));
  const recusar = async (route, pedido) => {
    const r = responder?.(pedido);
    return r ? route.fulfill({ status: r.status, contentType: r.contentType, headers: r.headers, body: r.body ?? '' }) : bloquear(route);
  };

  // WebSocket: sem connectToServer() o Playwright não liga ao servidor; fecha-se já do lado da página.
  await context.routeWebSocket(() => true, (ws) => {
    pedidos.push({ url: ws.url(), metodo: 'GET', tipo: 'websocket' });
    ws.close().catch(() => {});
  });

  // Segue os redireccionamentos à mão, um salto de cada vez, cada um sujeito à mesma regra.
  const seguir = async (route, pedido) => {
    const principal = route.request().isNavigationRequest() && !route.request().frame().parentFrame();
    let actual = pedido.url;
    for (let i = 0; i < MAX_SALTOS; i++) {
      const r = await route.fetch({ url: actual, maxRedirects: 0 });
      const destino = r.status() >= 300 && r.status() < 400 ? r.headers().location : undefined;
      if (!destino) {
        if (actual === pedido.url) return route.fulfill({ response: r });
        if (!principal) return route.fulfill({ response: r });
        // Documento principal: o browser vai directo ao destino final (já verificado e sem
        // redireccionar), para que a página fique com o URL certo.
        anfitrioes.add(semWww(new URL(actual).hostname));
        return route.fulfill({ status: 302, headers: { location: actual } });
      }
      actual = new URL(destino, actual).href;
      const salto = { ...pedido, url: actual };
      pedidos.push(salto);
      if (!pedidoPermitido(salto, anfitrioes)) return bloquear(route);
    }
    return route.abort('failed');
  };

  await context.route('**/*', async (route) => {
    const req = route.request();
    const pedido = { url: req.url(), metodo: req.method(), tipo: req.resourceType() };
    try {
      if (bloquearTudo?.() || !pedidoPermitido(pedido, anfitrioes)) return await recusar(route, pedido);
      if (obter) {
        const r = await obter(pedido.url);
        const status = r.status || 404;
        return await route.fulfill({ status, contentType: tipoDeConteudo[pedido.tipo], body: status < 400 ? r.texto : '' });
      }
      return await seguir(route, pedido);
    } catch {
      await route.abort('failed').catch(() => {});
    }
  });
  return { pedidos, anfitrioes };
}

export async function renderizarPagina({ url, obter, avaliar, timeout = TIMEOUT_MS, prazo = PRAZO_MS }) {
  const estado = { browser: null, expirou: false };
  let relogio;
  const limite = new Promise((ok) => { relogio = setTimeout(() => ok(null), prazo); });
  const r = await Promise.race([renderizar({ url, obter, avaliar, timeout }, estado), limite]);
  clearTimeout(relogio);
  if (r) return r;
  estado.expirou = true;
  await estado.browser?.close().catch(() => {});
  return { ok: false, status: 0, url, dom: '', pedidos: [], erro: 'timeout' };
}

async function renderizar({ url, obter, avaliar, timeout }, estado) {
  let browser;
  try {
    browser = estado.browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  } catch (e) {
    return { ok: false, status: 0, url, dom: '', pedidos: [], erro: explicarFalhaDoBrowser(e), falhaDoBrowser: true };
  }
  if (estado.expirou) return browser.close().catch(() => {});
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT, serviceWorkers: 'block', acceptDownloads: false });
    const page = await context.newPage();
    const { pedidos } = await vigiarContexto(context, url, { obter });

    const resposta = await page.goto(url, { waitUntil: 'load', timeout });
    // Tags assíncronas (GTM → GA4) disparam depois do load; networkidle é o sinal de "acalmou".
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const status = resposta?.status() ?? 0;
    const avaliado = avaliar ? await page.evaluate(avaliar) : undefined;
    return { ok: status > 0 && status < 400, status, url: page.url(), dom: await page.content(), pedidos, avaliado, erro: null };
  } catch (e) {
    return { ok: false, status: 0, url, dom: '', pedidos: [], erro: primeiraLinha(e) };
  } finally {
    await browser.close().catch(() => {});
  }
}

export function explicarFalhaDoBrowser(e) {
  const msg = String(e?.message ?? e);
  if (/sandbox|namespace|userns|zygote/i.test(msg)) {
    return `o chromium não arrancou com sandbox (namespaces de utilizador recusados pelo SO — ex.: AppArmor no Ubuntu >= 23.10). `
      + `A auditoria não corre sem sandbox; ver docs/DECISIONS.md D-015. Erro: ${primeiraLinha(e)}`;
  }
  if (/Executable doesn't exist/i.test(msg)) return 'chromium em falta (npx playwright install --only-shell chromium)';
  return `o chromium não arrancou: ${primeiraLinha(e)}`;
}

const primeiraLinha = (e) => String(e?.message ?? e).split('\n')[0];
