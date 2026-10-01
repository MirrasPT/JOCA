#!/usr/bin/env node
// Rascunho da matriz de acessos (CONTRATO §4) a partir de clientes/<slug>/dossier.md e do cofre.
// Só imprime as linhas da tabela: quem escreve conectores.md é a skill `mkt-conectores`, depois de
// provar cada acesso. Sem rede; não escreve nada.
//
//   node "<MKT>/scripts/conectores.mjs" <slug>       (raiz: MARKETEER_RAIZ ou a pasta atual)
// Sai 0 e imprime a tabela; 1 em erro.
//
// - O cofre lê-se SÓ por cofre.mjs e vira logo booleano (há/não há chave) — o valor nunca sai daqui.
// - Ter a chave não prova acesso (pode faltar permissão): `acesso` fica sempre `não verificado`;
//   a prova é o comando em `como ligar`, que a skill corre e regista em `verificado em`.
// - Canais do dossier fora da lista do contrato (tiktok, youtube, x, outro) saem numa nota à parte.

import { ler } from './cofre.mjs';
import { CHAVES_DO_COFRE } from './chaves.mjs';
import { raizDados } from './raiz.mjs';
import { eEntrada, SEM_FONTE } from './validar-dossier.mjs';
import { lerDossier } from './tracking/plano.mjs';
import { COFRE_AGENCIA as COFRE_ADS } from './ads/api.mjs';
import { COFRE_AGENCIA as COFRE_PLACES, CHAVE as CHAVE_PLACES } from './auditoria/gbp.mjs';

// Tipo do dossier (validar-dossier.mjs) → canal do contrato.
const DO_DOSSIER = {
  ga4: 'ga4', gtm: 'gtm', gbp: 'gbp', 'search-console': 'search-console', meta: 'meta-ads',
  'google-ads': 'google-ads', linkedin: 'linkedin', instagram: 'instagram', facebook: 'facebook',
  trypost: 'trypost', email: 'email',
};

const NV = 'não verificado';
const AUDITAR = (slug) => `node "<MKT>/scripts/auditoria/correr.mjs" ${slug}`;
const GUARDAR = (cofre, chave) => `no terminal do operador: node "<MKT>/scripts/guardar-credencial.mjs" ${cofre} ${chave}`;

// via · dados que dá · como provar/ligar — o que o motor já sabe fazer por canal (ver README).
const CANAIS = {
  site: { via: 'público', dados: 'SEO técnico, tags presentes, NAP, perfis ligados', ligar: (s) => `provar: ${AUDITAR(s)}` },
  gtm: { via: 'público', dados: 'contentor e tags vistos no site; prova de consentimento', ligar: () => 'provar: node "<MKT>/scripts/tracking/prova.mjs" <url do site>' },
  ga4: { via: 'api', dados: 'utilizadores ativos e eventos (GA4 Data API)', ligar: (s) => `service account com leitura na propriedade; ${GUARDAR(s, 'GOOGLE_SERVICE_ACCOUNT')}; provar: ${AUDITAR(s)}` },
  'search-console': { via: 'manual', dados: '[por confirmar] — módulo do motor por implementar', ligar: () => 'dar acesso de leitura à service account; exportar CSV do Search Console até haver módulo' },
  gbp: { via: 'api', dados: 'estado, NAP, horário, avaliações, fotos (Places API, dados públicos)', ligar: (s) => `chave Places da agência; ${GUARDAR(COFRE_PLACES, CHAVE_PLACES)}; provar: ${AUDITAR(s)}` },
  'google-ads': { via: 'api', dados: 'campanhas, termos, Quality Score, conversões (12 meses)', ligar: (s) => `node "<MKT>/scripts/ads/ligar.mjs" ${s}; provar: node "<MKT>/scripts/ads/diagnostico.mjs" ${s}` },
  'meta-ads': { via: 'manual', dados: '[por confirmar] — sem conector no motor', ligar: () => 'exportar CSV do Gestor de Anúncios ou dar acesso de leitura (conector por fazer)' },
  facebook: { via: 'público', dados: 'página ligada a partir do site', ligar: (s) => `provar: ${AUDITAR(s)}` },
  instagram: { via: 'público', dados: 'perfil ligado a partir do site', ligar: (s) => `provar: ${AUDITAR(s)}` },
  linkedin: { via: 'manual', dados: '[por confirmar] — sem conector no motor', ligar: () => 'exportar analytics da página em CSV' },
  'linkedin-ads': { via: 'manual', dados: '[por confirmar] — sem conector no motor', ligar: () => 'exportar CSV do Campaign Manager' },
  email: { via: 'manual', dados: '[por confirmar] — sem conector no motor', ligar: () => 'exportar relatório da ferramenta de email em CSV' },
  trypost: { via: 'mcp', dados: 'publicações agendadas e métricas por post', ligar: () => 'instalar/ligar o MCP trypost e listar as contas sociais' },
};

