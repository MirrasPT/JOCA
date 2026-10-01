// Auditoria de presença local e redes (#7). Contrato em pagina.mjs; formato em formato.mjs.
//
// A partir da página inicial do site:
//   - lista os perfis ligados (links <a> e "sameAs" do JSON-LD): uma área "presenca.<rede>" por
//     rede, com a URL do perfil na nota. Cada perfil leva no máximo 1 pedido, só para saber se se
//     lê publicamente; nunca se extraem seguidores nem dados do perfil (fora de âmbito).
//     Falha de rede/timeout/5xx → "erro" (tentar de novo); login ou conteúdo indisponível →
//     "nao-verificado"; HTTP 404 → achado "presenca.perfil-link-partido" (link partido no site).
//   - compara o NAP (nome, morada, telefone) que o site mostra com o do JSON-LD
//     LocalBusiness/Organization; incoerência → achado "presenca.nap-incoerente".
// A ausência de dados estruturados é do módulo seo (#6); aqui só fica na nota.

import { obterPagina } from './pagina.mjs';

// Ordem fixa das áreas no output; "gbp" (Google Business Profile, ver ehGbp) vem no fim.
const REDES = [
  ['instagram', /(^|\.)instagram\.com$/],
  ['facebook', /(^|\.)(facebook\.com|fb\.com|fb\.me)$/],
  ['linkedin', /(^|\.)linkedin\.com$/],
  ['tiktok', /(^|\.)tiktok\.com$/],
  ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/],
  ['x', /(^|\.)(twitter\.com|x\.com)$/],
];

// Links de partilha/intenção não são perfis do cliente. Ancorados ao início do caminho:
// facebook.com/share/<id>/ é um perfil e instagram.com/share.cafe/ é um handle.
const NAO_PERFIL = /^\/(sharer|share\.php|intent|shareArticle|sharing|dialog|plugins|embed)(\/|\.php|$)|^\/share\/?$|^\/watch\b/i;

// Sinais de que o perfil não se lê sem sessão ou está bloqueado.
const MURO_URL = /\/(login|accounts\/login|authwall|checkpoint|signin|uas\/login)\b|consent\.(google|youtube)\./i;
// \b nas duas pontas: "Centrar" e "Blog" não são muro.
const MURO_TITULO = /\b(log ?in|sign ?in|sign up|entrar|before you continue|antes de continuar)\b|\binicia(r)? sess/i;
// Soft-404: a rede responde 200 com uma página de "conteúdo indisponível".
const INDISPONIVEL = /este conte[uú]do n[aã]o est[aá] dispon[ií]vel|this content isn['’]t available|this page isn['’]t available|esta p[aá]gina n[aã]o est[aá] dispon[ií]vel|page not found|p[aá]gina n[aã]o encontrada/i;

// Google Business Profile: só URLs de um lugar. Um link de direcções (maps?q=morada) não é o perfil.
export function ehGbp(host, u) {
  if (['g.page', 'maps.app.goo.gl', 'share.google'].includes(host) || /(^|\.)business\.site$/.test(host)) return true;
  if (host === 'search.google.com') return u.pathname.startsWith('/local/writereview') && u.searchParams.has('placeid');
  const mapas = /^maps\.google\.[a-z.]+$/.test(host) || (/^google\.[a-z.]+$/.test(host) && u.pathname.startsWith('/maps'));
  return mapas && (u.pathname.includes('/maps/place') || u.searchParams.has('cid'));
}

export async function auditar({ site, obter = obterPagina }) {
  const r = await obter(site);
  if (!r.ok) {
    return {
      areas: [{ area: 'presenca', estado: 'erro', nota: `não foi possível ler ${site}: ${r.erro ?? `HTTP ${r.status}`}` }],
      achados: [],
    };
  }
  const base = r.url || site;
  const html = r.texto;
  const { nos, invalidos } = jsonLd(html);

  const perfis = encontrarPerfis(html, nos, base);
  const areas = [];
  const achados = [];

  const nap = compararNap(html, nos);
  const notas = [
    perfis.size ? `perfis ligados: ${[...perfis.keys()].join(', ')}` : 'nenhum perfil social nem link do Google Business Profile no site',
    nap.nota,
  ];
  if (invalidos) notas.push(`${invalidos} bloco(s) JSON-LD inválido(s) ignorado(s)`);
  areas.push({ area: 'presenca', estado: 'verificado', nota: notas.join('; ') });

  if (nap.diferencas.length) {
    achados.push({
      area: 'presenca',
      regra: 'presenca.nap-incoerente',
      severidade: 'alta',
      evidencia: `${base} — ${nap.diferencas.join('; ')}`,
      recomendacao: 'Alinhar nome, morada e telefone entre o texto do site e o JSON-LD (e depois no Google Business Profile); o NAP tem de ser igual em todas as fontes.',
      skill: 'seo-local',
    });
  }

  for (const [rede, urls] of perfis) {
    const { area, achado } = await verificarPerfil(rede, urls, obter, base);
    areas.push(area);
    if (achado) achados.push(achado);
  }
  return { areas, achados };
}

