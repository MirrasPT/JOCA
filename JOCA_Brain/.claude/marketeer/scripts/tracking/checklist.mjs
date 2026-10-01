// Checklist GA4/Google Ads do relatório do `tracking/prova.mjs --cliente`.
// O que a API do Google Ads responde lê-se com scripts/ads/api.mjs, SÓ LEITURA (GAQL); o resto é
// checklist manual (as definições do GA4 não estão na API do Ads). Nunca lança: sem acesso, cada
// item lido fica "não verificado" com o motivo (sem segredos — limparErro).
//
//   checklist(slug, { raiz, login, ligar, rotulo }) → { itens: [{ item, estado, evidencia }], erro? }
//   estado: 'ok' | 'falta' | 'manual' | 'não verificado'

import { ligarApi, canaisDoDossier, customerIdDoDossier } from '../ads/api.mjs';
import { limparErro } from '../auditoria/limpar.mjs';

const GA4_IMPORTADA = /^GOOGLE_ANALYTICS_4/;

export const MANUAIS = [
  ['Ligação GA4 ↔ Google Ads', 'GA4 → Administrador → Ligações de produtos → Google Ads: conta ligada, com a publicidade personalizada activa se houver remarketing.'],
  ['Retenção de dados do GA4 em 14 meses', 'GA4 → Administrador → Recolha e modificação de dados → Retenção de dados: «Retenção de dados de eventos» = 14 meses (o valor por omissão é 2).'],
  ['Tráfego interno excluído', 'GA4 → Administrador → Streams de dados → Configurar definições da etiqueta → Definir tráfego interno (IPs da equipa) + Filtros de dados: «Tráfego interno» Activo (não só «Teste»).'],
  ['Eventos-chave marcados depois do 1.º evento', 'GA4 → Administrador → Eventos: marcar generate_lead (e clique_telefone) como evento-chave só depois de aparecerem na lista (o 1.º evento tem de chegar primeiro).'],
];

const item = (nome, estado, evidencia) => ({ item: nome, estado, evidencia });

