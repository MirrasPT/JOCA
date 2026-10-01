// Auditoria do Google Business Profile (D-023): lê os dados públicos do perfil pela
// Places API (New) e compara-os com o site. Só leitura (D-008); formato em formato.mjs.
//
//   auditar({ site, cliente: { slug, canais }, obter?, obterSite?, lerCofre? }) → { areas, achados }
//     obter(url, init) → Response-like ({ ok, status, json() }) · default: fetch (Places API)
//     obterSite(url) → { ok, status, url, texto, erro } · default: obterPagina (pagina.mjs)
//     lerCofre(slug, chave) → valor | null · default: cofre.ler
//
// Identificação do perfil, por ordem:
//   1. canal `gbp` do dossier com o Place ID em `id`;
//   2. link do perfil no site (<a>, sameAs e hasMap do JSON-LD; detecção de presenca.mjs) que traga
//      o Place ID (`placeid=` ou `q=place_id:`);
//   3. Text Search (`places:searchText`) com nome + morada do JSON-LD — a API não aceita o `cid` dos
//      links maps.google.com/?cid=. Só se aceita um resultado a ≤ 250 m do `geo` do JSON-LD; sem
//      `geo`, só com nome e código postal iguais. O Place ID encontrado vai na nota, para o operador
//      confirmar e pôr no dossier.
//   Nada encontrado → área "nao-verificado" com o motivo.
//
// Credencial: GOOGLE_PLACES_API_KEY no cofre de agência `google-places` (como o `google-ads`,
// D-019). Sem chave → "nao-verificado", sem nenhum pedido. A chave só vai no header X-Goog-Api-Key
// e é tapada em todas as mensagens (nunca em notas, evidências ou erros).

import { ler } from '../cofre.mjs';
import { SEM_FONTE } from '../validar-dossier.mjs';
import { tapar } from '../ads/api.mjs';
import { obterPagina } from './pagina.mjs';
import { limparErro } from './limpar.mjs';
import {
  ehGbp, encontrarPerfis, entidadesDeNegocio, jsonLd, hrefs, decodificar, normalizar,
  semFormaJuridica, cpNormalizado, digitos,
} from './presenca.mjs';

export const COFRE_AGENCIA = 'google-places';
export const CHAVE = 'GOOGLE_PLACES_API_KEY';
const API = 'https://places.googleapis.com/v1';
const PRAZO_MS = 20_000;
const IDIOMA = 'pt-PT';
const REGIAO = 'PT';
const AREA = 'gbp';
const SKILL = 'seo-local';

// Limiares desta versão (D-023).
export const DISTANCIA_MAX_M = 250;
export const MEDIA_MIN = 4.0;
export const AVALIACOES_MIN = 10;

// Campos confirmados na documentação da Places API (New) (reference/rest/v1/places, 2026-10-01).
const CAMPOS_DETALHE = [
  'id', 'displayName', 'formattedAddress', 'postalAddress', 'nationalPhoneNumber', 'internationalPhoneNumber',
  'websiteUri', 'primaryType', 'primaryTypeDisplayName', 'types', 'regularOpeningHours', 'businessStatus',
  'rating', 'userRatingCount', 'photos', 'googleMapsUri',
].join(',');
const CAMPOS_PESQUISA = ['id', 'displayName', 'formattedAddress', 'postalAddress', 'location'].map((c) => `places.${c}`).join(',');

const PLACE_ID = /^[A-Za-z0-9_-]{16,}$/;
const COMANDO_CHAVE = `node "<MKT>/scripts/guardar-credencial.mjs" ${COFRE_AGENCIA} ${CHAVE}`;

// Erro com mensagem já própria para nota (sem a chave).
class ErroGbp extends Error {}

async function pedir(obter, url, init, chave) {
  const limpo = (t) => limparErro(tapar(t, [chave]), 150);
  let r;
  try {
    r = await obter(url, { ...init, signal: AbortSignal.timeout(PRAZO_MS) });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw new ErroGbp(`a Places API não respondeu em ${PRAZO_MS / 1000} s (timeout)`);
    throw new ErroGbp(`erro de rede a contactar a Places API (${limpo(e?.cause?.code ?? e?.name ?? 'erro')})`);
  }
  let corpo = null;
  try { corpo = await r.json(); } catch { /* corpo não-JSON: fica o status */ }
  if (!r.ok) {
    const det = [corpo?.error?.status, corpo?.error?.message].filter((x) => typeof x === 'string' && x).join(': ');
    throw new ErroGbp(`a Places API respondeu HTTP ${r.status}${det ? ` (${limpo(det)})` : ''}`);
  }
  return corpo && typeof corpo === 'object' ? corpo : {};
}

