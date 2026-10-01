// Leitura da especificação de uma campanha Search (Markdown, formato validado em campanhas reais;
// modelo em modelos/campanha-search.md). Sem I/O: texto → objecto.
//
// O que se lê do corpo (tolerante: funciona no modelo e nas especificações escritas à mão):
//   grupos       **C1 · Nome** seguido de um bloco ``` com uma palavra-chave por linha
//                ("…" = expressão, […] = exacta, sem símbolos = ampla)
//   anúncios     tabelas `| # | Título | Car. |…` e `| # | Descrição | Car. |…` debaixo de um
//                título `### C1 · Nome`; colunas extra com ✓ (RSA-S, RSA-P…) = variantes; coluna
//                `Fixar` ou "(fixar pos. N)" = fixação
//   negativas    tabelas dentro de uma secção `## … negativas`: linha com código de grupo na 1.ª
//                célula = negativa de grupo; coluna "…campanha A…" = negativa dessa campanha;
//                resto = negativa de todas as campanhas do documento. Só se lêem `tokens` entre
//                crases dentro de TABELAS (a prosa à volta cita negativas que NÃO se usam)
//   recursos     tabelas cujo cabeçalho começa por Texto (sitelinks), Frase (destaques), Valor
//                (snippets); cabeçalho do snippet em "cabeçalho **X**"
//   URL final    linha/tabela "URL final …" (URL ou TODO) · caminho visível `/a/b`
//   contagens    coluna `Car.` = contagem declarada do texto da coluna anterior; `*` = o texto tem
//                o marcador X, contado como 10.000 (pior caso)
// O frontmatter YAML (bloco `campanha:`) tem os valores de máquina para `campanha/criar.mjs` (D-020).

import { parse } from 'yaml';

export const LIMITES = {
  titulo: 30, descricao: 90, caminho: 15, sitelink: 25, sitelinkDescricao: 35, destaque: 25, snippet: 25, palavra: 80,
};
export const MAX_PALAVRAS_POR_KW = 10;

export const comprimento = (s) => [...String(s ?? '')].length;

// "x" → PHRASE, [x] → EXACT, resto → BROAD
export function lerPalavra(s) {
  const t = String(s).trim();
  if (/^".*"$/.test(t)) return { text: t.slice(1, -1).trim(), matchType: 'PHRASE' };
  if (/^\[.*\]$/.test(t)) return { text: t.slice(1, -1).trim(), matchType: 'EXACT' };
  return { text: t, matchType: 'BROAD' };
}

export const mostrarPalavra = (k) => (k.matchType === 'PHRASE' ? `"${k.text}"` : k.matchType === 'EXACT' ? `[${k.text}]` : k.text);

export function separarFrontmatter(texto) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (!m) return { dados: {}, corpo: texto };
  return { dados: parse(m[1]) ?? {}, corpo: texto.slice(m[0].length) };
}

const celulas = (linha) => linha.trim().replace(/^\|/, '').replace(/\|$/, '')
  .split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

// Corpo → blocos: tabelas e blocos de código, cada um com os títulos que o envolvem (h[0]=h1…)
// e a última linha de texto antes dele (rótulo).
export function blocos(corpo) {
  const linhas = corpo.split(/\r?\n/);
  const out = [];
  const h = [];
  let rotulo = '';
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const t = /^(#{1,6})\s+(.*)$/.exec(l);
    if (t) { h.length = t[1].length - 1; h[t[1].length - 1] = t[2].trim(); rotulo = ''; continue; }
    if (/^\s*```/.test(l)) {
      const conteudo = [];
      for (i++; i < linhas.length && !/^\s*```/.test(linhas[i]); i++) conteudo.push(linhas[i]);
      out.push({ tipo: 'codigo', linhas: conteudo, h: [...h], rotulo, linha: i });
      continue;
    }
    if (/^\s*\|/.test(l)) {
      const tab = [];
      for (; i < linhas.length && /^\s*\|/.test(linhas[i]); i++) tab.push(linhas[i]);
      i--;
      const [cab, ...resto] = tab.map(celulas);
      const linhasTab = resto.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c) || c === ''));
      out.push({ tipo: 'tabela', cab, linhas: linhasTab, h: [...h], rotulo, linha: i });
      continue;
    }
    if (l.trim()) rotulo = l.trim();
  }
  return out;
}

