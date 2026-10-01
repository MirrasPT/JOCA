// Contrato dos módulos de auditoria (#5 tracking · #6 seo · #7 presenca · #8 contas) e o obter()
// partilhado. Fundação da onda 2: os módulos importam daqui, não recriam.
//
// Cada módulo em scripts/auditoria/<modulo>.mjs exporta:
//
//   export async function auditar({ site, obter = obterPagina }) → { areas, achados }
//
//   - site:   URL base do cliente (cliente.site do dossier)
//   - obter:  função injectável (os testes passam uma que serve fixtures, sem rede). ⚠ No
//             tracking, um obter custom serve TODOS os pedidos do browser em vez da rede e
//             desliga a verificação dos redireccionamentos salto a salto (D-015 c) — por isso o
//             agregador (correr.mjs) chama os módulos SEM obter; só os testes o injectam.
//   - areas/achados: no formato de scripts/auditoria/formato.mjs (sem cliente/data/metodo —
//     esses são do agregador, #9). "area" começa pelo nome do módulo ("seo", "presenca.gbp").
//
// Regras: nunca lançar por falha de rede — a área fica "erro" com nota; nunca inventar achados;
// só leitura (D-008).

const TIMEOUT_MS = 15000;
const USER_AGENT = 'marketeer-pack (auditoria)';

// → { ok, status, url, texto, erro }. Nunca lança: erro de rede vira { ok: false, erro }.
export async function obterPagina(url, { timeout = TIMEOUT_MS } = {}) {
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
      headers: { 'user-agent': USER_AGENT },
    });
    return { ok: r.ok, status: r.status, url: r.url, texto: await r.text(), erro: null };
  } catch (e) {
    return { ok: false, status: 0, url, texto: '', erro: e.name === 'TimeoutError' ? 'timeout' : (e.cause?.code ?? e.name) };
  }
}

// obter() para testes: serve um mapa { url: texto | { status, texto } } sem rede.
export function obterDeFixtures(mapa) {
  return async (url) => {
    const v = mapa[url];
    if (v === undefined) return { ok: false, status: 404, url, texto: '', erro: null };
    const { status = 200, texto = '' } = typeof v === 'string' ? { texto: v } : v;
    return { ok: status < 400, status, url, texto, erro: null };
  };
}