// ---------- perfis ----------

export function encontrarPerfis(html, nos, base) {
  const candidatos = hrefs(html);
  for (const no of nos) sameAs(no, candidatos);

  const perfis = new Map();
  for (const bruto of candidatos) {
    let u;
    try {
      u = new URL(bruto.trim(), base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const rede = ehGbp(host, u) ? 'gbp' : REDES.find(([, re]) => re.test(host))?.[0];
    if (!rede || host === 'youtu.be' || (rede !== 'gbp' && (NAO_PERFIL.test(u.pathname) || /[?&]u=/.test(u.search)))) continue; // youtu.be = vídeo
    if (rede !== 'gbp' && (u.pathname === '/' || u.pathname === '')) continue; // só o domínio da rede
    if (rede !== 'gbp' && /\/(p|status|video|reel)\//i.test(u.pathname)) continue; // uma publicação, não o perfil
    if (rede === 'gbp') {
      // Só cid/placeid/q identificam o lugar; o resto (g_st, g_ep, utm...) é rasto de quem partilhou.
      for (const k of [...u.searchParams.keys()]) if (!['cid', 'placeid', 'q'].includes(k)) u.searchParams.delete(k);
    } else {
      // Query e fragmento fora (utm, igshid, fbclid identificam quem partilhou e não podem ir para
      // clientes/); só o id de facebook.com/profile.php?id= identifica o perfil.
      const id = u.pathname === '/profile.php' ? u.searchParams.get('id') : null;
      u.search = id ? `?id=${encodeURIComponent(id)}` : '';
      u.hash = '';
    }
    const url = u.href;
    if (!perfis.has(rede)) perfis.set(rede, []);
    if (!perfis.get(rede).includes(url)) perfis.get(rede).push(url);
  }
  return new Map([...REDES.map(([rede]) => rede), 'gbp'].map((rede) => [rede, perfis.get(rede)]).filter(([, v]) => v));
}

// 1 pedido por rede (ao primeiro perfil ligado); os restantes ficam listados na nota.
// → { area, achado? }
async function verificarPerfil(rede, urls, obter, base) {
  const [url] = urls;
  const outros = urls.length > 1 ? ` (+ ${urls.slice(1).join(', ')} — não pedidos)` : '';
  const area = `presenca.${rede}`;
  const r = await obter(url);
  if (!r.ok) {
    const motivo = r.erro ?? `HTTP ${r.status}`;
    // Falha de rede, timeout ou 5xx: não se sabe nada do perfil — tentar de novo, não "sem acesso".
    if (r.erro || !r.status || (r.status >= 500 && r.status <= 599)) {
      return { area: { area, estado: 'erro', nota: `${url}${outros} ligado no site; o pedido ao perfil falhou (${motivo}) — tentar de novo` } };
    }
    if (r.status === 404) {
      return {
        area: { area, estado: 'verificado', nota: `${url}${outros} ligado no site; HTTP 404 — link partido (ver achado presenca.perfil-link-partido)` },
        achado: {
          area: 'presenca',
          regra: 'presenca.perfil-link-partido',
          severidade: 'media',
          evidencia: `${base} liga para ${url}, que responde HTTP 404`,
          recomendacao: 'Corrigir ou remover no site o link para o perfil: aponta para uma página que não existe.',
          skill: rede === 'gbp' ? 'seo-local' : 'social-content',
          alvo: rede, // um achado por rede: "regra"+"alvo" é único na auditoria (D-016)
        },
      };
    }
    return { area: { area, estado: 'nao-verificado', nota: `${url}${outros} ligado no site; perfil não lido publicamente (${motivo})` } };
  }
  const titulo = decodificar(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(r.texto)?.[1]?.trim() ?? '');
  if (MURO_URL.test(r.url ?? '') || MURO_TITULO.test(titulo)) {
    return { area: { area, estado: 'nao-verificado', nota: `${url}${outros} ligado no site; perfil pede sessão ou bloqueia leitura pública` } };
  }
  if (INDISPONIVEL.test(`${titulo} ${textoVisivel(r.texto)}`)) {
    return { area: { area, estado: 'nao-verificado', nota: `${url}${outros} ligado no site; a rede responde HTTP ${r.status} com uma página de conteúdo indisponível` } };
  }
  // Só isto se mediu: não se diz "acessível publicamente".
  return { area: { area, estado: 'verificado', nota: `${url}${outros} ligado no site; HTTP ${r.status}, sem muro de login no título nem redirecção para login, sem página de conteúdo indisponível (métricas fora de âmbito)` } };
}

// ---------- NAP ----------

function compararNap(html, nos) {
  // Qualquer entidade de negócio serve (várias lojas em @graph): um campo só diverge se nenhuma bater.
  const negocios = entidadesDeNegocio(nos);
  if (!negocios.length) return { nota: 'sem JSON-LD LocalBusiness/Organization — NAP não comparado', diferencas: [] };

  const titulo = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '';
  const texto = textoVisivel(html);
  const textoN = normalizar(`${decodificar(titulo)} ${texto}`);
  // Entidade HTML que não se soube descodificar: um texto "em falta" pode estar lá escrito assim.
  const duvida = /&[a-z][a-z0-9]*;/i.test(`${decodificar(titulo)} ${texto}`);
  const diferencas = [];
  const comparados = [];
  const avisos = [];
  const lista = (vs) => [...new Set(vs)].map((v) => `"${v}"`).join(', ');
  const noTexto = (campo, valores, diferenca) => {
    comparados.push(campo);
    if (valores.some((v) => textoN.includes(normalizar(v)))) return;
    if (duvida) avisos.push(`${campo} não confirmado (entidades HTML por descodificar no site)`);
    else diferencas.push(diferenca);
  };

  const nomes = negocios.map((n) => (typeof n.name === 'string' ? decodificar(n.name).trim() : '')).filter(Boolean);
  if (nomes.length) noTexto('nome', nomes.map(semFormaJuridica), `nome: JSON-LD diz ${lista(nomes)}, que não aparece no site`);

  // Telefone: compara-se contra os links tel:. Números no texto só confirmam (fixo 2-3-4, 808,
  // NIF com 9 dígitos...): nunca geram achado.
  const tels = negocios.flatMap((n) => [].concat(n.telephone ?? [])).filter((t) => typeof t === 'string' && digitos(t));
  if (tels.length) {
    const telLinks = hrefs(html).filter((h) => /^\s*tel:/i.test(h)).map((h) => h.trim().slice(4).trim());
    const alvos = tels.map(digitos);
    const confirmado = alvos.some((a) => telLinks.some((t) => digitos(t) === a) || noTextoComoTelefone(texto, a));
    if (telLinks.length) {
      comparados.push('telefone');
      if (!confirmado) diferencas.push(`telefone: JSON-LD diz ${lista(unicosPorDigitos(tels))}, o site liga para ${lista(unicosPorDigitos(telLinks))}`);
    } else if (!confirmado) {
      avisos.push('telefone não confirmado (o site não tem link tel: e o número do JSON-LD não aparece no texto)');
    } else comparados.push('telefone');
  }

  const moradas = negocios.flatMap((n) => [].concat(n.address ?? []));
  const cps = [...new Set(moradas.map((m) => cpNormalizado(typeof m === 'object' ? m?.postalCode : m)).filter(Boolean))];
  const cpsSite = [...new Set(texto.match(/\b\d{4}-\d{3}\b/g) ?? [])];
  const ruas = moradas.map((m) => (typeof m === 'object' && typeof m?.streetAddress === 'string' ? m.streetAddress : '')).filter(Boolean);
  if (cps.length && cpsSite.length) {
    comparados.push('morada');
    if (!cps.some((c) => cpsSite.includes(c))) diferencas.push(`morada: código postal no JSON-LD ${lista(cps)}, no site ${lista(cpsSite)}`);
  } else if (!cps.length && ruas.length && texto) {
    noTexto('morada', ruas, `morada: JSON-LD diz ${lista(ruas)}, que não aparece no site`);
  }

  const nota = [
    comparados.length ? `NAP comparado entre site e JSON-LD (${comparados.join(', ')})` : 'JSON-LD sem nome/morada/telefone comparáveis com o site — NAP não comparado',
    ...avisos,
  ].join('; ');
  return { nota, diferencas };
}

// ---------- utilitários (exportados para o módulo gbp, D-023) ----------

// Nós JSON-LD que descrevem o negócio (LocalBusiness/Organization, ou com nome e morada/telefone).
export const entidadesDeNegocio = (nos) => nos.filter((n) => tipos(n).some((t) => /LocalBusiness|Organization/.test(t)) || (n.name && (n.address || n.telephone)));

export function jsonLd(html) {
  const nos = [];
  let invalidos = 0;
  for (const m of html.matchAll(/<script\b[^>]*\btype\s*=\s*(["']?)application\/ld\+json\1(?=[\s>\/])[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      achatar(JSON.parse(m[2]), nos);
    } catch {
      invalidos++;
    }
  }
  return { nos, invalidos };
}

// href de <a>, com ou sem aspas (HTML minificado: href=https://...), já descodificado.
export function hrefs(html) {
  return [...html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:(["'])(.*?)\1|([^\s"'>]+))/gis)].map((m) => decodificar(m[2] ?? m[3]));
}

// sameAs do nó e dos aninhados (publisher, mainEntity, ...), com descida limitada.
function sameAs(v, out, profundidade = 0) {
  if (!v || typeof v !== 'object' || profundidade > 6) return;
  if (Array.isArray(v)) return v.forEach((x) => sameAs(x, out, profundidade + 1));
  out.push(...[].concat(v.sameAs ?? []).filter((x) => typeof x === 'string'));
  for (const [k, x] of Object.entries(v)) if (k !== 'sameAs') sameAs(x, out, profundidade + 1);
}

function achatar(v, nos) {
  if (Array.isArray(v)) return v.forEach((x) => achatar(x, nos));
  if (!v || typeof v !== 'object') return;
  nos.push(v);
  if (v['@graph']) achatar(v['@graph'], nos);
}

const tipos = (n) => [].concat(n['@type'] ?? []).map(String);

function textoVisivel(html) {
  return decodificar(
    html
      .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

// Entidades nomeadas: as comuns por extenso e as letras acentuadas por composição (&eacute; = e +
// acento agudo). O resto fica como está, e quem compara texto trata-o como dúvida.
const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', ndash: '–', mdash: '—',
  hellip: '…', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ordm: 'º',
  ordf: 'ª', deg: '°', euro: '€', copy: '©', reg: '®', trade: '™', shy: '', szlig: 'ß', aelig: 'æ',
  AElig: 'Æ', oslash: 'ø', Oslash: 'Ø', bull: '•', iexcl: '¡', iquest: '¿',
};
const ACENTOS = { acute: '\u0301', grave: '\u0300', circ: '\u0302', tilde: '\u0303', uml: '\u0308', cedil: '\u0327', ring: '\u030A' };
export function decodificar(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return cp <= 0x10ffff ? String.fromCodePoint(cp) : m; // acima do Unicode: fica como está (não lança)
    }
    const nomeada = ENTIDADES[e] ?? ENTIDADES[e.toLowerCase()];
    if (nomeada !== undefined) return nomeada;
    const letra = /^([a-z])(acute|grave|circ|tilde|uml|cedil|ring)$/i.exec(e);
    return letra ? (letra[1] + ACENTOS[letra[2]]).normalize('NFC') : m;
  });
}

export const normalizar = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const semFormaJuridica = (s) => s.replace(/[,\s]+(lda\.?|limitada|unipessoal|s\.?\s?a\.?)(?=[\s,]|$)/gi, '').trim();

// O número (só dígitos, sem +351) aparece no texto com qualquer agrupamento: "22 208 0000",
// "222 080 000", "+351 222-080-000". Os dígitos têm de estar isolados (não dentro de outro número).
function noTextoComoTelefone(texto, alvo) {
  if (alvo.length < 6) return false;
  const corpo = [...alvo].join('[\\s.()-]?');
  return new RegExp(`(?<!\\d)(?:(?:\\+|00)351[\\s.-]?)?${corpo}(?!\\d)`).test(texto);
}

// O mesmo número escrito de várias formas conta uma vez (fica a primeira forma vista).
const unicosPorDigitos = (ts) => ts.filter((t, i) => ts.findIndex((o) => digitos(o) === digitos(t)) === i);

// "4050-262 Porto", "4050 262", "4050262" → "4050-262"; sem código postal PT → ''.
export function cpNormalizado(v) {
  const m = /(?<!\d)(\d{4})\s*[-–]?\s*(\d{3})(?!\d)/.exec(String(v ?? ''));
  return m ? `${m[1]}-${m[2]}` : '';
}

// Só dígitos, sem indicativo de Portugal: "+351 912 345 678" e "912345678" dão o mesmo.
export function digitos(s) {
  const d = s.replace(/\D/g, '').replace(/^00/, '');
  return d.length === 12 && d.startsWith('351') ? d.slice(3) : d;
}
