#!/usr/bin/env node
// `node "<MKT>/scripts/ads/diagnostico.mjs" <cliente>` — diagnóstico SÓ DE LEITURA de uma conta Google Ads (D-008).
// Uso: node "<MKT>/scripts/ads/diagnostico.mjs" <slug> [--login <id|mcc>] [raiz]
//
// Lê por GAQL (12 meses até ontem): campanhas (custo, cliques, impressões, conversões, CPC,
// parcela de impressões), termos de pesquisa com gasto sem conversão, palavras-chave com índice
// de qualidade, landing pages (+ estado HTTP actual por GET), acções de conversão, objectivos por
// campanha e campanhas activas. Grava clientes/<slug>/ads/diagnostico-<AAAA-MM-DD>[-N].md
// (nunca sobrescreve) e imprime um resumo. Nenhum mutate.
//
//   diagnosticar(slug, { raiz, login, obter, hoje, ligar }) → { caminho, dados, resumo }

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { eEntrada } from '../validar-dossier.mjs';
import { dataLocal } from '../criar-dossier.mjs';
import { limparErro } from '../auditoria/limpar.mjs';
import { ligarApi, canaisDoDossier, customerIdDoDossier, ErroAds } from './api.mjs';
import { raizDados } from '../raiz.mjs';

const TOPO = 50;
const QS_BAIXO = 4;

export function periodo(hoje = new Date()) {
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
  const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 365);
  return { de: dataLocal(inicio), ate: dataLocal(ontem) };
}

const n = (v) => Number(v ?? 0) || 0;
const euros = (micros) => n(micros) / 1e6;

// GAQL não aceita OR: os filtros compostos fazem-se em JS depois da leitura.
export function consultas({ de, ate }) {
  const D = `segments.date BETWEEN '${de}' AND '${ate}'`;
  return {
    conta: 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.auto_tagging_enabled, customer.status FROM customer',
    campanhas: 'SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.experiment_type, campaign.bidding_strategy_type, campaign_budget.amount_micros FROM campaign',
    metricas: `SELECT campaign.id, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.average_cpc, metrics.search_impression_share FROM campaign WHERE ${D}`,
    termos: `SELECT search_term_view.search_term, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM search_term_view WHERE ${D} AND metrics.cost_micros > 0 ORDER BY metrics.cost_micros DESC`,
    palavras: "SELECT campaign.name, campaign.status, ad_group.name, ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ad_group_criterion.quality_info.quality_score, ad_group_criterion.quality_info.creative_quality_score, ad_group_criterion.quality_info.post_click_quality_score, ad_group_criterion.quality_info.search_predicted_ctr FROM keyword_view WHERE ad_group_criterion.status != 'REMOVED' AND campaign.status != 'REMOVED'",
    palavrasMetricas: `SELECT ad_group_criterion.resource_name, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM keyword_view WHERE ${D}`,
    landing: `SELECT landing_page_view.unexpanded_final_url, metrics.cost_micros, metrics.clicks, metrics.conversions FROM landing_page_view WHERE ${D}`,
    anuncios: "SELECT campaign.name, campaign.status, ad_group_ad.ad.final_urls FROM ad_group_ad WHERE ad_group_ad.status = 'ENABLED' AND campaign.status != 'REMOVED'",
    conversoes: "SELECT conversion_action.id, conversion_action.name, conversion_action.type, conversion_action.category, conversion_action.status, conversion_action.primary_for_goal, conversion_action.origin, conversion_action.counting_type FROM conversion_action WHERE conversion_action.status != 'REMOVED'",
    conversoesMetricas: `SELECT segments.conversion_action, metrics.all_conversions, metrics.conversions FROM campaign WHERE ${D}`,
    objectivos: "SELECT campaign.id, campaign.name, campaign.status, campaign_conversion_goal.category, campaign_conversion_goal.origin, campaign_conversion_goal.biddable FROM campaign_conversion_goal WHERE campaign.status != 'REMOVED'",
  };
}

