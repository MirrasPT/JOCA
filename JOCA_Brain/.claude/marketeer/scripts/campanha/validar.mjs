#!/usr/bin/env node
// Validador da especificação de uma campanha Search. Só leitura: não fala com a
// Google Ads API; só faz GET às URLs das landings e dos sitelinks.
//
//   node "<MKT>/scripts/campanha/validar.mjs" <ficheiro.md> [--sem-rede]
//
// Erros (saída 1): texto acima do limite · contagem declarada (`Car.`) diferente da real · marcador
// por preencher (X, TODO) em texto de anúncio ou URL final · telefone no texto dos anúncios ·
// negativa que bloqueia uma palavra-chave positiva da mesma campanha/grupo · palavra-chave ampla ou
// repetida · par expressão/exacta partido entre grupos · RSA com mais de 15 títulos / 4 descrições,
// ou menos de 3 / 2, ou títulos repetidos · URL que não responde 200.
// Avisos (não falham): RSA incompleto (<15 / <4) · exacta sem expressão que a cubra no grupo.
//
//   validar(texto, { obter, rede }) → { erros, avisos, resumo }

import { readFileSync } from 'node:fs';
import { eEntrada } from '../validar-dossier.mjs';
import { limparErro } from '../auditoria/limpar.mjs';
import { lerEspecificacao, comprimento, LIMITES, MAX_PALAVRAS_POR_KW, bloqueia, mostrarPalavra, definicoes, negativasForaDeTabela } from './especificacao.mjs';

const PIOR_CASO_X = '10.000'; // "A partir de X €" conta-se como "A partir de 10.000 €" (convenção do PR #46)
const RE_TELEFONE = /(?<!\d)(?:\+?351[\s.-]?)?[29]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}(?!\d)/;
const RE_MARCADOR = /\bX\b|TODO|<sem fonte>/;

