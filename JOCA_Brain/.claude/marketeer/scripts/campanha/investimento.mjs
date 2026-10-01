#!/usr/bin/env node
// `node "<MKT>/scripts/campanha/investimento.mjs" <cliente>` — tabela de investimento, SÓ LEITURA.
// É o que se mostra ao dono da conta ANTES de ele activar qualquer campanha (a activação é manual, fora do
// módulo — D-019).
//
//   node "<MKT>/scripts/campanha/investimento.mjs" <slug> [<nome|ficheiro.md>...] [--todas] [--login <id|mcc>]
//
// Sem especificação: campanhas da conta em pausa ou activas (--todas inclui as removidas com gasto).
// Com especificação(ões): só essas; a que ainda não existe na conta aparece com os valores da
// especificação e estado "por criar".
// Colunas: estado · orçamento diário · mensal (×30,4) · licitação · CPC máximo · horário ·
// CPC real dos últimos 12 meses (quando houve cliques).

import { readFileSync, existsSync } from 'node:fs';
import { eEntrada } from '../validar-dossier.mjs';
import { limparErro } from '../auditoria/limpar.mjs';
import { ligarApi, canaisDoDossier, customerIdDoDossier, ErroAds } from '../ads/api.mjs';
import { periodo } from '../ads/diagnostico.mjs';
import { definicoes, lerEspecificacao, DIAS_API } from './especificacao.mjs';
import { caminhoEspecificacao } from './criar.mjs';
import { raizDados } from '../raiz.mjs';