// Estado HTTP actual de um URL (GET, segue redireccionamentos). Nunca lança.
export async function estadoHttp(url, obter) {
  try {
    const r = await obter(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    try { await r.body?.cancel?.(); } catch { /* sem corpo */ }
    return { status: r.status, final: r.redirected && r.url && r.url !== url ? r.url : null };
  } catch (e) {
    return { status: null, erro: limparErro(e?.cause?.code ?? e?.name ?? 'erro', 60) };
  }
}

// Agrega as linhas da API num objecto simples (sem I/O) — é o que o relatório e o resumo lêem.
export function agregar(l) {
  const conta = l.conta[0]?.customer ?? {};
  const met = new Map(l.metricas.map((x) => [String(x.campaign.id), x.metrics ?? {}]));
  const campanhas = l.campanhas.map((x) => {
    const m = met.get(String(x.campaign.id)) ?? {};
    return {
      id: String(x.campaign.id), nome: x.campaign.name, estado: x.campaign.status,
      canal: x.campaign.advertisingChannelType, experiencia: x.campaign.experimentType,
      licitacao: x.campaign.biddingStrategyType, orcamentoDia: euros(x.campaignBudget?.amountMicros),
      custo: euros(m.costMicros), cliques: n(m.clicks), impressoes: n(m.impressions),
      conversoes: n(m.conversions), cpc: euros(m.averageCpc),
      parcela: m.searchImpressionShare === undefined ? null : n(m.searchImpressionShare),
    };
  }).filter((c) => c.estado !== 'REMOVED' || c.impressoes > 0)
    .sort((a, b) => b.custo - a.custo || a.nome.localeCompare(b.nome));

  const termos = l.termos.map((x) => ({
    termo: x.searchTermView?.searchTerm, campanha: x.campaign?.name,
    custo: euros(x.metrics?.costMicros), cliques: n(x.metrics?.clicks), conversoes: n(x.metrics?.conversions),
  }));
  const semConversao = termos.filter((t) => t.conversoes === 0);

  const pm = new Map(l.palavrasMetricas.map((x) => [x.adGroupCriterion?.resourceName, x.metrics ?? {}]));
  const palavras = l.palavras.map((x) => {
    const q = x.adGroupCriterion?.qualityInfo ?? {};
    const m = pm.get(x.adGroupCriterion?.resourceName) ?? {};
    return {
      campanha: x.campaign?.name, estadoCampanha: x.campaign?.status, grupo: x.adGroup?.name,
      texto: x.adGroupCriterion?.keyword?.text, correspondencia: x.adGroupCriterion?.keyword?.matchType,
      estado: x.adGroupCriterion?.status, qs: q.qualityScore ?? null,
      anuncio: q.creativeQualityScore ?? null, landing: q.postClickQualityScore ?? null, ctr: q.searchPredictedCtr ?? null,
      custo: euros(m.costMicros), cliques: n(m.clicks), conversoes: n(m.conversions),
    };
  }).sort((a, b) => (a.qs ?? 99) - (b.qs ?? 99) || b.custo - a.custo);

  const porAccao = new Map();
  for (const x of l.conversoesMetricas) {
    const k = x.segments?.conversionAction;
    porAccao.set(k, (porAccao.get(k) ?? 0) + n(x.metrics?.allConversions));
  }
  const conversoes = l.conversoes.map((x) => {
    const c = x.conversionAction;
    return {
      nome: c.name, tipo: c.type, categoria: c.category, estado: c.status, principal: !!c.primaryForGoal,
      origem: c.origin, contagem: c.countingType,
      total: porAccao.get(`customers/${conta.id}/conversionActions/${c.id}`) ?? 0,
    };
  });

  const objectivos = l.objectivos.map((x) => ({
    campanhaId: String(x.campaign.id), campanha: x.campaign.name, estado: x.campaign.status,
    categoria: x.campaignConversionGoal.category, origem: x.campaignConversionGoal.origin,
    conta: !!x.campaignConversionGoal.biddable,
  }));

  return { conta, campanhas, termos, semConversao, palavras, conversoes, objectivos };
}

export function landingPages(l) {
  const urls = new Map();
  for (const x of l.landing) {
    const u = x.landingPageView?.unexpandedFinalUrl;
    if (!u) continue;
    const a = urls.get(u) ?? { url: u, custo: 0, cliques: 0, conversoes: 0, anuncioActivo: false };
    a.custo += euros(x.metrics?.costMicros); a.cliques += n(x.metrics?.clicks); a.conversoes += n(x.metrics?.conversions);
    urls.set(u, a);
  }
  for (const x of l.anuncios) {
    for (const u of x.adGroupAd?.ad?.finalUrls ?? []) {
      const a = urls.get(u) ?? { url: u, custo: 0, cliques: 0, conversoes: 0, anuncioActivo: false };
      a.anuncioActivo = true;
      urls.set(u, a);
    }
  }
  return [...urls.values()].sort((a, b) => b.custo - a.custo || a.url.localeCompare(b.url));
}

export function sinais(d, moeda) {
  const s = [];
  const activas = d.campanhas.filter((c) => c.estado === 'ENABLED');
  s.push(`${activas.length} campanha(s) activa(s)${activas.length ? `: ${activas.map((c) => c.nome).join(', ')}` : ''}`);
  const exp = activas.filter((c) => c.experiencia === 'EXPERIMENT');
  if (exp.length) s.push(`${exp.length} campanha(s) de experiência activa(s) (não se pausam; termina-se a experiência): ${exp.map((c) => c.nome).join(', ')}`);
  const gastoTermos = d.termos.reduce((t, x) => t + x.custo, 0);
  const perdido = d.semConversao.reduce((t, x) => t + x.custo, 0);
  if (gastoTermos > 0) s.push(`termos de pesquisa sem conversão: ${perdido.toFixed(2)} ${moeda} de ${gastoTermos.toFixed(2)} ${moeda} (${Math.round((perdido / gastoTermos) * 100)}%) em ${d.semConversao.length} termos`);
  const lpMas = d.landing.filter((x) => x.status === null || x.status >= 400);
  if (lpMas.length) s.push(`${lpMas.length} landing page(s) com erro agora: ${lpMas.map((x) => `${x.url} (${x.status ?? x.erro})`).join(', ')}`);
  const qsBaixo = d.palavras.filter((p) => p.estado === 'ENABLED' && p.qs !== null && p.qs <= QS_BAIXO);
  if (qsBaixo.length) s.push(`${qsBaixo.length} palavra(s)-chave activa(s) com índice de qualidade ≤ ${QS_BAIXO}`);
  const semObjectivo = activas.filter((c) => !d.objectivos.some((o) => o.campanhaId === c.id && o.conta));
  if (semObjectivo.length) s.push(`${semObjectivo.length} campanha(s) activa(s) sem nenhum objectivo de conversão a contar: ${semObjectivo.map((c) => c.nome).join(', ')}`);
  const principaisMortas = d.conversoes.filter((c) => c.estado === 'ENABLED' && c.principal && c.total === 0);
  if (principaisMortas.length) s.push(`${principaisMortas.length} acção(ões) de conversão principal(is) sem nenhuma conversão em 12 meses: ${principaisMortas.map((c) => c.nome).join(', ')}`);
  return s;
}

const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const tabela = (cab, linhas) => linhas.length
  ? [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...linhas.map((l) => `| ${l.map(esc).join(' | ')} |`)].join('\n')
  : '_sem dados no período_';
const pct = (v) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);