const RE_GRUPO = /^([A-Z]\d+)\s+·\s+(.+)$/;
const campanhaDe = (codigo) => codigo.replace(/\d+$/, '');
const crases = (s) => [...String(s).matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const grupoDoTitulo = (h) => {
  for (let n = h.length - 1; n >= 0; n--) {
    const m = h[n] && RE_GRUPO.exec(h[n].replace(/\*/g, ''));
    if (m) return m[1];
  }
  return null;
};

// Tipo do texto pela coluna: título/descrição (tabela RSA, 1.ª coluna `#`), sitelink (1.ª coluna
// Texto), destaque (1.ª coluna Frase), snippet (1.ª coluna Valor). Outras tabelas não contam.
function tipoDaColuna(cab0, nome, j) {
  if (cab0 === '#' && /^t[ií]tulo$/i.test(nome)) return 'titulo';
  if (cab0 === '#' && /^descri[çc][ãa]o$/i.test(nome)) return 'descricao';
  if (/^texto$/i.test(cab0) && j === 0) return 'sitelink';
  if (/^texto$/i.test(cab0) && /^descri[çc][ãa]o \d$/i.test(nome)) return 'sitelinkDescricao';
  if (j === 0 && /^frase$/i.test(nome)) return 'destaque';
  if (j === 0 && /^valor$/i.test(nome)) return 'snippet';
  return null;
}

// "20*" → { n: 20, marcador: true }
const lerDeclarado = (c) => { const m = /^(\d+)\s*(\*)?$/.exec(String(c ?? '').trim()); return m ? { n: Number(m[1]), marcador: !!m[2] } : null; };

export function lerEspecificacao(texto) {
  const { dados, corpo } = separarFrontmatter(texto);
  const bs = blocos(corpo);
  const grupos = [];
  const anuncios = new Map(); // `${grupo}|${variante}` → { grupo, variante, titulos, descricoes }
  const textos = [];
  const negativas = [];
  const sitelinks = [];
  const destaques = [];
  const snippets = [];

  for (const b of bs) {
    // Grupos e palavras-chave
    if (b.tipo === 'codigo') {
      const m = /^\*\*([A-Z]\d+)\s+·\s+([^*]+)\*\*/.exec(b.rotulo);
      if (!m) continue;
      grupos.push({
        codigo: m[1], nome: m[2].trim(), campanha: campanhaDe(m[1]),
        palavras: b.linhas.map((x) => x.trim()).filter(Boolean).map(lerPalavra),
      });
      continue;
    }
    const { cab, linhas } = b;
    const emNegativas = b.h.some((x, n) => n <= 2 && x && /negativ/i.test(x));

    // Textos contados (todas as tabelas com colunas de texto de anúncio)
    const colTexto = cab.map((c, j) => ({ j, tipo: tipoDaColuna(cab[0], c, j) })).filter((x) => x.tipo);
    if (colTexto.length && !emNegativas) {
      for (const r of linhas) {
        for (const { j, tipo } of colTexto) {
          const txt = r[j];
          if (!txt) continue;
          const declarado = /^car\.?$/i.test(cab[j + 1] ?? '') ? lerDeclarado(r[j + 1]) : null;
          textos.push({ tipo, texto: txt, declarado, onde: `${grupoDoTitulo(b.h) ?? b.h.filter(Boolean).at(-1) ?? ''} ${r[0]}`.trim() });
        }
      }
    }

    // Anúncios (RSA)
    if (cab[0] === '#' && /^(t[ií]tulo|descri[çc][ãa]o)$/i.test(cab[1] ?? '')) {
      const grupo = grupoDoTitulo(b.h);
      if (!grupo) continue;
      const eTitulo = /^t[ií]tulo$/i.test(cab[1]);
      const jFixar = cab.findIndex((c) => /^fixar/i.test(c));
      const variantes = cab.map((c, j) => ({ c, j })).filter(({ c, j }) => j > 1 && !/^car\.?$/i.test(c) && j !== jFixar);
      for (const r of linhas) {
        if (!/^(D)?\d+[A-Z]?$/.test(r[0]) || !r[1]) continue;
        const fix = jFixar >= 0 ? /(\d)/.exec(r[jFixar] ?? '') : r.map((c) => /fixar pos\.?\s*(\d)/i.exec(c)).find(Boolean);
        const item = { texto: r[1], fixar: fix ? Number(fix[1]) : null, id: r[0] };
        const nomes = variantes.length ? variantes.filter(({ j }) => /✓/.test(r[j] ?? '')).map(({ c }) => c) : [''];
        for (const v of nomes) {
          const k = `${grupo}|${v}`;
          if (!anuncios.has(k)) anuncios.set(k, { grupo, variante: v, titulos: [], descricoes: [] });
          anuncios.get(k)[eTitulo ? 'titulos' : 'descricoes'].push(item);
        }
      }
      continue;
    }

    // Negativas
    if (emNegativas) {
      const colCampanha = cab.map((c, j) => ({ j, m: /campanha\s+([A-Z])\b/.exec(c) })).filter((x) => x.m);
      const colNeg = cab.map((c, j) => j).filter((j) => /negativ|excluir/i.test(cab[j]));
      for (const r of linhas) {
        if (/^[A-Z]\d+$/.test(r[0])) {
          for (const t of crases(r.slice(1, colNeg.length ? colNeg.at(-1) + 1 : 2).join(' '))) negativas.push({ nivel: 'grupo', alvo: r[0], ...lerPalavra(t) });
        } else if (colCampanha.length) {
          for (const { j, m } of colCampanha) for (const t of crases(r[j] ?? '')) negativas.push({ nivel: 'campanha', alvo: m[1], ...lerPalavra(t) });
        } else {
          const cols = colNeg.length ? colNeg : r.map((_, j) => j).slice(1);
          for (const j of cols) for (const t of crases(r[j] ?? '')) negativas.push({ nivel: 'campanha', alvo: '*', ...lerPalavra(t) });
        }
      }
      continue;
    }

    // Recursos
    const col = (re) => cab.findIndex((c) => re.test(c));
    if (/^texto$/i.test(cab[0]) && col(/^url/i) >= 0) {
      const [j1, j2, ju] = [col(/^descri[çc][ãa]o 1$/i), col(/^descri[çc][ãa]o 2$/i), col(/^url/i)];
      for (const r of linhas) {
        const url = (/(https?:\/\/[^\s)`]+)/.exec(r[ju] ?? '') ?? [])[1] ?? null;
        sitelinks.push({ texto: r[0], d1: r[j1] ?? '', d2: r[j2] ?? '', url, campanhas: cab.map((c, j) => (/^[A-Z]$/.test(c) && /✓/.test(r[j] ?? '') ? c : null)).filter(Boolean) });
      }
    } else if (/^frase$/i.test(cab[0])) {
      for (const r of linhas) destaques.push({ texto: r[0], campanha: (/^\*\*campanha\s+([A-Z])\*\*$/i.exec(b.rotulo) ?? [])[1] ?? null });
    } else if (/^valor$/i.test(cab[0])) {
      const cabecalho = (/cabeçalho\s+\*\*([^*]+)\*\*/i.exec(`${b.rotulo} ${b.h.at(-1) ?? ''}`) ?? [])[1] ?? null;
      const campanha = (/campanha\s+([A-Z])\b/i.exec(b.rotulo) ?? [])[1] ?? null;
      snippets.push({ cabecalho, campanha, valores: linhas.map((r) => r[0]) });
    }
  }

  // URL final e caminho visível — linhas do corpo (tabela ou prosa)
  const urlsFinais = [];
  const caminhos = [];
  for (const l of corpo.split(/\r?\n/)) {
    if (/URL final/i.test(l) && !/sufixo/i.test(l)) {
      const cs = /^\s*\|/.test(l) ? celulas(l).slice(1) : [l.slice(l.search(/URL final/i))];
      for (const c of cs) {
        for (const m of c.matchAll(/(https?:\/\/[^\s`,)|]+)|`?(TODO[^`|]*)`?/g)) {
          if (m[1]) urlsFinais.push({ url: m[1].replace(/[.;]$/, '') });
          else urlsFinais.push({ todo: m[2].trim() });
        }
      }
    }
    if (/caminho/i.test(l)) {
      for (const t of crases(l)) if (/^\/[^\s]+$/.test(t) && !/https?:/.test(t)) caminhos.push(t.split('/').filter(Boolean));
    }
  }
  const c = dados?.campanha ?? {};
  if (typeof c.url_final === 'string') urlsFinais.push(/^https?:/.test(c.url_final) ? { url: c.url_final } : { todo: c.url_final });
  if (Array.isArray(c.caminho)) caminhos.push(c.caminho.map(String));

  // Telefones: frontmatter + números PT (9 algarismos) na secção do recurso de chamada / no corpo
  const telefones = new Set();
  if (c.telefone) telefones.add(String(c.telefone).replace(/\D/g, '').replace(/^351(?=\d{9}$)/, ''));
  for (const m of corpo.matchAll(/(?<![\d])(?:\+351\s?)?([29]\d{2}\s?\d{3}\s?\d{3})(?![\d])/g)) telefones.add(m[1].replace(/\s/g, ''));

  const unicos = (xs, chave) => [...new Map(xs.map((x) => [chave(x), x])).values()];
  return {
    dados, grupos, anuncios: [...anuncios.values()], textos, negativas, sitelinks, destaques, snippets,
    urlsFinais: unicos(urlsFinais, (x) => x.url ?? `TODO:${x.todo}`),
    caminhos: unicos(caminhos, (x) => x.join('/')),
    telefones: [...telefones],
  };
}

// Termos (entre crases ou aspas, ou linhas de bloco de código) FORA de tabelas numa secção de
// negativas: não se lêem como negativas (D-020) → o validador avisa. → [{ secao, n }]
export function negativasForaDeTabela(corpo) {
  const por = new Map();
  const h = [];
  let emCodigo = false;
  for (const l of corpo.split(/\r?\n/)) {
    if (/^\s*```/.test(l)) { emCodigo = !emCodigo; continue; }
    const t = !emCodigo && /^(#{1,6})\s+(.*)$/.exec(l);
    if (t) { h.length = t[1].length - 1; h[t[1].length - 1] = t[2].trim(); continue; }
    if (!h.some((x, n) => n <= 2 && x && /negativ/i.test(x)) || /^\s*\|/.test(l)) continue;
    const n = emCodigo ? (l.trim() ? 1 : 0)
      : crases(l).length + (l.replace(/`[^`]*`/g, '').match(/"[^"\n]+"|“[^”\n]+”/g) ?? []).length;
    if (!n) continue;
    const secao = h.filter(Boolean).at(-1);
    por.set(secao, (por.get(secao) ?? 0) + n);
  }
  return [...por].map(([secao, n]) => ({ secao, n }));
}

// A negativa bloqueia as pesquisas desta palavra-chave positiva? (as negativas não apanham plurais
// nem variantes; minúsculas). Ampla: todas as palavras da negativa estão na positiva. Expressão:
// a sequência está na positiva. Exacta: igual.
export function bloqueia(neg, positiva) {
  const p = positiva.toLowerCase().split(/\s+/).filter(Boolean);
  const n = neg.text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!n.length) return false;
  if (neg.matchType === 'BROAD') return n.every((w) => p.includes(w));
  if (neg.matchType === 'PHRASE') return ` ${p.join(' ')} `.includes(` ${n.join(' ')} `);
  return p.join(' ') === n.join(' ');
}

// ---------- Definições de máquina (frontmatter `campanha:`, D-020) ----------

const DIAS = { seg: 'MONDAY', ter: 'TUESDAY', qua: 'WEDNESDAY', qui: 'THURSDAY', sex: 'FRIDAY', sab: 'SATURDAY', 'sáb': 'SATURDAY', dom: 'SUNDAY' };
export const DIAS_API = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
export const LICITACOES = { 'maximizar-cliques': 'TARGET_SPEND', 'cpc-manual': 'MANUAL_CPC' };
const micros = (eur) => String(Math.round(Number(eur) * 100) * 10_000); // arredonda ao cêntimo

function lerHorario(h, onde, erros) {
  if (h === undefined || h === null) return null;
  const dias = (Array.isArray(h.dias) ? h.dias : []).map((d) => DIAS[String(d).toLowerCase()] ?? (DIAS_API.includes(String(d).toUpperCase()) ? String(d).toUpperCase() : null));
  const [ini, fim] = [Number(h.inicio), Number(h.fim)];
  if (!dias.length || dias.includes(null)) erros.push(`${onde}.dias: seg, ter, qua, qui, sex, sab, dom`);
  if (!Number.isInteger(ini) || !Number.isInteger(fim) || ini < 0 || fim > 24 || ini >= fim) erros.push(`${onde}: inicio e fim em horas inteiras, 0 ≤ inicio < fim ≤ 24`);
  return { dias: [...new Set(dias)], inicio: ini, fim };
}

// frontmatter.campanha → { valores, erros }. Nenhum valor por omissão para dinheiro nem geografia.
export function definicoes(c) {
  const erros = [];
  if (!c || typeof c !== 'object') return { valores: null, erros: ['frontmatter sem bloco `campanha:` (ver modelos/campanha-search.md)'] };
  const num = (k) => { const v = Number(c[k]); if (!(v > 0)) erros.push(`campanha.${k}: número > 0 em euros`); return v; };
  if (!/^[\p{L}\p{N}_\-. ]{3,120}$/u.test(String(c.nome ?? ''))) erros.push('campanha.nome em falta ou com caracteres fora de letras, algarismos, _ - . e espaço');
  const orcamento = num('orcamento_dia');
  const cpcMax = num('cpc_max');
  if (!LICITACOES[c.licitacao]) erros.push(`campanha.licitacao: ${Object.keys(LICITACOES).join(' ou ')}`);
  const localizacoes = (Array.isArray(c.localizacoes) ? c.localizacoes : []).map((l) => ({ id: String(l?.id ?? ''), nome: l?.nome ?? null }));
  if (!localizacoes.length || localizacoes.some((l) => !/^\d+$/.test(l.id))) erros.push('campanha.localizacoes: lista de { id: <geoTargetConstant>, nome: "<nome canónico>" }');
  const idiomas = (Array.isArray(c.idiomas) ? c.idiomas : []).map(String);
  if (!idiomas.length || idiomas.some((i) => !/^\d+$/.test(i))) erros.push('campanha.idiomas: lista de languageConstants (1014 = português)');
  if (!/^https:\/\//.test(String(c.url_final ?? ''))) erros.push('campanha.url_final: URL https');
  const caminho = Array.isArray(c.caminho) ? c.caminho.map(String) : [];
  const telefone = c.telefone ? String(c.telefone).replace(/\D/g, '').replace(/^351(?=\d{9}$)/, '') : null;
  if (telefone && !/^\d{9}$/.test(telefone)) erros.push('campanha.telefone: 9 algarismos (Portugal)');
  const horario = lerHorario(c.horario, 'campanha.horario', erros);
  const chamada = c.chamada ? lerHorario(c.chamada, 'campanha.chamada', erros) : null;
  if (chamada && !telefone) erros.push('campanha.chamada sem campanha.telefone');
  const listas = (Array.isArray(c.listas_negativas) ? c.listas_negativas : []).map(String);
  const cat = (xs) => (Array.isArray(xs) ? xs : []).map((x) => { const [categoria, origem] = String(x).toUpperCase().split('/'); return { categoria, origem: origem || null }; });
  const objectivos = { contar: cat(c.objectivos?.contar), naoContar: cat(c.objectivos?.nao_contar) };
  return {
    erros,
    valores: {
      nome: String(c.nome ?? ''), orcamento, orcamentoMicros: micros(orcamento), licitacao: c.licitacao,
      cpcMax, cpcMaxMicros: micros(cpcMax), localizacoes, idiomas, urlFinal: c.url_final, caminho,
      sufixo: c.sufixo_url ? String(c.sufixo_url) : null, telefone, horario, chamada, listas, objectivos,
    },
  };
}
