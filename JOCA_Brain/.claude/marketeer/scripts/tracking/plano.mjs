#!/usr/bin/env node
// `node "<MKT>/scripts/tracking/plano.mjs" <cliente>` — plano de medição a partir do dossier.
// Grava clientes/<slug>/tracking/plano.md a partir de modelos/tracking-plano.md; nunca
// sobrescreve (o plano edita-se à mão depois).
//
//   node "<MKT>/scripts/tracking/plano.mjs" <slug> [--formularios contacto,orcamento] [--telefones 212345678,...]
//     [--com-ads | --sem-ads] [raiz]
//
// Contrato da casa (D-021, revisto 2026-10-01): generate_lead{formulario} — evento recomendado do GA4
// para «submits a form» (verificado 2026-10-01, support.google.com/analytics/answer/9267735); era
// lead_enviado até ao pack: planos já gravados mantêm o nome que têm (o gtm lê-o do plano).
// Só no 2xx do envio — evento-chave e, com Google Ads, conversão; clique_telefone{numero} — evento-chave. Com Ads = o dossier tem canal google-ads
// (--com-ads/--sem-ads forçam). Valores dos formulários e telefones: só os que o operador der.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { eEntrada, SEM_FONTE } from '../validar-dossier.mjs';
import { dataLocal } from '../criar-dossier.mjs';
import { ErroTracking } from './gtm.mjs';
import { raizDados } from '../raiz.mjs';

export const MODELO = fileURLToPath(new URL('../../modelos/tracking-plano.md', import.meta.url));

export function eventosDaCasa({ comAds }) {
  return [
    {
      nome: 'generate_lead', parametros: ['formulario'], quando: 'sucesso (2xx) do envio de um formulário',
      evento_chave: true, ...(comAds && { conversao_ads: { nome: 'Lead (formulário)', valor: 1, moeda: 'EUR' } }),
    },
    { nome: 'clique_telefone', parametros: ['numero'], quando: 'clique num link tel:', evento_chave: true },
  ];
}

const semFonte = (v) => v === undefined || v === null || v === '' || v === SEM_FONTE;
const lista = (xs) => (xs?.length ? xs.map((x) => `\`${x}\``).join(', ') : SEM_FONTE);

export function preencher(modelo, { slug, dossier, formularios = [], telefones = [], comAds, hoje = new Date() }) {
  const canal = (tipo) => (dossier.canais ?? []).find((c) => c?.tipo === tipo);
  const ads = comAds ?? !!canal('google-ads');
  const eventos = eventosDaCasa({ comAds: ads });
  const frente = {
    cliente: slug, documento: 'plano de medição (GA4 + Google Ads via GTM, com consentimento)',
    site: dossier.cliente?.site ?? SEM_FONTE, data: dataLocal(hoje), tracking: { eventos },
  };
  const objectivos = Array.isArray(dossier.objectivos) ? (dossier.objectivos.join('; ') || SEM_FONTE) : (dossier.objectivos ?? SEM_FONTE);
  const conv = eventos.filter((e) => e.conversao_ads);
  const v = {
    FRONTMATTER: `---\n${stringify(frente).trimEnd()}\n---`,
    CLIENTE: dossier.cliente?.nome ?? slug, SLUG: slug, OBJECTIVOS: objectivos,
    TABELA_EVENTOS: eventos.map((e) => `| \`${e.nome}\` | ${e.parametros.map((p) => `\`${p}\``).join(', ')} | ${e.quando} | ${e.evento_chave ? 'sim' : 'não'} | ${e.conversao_ads ? `sim — «${e.conversao_ads.nome}»` : 'não'} |`).join('\n'),
    FORMULARIOS: lista(formularios), FORMULARIO_EXEMPLO: formularios[0] ?? SEM_FONTE,
    TELEFONES: lista(telefones), TELEFONE_EXEMPLO: telefones[0] ?? SEM_FONTE,
    TABELA_CONVERSOES: conv.length
      ? ['| Acção de conversão | Evento | Valor | Categoria | Contagem |', '|---|---|---|---|---|',
        ...conv.map((e) => `| ${e.conversao_ads.nome} | \`${e.nome}\` | ${e.conversao_ads.valor} ${e.conversao_ads.moeda} (nominal) | Enviar formulário de lead | Uma |`)].join('\n')
      : 'Sem Google Ads neste cliente (dossier sem canal `google-ads`). Com Ads: `node "<MKT>/scripts/tracking/plano.mjs" ${slug} --com-ads`.',
    LISTA_CHAVE: eventos.filter((e) => e.evento_chave).map((e) => `- \`${e.nome}\``).join('\n'),
    GA4_PROPRIEDADE: semFonte(canal('ga4')?.id) ? SEM_FONTE : canal('ga4').id,
    ADS_CONTA: semFonte(canal('google-ads')?.id) ? SEM_FONTE : canal('google-ads').id,
  };
  return modelo.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => (k in v ? String(v[k]) : `{{${k}}}`));
}

export function lerDossier(raiz, slug) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(slug ?? ''))) throw new ErroTracking(`slug inválido "${slug}"`);
  let texto;
  try {
    texto = readFileSync(join(raiz, 'clientes', slug, 'dossier.md'), 'utf8');
  } catch {
    throw new ErroTracking(`sem dossier para ${slug} (clientes/${slug}/dossier.md) — /marketeer ${slug}`);
  }
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(texto);
  if (!m) throw new ErroTracking(`dossier de ${slug} sem frontmatter`);
  return parse(m[1]) ?? {};
}

export function plano(slug, opcoes = {}, { raiz = raizDados(), hoje = new Date(), modelo = readFileSync(MODELO, 'utf8') } = {}) {
  const dossier = lerDossier(raiz, slug);
  const texto = preencher(modelo, { slug, dossier, hoje, ...opcoes });
  const pasta = join(raiz, 'clientes', slug, 'tracking');
  mkdirSync(pasta, { recursive: true });
  const caminho = join(pasta, 'plano.md');
  try {
    writeFileSync(caminho, texto, { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') throw new ErroTracking(`${relative(raiz, caminho)} já existe — não se sobrescreve (edita-o)`);
    throw e;
  }
  return relative(raiz, caminho);
}

if (eEntrada(import.meta.url)) {
  const args = process.argv.slice(2);
  const valor = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const csv = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
  const livres = args.filter((a, j) => !a.startsWith('--') && !['--formularios', '--telefones'].includes(args[j - 1]));
  const comAds = args.includes('--com-ads') ? true : args.includes('--sem-ads') ? false : undefined;
  try {
    if (!livres[0]) throw new ErroTracking('uso: node "<MKT>/scripts/tracking/plano.mjs" <slug> [--formularios a,b] [--telefones x,y] [--com-ads|--sem-ads] [raiz]');
    const f = plano(livres[0], { formularios: csv(valor('--formularios')), telefones: csv(valor('--telefones')), comAds }, livres[1] ? { raiz: livres[1] } : {});
    console.log(`Plano de medição gravado em ${f}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