export function relatorio(slug, per, d) {
  const moeda = d.conta.currencyCode ?? '';
  const din = (v) => `${v.toFixed(2)} ${moeda}`;
  const comQs = d.palavras.filter((p) => p.qs !== null || p.custo > 0);
  const tot = d.campanhas.reduce((t, c) => ({ custo: t.custo + c.custo, cliques: t.cliques + c.cliques, conv: t.conv + c.conversoes }), { custo: 0, cliques: 0, conv: 0 });
  return [
    `# Diagnóstico Google Ads — ${slug}`,
    '',
    `Conta ${d.conta.id} (${d.conta.descriptiveName ?? 'sem nome'}) · ${moeda} · ${d.conta.timeZone ?? ''} · auto-tagging: ${d.conta.autoTaggingEnabled ? 'sim' : 'não'}`,
    `Período: ${per.de} a ${per.ate} · Google Ads API (GAQL), só leitura · gerado por scripts/ads/diagnostico.mjs`,
    '',
    `Total: ${din(tot.custo)} · ${tot.cliques} cliques · ${tot.conv.toFixed(1)} conversões`,
    '',
    '## Sinais',
    '',
    ...sinais(d, moeda).map((s) => `- ${s}`),
    '',
    '## Campanhas (12 meses)',
    '',
    tabela(['Campanha', 'ID', 'Estado', 'Tipo', 'Licitação', 'Orçamento/dia', 'Custo', 'Cliques', 'Impr.', 'Conv.', 'CPC médio', 'Parcela impr.'],
      d.campanhas.map((c) => [c.nome, c.id, c.estado + (c.experiencia === 'EXPERIMENT' ? ' (experiência)' : ''), c.canal, c.licitacao, din(c.orcamentoDia), din(c.custo), c.cliques, c.impressoes, c.conversoes.toFixed(1), din(c.cpc), pct(c.parcela)])),
    '',
    `## Termos de pesquisa com gasto e sem conversão (top ${TOPO} por custo, de ${d.semConversao.length})`,
    '',
    tabela(['Termo', 'Campanha', 'Custo', 'Cliques'], d.semConversao.slice(0, TOPO).map((t) => [t.termo, t.campanha, din(t.custo), t.cliques])),
    '',
    '## Palavras-chave e índice de qualidade (pior primeiro)',
    '',
    `Só as que têm índice de qualidade ou gasto no período (${d.palavras.length - comQs.length} sem nenhum dos dois omitidas).`,
    '',
    tabela(['Palavra-chave', 'Corresp.', 'Estado', 'Campanha / grupo', 'QS', 'Anúncio', 'Landing', 'CTR prev.', 'Custo', 'Conv.'],
      comQs.map((p) => [p.texto, p.correspondencia, p.estado, `${p.campanha} / ${p.grupo}`, p.qs ?? '—', p.anuncio ?? '—', p.landing ?? '—', p.ctr ?? '—', din(p.custo), p.conversoes.toFixed(1)])),
    '',
    '## Landing pages (estado HTTP agora)',
    '',
    tabela(['URL', 'HTTP', 'Redirecciona para', 'Anúncio activo', 'Custo', 'Cliques', 'Conv.'],
      d.landing.map((x) => [x.url, x.status ?? `erro (${x.erro})`, x.final ?? '', x.anuncioActivo ? 'sim' : 'não', din(x.custo), x.cliques, x.conversoes.toFixed(1)])),
    '',
    '## Acções de conversão',
    '',
    tabela(['Nome', 'Categoria', 'Tipo', 'Origem', 'Estado', 'Principal', 'Contagem', 'Conversões 12m'],
      d.conversoes.map((c) => [c.nome, c.categoria, c.tipo, c.origem, c.estado, c.principal ? 'sim' : 'não', c.contagem, c.total.toFixed(1)])),
    '',
    '## Objectivos de conversão por campanha',
    '',
    tabela(['Campanha', 'Estado', 'Categoria', 'Origem', 'Conta para licitação'],
      d.objectivos.map((o) => [o.campanha, o.estado, o.categoria, o.origem, o.conta ? 'sim' : 'não'])),
    '',
    '## Campanhas activas',
    '',
    tabela(['Campanha', 'ID', 'Tipo', 'Orçamento/dia', 'Licitação'],
      d.campanhas.filter((c) => c.estado === 'ENABLED').map((c) => [c.nome, c.id, c.canal, din(c.orcamentoDia), c.licitacao])),
    '',
  ].join('\n');
}

