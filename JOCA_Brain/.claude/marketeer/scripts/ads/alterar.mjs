#!/usr/bin/env node
// Escritas na conta Google Ads do cliente (fase 2 — D-008, D-019). Só DUAS, e nenhuma activa nada:
//
//   node "<MKT>/scripts/ads/alterar.mjs" pausar <slug> <nome|id>... [--confirmar] [--login <id|mcc>]
//   node "<MKT>/scripts/ads/alterar.mjs" objectivos <slug> --campanha <nome|id>
//        [--contar CAT[/ORIGEM],...] [--nao-contar CAT[/ORIGEM],...] [--confirmar] [--login <id|mcc>]
//
// Sem --confirmar: mostra o plano e ensaia-o na API com validateOnly (não muda nada).
// Com --confirmar: aplica e VERIFICA por GAQL que a conta ficou como pedido (sai 1 se não ficou).
// A confirmação humana é da skill (AskUserQuestion) antes de passar --confirmar.
//
// REGRA: NÃO existe caminho que ponha campanhas em ENABLED. O único estado que se escreve
// numa campanha é PAUSED, fixo no código. Activar é à mão, pelo dono da conta, depois de rever o investimento.
//
// Casos especiais:
// - campanha de experiência (experiment_type EXPERIMENT): não se pausa — termina-se a experiência
//   na interface do Google Ads, ou pausa-se a campanha base;
// - MUTATE_NOT_ALLOWED (ex.: conversões criadas pela Google): não se mexe na acção de conversão;
//   a alternativa é o objectivo por campanha (`objectivos`).

import { eEntrada } from '../validar-dossier.mjs';
import { limparErro } from '../auditoria/limpar.mjs';
import { ligarApi, canaisDoDossier, customerIdDoDossier, ErroAds } from './api.mjs';
import { raizDados } from '../raiz.mjs';

const PAUSADA = 'PAUSED'; // único estado de campanha que este módulo escreve

const MSG_EXPERIENCIA = 'é uma campanha de experiência (experiment_type EXPERIMENT): não se pausa — termina-se a experiência na interface do Google Ads (Campanhas → Experiências) ou pausa-se a campanha base';
const MSG_NAO_PERMITIDO = 'a Google não deixa alterar isto (MUTATE_NOT_ALLOWED — típico das conversões criadas pela Google): não se mexe na acção de conversão; a alternativa é o objectivo por campanha (`ads objectivos`)';

const Q_CAMPANHAS = "SELECT campaign.id, campaign.name, campaign.status, campaign.experiment_type, campaign.resource_name FROM campaign WHERE campaign.status != 'REMOVED'";

// alvo (nome exacto ou ID) → campanha. Nome repetido → pede o ID.
export function resolverCampanha(campanhas, alvo) {
  const a = String(alvo).trim();
  const porId = campanhas.filter((c) => String(c.campaign.id) === a);
  if (porId.length) return { campanha: porId[0] };
  const porNome = campanhas.filter((c) => c.campaign.name === a);
  if (porNome.length === 1) return { campanha: porNome[0] };
  if (porNome.length > 1) return { erro: `"${a}": ${porNome.length} campanhas com este nome — usar o ID (${porNome.map((c) => c.campaign.id).join(', ')})` };
  return { erro: `"${a}": campanha não encontrada (nome exacto ou ID; removidas não contam)` };
}

// → { ops, avisos, erros }. As ops só levam status PAUSED.
export function planearPausa(campanhas, alvos) {
  const ops = [];
  const avisos = [];
  const erros = [];
  const vistos = new Set();
  for (const alvo of alvos) {
    const { campanha, erro } = resolverCampanha(campanhas, alvo);
    if (erro) { erros.push(erro); continue; }
    const c = campanha.campaign;
    if (vistos.has(String(c.id))) continue;
    vistos.add(String(c.id));
    if (c.experimentType === 'EXPERIMENT') { erros.push(`"${c.name}" (${c.id}) ${MSG_EXPERIENCIA}`); continue; }
    if (c.status === PAUSADA) { avisos.push(`"${c.name}" (${c.id}) já está em pausa — nada a fazer`); continue; }
    ops.push({ update: { resourceName: c.resourceName, status: PAUSADA }, updateMask: 'status', _id: String(c.id), _nome: c.name, _de: c.status });
  }
  return { ops, avisos, erros };
}

