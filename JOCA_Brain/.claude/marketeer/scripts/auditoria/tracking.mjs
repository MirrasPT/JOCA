// Auditoria de tracking no site (#5): renderiza a página inicial e detecta GA4, GTM, Meta Pixel e
// o banner de consentimento. Contrato em pagina.mjs; formato em formato.mjs.
//
//   auditar({ site, obter = obterPagina, renderizar = renderizarPagina }) → { areas, achados }
//
// obter injectado (fixtures) → o browser é servido por ele, sem rede. renderizar injectável para
// correr sem browser: recebe { url, obter, avaliar } e devolve { ok, status, url, dom, pedidos, avaliado?, erro }.
// "avaliado" = banners visíveis vistos no browser (bannersVisiveis); sem ele, o banner genérico
// procura-se no HTML, só em elementos de bloco.
//
// "Antes do consentimento" = durante o carregamento, sem clicar em nada. Só conta como disparo o
// hit de recolha (eHitDeRecolha: GA4, UA, Google Ads, Meta, LinkedIn, TikTok, Hotjar, Clarity),
// não o carregar da biblioteca; hit Google com gcs=G100 (ad_storage E analytics_storage
// recusados) é o ping sem cookies do Consent Mode e não conta. G110 (ads concedido sem
// interacção) conta. Interpretação a validar juridicamente — D-015. Os hits nunca saem para a rede
// (D-008): o renderizar responde-os localmente e só os regista.

import { obterPagina } from './pagina.mjs';
import { renderizarPagina, eHitDeRecolha } from './renderizar.mjs';

const AREA = 'tracking';
const NOMES = {
  ga4: 'GA4', ua: 'Universal Analytics', 'google-ads': 'Google Ads', meta: 'Meta Pixel',
  linkedin: 'LinkedIn Insight Tag', tiktok: 'TikTok Pixel', hotjar: 'Hotjar', clarity: 'Microsoft Clarity',
};
const GOOGLE = new Set(['ga4', 'ua', 'google-ads']);

