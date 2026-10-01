#!/usr/bin/env node
// `node "<MKT>/scripts/campanha/csv.mjs" <cliente> <nome>` — alternativa SEM API: gera os CSV de
// carregamento em massa (Ferramentas → Ações em massa → Carregamentos) a partir da especificação.
// Cabeçalhos dos modelos oficiais da Google, como nos modelos de carregamento do Google Ads Editor
// (PR #46): UTF-8 com BOM, vírgula, aspas só onde é preciso. A campanha entra SEMPRE em Paused.
//
//   node "<MKT>/scripts/campanha/csv.mjs" <slug> <nome|ficheiro.md>
//
// Grava clientes/<slug>/campanhas/<nome>-carregamento/ (recusa se a pasta já existir) e imprime a
// ordem de carregamento e os passos que ficam manuais (sem coluna confirmada nos modelos).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { eEntrada } from '../validar-dossier.mjs';
import { limparErro } from '../auditoria/limpar.mjs';
import { canaisDoDossier, customerIdDoDossier, ErroAds } from '../ads/api.mjs';
import { plano, caminhoEspecificacao } from './criar.mjs';
import { validar } from './validar.mjs';
import { raizDados } from '../raiz.mjs';

const IDIOMA = { 1014: 'pt', 1000: 'en', 1003: 'es', 1002: 'fr' };
const CORRESP = { PHRASE: 'Phrase match', EXACT: 'Exact match', BROAD: 'Broad match' };
const DIA_EN = { MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday' };

const campo = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csv = (cab, linhas) => `\uFEFF${[cab, ...linhas].map((l) => l.map(campo).join(',')).join('\n')}\n`;
const hora12 = (h) => { const x = h % 24; return `${String(x % 12 || 12).padStart(2, '0')}:00 ${x < 12 ? 'AM' : 'PM'}`; };
const negTexto = (n) => (n.matchType === 'PHRASE' ? `"${n.text}"` : n.matchType === 'EXACT' ? `[${n.text}]` : n.text);

// plano + customer id formatado → { ficheiro: conteúdo }, manuais: [texto]
export function ficheiros(p, conta) {
  const cid = conta.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
  const C = p.nome;
  const grupo = (codigo) => `${codigo} · ${p.grupos.find((g) => g.codigo === codigo).nome}`;
  const out = {};
  const manuais = [];
  const idiomas = p.idiomas.map((i) => IDIOMA[i]);
  if (idiomas.includes(undefined)) manuais.push(`idiomas ${p.idiomas.join(', ')}: sem código conhecido — definir na interface`);
  out['01a-campanhas.csv'] = csv(
    ['Action', 'Customer ID', 'Campaign status', 'Campaign', 'Campaign type', 'Networks', 'Budget', 'Budget type', 'Bid strategy type', 'Language', 'Final URL suffix'],
    [['Add', cid, 'Paused', C, 'Search', 'Google search', p.orcamento.toFixed(2), 'Daily', p.licitacao === 'cpc-manual' ? 'Manual CPC' : 'Maximize clicks', idiomas.filter(Boolean).join(';'), p.sufixo ?? '']],
  );
  out['01b-grupos.csv'] = csv(['Action', 'Customer ID', 'Campaign', 'Ad group', 'Status'], p.grupos.map((g) => ['Add', cid, C, grupo(g.codigo), 'Enabled']));
  out['02-palavras-chave.csv'] = csv(['Action', 'Customer ID', 'Keyword status', 'Campaign', 'Ad group', 'Keyword', 'Match Type'],
    p.grupos.flatMap((g) => g.palavras.map((k) => ['Add', cid, 'Enabled', C, grupo(g.codigo), k.text, CORRESP[k.matchType]])));
  if (p.listas.length) out['02c-associar-lista.csv'] = csv(['Action', 'Customer ID', 'Negative keyword', 'Keyword or list', 'Campaign'], p.listas.map((l) => ['Add', cid, l, 'List', C]));

  const maxT = Math.max(...p.anuncios.map((a) => a.titulos.length));
  const maxD = Math.max(...p.anuncios.map((a) => a.descricoes.length));
  const fixT = [...new Set(p.anuncios.flatMap((a) => a.titulos.map((t, i) => (t.fixar ? i + 1 : null)).filter(Boolean)))].sort((a, b) => a - b);
  const fixD = [...new Set(p.anuncios.flatMap((a) => a.descricoes.map((t, i) => (t.fixar ? i + 1 : null)).filter(Boolean)))].sort((a, b) => a - b);
  const cabRsa = ['Action', 'Customer ID', 'Ad status', 'Campaign', 'Ad group', 'Ad type',
    ...Array.from({ length: maxT }, (_, i) => `Headline ${i + 1}`), ...Array.from({ length: maxD }, (_, i) => (i ? `Description ${i + 1}` : 'Description')),
    ...fixT.map((i) => `Headline ${i} position`), ...fixD.map((i) => `Description ${i} position`), 'Path 1', 'Path 2', 'Final URL', 'Custom parameter'];
  out['03-anuncios-rsa.csv'] = csv(cabRsa, p.anuncios.map((a) => ['Add', cid, 'Enabled', C, grupo(a.grupo), 'Responsive search ad',
    ...Array.from({ length: maxT }, (_, i) => a.titulos[i]?.texto ?? ''), ...Array.from({ length: maxD }, (_, i) => a.descricoes[i]?.texto ?? ''),
    ...fixT.map((i) => a.titulos[i - 1]?.fixar ?? ''), ...fixD.map((i) => a.descricoes[i - 1]?.fixar ?? ''),
    p.caminho[0] ?? '', p.caminho[1] ?? '', p.urlFinal, [`{_grupo}=${a.grupo.toLowerCase()}`, ...(a.param ? [`{_rsa}=${a.param}`] : [])].join(' ; ')]));
  if (p.sitelinks.length) {
    out['04-sitelinks.csv'] = csv(['Row Type', 'Action', 'Customer ID', 'Asset action', 'Level', 'Campaign', 'Ad group', 'Sitelink text', 'Final URL', 'Description', 'Description 2'],
      p.sitelinks.map((s) => ['Sitelink', 'Add', cid, 'Create new', 'Campaign', C, '', s.texto, s.url, s.d1, s.d2]));
  }
  if (p.destaques.length) out['05-frases-destaque.csv'] = csv(['Row type', 'Action', 'Customer ID', 'Campaign', 'Ad group', 'Callout text'], p.destaques.map((t) => ['Callout extension', 'add', cid, C, '', t]));
  if (p.snippets.length) {
    out['06-snippets.csv'] = csv(['Action', 'Customer ID', 'Campaign', 'Ad group', 'Structured snippet header', 'Structured snippet values'],
      p.snippets.map((s) => ['add', cid, C, '', s.cabecalho, s.valores.join(';')]));
  }
  if (p.telefone) {
    const h = p.chamada ? p.chamada.dias.map((d) => `${DIA_EN[d]}, ${hora12(p.chamada.inicio)} - ${hora12(p.chamada.fim)}`).join('; ') : '';
    out['07-recurso-chamada.csv'] = csv(['Row Type', 'Action', 'Customer ID', 'Asset action', 'Level', 'Campaign', 'Ad group', 'Phone number', 'Country code', 'Scheduling'],
      [['Call asset', 'Add', cid, 'Create new', 'Campaign', C, '', p.telefone, 'PT', h]]);
  }
  const semNome = p.localizacoes.filter((l) => !l.nome);
  if (semNome.length) manuais.push(`localizações sem nome canónico no frontmatter (ids ${semNome.map((l) => l.id).join(', ')}): definir na interface`);
  else out['08-localizacoes.csv'] = csv(['Customer ID', 'Campaign', 'Location'], [[cid, C, p.localizacoes.map((l) => l.nome).join(' ; ')]]);
  const negC = [...new Map(p.negCampanha.map((n) => [`${n.text.toLowerCase()}|${n.matchType}`, n])).values()];
  if (negC.length) out['09-negativas-campanha.csv'] = csv(['Action', 'Customer ID', 'Negative keyword', 'Keyword or list', 'Campaign'], negC.map((n) => ['Add', cid, negTexto(n), 'Keyword', C]));

  manuais.push(
    `opção de localização: Incluir "Presença" (não "Presença ou interesse")`,
    p.licitacao === 'cpc-manual' ? `CPC por grupo: ${p.cpcMax.toFixed(2).replace('.', ',')} € (CPC manual)` : `limite máximo de CPC: ${p.cpcMax.toFixed(2).replace('.', ',')} € (Maximizar cliques)`,
    p.horario ? `programação de anúncios: ${p.horario.dias.map((d) => DIA_EN[d]).join(', ')} ${p.horario.inicio}:00–${p.horario.fim}:00` : 'programação de anúncios: sem restrição (como na especificação)',
    'recursos automáticos de texto: desligar',
    'publicidade política da UE: "não contém"',
  );
  if (p.negGrupo.length) manuais.push(`negativas de grupo (${p.negGrupo.length}): ${p.negGrupo.map((n) => `${n.alvo} ${negTexto(n)}`).join(', ')}`);
  if (p.objectivos.contar.length || p.objectivos.naoContar.length) manuais.push(`objectivos da campanha: contar ${p.objectivos.contar.map((c) => c.categoria).join(', ') || '—'} · não contar ${p.objectivos.naoContar.map((c) => c.categoria).join(', ') || '—'}`);
  return { out, manuais };
}

// Valida antes de gerar (sem rede: os URLs não se testam aqui). Especificação com erros → nada.
export async function gerarCsv(slug, nome, { raiz = raizDados() } = {}) {
  const f = caminhoEspecificacao(raiz, slug, nome);
  if (!existsSync(f)) throw new ErroAds(`especificação não encontrada: ${f}`);
  const texto = readFileSync(f, 'utf8');
  const v = await validar(texto, { rede: false });
  const { erros: e2, p } = plano(texto);
  const erros = [...new Set([...v.erros, ...e2])];
  if (erros.length) return { linhas: [...erros.map((e) => `✗ ${e}`), 'A especificação não passa o validador — nada foi gerado.'], ok: false };
  const conta = customerIdDoDossier(canaisDoDossier(raiz, slug));
  if (!conta) throw new ErroAds(`o dossier de ${slug} não tem canal google-ads com customer_id de 10 algarismos`);
  const pasta = join(dirname(f), `${basename(f, '.md')}-carregamento`);
  if (existsSync(pasta)) return { linhas: [`✗ ${relative(raiz, pasta)} já existe — não se sobrescreve (apagar à mão ou mudar o nome)`], ok: false };
  const { out, manuais } = ficheiros(p, conta);
  mkdirSync(pasta, { recursive: true });
  for (const [nomeF, conteudo] of Object.entries(out)) writeFileSync(join(pasta, nomeF), conteudo, { flag: 'wx' });
  return {
    ok: true,
    linhas: [
      `Gravado em ${relative(raiz, pasta)} — carregar por esta ordem (Carregar → Pré-visualizar → Aplicar, um de cada vez):`,
      ...Object.keys(out).map((x, i) => `  ${i + 1}. ${x}`),
      'Passos manuais na interface (sem coluna confirmada nos modelos):',
      ...manuais.map((m) => `  - ${m}`),
      `A campanha entra em Paused. Activar é manual, pelo dono da conta, depois de rever \`node "<MKT>/scripts/campanha/investimento.mjs" ${slug}\`.`,
    ],
  };
}

if (eEntrada(import.meta.url)) {
  const livres = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  try {
    if (livres.length < 2) throw new Error('uso: node "<MKT>/scripts/campanha/csv.mjs" <slug> <nome|ficheiro.md>');
    const r = await gerarCsv(livres[0], livres[1]);
    console.log(r.linhas.join('\n'));
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error(`✗ ${limparErro(e.message, 400)}`);
    process.exit(1);
  }
}