const cabecalhos = (chave, campos) => ({ 'X-Goog-Api-Key': chave, 'X-Goog-FieldMask': campos });

async function lerDetalhes(id, chave, obter) {
  const url = `${API}/places/${encodeURIComponent(id)}?languageCode=${IDIOMA}&regionCode=${REGIAO}`;
  return pedir(obter, url, { method: 'GET', headers: cabecalhos(chave, CAMPOS_DETALHE) }, chave);
}

async function pesquisar(textQuery, geo, chave, obter) {
  const corpo = { textQuery, languageCode: IDIOMA, regionCode: REGIAO, pageSize: 5 };
  if (geo) corpo.locationBias = { circle: { center: { latitude: geo.lat, longitude: geo.lng }, radius: 500 } };
  const r = await pedir(obter, `${API}/places:searchText`, {
    method: 'POST',
    headers: { ...cabecalhos(chave, CAMPOS_PESQUISA), 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  }, chave);
  return Array.isArray(r.places) ? r.places : [];
}

// ---------- o que o site diz ----------

function lerSite(html, base) {
  const { nos } = jsonLd(html);
  const negocios = entidadesDeNegocio(nos);
  // Links do perfil: <a> e sameAs (presenca.mjs) + hasMap do JSON-LD.
  const links = [...(encontrarPerfis(html, nos, base).get('gbp') ?? [])];
  for (const n of nos) {
    for (const m of [].concat(n.hasMap ?? [])) {
      const bruto = typeof m === 'string' ? m : typeof m?.url === 'string' ? m.url : null;
      if (!bruto) continue;
      try {
        const u = new URL(bruto.trim(), base);
        if (ehGbp(u.hostname.toLowerCase().replace(/^www\./, ''), u) && !links.includes(u.href)) links.push(u.href);
      } catch { /* URL inválida: ignora */ }
    }
  }
  const texto = (v) => (typeof v === 'string' ? decodificar(v).trim() : '');
  const moradas = negocios.flatMap((n) => [].concat(n.address ?? []));
  const coord = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v));
  const geo = negocios.map((n) => n.geo).find((g) => g && coord(g.latitude) && coord(g.longitude));
  return {
    links,
    nomes: negocios.map((n) => texto(n.name)).filter(Boolean),
    telefones: [
      ...negocios.flatMap((n) => [].concat(n.telephone ?? [])).filter((t) => typeof t === 'string'),
      ...hrefs(html).filter((h) => /^\s*tel:/i.test(h)).map((h) => h.trim().slice(4).trim()),
    ].filter((t) => digitos(t)),
    cps: [...new Set(moradas.map((m) => cpNormalizado(typeof m === 'object' ? m?.postalCode : m)).filter(Boolean))],
    ruas: moradas.map((m) => texto(typeof m === 'object' ? m?.streetAddress : m)).filter(Boolean),
    localidades: moradas.map((m) => texto(typeof m === 'object' ? m?.addressLocality : '')).filter(Boolean),
    geo: geo ? { lat: Number(geo.latitude), lng: Number(geo.longitude) } : null,
    temNegocio: negocios.length > 0,
  };
}

