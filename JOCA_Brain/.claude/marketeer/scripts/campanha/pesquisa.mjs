#!/usr/bin/env node
// `node "<MKT>/scripts/campanha/pesquisa.mjs" <cliente>` — pesquisa de palavras-chave SÓ DE LEITURA.
//
//   node "<MKT>/scripts/campanha/pesquisa.mjs" <slug> --sementes "a,b,c" [--campanha <texto>] [--meses 12]
//        [--geo 2620,...] [--idioma 1014] [--login <id|mcc>]
//
// 1. Tenta o Planeador (KeywordPlanIdeaService.generateKeywordIdeas) com as sementes. Com acesso
//    Explorer a Google responde 403 DEVELOPER_TOKEN_NOT_APPROVED: o relatório di-lo e continua só
//    com o histórico. NUNCA se inventam volumes: sem Planeador não há coluna de volume.
// 2. Histórico real da conta (search_term_view, N meses até ontem, campanhas filtradas por
//    --campanha): termos com gasto e conversões, termos que gastaram sem converter, e por semente
//    os termos que a contêm → proposta de palavras-chave (expressão + exacta) e de negativas
//    (palavras dos termos sem conversão que não aparecem em termos que converteram nem nas sementes).
// Grava clientes/<slug>/campanhas/pesquisa-<AAAA-MM-DD>[-N].md (nunca sobrescreve).

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { eEntrada } from '../validar-dossier.mjs';
import { dataLocal } from '../criar-dossier.mjs';
import { limparErro } from '../auditoria/limpar.mjs';
import { ligarApi, canaisDoDossier, customerIdDoDossier, ErroAds } from '../ads/api.mjs';
import { raizDados } from '../raiz.mjs';

const TOPO = 40;
const PALAVRAS_VAZIAS = new Set('a o as os de do da dos das e em no na nos nas um uma uns umas para por com que se ao aos à às ou the of for'.split(' '));

const n = (v) => Number(v ?? 0) || 0;
const euros = (micros) => n(micros) / 1e6;
// Só para comparar (acentos e maiúsculas); o texto mostrado é sempre o original.
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const palavras = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
const contem = (termo, semente) => ` ${palavras(termo).join(' ')} `.includes(` ${palavras(semente).join(' ')} `);

export function periodo(hoje = new Date(), meses = 12) {
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
  const inicio = new Date(hoje); inicio.setMonth(inicio.getMonth() - meses);
  return { de: dataLocal(inicio), ate: dataLocal(ontem) };
}

// Planeador → { ideias } ou { recusado: motivo }. Nunca lança por falta de acesso.
export async function ideiasDoPlaneador(api, sementes, { geo = ['2620'], idioma = '1014' } = {}) {
  try {
    const r = await api.chamar(':generateKeywordIdeas', {
      language: `languageConstants/${idioma}`,
      geoTargetConstants: geo.map((g) => `geoTargetConstants/${g}`),
      keywordPlanNetwork: 'GOOGLE_SEARCH',
      keywordSeed: { keywords: sementes },
    });
    return {
      ideias: (r.results ?? []).map((x) => ({
        texto: x.text,
        volume: x.keywordIdeaMetrics?.avgMonthlySearches ?? null,
        concorrencia: x.keywordIdeaMetrics?.competition ?? null,
        lanceBaixo: x.keywordIdeaMetrics?.lowTopOfPageBidMicros ? euros(x.keywordIdeaMetrics.lowTopOfPageBidMicros) : null,
        lanceAlto: x.keywordIdeaMetrics?.highTopOfPageBidMicros ? euros(x.keywordIdeaMetrics.highTopOfPageBidMicros) : null,
      })),
    };
  } catch (e) {
    if (!(e instanceof ErroAds)) throw e;
    const explorer = e.codigos?.includes('DEVELOPER_TOKEN_NOT_APPROVED');
    return { recusado: explorer ? 'DEVELOPER_TOKEN_NOT_APPROVED (acesso Explorer do token de programador)' : limparErro(e.message, 200) };
  }
}

// Linhas de search_term_view → termos agregados (o mesmo termo em várias campanhas soma-se).
export function agregarTermos(linhas, filtroCampanha) {
  const f = filtroCampanha ? norm(filtroCampanha) : null;
  const m = new Map();
  for (const x of linhas) {
    if (f && !norm(x.campaign?.name).includes(f)) continue;
    const termo = x.searchTermView?.searchTerm;
    if (!termo) continue;
    const a = m.get(termo) ?? { termo, campanhas: new Set(), impressoes: 0, cliques: 0, custo: 0, conversoes: 0 };
    a.campanhas.add(x.campaign?.name);
    a.impressoes += n(x.metrics?.impressions); a.cliques += n(x.metrics?.clicks);
    a.custo += euros(x.metrics?.costMicros); a.conversoes += n(x.metrics?.conversions);
    m.set(termo, a);
  }
  return [...m.values()].sort((a, b) => b.custo - a.custo || a.termo.localeCompare(b.termo));
}