// "SUBMIT_LEAD_FORM/WEBSITE,PHONE_CALL_LEAD" → [{ categoria, origem? }]
export function lerCategorias(texto) {
  return String(texto ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const [categoria, origem] = x.split('/').map((y) => y.trim().toUpperCase());
    return { categoria, origem: origem || null };
  });
}

// objectivos = linhas de campaign_conversion_goal de UMA campanha → { ops, avisos, erros }
export function planearObjectivos(objectivos, { contar = [], naoContar = [] }) {
  const erros = [];
  const pedido = new Map(); // resourceName → biddable
  const casa = (o, s) => o.category === s.categoria && (!s.origem || o.origin === s.origem);
  for (const [lista, valor] of [[contar, true], [naoContar, false]]) {
    for (const s of lista) {
      const alvo = objectivos.filter((x) => casa(x.campaignConversionGoal, s));
      if (!alvo.length) {
        const existem = objectivos.map((x) => `${x.campaignConversionGoal.category}/${x.campaignConversionGoal.origin}`).join(', ');
        erros.push(`objectivo ${s.categoria}${s.origem ? `/${s.origem}` : ''} não existe nesta campanha (existem: ${existem || 'nenhum'})`);
      }
      for (const x of alvo) {
        const rn = x.campaignConversionGoal.resourceName;
        if (pedido.has(rn) && pedido.get(rn) !== valor) erros.push(`${x.campaignConversionGoal.category}/${x.campaignConversionGoal.origin} pedido em --contar e em --nao-contar`);
        pedido.set(rn, valor);
      }
    }
  }
  const ops = [];
  const avisos = [];
  for (const x of objectivos) {
    const g = x.campaignConversionGoal;
    if (!pedido.has(g.resourceName)) continue;
    const quer = pedido.get(g.resourceName);
    if (!!g.biddable === quer) { avisos.push(`${g.category}/${g.origin} já ${quer ? 'conta' : 'não conta'} — nada a fazer`); continue; }
    ops.push({ update: { resourceName: g.resourceName, biddable: quer }, updateMask: 'biddable', _desc: `${g.category}/${g.origin}: ${g.biddable ? 'conta' : 'não conta'} → ${quer ? 'conta' : 'não conta'}` });
  }
  return { ops, avisos, erros };
}

const semMeta = (ops) => ops.map(({ update, updateMask }) => ({ update, updateMask }));

async function aplicar(api, servico, ops, confirmar) {
  try {
    await api.mutate(servico, semMeta(ops), { validar: !confirmar });
  } catch (e) {
    if (e.codigos?.includes('MUTATE_NOT_ALLOWED')) throw new ErroAds(`${MSG_NAO_PERMITIDO}. Detalhe: ${e.message}`);
    throw e;
  }
}

async function abrir(slug, { raiz, login, obter, ligar }) {
  const customerId = customerIdDoDossier(canaisDoDossier(raiz, slug));
  if (!customerId) throw new ErroAds(`o dossier de ${slug} não tem canal google-ads com customer_id de 10 algarismos`);
  return ligar({ slug, customerId, login, ...(obter ? { obter } : {}) });
}

// → { linhas: [texto], ok }
export async function pausar(slug, alvos, { confirmar = false, raiz = raizDados(), login, obter, ligar = ligarApi } = {}) {
  if (!alvos.length) throw new ErroAds('indicar pelo menos uma campanha (nome exacto ou ID)');
  const api = await abrir(slug, { raiz, login, obter, ligar });
  const plano = planearPausa(await api.gaql(Q_CAMPANHAS), alvos);
  const linhas = [...plano.erros.map((e) => `✗ ${e}`), ...plano.avisos.map((a) => `– ${a}`)];
  if (plano.erros.length) return { linhas: [...linhas, 'Nada foi alterado.'], ok: false };
  if (!plano.ops.length) return { linhas: [...linhas, 'Nada a alterar.'], ok: true };
  linhas.push(...plano.ops.map((o) => `→ pausar "${o._nome}" (${o._id}): ${o._de} → ${PAUSADA}`));
  await aplicar(api, 'campaigns', plano.ops, confirmar);
  if (!confirmar) return { linhas: [...linhas, `✓ ensaio aceite pela API (validateOnly) — nada foi alterado. Para aplicar: --confirmar`], ok: true };

  const ids = plano.ops.map((o) => o._id);
  const depois = await api.gaql(`SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.id IN (${ids.join(', ')})`);
  const falhou = ids.filter((id) => depois.find((x) => String(x.campaign.id) === id)?.campaign.status !== PAUSADA);
  linhas.push(falhou.length ? `✗ verificação GAQL: ainda não em pausa: ${falhou.join(', ')}` : `✓ verificado por GAQL: ${ids.length} campanha(s) em ${PAUSADA}`);
  return { linhas, ok: !falhou.length };
}

