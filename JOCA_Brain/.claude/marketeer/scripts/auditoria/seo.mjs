// Auditoria de SEO técnico (#6): title, meta description, canonical, robots.txt, sitemap.xml,
// dados estruturados e indexabilidade. Contrato em pagina.mjs; formato em formato.mjs.
//
// Trabalha sobre o HTML estático devolvido por obter(), sem renderização: o que só existe depois
// de correr JavaScript não é visto aqui. Os cabeçalhos HTTP (X-Robots-Tag) também não, porque o
// obter() não os devolve.

import { obterPagina } from './pagina.mjs';

const AREA = 'seo';
const SKILL = 'seo';

const achado = (regra, severidade, evidencia, recomendacao) =>
  ({ area: AREA, regra: `${AREA}.${regra}`, severidade, evidencia, recomendacao, skill: SKILL });

// Atributos de uma tag: <meta name="robots" content='noindex'> → { name: 'robots', content: 'noindex' }.
function atributos(tag) {
  const attrs = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const corpo = tag.replace(/^<\s*[a-z0-9-]+/i, '').replace(/\/?>$/, '');
  for (const m of corpo.matchAll(re)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

const tags = (html, nome) => [...html.matchAll(new RegExp(`<${nome}\\b[^>]*>`, 'gi'))].map((m) => atributos(m[0]));

const decodificar = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

// robots.txt → { bloqueio, sitemaps }. Grupos por user-agent (linhas User-agent seguidas partilham
// grupo); vale o grupo do Googlebot se existir, senão o de "*". bloqueio = { agente, regra } quando
// esse grupo tem "Disallow: /" ou "Disallow: /*" sem um "Allow" que o anule (igual ou mais longo).
function lerRobots(texto) {
  const sitemaps = [];
  const grupos = [];
  let grupo = null;
  for (const linha of texto.split(/\r?\n/)) {
    const m = /^\s*([a-z-]+)\s*:\s*(.*?)\s*$/i.exec(linha.replace(/#.*/, ''));
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2];
    if (campo === 'sitemap') { if (valor) sitemaps.push(valor); continue; }
    if (campo === 'user-agent') {
      if (!grupo || grupo.regras.length) grupos.push(grupo = { agentes: [], regras: [] });
      grupo.agentes.push(valor.toLowerCase());
    } else if ((campo === 'disallow' || campo === 'allow') && grupo) {
      grupo.regras.push({ campo, valor });
    }
  }
  const aplicaveis = (ua) => grupos.filter((g) => g.agentes.includes(ua));
  const agente = aplicaveis('googlebot').length ? 'googlebot' : '*';
  const regras = aplicaveis(agente).flatMap((g) => g.regras);
  const raiz = (campo) => regras.filter((r) => r.campo === campo && (r.valor === '/' || r.valor === '/*')).map((r) => r.valor);
  const permitidos = raiz('allow');
  const bloqueia = raiz('disallow').find((d) => !permitidos.some((a) => a.length >= d.length));
  return { bloqueio: bloqueia ? { agente: agente === '*' ? '*' : 'Googlebot', regra: bloqueia } : null, sitemaps };
}

const eSitemap = (texto) => /<(urlset|sitemapindex)\b/i.test(texto);
// robots.txt com 200 que é HTML: fallback de SPA/CMS, conta como ausente (como o sitemap).
const eHtml = (texto) => /<(!doctype\s+html|html)\b/i.test(texto);
const LIMITES = 'página inicial; HTML estático; X-Robots-Tag não verificado';

export async function auditar({ site, obter = obterPagina }) {
  let base;
  try { base = new URL(site); } catch {
    return { areas: [{ area: AREA, estado: 'erro', nota: `site inválido: ${site}` }], achados: [] };
  }
  const pagina = await obter(base.href);
  if (!pagina.ok) {
    const porque = pagina.erro ? `erro de rede (${pagina.erro})` : `HTTP ${pagina.status}`;
    return { areas: [{ area: AREA, estado: 'erro', nota: `site inacessível em ${base.href}: ${porque}` }], achados: [] };
  }

  const url = pagina.url || base.href;
  const origem = new URL(url).origin;
  // Retira comentários e blocos que não são marcação da página (script, style, template, noscript,
  // svg) numa só passagem da esquerda para a direita, como o tokenizer do browser: abre primeiro,
  // ganha. Um "<!--" numa string de <script> não come o resto e um <script> comentado não conta.
  // Os blocos JSON-LD guardam-se à parte antes de sair.
  const jsonld = [];
  const html = pagina.texto.replace(/<!--[\s\S]*?-->|<(script|style|template|noscript|svg)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi,
    (_, nome, attrs, corpo) => {
      if (nome?.toLowerCase() === 'script' && (atributos(`<script${attrs}>`).type ?? '').trim().toLowerCase() === 'application/ld+json') jsonld.push(corpo);
      return ' ';
    });
  // Title, meta e canonical procuram-se no documento inteiro: o Next.js >=15.2 faz streaming dos
  // metadados para o <body> quando o user-agent não é um bot.
  const achados = [];
  const falhas = [];

  // Title
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!title || !decodificar(title[1])) {
    achados.push(achado('title-ausente', 'alta', `${url} — sem <title> ou <title> vazio`,
      'Definir um <title> único e descritivo (50-60 caracteres), com o termo principal no início.'));
  }

  const metas = tags(html, 'meta');

  // Meta description
  const descricao = metas.find((m) => m.name?.toLowerCase() === 'description');
  if (!descricao || !decodificar(descricao.content ?? '')) {
    achados.push(achado('meta-description-ausente', 'media', `${url} — sem <meta name="description"> ou com conteúdo vazio`,
      'Escrever uma meta description única (150-160 caracteres) que resuma a página e convide ao clique.'));
  }

  // Indexabilidade: meta robots / googlebot
  const noindex = metas.find((m) => ['robots', 'googlebot'].includes(m.name?.toLowerCase())
    && /(^|[\s,])(noindex|none)($|[\s,])/i.test(m.content ?? ''));
  if (noindex) {
    achados.push(achado('noindex', 'critica', `${url} — <meta name="${noindex.name}" content="${noindex.content}">`,
      'Remover o noindex da página pública; enquanto existir, a página não aparece no Google.'));
  }

  // Canonical
  const canonical = tags(html, 'link').find((l) => (l.rel ?? '').toLowerCase().split(/\s+/).includes('canonical') && l.href?.trim());
  if (!canonical) {
    achados.push(achado('canonical-ausente', 'media', `${url} — sem <link rel="canonical">`,
      'Adicionar <link rel="canonical"> auto-referenciado com o URL definitivo (https, com/sem www coerente).'));
  }

  // Dados estruturados: JSON-LD ou microdata
  const microdata = /\bitemscope\b/i.test(html);
  const invalidos = jsonld.filter((j) => { try { JSON.parse(j); return false; } catch { return true; } });
  if (!jsonld.length && !microdata) {
    achados.push(achado('dados-estruturados-ausentes', 'baixa', `${url} — sem JSON-LD (application/ld+json) nem microdata (itemscope)`,
      'Adicionar dados estruturados JSON-LD adequados ao negócio (Organization/LocalBusiness, WebSite).'));
  } else if (invalidos.length) {
    achados.push(achado('dados-estruturados-invalidos', 'media', `${url} — ${invalidos.length} de ${jsonld.length} bloco(s) JSON-LD com JSON inválido`,
      'Corrigir o JSON-LD e validar no Rich Results Test do Google.'));
  }

  // robots.txt
  const urlRobots = `${origem}/robots.txt`;
  const robots = await obter(urlRobots);
  let sitemapsDeclarados = [];
  if (robots.ok && eHtml(robots.texto)) {
    achados.push(achado('robots-ausente', 'media', `${urlRobots} — HTTP 200 mas é uma página HTML, não um robots.txt`,
      'Publicar um robots.txt na raiz do domínio, com a linha "Sitemap:" a apontar para o sitemap.'));
  } else if (robots.ok) {
    const r = lerRobots(robots.texto);
    // "Sitemap:" relativo resolve-se contra o robots.txt; um valor que nem assim é URL ignora-se.
    sitemapsDeclarados = r.sitemaps.flatMap((v) => { try { return [new URL(v, urlRobots).href]; } catch { return []; } });
    if (r.bloqueio) {
      achados.push(achado('robots-bloqueia-tudo', 'critica', `${urlRobots} — "User-agent: ${r.bloqueio.agente}" com "Disallow: ${r.bloqueio.regra}"`,
        `Retirar o "Disallow: ${r.bloqueio.regra}" do robots.txt; bloqueia o rastreio do site inteiro.`));
    }
  } else if (robots.status === 404 || robots.status === 410) {
    achados.push(achado('robots-ausente', 'media', `${urlRobots} — HTTP ${robots.status}`,
      'Publicar um robots.txt na raiz do domínio, com a linha "Sitemap:" a apontar para o sitemap.'));
  } else {
    falhas.push(`robots.txt não verificado (${robots.erro ? `erro de rede: ${robots.erro}` : `HTTP ${robots.status}`})`);
  }

  // sitemap.xml: os declarados no robots.txt, senão /sitemap.xml
  const candidatos = sitemapsDeclarados.length ? sitemapsDeclarados : [`${origem}/sitemap.xml`];
  const medidos = [];
  let encontrado = false;
  let sitemapIncerto = false;
  for (const c of candidatos) {
    // Sitemap comprimido: o obter() devolve texto, não bytes, logo não se lê — fica por verificar.
    if (/\.gz$/i.test(new URL(c).pathname)) {
      sitemapIncerto = true;
      medidos.push(`${c} — sitemap comprimido (.gz), não lido`);
      continue;
    }
    const s = await obter(c);
    if (s.ok && eSitemap(s.texto)) { encontrado = true; break; }
    if (!s.ok && (s.status === 0 || s.status >= 500)) sitemapIncerto = true;
    medidos.push(`${c} — ${s.ok ? 'HTTP 200 mas não é um sitemap XML' : s.erro ? `erro de rede (${s.erro})` : `HTTP ${s.status}`}`);
  }
  // Declarados falharam: tenta-se ainda /sitemap.xml (#26). Se existir, o problema é a linha
  // "Sitemap:" do robots.txt, não a falta de sitemap. Com um declarado por verificar (5xx, rede,
  // .gz) não se afirma que está partido: fica a verificação parcial.
  const padrao = `${origem}/sitemap.xml`;
  if (!encontrado && sitemapsDeclarados.length && !candidatos.includes(padrao)) {
    const s = await obter(padrao);
    if (s.ok && eSitemap(s.texto)) {
      encontrado = true;
      if (sitemapIncerto) falhas.push(`sitemap declarado não verificado (${medidos.join('; ')})`);
      else {
        achados.push(achado('sitemap-declarado-partido', 'media', `${medidos.join('; ')}; ${padrao} — sitemap XML válido`,
          `Corrigir a linha "Sitemap:" do ${urlRobots} para ${padrao} (ou publicar o sitemap no caminho declarado) e voltar a submetê-lo na Search Console.`));
      }
    } else {
      if (!s.ok && (s.status === 0 || s.status >= 500)) sitemapIncerto = true;
      medidos.push(`${padrao} — ${s.ok ? 'HTTP 200 mas não é um sitemap XML' : s.erro ? `erro de rede (${s.erro})` : `HTTP ${s.status}`}`);
    }
  }
  if (!encontrado) {
    if (sitemapIncerto) falhas.push(`sitemap não verificado (${medidos.join('; ')})`);
    else {
      achados.push(achado('sitemap-ausente', 'media', medidos.join('; '),
        'Gerar um sitemap.xml com os URLs canónicos e indexáveis, declará-lo no robots.txt e submetê-lo na Search Console.'));
    }
  }

  const area = falhas.length
    ? { area: AREA, estado: 'erro', nota: `verificação parcial de ${url}: ${falhas.join('; ')}` }
    : { area: AREA, estado: 'verificado', nota: LIMITES };
  return { areas: [area], achados };
}