const somar = (ts) => ts.reduce((t, x) => ({ impressoes: t.impressoes + x.impressoes, cliques: t.cliques + x.cliques, custo: t.custo + x.custo, conversoes: t.conversoes + x.conversoes }), { impressoes: 0, cliques: 0, custo: 0, conversoes: 0 });

// → { porSemente, convertem, semConversao, negativas }
export function propor(termos, sementes) {
  const convertem = termos.filter((t) => t.conversoes > 0);
  const semConversao = termos.filter((t) => t.conversoes === 0 && t.custo > 0);
  const porSemente = sementes.map((s) => {
    const ts = termos.filter((t) => contem(t.termo, s));
    return { semente: s, termos: ts, ...somar(ts) };
  });
  // Negativas candidatas: palavras dos termos sem conversão, fora das sementes e dos termos que
  // converteram, ordenadas pelo custo dos termos onde aparecem.
  const protegidas = new Set([...sementes.flatMap(palavras), ...convertem.flatMap((t) => palavras(t.termo))]);
  const porPalavra = new Map();
  for (const t of semConversao) {
    // chave = a palavra como foi pesquisada (com acentos): uma negativa não apanha variantes
    for (const w of new Set(t.termo.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean))) {
      if (protegidas.has(norm(w)) || PALAVRAS_VAZIAS.has(w) || w.length < 2 || /^\d+$/.test(w)) continue;
      const a = porPalavra.get(w) ?? { palavra: w, termos: 0, custo: 0, cliques: 0, exemplo: t.termo };
      a.termos++; a.custo += t.custo; a.cliques += t.cliques;
      porPalavra.set(w, a);
    }
  }
  const negativas = [...porPalavra.values()].sort((a, b) => b.custo - a.custo || b.termos - a.termos);
  return { porSemente, convertem, semConversao, negativas };
}

const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const tabela = (cab, linhas) => (linhas.length
  ? [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...linhas.map((l) => `| ${l.map(esc).join(' | ')} |`)].join('\n')
  : '_sem dados no período_');
const din = (v) => `${v.toFixed(2)} €`;
const cpc = (t) => (t.cliques ? din(t.custo / t.cliques) : '—');

export function relatorio({ slug, conta, per, filtro, sementes, planeador, prop, termos }) {
  const tot = somar(termos);
  return [
    `# Pesquisa de palavras-chave — ${slug}`,
    '',
    `Conta ${conta} · período ${per.de} a ${per.ate}${filtro ? ` · campanhas com "${filtro}" no nome` : ' · todas as campanhas'} · gerado por scripts/campanha/pesquisa.mjs (só leitura)`,
    `Sementes: ${sementes.map((s) => `\`${s}\``).join(', ') || '—'}`,
    '',
    '## 1. Planeador de palavras-chave (Google)',
    '',
    planeador.recusado
      ? `**Recusado:** ${planeador.recusado}. Este relatório **não tem volumes de pesquisa, concorrência nem lances da Google**: usa só o histórico real da conta. Antes de criar a campanha, passar as palavras propostas pelo Planeador na interface.`
      : tabela(['Ideia', 'Pesquisas/mês (Google)', 'Concorrência', 'Lance topo (baixo)', 'Lance topo (alto)'],
        planeador.ideias.slice(0, 100).map((i) => [i.texto, i.volume ?? '—', i.concorrencia ?? '—', i.lanceBaixo === null ? '—' : din(i.lanceBaixo), i.lanceAlto === null ? '—' : din(i.lanceAlto)])),
    '',
    '## 2. Histórico da conta',
    '',
    `${termos.length} termos de pesquisa com impressões visíveis: ${tot.impressoes} impressões, ${tot.cliques} cliques, ${din(tot.custo)}, ${tot.conversoes.toFixed(1)} conversões.`,
    'A Google só mostra os termos com volume suficiente. **Impressões da conta não são volume de pesquisa**: são as vezes que o anúncio apareceu, com a parcela de impressões que a conta tinha. Servem para comparar temas entre si.',
    '',
    '### 2.1 Por semente (termos que contêm a semente)',
    '',
    tabela(['Semente', 'Termos', 'Impr.', 'Cliques', 'Custo', 'CPC real', 'Conv.', 'Proposta'],
      prop.porSemente.map((s) => [s.semente, s.termos.length, s.impressoes, s.cliques, din(s.custo), cpc(s), s.conversoes.toFixed(1),
        s.termos.length ? `"${s.semente}" + [${s.semente}]` : 'sem histórico — validar no Planeador'])),
    '',
    `### 2.2 Termos que converteram (top ${TOPO} por conversões)`,
    '',
    'Candidatos a palavra-chave exacta **se** a intenção for comercial. Conversão não prova lead qualificado: ler o termo.',
    '',
    tabela(['Termo', 'Conv.', 'Cliques', 'Custo', 'CPC real'],
      [...prop.convertem].sort((a, b) => b.conversoes - a.conversoes || b.custo - a.custo).slice(0, TOPO).map((t) => [t.termo, t.conversoes.toFixed(1), t.cliques, din(t.custo), cpc(t)])),
    '',
    `### 2.3 Termos que gastaram sem converter (top ${TOPO} por custo, de ${prop.semConversao.length})`,
    '',
    tabela(['Termo', 'Cliques', 'Custo', 'Campanha(s)'],
      prop.semConversao.slice(0, TOPO).map((t) => [t.termo, t.cliques, din(t.custo), [...t.campanhas].join(', ')])),
    '',
    `## 3. Negativas candidatas (top ${TOPO} por custo)`,
    '',
    'Palavras que aparecem em termos com gasto e 0 conversões e **nunca** num termo que converteu nem nas sementes. Rever uma a uma antes de usar: uma palavra solta em correspondência ampla negativa bloqueia todas as pesquisas que a tenham.',
    '',
    tabela(['Palavra', 'Termos', 'Cliques', 'Custo', 'Exemplo'],
      prop.negativas.slice(0, TOPO).map((w) => [`\`${w.palavra}\``, w.termos, w.cliques, din(w.custo), w.exemplo])),
    '',
  ].join('\n');
}