export async function estadoUrl(url, obter) {
  try {
    const r = await obter(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    try { await r.body?.cancel?.(); } catch { /* sem corpo */ }
    return { status: r.status, destino: r.headers?.get?.('location') ?? null };
  } catch (e) {
    return { status: null, erro: limparErro(e?.cause?.code ?? e?.name ?? 'erro', 60) };
  }
}

export async function validar(texto, { obter = globalThis.fetch, rede = true } = {}) {
  const e = lerEspecificacao(texto);
  const erros = [];
  const avisos = [];

  // 0. Definições de máquina (só quando o documento as tem — as especificações antigas não têm)
  if (e.dados?.campanha) erros.push(...definicoes(e.dados.campanha).erros);

  // 1. Caracteres de todos os textos
  for (const t of e.textos) {
    const n = comprimento(t.texto);
    const nPior = t.declarado?.marcador ? comprimento(t.texto.replace(/\bX\b/g, PIOR_CASO_X)) : n;
    const lim = LIMITES[t.tipo];
    if (nPior > lim) erros.push(`${t.onde}: "${t.texto}" tem ${nPior} caracteres (> ${lim})`);
    if (t.declarado && t.declarado.n !== nPior) erros.push(`${t.onde}: "${t.texto}" declara ${t.declarado.n}${t.declarado.marcador ? '*' : ''} caracteres, tem ${nPior}`);
    if (RE_MARCADOR.test(t.texto)) erros.push(`${t.onde}: "${t.texto}" tem um marcador por preencher`);
    if (RE_TELEFONE.test(t.texto) || e.telefones.some((tel) => t.texto.replace(/\D/g, '').includes(tel))) {
      erros.push(`${t.onde}: "${t.texto}" tem um número de telefone — o telefone vai só no recurso de chamada (política da Google)`);
    }
  }
  for (const p of e.caminhos) {
    if (p.length > 2) erros.push(`caminho /${p.join('/')}: máximo 2 partes`);
    for (const x of p) if (comprimento(x) > LIMITES.caminho) erros.push(`caminho "${x}" tem ${comprimento(x)} caracteres (> ${LIMITES.caminho})`);
  }

  // 2. RSA
  for (const a of e.anuncios) {
    const nome = `${a.grupo}${a.variante ? ` ${a.variante}` : ''}`;
    const [nt, nd] = [a.titulos.length, a.descricoes.length];
    if (nt > 15 || nt < 3) erros.push(`RSA ${nome}: ${nt} títulos (3 a 15)`);
    else if (nt < 15) avisos.push(`RSA ${nome}: ${nt} títulos (o modelo pede 15)`);
    if (nd > 4 || nd < 2) erros.push(`RSA ${nome}: ${nd} descrições (2 a 4)`);
    else if (nd < 4) avisos.push(`RSA ${nome}: ${nd} descrições (o modelo pede 4)`);
    const rep = a.titulos.map((x) => x.texto.toLowerCase()).filter((x, i, xs) => xs.indexOf(x) !== i);
    if (rep.length) erros.push(`RSA ${nome}: títulos repetidos: ${[...new Set(rep)].join(', ')}`);
    for (const x of [...a.titulos, ...a.descricoes]) if (x.fixar && (x.fixar < 1 || x.fixar > (a.titulos.includes(x) ? 3 : 2))) erros.push(`RSA ${nome}: ${x.id} fixado numa posição que não existe (${x.fixar})`);
  }
  const semAnuncio = e.grupos.filter((g) => !e.anuncios.some((a) => a.grupo === g.codigo));
  for (const g of semAnuncio) erros.push(`grupo ${g.codigo}: sem RSA`);

  // 3. Palavras-chave: ampla, repetidas, comprimento, pares expressão/exacta
  const campanhas = [...new Set(e.grupos.map((g) => g.campanha))];
  for (const c of campanhas) {
    const gs = e.grupos.filter((g) => g.campanha === c);
    const onde = new Map(); // text|match → grupo
    for (const g of gs) {
      for (const k of g.palavras) {
        if (RE_MARCADOR.test(k.text)) erros.push(`${g.codigo}: ${mostrarPalavra(k)} tem um marcador por preencher`);
        if (k.matchType === 'BROAD') erros.push(`${g.codigo}: ${k.text} é correspondência ampla — só expressão ("…") e exacta ([…])`);
        if (comprimento(k.text) > LIMITES.palavra || k.text.split(/\s+/).length > MAX_PALAVRAS_POR_KW) erros.push(`${g.codigo}: ${mostrarPalavra(k)} passa os limites (80 caracteres, 10 palavras)`);
        const chave = `${k.text.toLowerCase()}|${k.matchType}`;
        if (onde.has(chave)) erros.push(`${mostrarPalavra(k)} repetida (${onde.get(chave)} e ${g.codigo})`);
        else onde.set(chave, g.codigo);
      }
    }
    for (const [chave, grupo] of onde) {
      const [txt, m] = chave.split('|');
      const par = onde.get(`${txt}|${m === 'PHRASE' ? 'EXACT' : 'PHRASE'}`);
      if (m === 'PHRASE' && par && par !== grupo) erros.push(`par partido: "${txt}" em ${grupo} e [${txt}] em ${par} — expressão e exacta no mesmo grupo`);
      if (m === 'EXACT' && !par) {
        const cobre = gs.find((g) => g.codigo === grupo).palavras.some((k) => k.matchType === 'PHRASE' && bloqueia(k, txt));
        if (!cobre) avisos.push(`[${txt}] (${grupo}) sem expressão que a cubra no grupo`);
      }
    }
  }

  // 4. Negativas que bloqueiam positivas
  for (const g of e.grupos) {
    const aplicam = e.negativas.filter((n) => (n.nivel === 'grupo' ? n.alvo === g.codigo : n.alvo === '*' || n.alvo === g.campanha));
    for (const k of g.palavras) {
      for (const n of aplicam) {
        if (bloqueia(n, k.text)) erros.push(`negativa ${mostrarPalavra(n)} (${n.nivel === 'grupo' ? `grupo ${n.alvo}` : n.alvo === '*' ? 'campanha' : `campanha ${n.alvo}`}) bloqueia ${g.codigo} ${mostrarPalavra(k)}`);
      }
    }
  }

  // 4b. Negativas fora de tabela: aviso, não erro — a prosa das secções de negativas cita também
  // negativas rejeitadas ("`erp` sozinho não é negativa") e listas partilhadas; um erro recusaria
  // especificações correctas. O aviso diz onde, para o autor passar para tabela o que for negativa.
  for (const { secao, n } of negativasForaDeTabela(texto.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''))) {
    avisos.push(`secção "${secao}": ${n} termo(s) entre crases/aspas fora de tabela — NÃO são lidos como negativas; se o forem, passar para uma tabela`);
  }

  // 5. URL final e URLs dos sitelinks
  for (const u of e.urlsFinais) if (u.todo) erros.push(`URL final por preencher (${u.todo})`);
  const urls = [...new Set([...e.urlsFinais.filter((u) => u.url).map((u) => u.url), ...e.sitelinks.map((s) => s.url).filter(Boolean)])];
  for (const s of e.sitelinks) if (!s.url) erros.push(`sitelink "${s.texto}" sem URL`);
  if (!e.urlsFinais.some((u) => u.url) && e.grupos.length) erros.push('sem URL final');
  const estados = [];
  if (!rede) avisos.push(`URLs não verificadas (--sem-rede): ${urls.length}`);
  else {
    for (const url of urls) {
      const r = await estadoUrl(url, obter);
      estados.push({ url, ...r });
      if (r.status === 200) continue;
      if (r.status >= 300 && r.status < 400) erros.push(`${url} redirecciona (${r.status}${r.destino ? ` → ${r.destino}` : ''}) — usar o URL final`);
      else erros.push(`${url} responde ${r.status ?? `erro (${r.erro})`}`);
    }
  }

  const resumo = {
    campanhas: campanhas.length, grupos: e.grupos.length,
    palavras: e.grupos.reduce((t, g) => t + g.palavras.length, 0),
    negativas: e.negativas.length, rsa: e.anuncios.length, textos: e.textos.length,
    sitelinks: e.sitelinks.length, urls: urls.length, estados,
  };
  return { erros, avisos, resumo };
}