export async function diagnosticar(slug, { raiz = raizDados(), login, obter = globalThis.fetch, hoje = new Date(), ligar = ligarApi } = {}) {
  const customerId = customerIdDoDossier(canaisDoDossier(raiz, slug));
  if (!customerId) throw new ErroAds(`o dossier de ${slug} não tem canal google-ads com customer_id de 10 algarismos`);
  const api = await ligar({ slug, customerId, login, obter });
  const per = periodo(hoje);
  const q = consultas(per);
  const l = {};
  for (const [k, query] of Object.entries(q)) l[k] = await api.gaql(query); // em série: rede instável
  const d = agregar(l);
  d.landing = landingPages(l);
  for (const x of d.landing) Object.assign(x, await estadoHttp(x.url, obter));

  const texto = relatorio(slug, per, d);
  const pasta = join(raiz, 'clientes', slug, 'ads');
  mkdirSync(pasta, { recursive: true });
  const data = dataLocal(hoje);
  for (let i = 1; ; i++) {
    const caminho = join(pasta, `diagnostico-${data}${i === 1 ? '' : `-${i}`}.md`);
    try {
      writeFileSync(caminho, texto, { flag: 'wx' });
    } catch (e) {
      if (e.code === 'EEXIST') continue;
      throw e;
    }
    const moeda = d.conta.currencyCode ?? '';
    const tot = d.campanhas.reduce((t, c) => t + c.custo, 0);
    const resumo = [
      `Diagnóstico Google Ads de ${slug} — conta ${d.conta.id}, ${per.de} a ${per.ate}`,
      `Gravado em ${relative(raiz, caminho)}`,
      `Gasto: ${tot.toFixed(2)} ${moeda} em ${d.campanhas.filter((c) => c.custo > 0).length} campanha(s) com gasto`,
      ...sinais(d, moeda).map((s) => `  - ${s}`),
    ].join('\n');
    return { caminho, dados: d, resumo };
  }
}

if (eEntrada(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--login');
  const login = i >= 0 ? args[i + 1] : undefined;
  const livres = args.filter((a, j) => !a.startsWith('--') && args[j - 1] !== '--login');
  try {
    if (!livres[0]) throw new Error('uso: node "<MKT>/scripts/ads/diagnostico.mjs" <slug> [--login <id|mcc>] [raiz]');
    const { resumo } = await diagnosticar(livres[0], { login, ...(livres[1] ? { raiz: livres[1] } : {}) });
    console.log(resumo);
  } catch (e) {
    console.error(`✗ ${limparErro(e.message, 400)}`);
    process.exit(1);
  }
}