export async function pesquisar(slug, { sementes = [], campanha, meses = 12, geo, idioma, raiz = raizDados(), login, obter = globalThis.fetch, hoje = new Date(), ligar = ligarApi } = {}) {
  const customerId = customerIdDoDossier(canaisDoDossier(raiz, slug));
  if (!customerId) throw new ErroAds(`o dossier de ${slug} não tem canal google-ads com customer_id de 10 algarismos`);
  const api = await ligar({ slug, customerId, login, obter });
  const planeador = sementes.length ? await ideiasDoPlaneador(api, sementes, { geo, idioma }) : { recusado: 'sem sementes — não se pediu' };
  const per = periodo(hoje, meses);
  const linhas = await api.gaql(`SELECT search_term_view.search_term, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE segments.date BETWEEN '${per.de}' AND '${per.ate}' AND metrics.impressions > 0`);
  const termos = agregarTermos(linhas, campanha);
  const prop = propor(termos, sementes);
  const texto = relatorio({ slug, conta: customerId, per, filtro: campanha, sementes, planeador, prop, termos });

  const pasta = join(raiz, 'clientes', slug, 'campanhas');
  mkdirSync(pasta, { recursive: true });
  for (let i = 1; ; i++) {
    const caminho = join(pasta, `pesquisa-${dataLocal(hoje)}${i === 1 ? '' : `-${i}`}.md`);
    try { writeFileSync(caminho, texto, { flag: 'wx' }); } catch (e) { if (e.code === 'EEXIST') continue; throw e; }
    const resumo = [
      `Pesquisa de ${slug} — conta ${customerId}, ${per.de} a ${per.ate}`,
      `Gravado em ${relative(raiz, caminho)}`,
      planeador.recusado ? `Planeador: recusado — ${planeador.recusado}. Sem volumes da Google: só histórico.` : `Planeador: ${planeador.ideias.length} ideias com volume da Google`,
      `${termos.length} termos · ${prop.convertem.length} converteram · ${prop.semConversao.length} gastaram sem converter (${din(somar(prop.semConversao).custo)})`,
      ...prop.porSemente.map((s) => `  - ${s.semente}: ${s.termos.length} termos, ${s.cliques} cliques, CPC ${cpc(s)}, ${s.conversoes.toFixed(1)} conv.`),
      `Negativas candidatas: ${prop.negativas.slice(0, 10).map((w) => w.palavra).join(', ') || '—'}`,
    ].join('\n');
    return { caminho, resumo, planeador, prop };
  }
}

if (eEntrada(import.meta.url)) {
  const args = process.argv.slice(2);
  const COM_VALOR = ['--sementes', '--campanha', '--meses', '--geo', '--idioma', '--login'];
  const valor = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const livres = args.filter((a, j) => !a.startsWith('--') && !COM_VALOR.includes(args[j - 1]));
  try {
    if (!livres[0]) throw new Error('uso: node "<MKT>/scripts/campanha/pesquisa.mjs" <slug> --sementes "a,b" [--campanha <texto>] [--meses 12] [--geo 2620] [--idioma 1014] [--login mcc]');
    const lista = (v) => String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    const { resumo } = await pesquisar(livres[0], {
      sementes: lista(valor('--sementes')), campanha: valor('--campanha'), meses: Number(valor('--meses') ?? 12),
      geo: valor('--geo') ? lista(valor('--geo')) : undefined, idioma: valor('--idioma'), login: valor('--login'),
      ...(livres[1] ? { raiz: livres[1] } : {}),
    });
    console.log(resumo);
  } catch (e) {
    console.error(`✗ ${limparErro(e.message, 400)}`);
    process.exit(1);
  }
}