if (eEntrada(import.meta.url)) {
  const args = process.argv.slice(2);
  const ficheiro = args.find((a) => !a.startsWith('--'));
  if (!ficheiro) { console.error('uso: node "<MKT>/scripts/campanha/validar.mjs" <ficheiro.md> [--sem-rede]'); process.exit(2); }
  let texto;
  try { texto = readFileSync(ficheiro, 'utf8'); } catch (err) { console.error(`✗ não consigo ler ${ficheiro} (${err.code})`); process.exit(2); }
  const { erros, avisos, resumo } = await validar(texto, { rede: !args.includes('--sem-rede') });
  console.log(`Especificação ${ficheiro}`);
  console.log(`${resumo.campanhas} campanha(s) · ${resumo.grupos} grupos · ${resumo.palavras} palavras-chave · ${resumo.negativas} negativas · ${resumo.rsa} RSA · ${resumo.textos} textos contados · ${resumo.sitelinks} sitelinks · ${resumo.urls} URLs`);
  for (const s of resumo.estados) console.log(`  ${s.status === 200 ? '✓' : '✗'} ${s.status ?? s.erro} ${s.url}`);
  for (const a of avisos) console.log(`– ${a}`);
  for (const x of erros) console.log(`✗ ${x}`);
  console.log(erros.length ? `${erros.length} erro(s) — a especificação não passa.` : '✓ a especificação passa.');
  process.exit(erros.length ? 1 : 0);
}