export const DIAS_POR_MES = 30.4;
const LICITACAO = {
  TARGET_SPEND: 'Maximizar cliques', MANUAL_CPC: 'CPC manual', MAXIMIZE_CONVERSIONS: 'Maximizar conversões',
  MAXIMIZE_CONVERSION_VALUE: 'Maximizar valor', TARGET_CPA: 'CPA alvo', TARGET_ROAS: 'ROAS alvo', TARGET_IMPRESSION_SHARE: 'Parcela de impressões',
};
const DIA_PT = { MONDAY: 'seg', TUESDAY: 'ter', WEDNESDAY: 'qua', THURSDAY: 'qui', FRIDAY: 'sex', SATURDAY: 'sáb', SUNDAY: 'dom' };
const euros = (m) => (Number(m ?? 0) || 0) / 1e6;
const din = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(2).replace('.', ',')} €`);

// [{ dia, inicio, fim }] → "seg–sex 08–20" / "todos os dias 08–23" / "sempre"
export function horarioTexto(blocos) {
  if (!blocos?.length) return 'sempre';
  const porHora = new Map();
  for (const b of blocos) {
    const k = `${String(b.inicio).padStart(2, '0')}–${String(b.fim).padStart(2, '0')}`;
    porHora.set(k, [...(porHora.get(k) ?? []), b.dia]);
  }
  return [...porHora].map(([h, dias]) => {
    const idx = [...new Set(dias)].map((d) => DIAS_API.indexOf(d)).sort((a, b) => a - b);
    const seguidos = idx.every((x, i) => i === 0 || x === idx[i - 1] + 1);
    const d = idx.length === 7 ? 'todos os dias' : seguidos && idx.length > 2 ? `${DIA_PT[DIAS_API[idx[0]]]}–${DIA_PT[DIAS_API[idx.at(-1)]]}` : idx.map((i) => DIA_PT[DIAS_API[i]]).join(', ');
    return `${d} ${h}`;
  }).join('; ');
}

export function linhaDaEspecificacao(texto) {
  const { valores: d, erros } = definicoes(lerEspecificacao(texto).dados?.campanha);
  if (erros.length) throw new ErroAds(`especificação sem definições válidas: ${erros.join('; ')}`);
  return {
    nome: d.nome, id: '—', estado: 'por criar', orcamentoDia: d.orcamento,
    licitacao: d.licitacao === 'cpc-manual' ? 'CPC manual' : 'Maximizar cliques', cpcMax: d.cpcMax,
    horario: d.horario ? horarioTexto(d.horario.dias.map((dia) => ({ dia, inicio: d.horario.inicio, fim: d.horario.fim }))) : 'sempre',
    cpcReal: null, cliques: 0,
  };
}

export function tabela(linhas) {
  const cab = ['Campanha', 'ID', 'Estado', 'Orçamento/dia', 'Mensal (×30,4)', 'Licitação', 'CPC máx.', 'Horário', 'CPC real 12m'];
  const tot = linhas.reduce((t, l) => t + l.orcamentoDia, 0);
  return [
    `| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`,
    ...linhas.map((l) => `| ${[l.nome, l.id, l.estado, din(l.orcamentoDia), din(l.orcamentoDia * DIAS_POR_MES), l.licitacao, l.cpcMax ? din(l.cpcMax) : l.licitacao === 'Maximizar cliques' ? 'sem teto ⚠' : '—', l.horario, l.cliques ? `${din(l.cpcReal)} (${l.cliques} cliques)` : 'sem histórico'].join(' | ')} |`),
    '',
    `Total se todas estiverem activas: ${din(tot)}/dia · ${din(tot * DIAS_POR_MES)}/mês (teto: a Google pode gastar até 2× o diário num dia, mas não passa de 30,4× no mês).`,
  ].join('\n');
}

export async function investimento(slug, { especificacoes = [], todas = false, raiz = raizDados(), login, obter = globalThis.fetch, hoje = new Date(), ligar = ligarApi } = {}) {
  const customerId = customerIdDoDossier(canaisDoDossier(raiz, slug));
  if (!customerId) throw new ErroAds(`o dossier de ${slug} não tem canal google-ads com customer_id de 10 algarismos`);
  const daEspecificacao = especificacoes.map((nome) => {
    const f = caminhoEspecificacao(raiz, slug, nome);
    if (!existsSync(f)) throw new ErroAds(`especificação não encontrada: ${f}`);
    return linhaDaEspecificacao(readFileSync(f, 'utf8'));
  });
  const api = await ligar({ slug, customerId, login, obter });
  const per = periodo(hoje);
  const campanhas = await api.gaql("SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type, campaign.target_spend.cpc_bid_ceiling_micros, campaign_budget.amount_micros FROM campaign WHERE campaign.status != 'REMOVED'");
  const metricas = new Map((await api.gaql(`SELECT campaign.id, metrics.clicks, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${per.de}' AND '${per.ate}'`))
    .map((x) => [String(x.campaign.id), { cliques: Number(x.metrics?.clicks ?? 0), custo: euros(x.metrics?.costMicros) }]));
  const horarios = new Map();
  for (const x of await api.gaql("SELECT campaign.id, campaign_criterion.ad_schedule.day_of_week, campaign_criterion.ad_schedule.start_hour, campaign_criterion.ad_schedule.end_hour FROM campaign_criterion WHERE campaign_criterion.type = 'AD_SCHEDULE' AND campaign.status != 'REMOVED'")) {
    const id = String(x.campaign.id);
    const s = x.campaignCriterion.adSchedule;
    horarios.set(id, [...(horarios.get(id) ?? []), { dia: s.dayOfWeek, inicio: s.startHour ?? 0, fim: s.endHour ?? 24 }]);
  }
  const lances = new Map();
  for (const x of await api.gaql("SELECT campaign.id, ad_group.cpc_bid_micros FROM ad_group WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED' AND campaign.bidding_strategy_type = 'MANUAL_CPC'")) {
    const id = String(x.campaign.id);
    lances.set(id, Math.max(lances.get(id) ?? 0, euros(x.adGroup?.cpcBidMicros)));
  }
  const daConta = campanhas.map((x) => {
    const c = x.campaign;
    const id = String(c.id);
    const m = metricas.get(id) ?? { cliques: 0, custo: 0 };
    const teto = euros(c.targetSpend?.cpcBidCeilingMicros) || lances.get(id) || null;
    return {
      nome: c.name, id, estado: c.status === 'ENABLED' ? 'ACTIVA' : c.status === 'PAUSED' ? 'em pausa' : c.status,
      orcamentoDia: euros(x.campaignBudget?.amountMicros), licitacao: LICITACAO[c.biddingStrategyType] ?? c.biddingStrategyType,
      cpcMax: teto, horario: horarioTexto(horarios.get(id)), cliques: m.cliques, cpcReal: m.cliques ? m.custo / m.cliques : null,
    };
  });
  let linhas;
  if (daEspecificacao.length) {
    linhas = daEspecificacao.map((e) => daConta.find((c) => c.nome === e.nome) ?? e);
  } else {
    linhas = daConta.filter((c) => todas || c.estado === 'ACTIVA' || c.estado === 'em pausa')
      .sort((a, b) => (a.estado === 'ACTIVA' ? 0 : 1) - (b.estado === 'ACTIVA' ? 0 : 1) || b.orcamentoDia - a.orcamentoDia || a.nome.localeCompare(b.nome));
  }
  const nActivas = daConta.filter((c) => c.estado === 'ACTIVA').length;
  return {
    linhas,
    texto: [
      `Investimento Google Ads — ${slug} (conta ${customerId}) · CPC real: ${per.de} a ${per.ate} · só leitura`,
      `Campanhas activas na conta agora: ${nActivas}`,
      '',
      tabela(linhas),
      '',
      'Activar é manual e fora do marketeer: só depois de o dono da conta rever esta tabela.',
    ].join('\n'),
  };
}

if (eEntrada(import.meta.url)) {
  const args = process.argv.slice(2);
  const valor = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const livres = args.filter((a, j) => !a.startsWith('--') && args[j - 1] !== '--login');
  try {
    if (!livres[0]) throw new Error('uso: node "<MKT>/scripts/campanha/investimento.mjs" <slug> [<nome|ficheiro.md>...] [--todas] [--login <id|mcc>]');
    const { texto } = await investimento(livres[0], { especificacoes: livres.slice(1), todas: args.includes('--todas'), login: valor('--login') });
    console.log(texto);
  } catch (e) {
    console.error(`✗ ${limparErro(e.message, 400)}`);
    process.exit(1);
  }
}