function placeIdDoLink(href) {
  try {
    const u = new URL(href);
    const id = u.searchParams.get('placeid') ?? u.searchParams.get('q')?.match(/^place_id:(.+)$/)?.[1];
    return id && PLACE_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

// ---------- identificação ----------

const chaveNome = (s) => normalizar(semFormaJuridica(String(s ?? '')));
const cpDoLugar = (p) => cpNormalizado(p?.postalAddress?.postalCode) || cpNormalizado(p?.formattedAddress);

function distanciaM(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// → { id } ou { motivo } (não encontrado / não confirmado).
async function procurarPorPesquisa(s, chave, obter) {
  if (!s) return { motivo: 'sem Place ID no dossier e o site não se leu — não há nome nem morada para procurar o perfil' };
  if (!s.nomes.length) return { motivo: 'sem Place ID no dossier nem no link do site, e o JSON-LD do site não tem o nome do negócio para procurar o perfil' };
  const morada = [s.ruas[0], s.cps[0], s.localidades[0]].filter(Boolean).join(' ');
  const lugares = await pesquisar([s.nomes[0], morada].filter(Boolean).join(', '), s.geo, chave, obter);
  if (!lugares.length) return { motivo: `a pesquisa na Places API por "${s.nomes[0]}" não devolveu nenhum lugar` };

  const nome = (p) => (typeof p?.displayName?.text === 'string' ? p.displayName.text : '?');
  if (s.geo) {
    const medidos = lugares
      .filter((p) => typeof p?.id === 'string' && Number.isFinite(p?.location?.latitude) && Number.isFinite(p?.location?.longitude))
      .map((p) => ({ p, d: distanciaM(s.geo, { lat: p.location.latitude, lng: p.location.longitude }) }))
      .sort((a, b) => a.d - b.d);
    const certo = medidos.find((m) => m.d <= DISTANCIA_MAX_M);
    if (certo) return { id: certo.p.id, como: `pesquisa por nome e morada, a ${Math.round(certo.d)} m do geo do JSON-LD` };
    const perto = medidos[0];
    return {
      motivo: perto
        ? `a pesquisa não devolveu nenhum lugar a ≤ ${DISTANCIA_MAX_M} m do geo do JSON-LD (o mais próximo, "${nome(perto.p)}" ${perto.p.id}, fica a ${Math.round(perto.d)} m) — perfil não confirmado`
        : 'a pesquisa devolveu lugares sem coordenadas — perfil não confirmado',
    };
  }
  if (!s.cps.length) return { motivo: 'sem geo nem código postal no JSON-LD para confirmar o resultado da pesquisa — perfil não confirmado' };
  const nomes = new Set(s.nomes.map(chaveNome));
  const certo = lugares.find((p) => typeof p?.id === 'string' && nomes.has(chaveNome(p?.displayName?.text)) && s.cps.includes(cpDoLugar(p)));
  if (certo) return { id: certo.id, como: 'pesquisa por nome e morada, nome e código postal iguais ao JSON-LD' };
  return { motivo: `nenhum resultado da pesquisa tem o nome e o código postal do JSON-LD (1.º: "${nome(lugares[0])}", ${cpDoLugar(lugares[0]) || 'sem código postal'}) — perfil não confirmado` };
}

// ---------- achados ----------

const hostSemWww = (h) => h.toLowerCase().replace(/^www\./, '');
const lista = (vs) => [...new Set(vs)].map((v) => `"${v}"`).join(', ');

function achado(regra, severidade, evidencia, recomendacao, alvo) {
  return { area: AREA, regra: `${AREA}.${regra}`, severidade, evidencia, recomendacao, skill: SKILL, ...(alvo ? { alvo } : {}) };
}

function compararNap(p, s, ev) {
  const achados = [];
  const comparados = [];
  const nap = (campo, gbp, site) => achados.push(achado('nap-diferente', 'alta',
    `${ev}: o perfil diz "${gbp}"; o site/JSON-LD diz ${site}`,
    'Alinhar nome, morada e telefone entre o Google Business Profile, o texto do site e o JSON-LD: o NAP tem de ser igual em todas as fontes.',
    campo));

  const nomeGbp = typeof p.displayName?.text === 'string' ? p.displayName.text.trim() : '';
  if (nomeGbp && s.nomes.length) {
    comparados.push('nome');
    if (!s.nomes.some((n) => chaveNome(n) === chaveNome(nomeGbp))) nap('nome', nomeGbp, lista(s.nomes));
  }

  const cpGbp = cpDoLugar(p);
  const moradaGbp = typeof p.formattedAddress === 'string' ? p.formattedAddress : '';
  if (cpGbp && s.cps.length) {
    comparados.push('morada');
    if (!s.cps.includes(cpGbp)) nap('morada', moradaGbp || cpGbp, `código postal ${lista(s.cps)}`);
  } else if (moradaGbp && s.ruas.length) {
    comparados.push('morada');
    if (!s.ruas.some((r) => normalizar(moradaGbp).includes(normalizar(r)))) nap('morada', moradaGbp, lista(s.ruas));
  }

  const telsGbp = [p.nationalPhoneNumber, p.internationalPhoneNumber].filter((t) => typeof t === 'string' && digitos(t));
  if (telsGbp.length && s.telefones.length) {
    comparados.push('telefone');
    const doSite = new Set(s.telefones.map(digitos));
    if (!telsGbp.some((t) => doSite.has(digitos(t)))) nap('telefone', telsGbp[0], lista(s.telefones));
  }

  const nota = comparados.length
    ? `NAP comparado com o site/JSON-LD (${comparados.join(', ')})`
    : s.temNegocio ? 'NAP não comparado (sem campos comuns entre o perfil e o site)' : 'NAP não comparado (sem JSON-LD de negócio no site)';
  return { achados, nota };
}

function achadosDoPerfil(p, id, site) {
  const ev = `Places API, places/${id}`;
  const achados = [];

  if (typeof p.businessStatus === 'string' && p.businessStatus !== 'OPERATIONAL' && p.businessStatus !== 'BUSINESS_STATUS_UNSPECIFIED') {
    achados.push(achado('perfil-nao-operacional', 'critica', `${ev}: businessStatus=${p.businessStatus}`,
      'O perfil aparece como não operacional (fechado ou por abrir): se o negócio está aberto, corrigir o estado no Google Business Profile já — o Google mostra-o fechado a quem procura.'));
  }

  const horario = p.regularOpeningHours;
  if (!(horario?.periods?.length || horario?.weekdayDescriptions?.length)) {
    achados.push(achado('sem-horario', 'media', `${ev}: sem regularOpeningHours`,
      'Preencher o horário de funcionamento no Google Business Profile (e mantê-lo igual ao do site).'));
  }

  const siteHost = (() => { try { return hostSemWww(new URL(site).hostname); } catch { return ''; } })();
  let u = null;
  try { u = typeof p.websiteUri === 'string' && p.websiteUri ? new URL(p.websiteUri) : null; } catch { u = null; }
  if (!u) {
    achados.push(achado('site-ausente', 'media', `${ev}: sem websiteUri`,
      `Pôr o site (${site}) no campo "Website" do Google Business Profile, com parâmetros UTM.`));
  } else {
    const h = hostSemWww(u.hostname);
    if (siteHost && h !== siteHost && !h.endsWith(`.${siteHost}`)) {
      achados.push(achado('site-noutro-dominio', 'media', `${ev}: websiteUri=${p.websiteUri}; o site do dossier é ${site}`,
        `Apontar o "Website" do Google Business Profile para o site do cliente (${site}), com parâmetros UTM.`));
    } else if (![...u.searchParams.keys()].some((k) => k.toLowerCase().startsWith('utm_'))) {
      achados.push(achado('site-sem-utm', 'baixa', `${ev}: websiteUri=${p.websiteUri} sem parâmetros utm_`,
        'Acrescentar UTM ao link do site no Google Business Profile (ex.: ?utm_source=google&utm_medium=organic&utm_campaign=gbp) para separar no GA4 as visitas que vêm do perfil.'));
    }
  }

  const fotos = Array.isArray(p.photos) ? p.photos.length : 0;
  if (!fotos) {
    achados.push(achado('sem-fotografias', 'media', `${ev}: sem photos`,
      'Publicar fotografias no Google Business Profile (fachada, interior, equipa, produtos/serviços).'));
  }

  // Sem avaliações a API omite rating e userRatingCount: ausente conta como 0.
  const n = Number.isFinite(p.userRatingCount) ? p.userRatingCount : 0;
  const media = Number.isFinite(p.rating) ? p.rating : null;
  if (n > 0 && media !== null && media < MEDIA_MIN) {
    achados.push(achado('media-baixa', 'media', `${ev}: rating=${media} em ${n} avaliações`,
      `Média abaixo de ${MEDIA_MIN.toFixed(1).replace('.', ',')}: responder a todas as avaliações (sobretudo às negativas) e pedir avaliações a clientes satisfeitos, sem filtrar quem pode avaliar.`));
  }
  if (n < AVALIACOES_MIN) {
    achados.push(achado('poucas-avaliacoes', 'baixa', `${ev}: userRatingCount=${n}`,
      `Menos de ${AVALIACOES_MIN} avaliações: criar uma rotina de pedido de avaliações (link directo para avaliar, depois de cada serviço).`));
  }
  return { achados, fotos, n, media };
}

// ---------- módulo ----------

export async function auditar({
  site,
  cliente = {},
  obter = globalThis.fetch,
  obterSite = obterPagina,
  lerCofre = (s, c) => ler(s, c),
} = {}) {
  const so = (estado, nota) => ({ areas: [{ area: AREA, estado, nota }], achados: [] });

  let chave = null;
  try {
    const v = lerCofre(COFRE_AGENCIA, CHAVE);
    chave = typeof v === 'string' && v.trim() ? v.trim() : null;
  } catch {
    chave = null; // cofre ilegível
  }
  if (!chave) return so('nao-verificado', `sem ${CHAVE} no cofre de agência "${COFRE_AGENCIA}" — guardar com: ${COMANDO_CHAVE}`);

  try {
    // 1. Place ID do dossier.
    const canais = (Array.isArray(cliente.canais) ? cliente.canais : []).filter((c) => c?.tipo === 'gbp');
    const ids = canais.map((c) => (typeof c.id === 'string' ? c.id.trim() : '')).filter((x) => x && x !== SEM_FONTE);
    let id = ids.find((x) => PLACE_ID.test(x)) ?? null;
    let origem = id ? 'do canal gbp do dossier' : null;
    const avisos = [];
    if (!id && ids.length) avisos.push('o id do canal gbp do dossier não é um Place ID — ignorado');

    // 2. Site: links do perfil e NAP.
    const r = await obterSite(site);
    const s = r?.ok ? lerSite(r.texto ?? '', r.url || site) : null;
    if (!s) avisos.push(`não foi possível ler ${site} (${r?.erro ?? `HTTP ${r?.status}`}) — NAP não comparado`);
    if (s?.links.length) avisos.push(`perfil ligado no site: ${s.links.join(', ')}`);
    if (!id && s) {
      id = s.links.map(placeIdDoLink).find(Boolean) ?? null;
      if (id) origem = 'do link no site — pôr no canal gbp do dossier';
    }

    // 3. Pesquisa.
    if (!id) {
      const p = await procurarPorPesquisa(s, chave, obter);
      if (!p.id) return so('nao-verificado', tapar([p.motivo, ...avisos].join('; '), [chave]));
      id = p.id;
      origem = `encontrado por ${p.como} — confirmar e pôr no canal gbp do dossier`;
    }

    const lugar = await lerDetalhes(id, chave, obter).catch((e) => {
      if (e instanceof ErroGbp && /HTTP 404/.test(e.message)) throw new ErroGbp(`${e.message} — Place ID ${id} não existe (errado no dossier?)`);
      throw e;
    });
    const perfil = achadosDoPerfil(lugar, id, site);
    const nap = s ? compararNap(lugar, s, `Places API, places/${id}`) : { achados: [], nota: null };
    const categoria = lugar.primaryTypeDisplayName?.text ?? lugar.primaryType ?? 'sem categoria';
    const nota = [
      `Place ID ${id} (${origem})`,
      `categoria: ${categoria}`,
      perfil.media !== null ? `média ${String(perfil.media).replace('.', ',')} em ${perfil.n} avaliações` : `${perfil.n} avaliações`,
      `${perfil.fotos} fotografia(s)${perfil.fotos >= 10 ? ' (a API devolve no máximo 10)' : ''}`,
      `estado: ${lugar.businessStatus ?? 'não indicado pela API'}`,
      ...(nap.nota ? [nap.nota] : []),
      ...avisos,
    ].join('; ');
    // Site não lido: o perfil viu-se, mas a comparação com o site não — verificação parcial.
    return {
      areas: [{ area: AREA, estado: s ? 'verificado' : 'erro', nota: tapar(nota, [chave]) }],
      achados: [...perfil.achados, ...nap.achados].map((a) => ({ ...a, evidencia: tapar(a.evidencia, [chave]) })),
    };
  } catch (e) {
    return so('erro', e instanceof ErroGbp ? e.message : `falha inesperada (${limparErro(tapar(e?.message ?? e, [chave]), 150)})`);
  }
}