export async function mudarObjectivos(slug, campanhaAlvo, { contar = [], naoContar = [], confirmar = false, raiz = raizDados(), login, obter, ligar = ligarApi } = {}) {
  if (!campanhaAlvo) throw new ErroAds('indicar --campanha <nome|id>');
  if (!contar.length && !naoContar.length) throw new ErroAds('indicar --contar e/ou --nao-contar (ex.: --contar SUBMIT_LEAD_FORM --nao-contar DOWNLOAD)');
  const api = await abrir(slug, { raiz, login, obter, ligar });
  const { campanha, erro } = resolverCampanha(await api.gaql(Q_CAMPANHAS), campanhaAlvo);
  if (erro) return { linhas: [`✗ ${erro}`, 'Nada foi alterado.'], ok: false };
  const id = String(campanha.campaign.id);
  const qObj = `SELECT campaign.id, campaign_conversion_goal.resource_name, campaign_conversion_goal.category, campaign_conversion_goal.origin, campaign_conversion_goal.biddable FROM campaign_conversion_goal WHERE campaign.id = ${id}`;
  const plano = planearObjectivos(await api.gaql(qObj), { contar, naoContar });
  const linhas = [`Campanha "${campanha.campaign.name}" (${id})`, ...plano.erros.map((e) => `✗ ${e}`), ...plano.avisos.map((a) => `– ${a}`)];
  if (plano.erros.length) return { linhas: [...linhas, 'Nada foi alterado.'], ok: false };
  if (!plano.ops.length) return { linhas: [...linhas, 'Nada a alterar.'], ok: true };
  linhas.push(...plano.ops.map((o) => `→ ${o._desc}`));
  await aplicar(api, 'campaignConversionGoals', plano.ops, confirmar);
  if (!confirmar) return { linhas: [...linhas, '✓ ensaio aceite pela API (validateOnly) — nada foi alterado. Para aplicar: --confirmar'], ok: true };

  const depois = new Map((await api.gaql(qObj)).map((x) => [x.campaignConversionGoal.resourceName, !!x.campaignConversionGoal.biddable]));
  const falhou = plano.ops.filter((o) => depois.get(o.update.resourceName) !== o.update.biddable);
  linhas.push(falhou.length ? `✗ verificação GAQL: não ficou como pedido: ${falhou.map((o) => o._desc).join('; ')}` : `✓ verificado por GAQL: ${plano.ops.length} objectivo(s) alterado(s)`);
  return { linhas, ok: !falhou.length };
}

if (eEntrada(import.meta.url)) {
  const args = process.argv.slice(2);
  const COM_VALOR = ['--login', '--campanha', '--contar', '--nao-contar'];
  const valor = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const livres = args.filter((a, j) => !a.startsWith('--') && !COM_VALOR.includes(args[j - 1]));
  const [accao, slug, ...alvos] = livres;
  const opcoes = { confirmar: args.includes('--confirmar'), login: valor('--login') };
  try {
    let r;
    if (accao === 'pausar' && slug) r = await pausar(slug, alvos, opcoes);
    else if (accao === 'objectivos' && slug) {
      r = await mudarObjectivos(slug, valor('--campanha'), { ...opcoes, contar: lerCategorias(valor('--contar')), naoContar: lerCategorias(valor('--nao-contar')) });
    } else throw new Error('uso: node "<MKT>/scripts/ads/alterar.mjs" pausar <slug> <nome|id>... [--confirmar] | objectivos <slug> --campanha <nome|id> [--contar CAT[/ORIGEM],...] [--nao-contar ...] [--confirmar]');
    console.log(r.linhas.join('\n'));
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error(`✗ ${limparErro(e.message, 400)}`);
    process.exit(1);
  }
}
