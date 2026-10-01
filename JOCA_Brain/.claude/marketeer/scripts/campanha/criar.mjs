#!/usr/bin/env node
// `node "<MKT>/scripts/campanha/criar.mjs" <cliente> <nome>` — cria UMA campanha Search a partir da especificação
// clientes/<slug>/campanhas/<nome>.md, num só googleAds:mutate (IDs temporários, atómico).
//
//   node "<MKT>/scripts/campanha/criar.mjs" <slug> <nome|ficheiro.md> [--confirmar] [--login <id|mcc>]
//
// Sem --confirmar: valida a especificação, ensaia TUDO na API com validateOnly e confirma por GAQL
// que nada ficou criado. Com --confirmar: cria, aplica os objectivos de conversão e verifica por GAQL.
//
// REGRA: a campanha nasce SEMPRE em PAUSED — estado fixo no código (CAMPANHA_PAUSADA), e
// `garantirPausa` recusa o pedido se alguma operação criar ou alterar uma campanha noutro estado.
// Este script NÃO activa nada; activar é à mão, pelo dono da conta, depois de ver `campanha/investimento.mjs`.
//
// Idempotente: aborta se já existir campanha ou orçamento (não removidos) com o mesmo nome.
// Negativas: "…" = PHRASE, […] = EXACT, sem símbolos = BROAD. Recursos (sitelinks, destaques,
// snippets, chamada) reutilizam os que já existem na conta com o mesmo texto.

import { readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { eEntrada } from '../validar-dossier.mjs';
import { limparErro } from '../auditoria/limpar.mjs';
import { ligarApi, canaisDoDossier, customerIdDoDossier, ErroAds } from '../ads/api.mjs';
import { planearObjectivos } from '../ads/alterar.mjs';
import { lerEspecificacao, definicoes, bloqueia, mostrarPalavra } from './especificacao.mjs';
import { validar } from './validar.mjs';
import { raizDados } from '../raiz.mjs';

export const CAMPANHA_PAUSADA = 'PAUSED'; // único estado com que este módulo cria campanhas

const gaqlTexto = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
export const nomeOrcamento = (nome) => `${nome} · orçamento`;

// Especificação → plano (uma campanha). Erros de estrutura → lista (nada se envia).
export function plano(texto) {
  const e = lerEspecificacao(texto);
  const { valores: d, erros } = definicoes(e.dados?.campanha);
  const campanhas = [...new Set(e.grupos.map((g) => g.campanha))];
  if (campanhas.length !== 1) erros.push(`a especificação tem ${campanhas.length} campanhas (grupos ${e.grupos.map((g) => g.codigo).join(', ') || '—'}); \`criar\` cria uma por ficheiro`);
  if (!e.anuncios.length) erros.push('sem RSA');
  const variantes = new Set(e.anuncios.map((a) => a.variante).filter(Boolean));
  const snippets = e.snippets.filter((s) => s.cabecalho && s.valores.length);
  return {
    erros,
    p: d && {
      ...d,
      grupos: e.grupos,
      anuncios: e.anuncios.map((a) => ({ ...a, param: variantes.size ? a.variante.replace(/^RSA-/i, '').toLowerCase() : null })),
      negCampanha: e.negativas.filter((n) => n.nivel === 'campanha'),
      negGrupo: e.negativas.filter((n) => n.nivel === 'grupo'),
      sitelinks: e.sitelinks.filter((s) => s.url),
      destaques: [...new Set(e.destaques.map((x) => x.texto))],
      snippets,
    },
  };
}

// Recusa qualquer operação que crie/altere uma campanha fora de PAUSED.
export function garantirPausa(ops) {
  for (const o of ops) {
    const c = o.campaignOperation;
    if (!c) continue;
    if (c.update || c.remove) throw new ErroAds('operação recusada: `campanha/criar.mjs` não altera campanhas existentes');
    if (c.create?.status !== CAMPANHA_PAUSADA) throw new ErroAds(`operação recusada: campanha com estado ${c.create?.status} — só se cria em ${CAMPANHA_PAUSADA}`);
  }
  return ops;
}

const chaveSitelink = (s) => `SL|${s.texto}|${s.d1}|${s.d2}|${s.url}`;
const chaveChamada = (tel, h) => `CALL|PT|${tel}|${h ? h.dias.map((d) => `${d}${h.inicio}-${h.fim}`).sort().join(',') : ''}`;
const horarioOps = (h) => h.dias.map((d) => ({ dayOfWeek: d, startHour: h.inicio, startMinute: 'ZERO', endHour: h.fim, endMinute: 'ZERO' }));

// Plano → mutateOperations (sem I/O). existentes: Map chave→resourceName de recursos da conta.
// listas: [resourceName] das listas partilhadas a associar.
export function operacoes(p, cid, { existentes = new Map(), listas = [] } = {}) {
  let tmp = 0;
  const novo = (tipo) => `customers/${cid}/${tipo}/${--tmp}`;
  const ops = [];
  const orc = novo('campaignBudgets');
  ops.push({ campaignBudgetOperation: { create: { resourceName: orc, name: nomeOrcamento(p.nome), amountMicros: p.orcamentoMicros, deliveryMethod: 'STANDARD', explicitlyShared: false } } });
  const C = novo('campaigns');
  ops.push({ campaignOperation: { create: {
    resourceName: C, name: p.nome, status: CAMPANHA_PAUSADA, advertisingChannelType: 'SEARCH', campaignBudget: orc,
    networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
    ...(p.licitacao === 'cpc-manual' ? { manualCpc: { enhancedCpcEnabled: false } } : { targetSpend: { cpcBidCeilingMicros: p.cpcMaxMicros } }),
    geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE', negativeGeoTargetType: 'PRESENCE' },
    ...(p.sufixo ? { finalUrlSuffix: p.sufixo } : {}),
    assetAutomationSettings: [{ assetAutomationType: 'TEXT_ASSET_AUTOMATION', assetAutomationStatus: 'OPTED_OUT' }],
    containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
  } } });
  const crit = (create) => ops.push({ campaignCriterionOperation: { create: { campaign: C, ...create } } });
  for (const l of p.localizacoes) crit({ location: { geoTargetConstant: `geoTargetConstants/${l.id}` } });
  for (const i of p.idiomas) crit({ language: { languageConstant: `languageConstants/${i}` } });
  if (p.horario) for (const s of horarioOps(p.horario)) crit({ adSchedule: s });
  const vistas = new Set();
  for (const n of p.negCampanha) {
    const k = `${n.text.toLowerCase()}|${n.matchType}`;
    if (vistas.has(k)) continue;
    vistas.add(k);
    crit({ negative: true, keyword: { text: n.text, matchType: n.matchType } });
  }
  for (const l of listas) ops.push({ campaignSharedSetOperation: { create: { campaign: C, sharedSet: l } } });

  const G = {};
  for (const g of p.grupos) {
    G[g.codigo] = novo('adGroups');
    ops.push({ adGroupOperation: { create: {
      resourceName: G[g.codigo], name: `${g.codigo} · ${g.nome}`, campaign: C, status: 'ENABLED', type: 'SEARCH_STANDARD',
      ...(p.licitacao === 'cpc-manual' ? { cpcBidMicros: p.cpcMaxMicros } : {}),
      urlCustomParameters: [{ key: 'grupo', value: g.codigo.toLowerCase() }],
    } } });
    for (const k of g.palavras) ops.push({ adGroupCriterionOperation: { create: { adGroup: G[g.codigo], status: 'ENABLED', keyword: { text: k.text, matchType: k.matchType } } } });
  }
  for (const n of p.negGrupo) {
    if (!G[n.alvo]) throw new ErroAds(`negativa de grupo para ${n.alvo}, que não existe`);
    ops.push({ adGroupCriterionOperation: { create: { adGroup: G[n.alvo], negative: true, keyword: { text: n.text, matchType: n.matchType } } } });
  }
  for (const a of p.anuncios) {
    ops.push({ adGroupAdOperation: { create: { adGroup: G[a.grupo], status: 'ENABLED', ad: {
      finalUrls: [p.urlFinal],
      ...(a.param ? { urlCustomParameters: [{ key: 'rsa', value: a.param }] } : {}),
      responsiveSearchAd: {
        headlines: a.titulos.map((t) => ({ text: t.texto, ...(t.fixar ? { pinnedField: `HEADLINE_${t.fixar}` } : {}) })),
        descriptions: a.descricoes.map((t) => ({ text: t.texto, ...(t.fixar ? { pinnedField: `DESCRIPTION_${t.fixar}` } : {}) })),
        ...(p.caminho[0] ? { path1: p.caminho[0] } : {}), ...(p.caminho[1] ? { path2: p.caminho[1] } : {}),
      },
    } } } });
  }

  const recursos = { novos: {}, reutilizados: {} };
  const ligarRecurso = (chave, criar, tipo) => {
    let res = existentes.get(chave);
    if (res) recursos.reutilizados[tipo] = (recursos.reutilizados[tipo] ?? 0) + 1;
    else {
      res = novo('assets');
      ops.push({ assetOperation: { create: { resourceName: res, ...criar } } });
      existentes.set(chave, res);
      recursos.novos[tipo] = (recursos.novos[tipo] ?? 0) + 1;
    }
    ops.push({ campaignAssetOperation: { create: { campaign: C, asset: res, fieldType: tipo } } });
  };
  for (const s of p.sitelinks) ligarRecurso(chaveSitelink(s), { finalUrls: [s.url], sitelinkAsset: { linkText: s.texto, description1: s.d1, description2: s.d2 } }, 'SITELINK');
  for (const t of p.destaques) ligarRecurso(`CO|${t}`, { calloutAsset: { calloutText: t } }, 'CALLOUT');
  for (const s of p.snippets) ligarRecurso(`SN|${s.cabecalho}|${s.valores.join(';')}`, { structuredSnippetAsset: { header: s.cabecalho, values: s.valores } }, 'STRUCTURED_SNIPPET');
  if (p.telefone) {
    ligarRecurso(chaveChamada(p.telefone, p.chamada), { callAsset: { countryCode: 'PT', phoneNumber: p.telefone, ...(p.chamada ? { adScheduleTargets: horarioOps(p.chamada) } : {}) } }, 'CALL');
  }
  return { ops: garantirPausa(ops), recursos };
}

async function recursosExistentes(api) {
  const m = new Map();
  for (const x of await api.gaql("SELECT asset.resource_name, asset.final_urls, asset.sitelink_asset.link_text, asset.sitelink_asset.description1, asset.sitelink_asset.description2 FROM asset WHERE asset.type = 'SITELINK'")) {
    const s = x.asset.sitelinkAsset ?? {};
    m.set(chaveSitelink({ texto: s.linkText, d1: s.description1, d2: s.description2, url: (x.asset.finalUrls ?? [])[0] }), x.asset.resourceName);
  }
  for (const x of await api.gaql("SELECT asset.resource_name, asset.callout_asset.callout_text FROM asset WHERE asset.type = 'CALLOUT'")) m.set(`CO|${x.asset.calloutAsset?.calloutText}`, x.asset.resourceName);
  for (const x of await api.gaql("SELECT asset.resource_name, asset.structured_snippet_asset.header, asset.structured_snippet_asset.values FROM asset WHERE asset.type = 'STRUCTURED_SNIPPET'")) {
    m.set(`SN|${x.asset.structuredSnippetAsset?.header}|${(x.asset.structuredSnippetAsset?.values ?? []).join(';')}`, x.asset.resourceName);
  }
  for (const x of await api.gaql("SELECT asset.resource_name, asset.call_asset.country_code, asset.call_asset.phone_number, asset.call_asset.ad_schedule_targets FROM asset WHERE asset.type = 'CALL'")) {
    const c = x.asset.callAsset ?? {};
    const h = (c.adScheduleTargets ?? []).map((t) => `${t.dayOfWeek}${t.startHour}-${t.endHour}`).sort().join(',');
    m.set(`CALL|${c.countryCode}|${String(c.phoneNumber ?? '').replace(/\D/g, '')}|${h}`, x.asset.resourceName);
  }
  return m;
}

const existentesComNome = async (api, nome) => [
  ...(await api.gaql(`SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.name = ${gaqlTexto(nome)} AND campaign.status != 'REMOVED'`)).map((x) => `campanha "${x.campaign.name}" (${x.campaign.id}, ${x.campaign.status})`),
  ...(await api.gaql(`SELECT campaign_budget.id, campaign_budget.name FROM campaign_budget WHERE campaign_budget.name = ${gaqlTexto(nomeOrcamento(nome))} AND campaign_budget.status != 'REMOVED'`)).map((x) => `orçamento "${x.campaignBudget.name}" (${x.campaignBudget.id})`),
];

const activas = async (api) => new Set((await api.gaql("SELECT campaign.id FROM campaign WHERE campaign.status = 'ENABLED'")).map((x) => String(x.campaign.id)));

// Verificação GAQL da campanha criada → { linhas, ok }
export async function verificar(api, p, campanhaId, activasAntes) {
  const w = `campaign.id = ${campanhaId}`;
  const conta = async (q) => (await api.gaql(q)).length;
  const [c] = await api.gaql(`SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type, campaign.target_spend.cpc_bid_ceiling_micros, campaign.geo_target_type_setting.positive_geo_target_type, campaign.network_settings.target_search_network, campaign.network_settings.target_content_network, campaign_budget.amount_micros FROM campaign WHERE ${w}`);
  const geo = (await api.gaql(`SELECT campaign_criterion.location.geo_target_constant FROM campaign_criterion WHERE ${w} AND campaign_criterion.type = 'LOCATION' AND campaign_criterion.negative = FALSE`)).map((x) => x.campaignCriterion.location.geoTargetConstant.split('/').pop()).sort();
  const negC = new Set(p.negCampanha.map((n) => `${n.text.toLowerCase()}|${n.matchType}`)).size;
  const esperado = [
    ['estado', c?.campaign.status, CAMPANHA_PAUSADA],
    ['orçamento (micros)', c?.campaignBudget.amountMicros, p.orcamentoMicros],
    ['localização PRESENCE', c?.campaign.geoTargetTypeSetting?.positiveGeoTargetType, 'PRESENCE'],
    ['geo', geo.join(','), p.localizacoes.map((l) => l.id).sort().join(',')],
    ['parceiros/Display', `${!!c?.campaign.networkSettings?.targetSearchNetwork}/${!!c?.campaign.networkSettings?.targetContentNetwork}`, 'false/false'],
    ...(p.licitacao === 'cpc-manual' ? [] : [['CPC máximo (micros)', c?.campaign.targetSpend?.cpcBidCeilingMicros, p.cpcMaxMicros]]),
    ['grupos', await conta(`SELECT ad_group.id FROM ad_group WHERE ${w} AND ad_group.status != 'REMOVED'`), p.grupos.length],
    ['palavras-chave', await conta(`SELECT ad_group_criterion.criterion_id FROM ad_group_criterion WHERE ${w} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'`), p.grupos.reduce((t, g) => t + g.palavras.length, 0)],
    ['negativas de campanha', await conta(`SELECT campaign_criterion.criterion_id FROM campaign_criterion WHERE ${w} AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE`), negC],
    ['negativas de grupo', await conta(`SELECT ad_group_criterion.criterion_id FROM ad_group_criterion WHERE ${w} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = TRUE`), p.negGrupo.length],
    ['RSA', await conta(`SELECT ad_group_ad.ad.id FROM ad_group_ad WHERE ${w} AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD' AND ad_group_ad.status != 'REMOVED'`), p.anuncios.length],
    ['horários', await conta(`SELECT campaign_criterion.criterion_id FROM campaign_criterion WHERE ${w} AND campaign_criterion.type = 'AD_SCHEDULE'`), p.horario ? p.horario.dias.length : 0],
  ];
  const linhas = esperado.map(([o, tem, quer]) => `${String(tem) === String(quer) ? '✓' : '✗'} ${o}: ${tem ?? '—'}${String(tem) === String(quer) ? '' : ` (esperado ${quer})`}`);
  const depois = await activas(api);
  const novasActivas = [...depois].filter((id) => !activasAntes.has(id));
  linhas.push(`${novasActivas.length ? '✗' : '✓'} campanhas activas novas na conta: ${novasActivas.length}${novasActivas.length ? ` (${novasActivas.join(', ')})` : ''}`);
  return { linhas, ok: linhas.every((l) => l.startsWith('✓')) };
}

export function caminhoEspecificacao(raiz, slug, nome) {
  if (isAbsolute(nome) || nome.endsWith('.md')) return isAbsolute(nome) ? nome : join(raiz, 'clientes', slug, 'campanhas', nome);
  return join(raiz, 'clientes', slug, 'campanhas', `${nome}.md`);
}

// → { linhas, ok }
export async function criar(slug, nome, { confirmar = false, raiz = raizDados(), login, obter = globalThis.fetch, ligar = ligarApi, rede = true } = {}) {
  const ficheiro = caminhoEspecificacao(raiz, slug, nome);
  if (!existsSync(ficheiro)) throw new ErroAds(`especificação não encontrada: ${ficheiro}`);
  const texto = readFileSync(ficheiro, 'utf8');
  const v = await validar(texto, { obter, rede });
  const { erros, p } = plano(texto);
  const todos = [...new Set([...v.erros, ...erros])];
  if (todos.length) return { linhas: [...todos.map((x) => `✗ ${x}`), 'A especificação não passa — nada foi enviado.'], ok: false };

  const customerId = customerIdDoDossier(canaisDoDossier(raiz, slug));
  if (!customerId) throw new ErroAds(`o dossier de ${slug} não tem canal google-ads com customer_id de 10 algarismos`);
  const api = await ligar({ slug, customerId, login, obter });

  const ja = await existentesComNome(api, p.nome);
  if (ja.length) return { linhas: [`✗ já existe: ${ja.join('; ')}`, 'Nada foi enviado (idempotência por nome).'], ok: false };

  // Listas partilhadas: têm de existir e não podem bloquear palavras-chave desta campanha.
  const listas = [];
  const linhas = [];
  for (const nomeLista of p.listas) {
    const r = await api.gaql(`SELECT shared_set.id, shared_set.resource_name, shared_set.status FROM shared_set WHERE shared_set.name = ${gaqlTexto(nomeLista)} AND shared_set.type = 'NEGATIVE_KEYWORDS' AND shared_set.status = 'ENABLED'`);
    if (r.length !== 1) return { linhas: [`✗ lista partilhada "${nomeLista}": ${r.length} na conta (esperada 1)`, 'Nada foi enviado.'], ok: false };
    const negs = (await api.gaql(`SELECT shared_criterion.keyword.text, shared_criterion.keyword.match_type FROM shared_criterion WHERE shared_set.id = ${r[0].sharedSet.id}`))
      .map((x) => ({ text: x.sharedCriterion.keyword?.text ?? '', matchType: x.sharedCriterion.keyword?.matchType }));
    const bloqueios = p.grupos.flatMap((g) => g.palavras.flatMap((k) => negs.filter((n) => bloqueia(n, k.text)).map((n) => `${mostrarPalavra(n)} bloqueia ${g.codigo} ${mostrarPalavra(k)}`)));
    if (bloqueios.length) return { linhas: [...bloqueios.map((b) => `✗ lista "${nomeLista}": ${b}`), 'Nada foi enviado.'], ok: false };
    listas.push(r[0].sharedSet.resourceName);
    linhas.push(`– lista "${nomeLista}": ${negs.length} negativas, nenhuma bloqueia as palavras-chave`);
  }

  const { ops, recursos } = operacoes(p, customerId, { existentes: await recursosExistentes(api), listas });
  const activasAntes = await activas(api);
  const nPal = p.grupos.reduce((t, g) => t + g.palavras.length, 0);
  linhas.push(`→ "${p.nome}" em ${CAMPANHA_PAUSADA}: ${p.orcamento.toFixed(2)} €/dia, ${p.licitacao}, CPC máx. ${p.cpcMax.toFixed(2)} €, ${p.grupos.length} grupos, ${nPal} palavras-chave, ${p.anuncios.length} RSA, ${ops.length} operações · recursos novos ${JSON.stringify(recursos.novos)} · reutilizados ${JSON.stringify(recursos.reutilizados)}`);

  const r = await api.mutateTudo(ops, { validar: !confirmar });
  if (!confirmar) {
    const depois = await existentesComNome(api, p.nome);
    linhas.push('✓ ensaio aceite pela API (validateOnly)');
    linhas.push(depois.length ? `✗ verificação GAQL: existe ${depois.join('; ')}` : `✓ verificado por GAQL: 0 campanhas e 0 orçamentos com este nome — nada foi criado. Para criar: --confirmar`);
    return { linhas, ok: !depois.length };
  }

  const campanhaRes = (r.mutateOperationResponses ?? []).map((x) => x.campaignResult?.resourceName).find(Boolean);
  if (!campanhaRes) return { linhas: [...linhas, '✗ a API não devolveu a campanha criada — verificar na conta por GAQL antes de repetir'], ok: false };
  const campanhaId = campanhaRes.split('/').pop();
  linhas.push(`✓ criada em pausa: ${campanhaRes}`);

  let falhaObj = false;
  if (p.objectivos.contar.length || p.objectivos.naoContar.length) {
    const qObj = `SELECT campaign.id, campaign_conversion_goal.resource_name, campaign_conversion_goal.category, campaign_conversion_goal.origin, campaign_conversion_goal.biddable FROM campaign_conversion_goal WHERE campaign.id = ${campanhaId}`;
    const obj = planearObjectivos(await api.gaql(qObj), p.objectivos);
    obj.erros.forEach((x) => linhas.push(`– objectivos: ${x}`));
    // A campanha já existe: uma falha aqui reporta-se e a verificação GAQL corre na mesma.
    if (obj.ops.length) {
      try {
        await api.mutate('campaignConversionGoals', obj.ops.map(({ update, updateMask }) => ({ update, updateMask })), { validar: false });
        linhas.push(`✓ objectivos: ${obj.ops.map((o) => o._desc).join('; ')}`);
      } catch (e) {
        falhaObj = true;
        linhas.push(`✗ objectivos não aplicados (${limparErro(e.message, 300)}) — a campanha ${campanhaId} ficou criada em pausa; aplicar com \`ads objectivos\``);
      }
    }
  }
  const ver = await verificar(api, p, campanhaId, activasAntes);
  return { linhas: [...linhas, ...ver.linhas], ok: ver.ok && !falhaObj };
}

if (eEntrada(import.meta.url)) {
  const args = process.argv.slice(2);
  const valor = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const livres = args.filter((a, j) => !a.startsWith('--') && args[j - 1] !== '--login');
  try {
    if (livres.length < 2) throw new Error('uso: node "<MKT>/scripts/campanha/criar.mjs" <slug> <nome|ficheiro.md> [--confirmar] [--login <id|mcc>]');
    const r = await criar(livres[0], livres[1], { confirmar: args.includes('--confirmar'), login: valor('--login') });
    console.log(r.linhas.join('\n'));
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error(`✗ ${limparErro(e.message, 400)}`);
    process.exit(1);
  }
}
