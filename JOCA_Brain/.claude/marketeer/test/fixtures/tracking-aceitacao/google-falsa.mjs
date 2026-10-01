// Google Ads falsa para a suite de aceitação do tracking: um `fetch` que responde ao
// token OAuth e ao GAQL como a API REST (camelCase) e REGISTA cada pedido. Nada sai para a rede.
// Segredos do cofre falso = sentinelas: nenhum pode aparecer na consola, em relatórios ou erros.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const SEGREDOS = {
  DEV: 'DEVTOKEN_SENTINELA_tracking_11',
  SECRET: 'GOCSPX-SENTINELA_tracking_22',
  RT_AGENCIA: '1//0SENTINELA_refresh_agencia_33',
  RT_CLIENTE: '1//0SENTINELA_refresh_cliente_44',
  ACCESS: 'ya29.SENTINELA_access_token_55',
};
export const CID = '1234567890';
export const ROTULO = 'RotuloFicticio001';

// Cofre falso em <home>/.config/marketeer (o real nunca é lido: o HOME aponta para uma pasta temporária).
export function escreverCofre(home, slug) {
  const cofre = join(home, '.config', 'marketeer');
  mkdirSync(cofre, { recursive: true, mode: 0o700 });
  writeFileSync(join(cofre, 'google-ads-oauth-client.json'),
    JSON.stringify({ installed: { client_id: 'cliente-oauth.apps.googleusercontent.com', client_secret: SEGREDOS.SECRET } }), { mode: 0o600 });
  writeFileSync(join(cofre, 'google-ads.env'), [
    `GOOGLE_ADS_DEVELOPER_TOKEN=${SEGREDOS.DEV}`,
    'GOOGLE_ADS_LOGIN_CUSTOMER_ID=999-888-7777',
    `GOOGLE_ADS_REFRESH_TOKEN=${SEGREDOS.RT_AGENCIA}`,
  ].join('\n') + '\n', { mode: 0o600 });
  writeFileSync(join(cofre, `${slug}.env`), `GOOGLE_ADS_REFRESH_TOKEN=${SEGREDOS.RT_CLIENTE}\n`, { mode: 0o600 });
}

function linhas(from, { autoTagging, rotulo }) {
  if (from === 'customer') return [{ customer: { resourceName: `customers/${CID}`, id: CID, descriptiveName: 'Conta Teste', autoTaggingEnabled: autoTagging } }];
  if (from === 'conversion_action') return [{
    conversionAction: {
      resourceName: `customers/${CID}/conversionActions/901`, id: '901', name: 'Lead (formulário)', status: 'ENABLED',
      type: 'WEBPAGE', category: 'SUBMIT_LEAD_FORM', primaryForGoal: true,
      tagSnippets: [{
        type: 'WEBPAGE', pageFormat: 'HTML',
        globalSiteTag: "<script async src=\"https://www.googletagmanager.com/gtag/js?id=AW-100000000\"></script><script>gtag('config', 'AW-100000000');</script>",
        eventSnippet: `<script>gtag('event', 'conversion', {'send_to': 'AW-100000000/${rotulo}'});</script>`,
      }],
    },
  }];
  if (from === 'campaign') return [{ campaign: { resourceName: `customers/${CID}/campaigns/111`, id: '111', name: 'Search Teste', status: 'ENABLED' } }];
  if (from === 'campaign_conversion_goal') return [{
    campaign: { resourceName: `customers/${CID}/campaigns/111`, id: '111', name: 'Search Teste', status: 'ENABLED' },
    campaignConversionGoal: { resourceName: `customers/${CID}/campaignConversionGoals/111~SUBMIT_LEAD_FORM~WEBSITE`, category: 'SUBMIT_LEAD_FORM', origin: 'WEBSITE', biddable: true },
  }];
  return [];
}

export function googleFalsa({ registar = () => {}, autoTagging = true, rotulo = ROTULO, erroToken = false } = {}) {
  return async (url, init = {}) => {
    const u = String(url);
    const metodo = String(init.method ?? 'GET').toUpperCase();
    const corpo = init.body == null ? '' : String(init.body);
    registar({ url: u, metodo, corpo });
    if (u === 'https://oauth2.googleapis.com/token') {
      if (erroToken) return Response.json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, { status: 400 });
      return Response.json({ access_token: SEGREDOS.ACCESS, expires_in: 3599, token_type: 'Bearer' });
    }
    if (/googleAds:search(Stream)?$/.test(u)) {
      const q = JSON.parse(corpo || '{}').query ?? '';
      const from = (/\bFROM\s+(\w+)/i.exec(q) ?? [])[1];
      return Response.json({ results: linhas(from, { autoTagging, rotulo }) });
    }
    if (/:mutate$/.test(u)) return Response.json({});
    return Response.json({ error: { code: 404, message: 'não existe na Google falsa' } }, { status: 404 });
  };
}
