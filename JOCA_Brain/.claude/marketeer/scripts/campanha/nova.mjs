#!/usr/bin/env node
// `node "<MKT>/scripts/campanha/nova.mjs" <cliente>` — grava clientes/<slug>/campanhas/<nome>.md a partir do modelo
// modelos/campanha-search.md e das respostas do questionário (JSON no stdin). Nunca
// sobrescreve. Resposta em falta → `<sem fonte>` na prosa e fora do frontmatter (o validador
// recusa-a depois): nada se inventa, sobretudo dinheiro e geografia.
//
//   node "<MKT>/scripts/campanha/nova.mjs" <slug> [raiz] <<'JSON'
//   {"nome": "GADS_Search_Leads_<Tema>_<AAAA-MM>", "tema": "...", "objectivo": "...", "publico": "...",
//    "localizacoes": [{"id": 2620, "nome": "Portugal"}], "idiomas": [1014],
//    "orcamento_dia": 5, "licitacao": "maximizar-cliques", "cpc_max": 2.3,
//    "url_final": "https://...", "caminho": ["paes", "encomendas"], "sufixo_url": "utm_source=google&...",
//    "horario": {"dias": ["seg","ter","qua","qui","sex"], "inicio": 8, "fim": 20},
//    "telefone": "222 000 111", "chamada": {"dias": [...], "inicio": 9, "fim": 18},
//    "factos": ["Fornada diária desde 2015", "..."], "listas_negativas": ["NEG_..."],
//    "objectivos": {"contar": ["SUBMIT_LEAD_FORM"], "nao_contar": ["DOWNLOAD"]}}
//   JSON

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { eEntrada } from '../validar-dossier.mjs';
import { dataLocal } from '../criar-dossier.mjs';
import { canaisDoDossier, customerIdDoDossier, ErroAds } from '../ads/api.mjs';
import { raizDados } from '../raiz.mjs';

export const MODELO = fileURLToPath(new URL('../../modelos/campanha-search.md', import.meta.url));
const SF = '<sem fonte>';
const CAMPOS = ['nome', 'orcamento_dia', 'licitacao', 'cpc_max', 'localizacoes', 'idiomas', 'url_final', 'caminho', 'sufixo_url', 'telefone', 'horario', 'chamada', 'listas_negativas', 'objectivos'];
const DIAS = { seg: 'seg', ter: 'ter', qua: 'qua', qui: 'qui', sex: 'sex', sab: 'sáb', dom: 'dom' };
const horarioTexto = (h) => (h?.dias?.length ? `${h.dias.map((d) => DIAS[d] ?? d).join(', ')}, ${String(h.inicio).padStart(2, '0')}:00–${String(h.fim).padStart(2, '0')}:00` : SF);
const eur = (v) => `${Number(v).toFixed(2).replace('.', ',')} €`;

export function preencher(modelo, r, { slug, cliente, conta, hoje = new Date() }) {
  const campanha = Object.fromEntries(CAMPOS.filter((k) => r[k] !== undefined && r[k] !== null && r[k] !== '').map((k) => [k, r[k]]));
  const frente = {
    cliente: slug, documento: 'especificação de campanha Google Ads (Search)', conta: conta ?? SF,
    estado: 'rascunho — nada foi criado na conta', data: dataLocal(hoje),
    fonte_dos_factos: r.factos?.length ? 'aprovados pelo operador no questionário (secção "Factos aprovados")' : SF,
    campanha,
  };
  const licit = r.licitacao === 'cpc-manual' ? `CPC manual${r.cpc_max ? `, ${eur(r.cpc_max)} por grupo` : ''}`
    : r.licitacao === 'maximizar-cliques' ? `Maximizar cliques${r.cpc_max ? `, CPC máximo ${eur(r.cpc_max)}` : ', CPC máximo TODO'}` : SF;
  const v = {
    FRONTMATTER: `---\n${stringify(frente).trimEnd()}\n---`,
    CLIENTE: cliente ?? slug, SLUG: slug, NOME: r.nome ?? SF, TEMA: r.tema ?? SF, OBJECTIVO: r.objectivo ?? SF, PUBLICO: r.publico ?? SF,
    LANDING: r.url_final ?? '`TODO: URL da landing`',
    CAMINHO: r.caminho?.length ? `/${r.caminho.join('/')}` : SF,
    ORCAMENTO_TEXTO: r.orcamento_dia ? `${eur(r.orcamento_dia)}/dia (≈${eur(r.orcamento_dia * 30.4)}/mês), teto` : SF,
    LICITACAO_TEXTO: licit,
    ZONA: r.localizacoes?.length ? r.localizacoes.map((l) => l.nome ?? l.id).join(', ') : SF,
    IDIOMAS: r.idiomas?.length ? r.idiomas.map((i) => (String(i) === '1014' ? 'Português' : `languageConstants/${i}`)).join(', ') : SF,
    HORARIO: r.horario ? horarioTexto(r.horario) : 'sempre (sem programação)',
    CHAMADA: r.chamada ? horarioTexto(r.chamada) : SF,
    TELEFONE: r.telefone ?? SF,
    LISTAS: r.listas_negativas?.length ? r.listas_negativas.join(', ') : 'nenhuma',
    OBJECTIVOS: r.objectivos ? `contar ${(r.objectivos.contar ?? []).join(', ') || '—'} · não contar ${(r.objectivos.nao_contar ?? []).join(', ') || '—'}` : SF,
    FACTOS: r.factos?.length ? r.factos.map((f) => `- ${f}`).join('\n') : `- ${SF} — sem factos aprovados, os anúncios não levam números`,
    DATA: dataLocal(hoje),
  };
  return modelo.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => (k in v ? String(v[k]) : `{{${k}}}`));
}

export function nova(slug, respostas, { raiz = raizDados(), hoje = new Date(), modelo = readFileSync(MODELO, 'utf8') } = {}) {
  if (!respostas?.nome || !/^[\p{L}\p{N}_\-.]{3,120}$/u.test(respostas.nome)) throw new ErroAds('"nome" da campanha em falta ou inválido (letras, algarismos, _ - ., sem espaços): é também o nome do ficheiro');
  const canais = canaisDoDossier(raiz, slug);
  const dossier = readFileSync(join(raiz, 'clientes', slug, 'dossier.md'), 'utf8');
  const cliente = (/^\s+nome:\s*(.+)$/m.exec(dossier) ?? [])[1]?.trim();
  const texto = preencher(modelo, respostas, { slug, cliente, conta: customerIdDoDossier(canais), hoje });
  const pasta = join(raiz, 'clientes', slug, 'campanhas');
  mkdirSync(pasta, { recursive: true });
  const caminho = join(pasta, `${respostas.nome}.md`);
  try { writeFileSync(caminho, texto, { flag: 'wx' }); } catch (e) {
    if (e.code === 'EEXIST') throw new ErroAds(`${relative(raiz, caminho)} já existe — não se sobrescreve`);
    throw e;
  }
  return caminho;
}

if (eEntrada(import.meta.url)) {
  const [slug, raiz] = process.argv.slice(2);
  try {
    if (!slug) throw new Error(`uso: node "<MKT>/scripts/campanha/nova.mjs" <slug> [raiz] <<'JSON' {...} JSON`);
    const respostas = JSON.parse(readFileSync(0, 'utf8'));
    console.log(nova(slug, respostas, raiz ? { raiz } : {}));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