const celula = (v) => String(v ?? SEM_FONTE).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

// Há chave no cofre? Só booleano. `lerCofre` injetável nos testes.
function haChave(canal, slug, lerCofre) {
  const tem = (cofre, chave) => { try { return lerCofre(cofre, chave) !== null; } catch { return null; } };
  if (canal === 'gbp') return tem(COFRE_PLACES, CHAVE_PLACES);
  const chaves = CHAVES_DO_COFRE[canal];
  if (!chaves) return undefined;
  const r = chaves.map((k) => tem(slug, k));
  // google-ads: o refresh token do cofre da agência ainda serve (legado, D-019; ver ads/api.mjs).
  if (canal === 'google-ads') r.push(tem(COFRE_ADS, 'GOOGLE_ADS_REFRESH_TOKEN'));
  if (r.some((x) => x === true)) return true;
  return r.some((x) => x === null) ? null : false;
}

export function matriz(slug, { raiz = raizDados(), lerCofre = (s, c) => ler(s, c) } = {}) {
  const dossier = lerDossier(raiz, slug);
  const linhas = [];
  const fora = [];
  if (dossier.cliente?.site && dossier.cliente.site !== SEM_FONTE) linhas.push({ canal: 'site', id: dossier.cliente.site });
  for (const c of Array.isArray(dossier.canais) ? dossier.canais : []) {
    const canal = DO_DOSSIER[c?.tipo];
    if (!canal) { fora.push(String(c?.tipo)); continue; }
    linhas.push({ canal, id: c.id ?? SEM_FONTE });
  }
  return {
    linhas: linhas.map(({ canal, id }) => {
      const k = CANAIS[canal];
      const chave = haChave(canal, slug, lerCofre);
      const nota = chave === true ? 'chave no cofre: sim' : chave === false ? 'chave no cofre: não' : chave === null ? 'cofre ilegível' : null;
      return { canal, id, acesso: NV, via: k.via, dados: k.dados, verificado: NV, ligar: [nota, k.ligar(slug)].filter(Boolean).join(' · ') };
    }),
    fora,
  };
}

export function tabela({ linhas, fora }) {
  const t = [
    '| canal | conta/id | acesso | via | dados que dá | verificado em | como ligar |',
    '|---|---|---|---|---|---|---|',
    ...linhas.map((l) => `| ${[l.canal, l.id, l.acesso, l.via, l.dados, l.verificado, l.ligar].map(celula).join(' | ')} |`),
  ];
  if (fora.length) t.push('', `Fora do contrato (não entram na matriz): ${fora.join(', ')}`);
  return t.join('\n');
}

if (eEntrada(import.meta.url)) {
  try {
    const [slug, ...resto] = process.argv.slice(2);
    if (!slug || resto.length) throw new Error('uso: node conectores.mjs <slug>');
    console.log(tabela(matriz(slug)));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