// Funções puras sobre as linhas da GAQL (testáveis sem rede).
export function avaliar({ conta, conversoes, objectivos }, { rotulo } = {}) {
  const itens = [];
  const c = conta?.[0]?.customer;
  itens.push(c?.autoTaggingEnabled
    ? item('Etiquetagem automática (gclid) activa', 'ok', `conta ${c.id}`)
    : item('Etiquetagem automática (gclid) activa', 'falta', 'Google Ads → Administrador → Definições da conta → Etiquetagem automática: sem ela o GA4 não atribui as visitas às campanhas.'));

  const activas = (conversoes ?? []).map((x) => x.conversionAction).filter((a) => a?.status === 'ENABLED');
  const ga4 = activas.filter((a) => GA4_IMPORTADA.test(a.type ?? ''));
  itens.push(ga4.length
    ? item('Conversões importadas do GA4 (indício da ligação GA4 ↔ Ads)', 'ok', ga4.map((a) => a.name).join(', '))
    : item('Conversões importadas do GA4 (indício da ligação GA4 ↔ Ads)', 'não verificado', 'nenhuma acção de conversão do tipo GA4 — não prova que a ligação falta; confirmar à mão (item manual «Ligação GA4 ↔ Google Ads»)'));

  if (rotulo) {
    const a = activas.find((x) => (x.tagSnippets ?? []).some((s) => String(s.eventSnippet ?? '').includes(rotulo)));
    itens.push(a
      ? item(`Acção de conversão do rótulo do contentor (${rotulo})`, 'ok', `«${a.name}» · ${a.category} · ${a.primaryForGoal ? 'principal' : 'secundária'}`)
      : item(`Acção de conversão do rótulo do contentor (${rotulo})`, 'falta', 'nenhuma acção de conversão activa com este rótulo — o contentor dispara para uma conversão que a conta não tem'));
  }

  const porCampanha = new Map();
  for (const x of objectivos ?? []) {
    const nome = x.campaign?.name;
    if (!nome) continue;
    const g = x.campaignConversionGoal ?? {};
    const l = porCampanha.get(nome) ?? { estado: x.campaign.status, contam: [] };
    if (g.biddable) l.contam.push(`${g.category}/${g.origin}`);
    porCampanha.set(nome, l);
  }
  // Agrupa as campanhas pelo conjunto de objectivos que contam (com 20+ campanhas, a lista por
  // campanha não se lê); até 3 nomes por grupo.
  const grupos = new Map();
  for (const [nome, l] of porCampanha) {
    const k = l.contam.sort().join(', ') || 'nada';
    grupos.set(k, [...(grupos.get(k) ?? []), nome]);
  }
  const texto = [...grupos].map(([k, ns]) => `${k}: ${ns.length} campanha(s) (${ns.slice(0, 3).join('; ')}${ns.length > 3 ? '; …' : ''})`).join(' · ');
  const foraDoPlano = [...new Set([...porCampanha.values()].flatMap((l) => l.contam).filter((k) => !/^(SUBMIT_LEAD_FORM|PHONE_CALL_LEAD)\//.test(k)))];
  const semLead = [...porCampanha].filter(([, l]) => !l.contam.some((k) => k.startsWith('SUBMIT_LEAD_FORM')));
  itens.push(!porCampanha.size
    ? item('Objectivos de conversão por campanha', 'ok', 'a conta não tem campanhas — nada a rever')
    : item('Objectivos de conversão por campanha', semLead.length || foraDoPlano.length ? 'falta' : 'ok',
      `${texto}${semLead.length ? ` — sem SUBMIT_LEAD_FORM a contar: ${semLead.length}` : ''}${foraDoPlano.length ? ` — a contar fora do plano (lead/chamada): ${foraDoPlano.join(', ')}; rever com \`ads objectivos\`` : ''}`));
  return itens;
}

// Itens que se leriam pela API do Ads — quando ela não responde ficam "?" com o motivo.
const DA_API = ['Etiquetagem automática (gclid) activa', 'Conversões importadas do GA4 (indício da ligação GA4 ↔ Ads)', 'Objectivos de conversão por campanha'];

export async function checklist(slug, { raiz, login, obter, ligar = ligarApi, rotulo } = {}) {
  const manuais = MANUAIS.map(([nome, como]) => item(nome, 'manual', como));
  const semApi = (motivo) => ({ itens: [...DA_API.map((n) => item(n, 'não verificado', motivo)), ...manuais], erro: motivo });
  let customerId;
  try {
    customerId = customerIdDoDossier(canaisDoDossier(raiz, slug));
  } catch (e) {
    return semApi(limparErro(e.message, 200));
  }
  if (!customerId) return semApi('o dossier não tem canal google-ads com customer_id — itens do Google Ads não verificados');
  try {
    const api = await ligar({ slug, customerId, login, obter });
    const linhas = {
      conta: await api.gaql('SELECT customer.id, customer.auto_tagging_enabled FROM customer'),
      conversoes: await api.gaql("SELECT conversion_action.name, conversion_action.type, conversion_action.status, conversion_action.category, conversion_action.primary_for_goal, conversion_action.tag_snippets FROM conversion_action WHERE conversion_action.status != 'REMOVED'"),
      objectivos: await api.gaql("SELECT campaign.name, campaign.status, campaign_conversion_goal.category, campaign_conversion_goal.origin, campaign_conversion_goal.biddable FROM campaign_conversion_goal WHERE campaign.status != 'REMOVED'"),
    };
    return { itens: [...avaliar(linhas, { rotulo }), ...manuais], conta: customerId };
  } catch (e) {
    return semApi(`Google Ads não verificado: ${limparErro(e.message, 200)}`);
  }
}

export const MARCAS = { ok: '✓', falta: '✗', manual: '☐', 'não verificado': '?' };
export const LEGENDA = 'Legenda: ✓ confirmado pela API · ✗ falha confirmada · ☐ manual (verificar no GA4) · ? a API não conseguiu confirmar';

export function checklistMarkdown({ itens, erro, conta }) {
  const sim = MARCAS;
  return [
    `Google Ads: ${conta ? `conta ${conta}, lida pela API (só leitura)` : erro ?? 'não verificado'}`,
    '',
    LEGENDA,
    '',
    '| | Item | Evidência / como verificar |',
    '|---|---|---|',
    ...itens.map((x) => `| ${sim[x.estado] ?? x.estado} | ${x.item} | ${String(x.evidencia).replace(/\|/g, '\\|')} |`),
  ].join('\n');
}