// CMPs conhecidos: [nome, padrão no DOM renderizado (src de script ou id/classe do banner)].
const CMPS = [
  ['Cookiebot', /consent\.cookiebot\.com|CybotCookiebotDialog/],
  ['OneTrust', /cdn\.cookielaw\.org|otSDKStub|onetrust-banner-sdk/],
  ['CookieYes', /cdn-cookieyes\.com|cky-consent/],
  ['Complianz', /cmplz-cookiebanner/],
  ['iubenda', /iubenda\.com\/cs|iubenda-cs-banner/],
  ['Didomi', /sdk\.privacy-center\.org|didomi-host/],
  ['Usercentrics', /usercentrics\.eu|usercentrics-root/],
  ['Borlabs Cookie', /BorlabsCookie/],
  ['CookieLawInfo', /cookie-law-info-bar|cli-cookie-bar/],
  ['Cookie Notice', /id=["']cookie-notice["']/],
  ['Klaro', /klaro\.js|id=["']klaro["']/i],
];
// Banner próprio: elemento de BLOCO (div/section/aside/dialog) com id/classe que fala de
// cookies/consentimento. Não contam <link id="cookie-notice-front-css">, <body class="cookies-not-set">,
// <input id="consent-newsletter">, scripts ou estilos.
const BANNER_GENERICO = /<(?:div|section|aside|dialog)\b[^>]*\s(?:id|class)=["'][^"']*(?:cookie|consent|consentimento|rgpd|gdpr)[^"']*["']/i;

// Corre no browser (page.evaluate): os blocos de banner próprio que estão VISÍVEIS.
export function bannersVisiveis() {
  const re = /cookie|consent|consentimento|rgpd|gdpr/i;
  return [...document.querySelectorAll('div, section, aside, dialog')]
    .filter((el) => re.test(el.id) || re.test(el.getAttribute('class') ?? ''))
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    })
    .map((el) => `<${el.tagName.toLowerCase()}${el.id ? ` id="${el.id}"` : ''}${el.getAttribute('class') ? ` class="${el.getAttribute('class')}"` : ''}>`);
}

const unicos = (xs) => [...new Set(xs)];
const contar = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
const todos = (re, texto) => [...texto.matchAll(re)].map((m) => m[1]);

// → { ga4, gtm, meta, banner, consentMode, duplicados, disparos }. Função pura sobre o render.
export function detectar({ dom, pedidos, bannersVisiveis: visiveis }) {
  const srcs = todos(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi, dom).map((s) => s.replace(/&amp;/g, '&'));
  const idDe = (src, re) => (re.exec(src) ?? [])[1];

  const ga4Scripts = srcs.map((s) => idDe(s, /googletagmanager\.com\/gtag\/js\?(?:.*&)?id=(G-[A-Z0-9]+)/)).filter(Boolean);
  const ga4Config = todos(/gtag\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]+)['"]/g, dom);
  const gtmScripts = srcs.map((s) => idDe(s, /googletagmanager\.com\/gtm\.js\?(?:.*&)?id=(GTM-[A-Z0-9]+)/)).filter(Boolean);
  const gtmNoscript = todos(/googletagmanager\.com\/ns\.html\?(?:[^"'\s<>]*?&(?:amp;)?)?id=(GTM-[A-Z0-9]+)/g, dom);
  const metaInit = todos(/fbq\(\s*['"]init['"]\s*,\s*['"]?(\d+)/g, dom);

  const hits = pedidos.map((p) => ({ ...p, vendor: eHitDeRecolha(p.url) })).filter((p) => p.vendor);
  const param = (url, k) => new URL(url).searchParams.get(k);
  const ga4Hits = hits.filter((h) => h.vendor === 'ga4');
  const metaHits = hits.filter((h) => h.vendor === 'meta');

  const ga4 = unicos([...ga4Scripts, ...ga4Config, ...ga4Hits.map((h) => param(h.url, 'tid')).filter(Boolean)]);
  const gtm = unicos([...gtmScripts, ...gtmNoscript]);
  const meta = unicos([...metaInit, ...metaHits.map((h) => param(h.url, 'id')).filter(Boolean)]);

  const duplicados = [];
  const marcar = (tag, contagem, como) => {
    for (const [id, n] of contagem) {
      if (n < 2) continue;
      const ja = duplicados.find((x) => x.tag === tag && x.id === id);
      if (ja) ja.como += `, ${n}x ${como}`;
      else duplicados.push({ tag, id, como: `${n}x ${como}` });
    }
  };
  marcar('GA4', contar(ga4Scripts), 'script gtag/js');
  marcar('GA4', contar(ga4Config), "gtag('config')");
  marcar('GTM', contar(gtmScripts), 'script gtm.js');
  marcar('Meta Pixel', contar(metaInit), "fbq('init')");
  // Nos hits: dois page_view do mesmo tid (ou dois PageView do mesmo pixel) num só carregamento.
  const deEvento = (hs, chaveEvento, evento, chaveId) => hs.filter((h) => param(h.url, chaveEvento) === evento).map((h) => param(h.url, chaveId)).filter(Boolean);
  marcar('GA4', contar(deEvento(ga4Hits, 'en', 'page_view', 'tid')), 'hit page_view');
  marcar('Meta Pixel', contar(deEvento(metaHits, 'ev', 'PageView', 'id')), 'hit PageView');

  const cmp = CMPS.find(([, re]) => re.test(dom));
  const generico = cmp ? null : Array.isArray(visiveis) ? visiveis[0] : BANNER_GENERICO.exec(dom)?.[0];
  const banner = cmp ? cmp[0] : generico ? `banner próprio (${generico.slice(0, 80)}…)` : null;

  const pingSemCookies = (h) => GOOGLE.has(h.vendor) && param(h.url, 'gcs') === 'G100';
  const disparos = hits.filter((h) => !pingSemCookies(h));

  const consentMode = /gtag\(\s*['"]consent['"]\s*,\s*['"]default['"]/.test(dom)
    || hits.some((h) => GOOGLE.has(h.vendor) && (param(h.url, 'gcs') || param(h.url, 'gcd')));

  return { ga4, gtm, meta, banner, consentMode, duplicados, disparos };
}

export async function auditar({ site, obter = obterPagina, renderizar = renderizarPagina }) {
  const r = await renderizar({ url: site, obter: obter === obterPagina ? undefined : obter, avaliar: bannersVisiveis });
  if (!r.ok) {
    const nota = r.falhaDoBrowser ? `não foi possível renderizar: ${r.erro}`
      : r.erro ? `site inacessível: ${r.erro}` : `site respondeu HTTP ${r.status}`;
    return { areas: [{ area: AREA, estado: 'erro', nota }], achados: [] };
  }

  const d = detectar({ ...r, bannersVisiveis: r.avaliado });
  const url = r.url;
  const lista = (xs) => (xs.length ? xs.join(', ') : 'nenhum');
  const nota = `página inicial, sem interacção · GA4: ${lista(d.ga4)} · GTM: ${lista(d.gtm)} · Meta Pixel: ${lista(d.meta)}`
    + ` · banner: ${d.banner ?? 'não detectado'} · Consent Mode: ${d.consentMode ? 'sim' : 'não'}`;

  const achados = [];
  // alvo: a regra repete-se por tag/fornecedor na mesma auditoria — "regra"+"alvo" é único (D-016).
  const achado = (slug, severidade, evidencia, recomendacao, skill, alvo) =>
    achados.push({ area: AREA, regra: `${AREA}.${slug}`, severidade, evidencia, recomendacao, skill, ...(alvo && { alvo }) });

  if (!d.ga4.length && !d.gtm.length) {
    achado('ga4-ausente', 'alta', `${url}: nenhum ID G-… nem GTM-… no HTML renderizado nem nos pedidos de rede`,
      'Instalar o GA4 (gtag.js ou via GTM) com Consent Mode, para haver medição de tráfego e conversões.', 'google-analytics');
  }

  for (const x of d.duplicados) {
    achado('tag-duplicada', 'media', `${url}: ${x.tag} ${x.id} instalado mais de uma vez (${x.como})`,
      'Deixar uma única instalação da tag (código no tema OU GTM, não os dois) — duplicada conta cada visita a dobrar.', 'analytics-tracking', `${x.tag} ${x.id}`);
  }

  for (const vendor of Object.keys(NOMES)) {
    const h = d.disparos.filter((p) => p.vendor === vendor);
    if (!h.length) continue;
    const nome = NOMES[vendor];
    achado('disparo-antes-consentimento', 'alta',
      `${url}: ${h.length} hit(s) ${nome} sem interacção com o banner — ex.: ${h[0].metodo} ${h[0].url.slice(0, 200)}`,
      `Bloquear o ${nome} até haver consentimento (Consent Mode v2 com default "denied", ou carregar só após o consentimento).`, 'gdpr-compliance', vendor);
  }

  if (!d.banner && (d.ga4.length || d.gtm.length || d.meta.length)) {
    achado('banner-consentimento-ausente', 'alta', `${url}: tags de medição presentes e nenhum banner de consentimento no DOM renderizado`,
      'Instalar um banner de consentimento com opt-in prévio (Aceitar/Recusar com o mesmo peso) e ligar as tags a ele.', 'gdpr-compliance');
  }

  return { areas: [{ area: AREA, estado: 'verificado', nota }], achados };
}
