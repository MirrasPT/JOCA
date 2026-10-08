#!/usr/bin/env node
// Painel do Marketeer — um HTML autónomo por cliente e ciclo (sem CDN, sem fontes nem scripts externos).
// Uso: node painel.mjs --cliente <RAIZ>/clientes/<slug> [--ciclo AAAA-MM] [--saida <ficheiro.html>]
// Só lê (nunca escreve) os ficheiros do cliente: marca.md · conectores.md · estado.json · auditorias/*.json ·
//   ciclos/<ciclo>/{01-analise.md, 02-proposta.md, revisao-<fase>*.md, vendas-woocommerce-*.json, meta-ads-*.md,
//   03-artes/, 04-implementacao.md, 05-review.md}. Ficheiro em falta → a secção diz «ainda sem dados».
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, eur, eur0, int, numPT, slug, sec, subsecs, linhasTab, colIdx, inline, md2html, detalhes, colapsavel, blocos, fonteNota } from './md.mjs';
import { colunasMes, barrasH, faixaFases, pontosRevisao, nomeMes } from './graficos.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = {};
process.argv.slice(2).forEach((a, i, arr) => { if (a.startsWith('--')) args[a.slice(2)] = arr[i + 1]; });
if (!args.cliente) { console.error('Uso: node painel.mjs --cliente <RAIZ>/clientes/<slug> [--ciclo AAAA-MM] [--saida <f.html>]'); process.exit(2); }
const CLIENTE = path.resolve(args.cliente);
const ler = (p) => (fs.existsSync(p) && fs.statSync(p).isFile() ? fs.readFileSync(p, 'utf8') : null);
const lerJson = (p) => { const t = ler(p); try { return t ? JSON.parse(t) : null; } catch { console.error('JSON inválido: ' + p); return null; } };
const ultimo = (dir, re) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => re.test(f)).sort().pop() || null : null);
// percent-encoding de um segmento de caminho (UTF-8)
const urlSeg = (t) => [...new TextEncoder().encode(t)].map((b) => (/[A-Za-z0-9._~-]/.test(String.fromCharCode(b)) && b < 128 ? String.fromCharCode(b) : '%' + b.toString(16).toUpperCase().padStart(2, '0'))).join('');
const dataFich = (p) => (fs.existsSync(p) ? fs.statSync(p).mtime.toISOString().slice(0, 10) : null);

const estado = lerJson(path.join(CLIENTE, 'estado.json'));
if (!estado) { console.error('estado.json em falta ou inválido em ' + CLIENTE); process.exit(1); }
const CICLO = args.ciclo || estado.ciclo;
if (!CICLO) { console.error('estado.json sem o campo «ciclo» — corre com --ciclo AAAA-MM ou corrige o estado (estado.mjs).'); process.exit(1); }
const DC = path.join(CLIENTE, 'ciclos', CICLO);
const marca = ler(path.join(CLIENTE, 'marca.md')) || '';
const conectores = ler(path.join(CLIENTE, 'conectores.md')) || '';
const analise = ler(path.join(DC, '01-analise.md')) || '';
const proposta = ler(path.join(DC, '02-proposta.md')) || '';
const review = ler(path.join(DC, '05-review.md')) || '';
const vendasFich = ultimo(DC, /^vendas-woocommerce-.*\.json$/);
const vendas = vendasFich ? lerJson(path.join(DC, vendasFich)) : null;
const metaFich = ultimo(DC, /^meta-ads-.*\.md$/);
const meta = metaFich ? ler(path.join(DC, metaFich)) : null;
const metaData = meta ? ((meta.match(/leitura (\d{4}-\d{2}-\d{2})/) || meta.match(/[Ll]ido a (\d{4}-\d{2}-\d{2})/) || metaFich.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null) : null;
const audDir = path.join(CLIENTE, 'auditorias');
const audFich = ultimo(audDir, /\.json$/);
const auditoria = audFich ? lerJson(path.join(audDir, audFich)) : null;
// revisões por fase: revisao-<fase>.md + revisao-<fase>-*.md (voltas seguintes), por ordem de nome
const FASES_REV = [['proposta', 'Proposta (F2)'], ['artes', 'Artes (F3)'], ['implementacao', 'Implementação (F4)'], ['review', 'Review (F5)']];
const revisoes = FASES_REV.map(([f, nome]) => {
  const fichs = fs.existsSync(DC) ? fs.readdirSync(DC).filter((x) => new RegExp(`^revisao-${f}(-.+)?\\.md$`).test(x) && !/brief/.test(x)).sort((a, b) => a.length - b.length || a.localeCompare(b)) : [];
  return { fase: f, nome, fichs, texto: fichs.map((x) => ler(path.join(DC, x))).join('\n') };
}).filter((r) => r.fichs.length);

const nomeMarca = (marca.match(/^#\s+(.+?)(?:\s+—.*)?$/m) || [])[1]?.trim() || estado.slug || path.basename(CLIENTE);
const FV = vendas ? `<code>${esc(vendasFich)}</code> (${esc(String(vendas.fonte || 'WooCommerce').split(' (')[0])}, lido ${esc(vendas.gerado)})` : '';
const FM = (t) => `<code>${esc(metaFich)}</code>${t ? ` §${esc(t)}` : ''} (lido ${esc(metaData || '—')})`;
const nv = '<span class="etq nv">não verificado</span>';
const pl = (n, um, varios) => `${int(n)} ${n === 1 ? um : varios}`;
// a leitura da Meta declara as compras do píxel como não fiáveis?
const pixelNaoFiavel = meta ? /erro do p[íi]xel|não (é )?fiáve(l|is)/i.test(meta) : false;
const etqPixel = pixelNaoFiavel ? ' <span class="etq confirmar">não fiável (píxel)</span>' : ' <span class="etq inferencia">reportado pela Meta</span>';
const semDados = (o) => `<div class="por-fazer"><p>Ainda sem dados — ${o}</p></div>`;

// ---------- séries mensais ----------
const mesSeg = (k) => { let [a, m] = k.split('-').map(Number); m === 12 ? (a++, m = 1) : m++; return `${a}-${String(m).padStart(2, '0')}`; };
const intervalo = (de, ate) => { const out = []; for (let k = de; k <= ate; k = mesSeg(k)) out.push(k); return out; };

const WC = (() => {
  if (!vendas?.mensal?.length) return null;
  const mapa = new Map(vendas.mensal.map((m) => [m.mes, m]));
  const meses = [...mapa.keys()].sort();
  const de = (vendas.historico?.de || meses[0]).slice(0, 7);
  const ate = [meses[meses.length - 1], (vendas.historico?.ate || '').slice(0, 7)].sort().pop();
  const parcial = (vendas.gerado || '').slice(0, 7);
  // o ficheiro lê todo o histórico da loja: mês sem linha dentro do intervalo = 0 encomendas
  const val = (k, campo) => (k < de || k > ate ? null : (mapa.get(k)?.[campo] ?? 0));
  return { de, ate, parcial, val };
})();

const META = (() => {
  if (!meta) return null;
  const s = subsecs(meta, 2).find((x) => /^Por mês/i.test(x.titulo || ''));
  if (!s) return null;
  const [cab, ...rows] = linhasTab(s.corpo);
  const iG = colIdx(cab, /gasto/i); const iC = colIdx(cab, /compras/i);
  const mapa = new Map();
  for (const r of rows) {
    const k = (r[0].match(/(\d{4}-\d{2})/) || [])[1]; if (!k) continue;
    mapa.set(k, { gasto: iG >= 0 ? numPT(r[iG]) : null, compras: iC >= 0 ? numPT(r[iC]) : null, parcial: /até|parcial/i.test(r[0]) });
  }
  const meses = [...mapa.keys()].sort();
  if (!meses.length) return null;
  const zeros = /meses sem linha\s*=\s*gasto 0/i.test(s.corpo);
  const de = meses[0]; const ate = meses[meses.length - 1];
  const val = (k, campo) => { if (mapa.has(k)) return mapa.get(k)[campo] ?? (campo === 'compras' ? 0 : null); return k >= de && k <= ate && zeros ? 0 : null; };
  return { titulo: s.titulo, de, ate, mapa, zeros, val };
})();

// produto em foco = objeto do ficheiro de vendas com «produto_id» (o produto que o ciclo vende)
const foco = (() => {
  if (!vendas) return null;
  const [chave, obj] = Object.entries(vendas).find(([, v]) => v && typeof v === 'object' && !Array.isArray(v) && 'produto_id' in v) || [];
  if (!obj) return null;
  const cat = (vendas.catalogo || []).find((c) => c.id === obj.produto_id);
  return { chave, obj, cat };
})();

// ---------- KPIs ----------
const kpi = (rotulo, valor, contexto, fonte) => `<div class="kpi"><div class="kpi-r">${rotulo}</div><div class="kpi-v">${valor}</div>${contexto ? (contexto.replace(/<[^>]+>/g, '').length > 90 ? `<details class="kpi-f kpi-c-d"><summary>como se calcula</summary><div class="kpi-c">${contexto}</div></details>` : `<div class="kpi-c">${contexto}</div>`) : ''}<details class="kpi-f"><summary>fonte</summary>${fonte}</details></div>`;
function kpiLista() {
  const out = [];
  if (vendas) {
    for (const [campo, nome] of [['ultimos_30d', '30 dias'], ['ultimos_90d', '90 dias']]) {
      const o = vendas[campo]; if (!o) continue;
      out.push(kpi(`Vendas pagas · ${nome}`, eur(o.receita_bruta_com_iva_e_portes), `${pl(o.encomendas, 'encomenda', 'encomendas')} · ${esc(o.de)} a ${esc(o.ate)} · c/ IVA e portes`, `${FV} · ${campo}`));
    }
  }
  if (meta) {
    const jan = subsecs(meta, 2).find((x) => /^Janelas/i.test(x.titulo || ''));
    if (jan) {
      const [cab, ...rows] = linhasTab(jan.corpo);
      const iG = colIdx(cab, /gasto/i); const iC = colIdx(cab, /compras/i); const iCpa = colIdx(cab, /custo/i); const iR = colIdx(cab, /roas/i);
      rows.forEach((r) => {
        const pixel = [iC >= 0 && `${esc(r[iC])} compras`, iCpa >= 0 && `${esc(r[iCpa])} por compra`, iR >= 0 && `ROAS ${esc(r[iR])}`].filter(Boolean).join(' · ');
        const dias = numPT(r[0]); const loja = vendas?.[`ultimos_${dias}d`]; const gasto = iG >= 0 ? numPT(r[iG]) : null;
        if (loja?.encomendas && gasto != null) {
          // medida de verdade: gasto ÷ vendas pagas da loja na mesma janela (mínimo; nem todas as vendas vêm dos anúncios)
          out.push(kpi(`Gasto Meta por venda paga · ${esc(r[0])}`, eur(gasto / loja.encomendas), `${esc(r[iG])} gastos ÷ ${pl(loja.encomendas, 'venda paga', 'vendas pagas')} na loja (${esc(loja.de)} a ${esc(loja.ate)}) · ${eur(loja.receita_bruta_com_iva_e_portes / gasto)} de vendas por cada 1 € gasto <span class="etq inferencia">inferência: divisão</span><br>Píxel: ${pixel}${etqPixel}`, `${FM(jan.titulo)} · ${FV} · ultimos_${dias}d`));
        } else out.push(kpi(`Gasto em anúncios Meta · ${esc(r[0])}`, esc(r[iG] ?? '—'), pixel ? `Píxel: ${pixel}${etqPixel}` : '', FM(jan.titulo)));
      });
    }
  }
  if (vendas?.ultimos_90d?.ticket_medio_com_iva != null) out.push(kpi('Ticket médio · 90 dias', eur(vendas.ultimos_90d.ticket_medio_com_iva), vendas.total_vendas ? `histórico: ${eur(vendas.total_vendas.ticket_medio_com_iva)}` : '', `${FV} · ultimos_90d`));
  if (vendas?.clientes?.distintos != null) out.push(kpi('Clientes distintos (histórico)', int(vendas.clientes.distintos), vendas.clientes.repetentes_2mais_encomendas != null ? `repetentes: ${esc(vendas.clientes.repetentes_2mais_encomendas)}` : '', `${FV} · clientes`));
  return out;
}
function kpis() { const out = kpiLista(); return out.length ? `<div class="kpis">${out.join('\n')}</div>` : ''; }

// ---------- gráficos de avaliação ----------
function graficos() {
  if (!WC && !META) return semDados('falta <code>vendas-woocommerce-*.json</code> e <code>meta-ads-*.md</code> no ciclo.');
  if (!WC || !META) return `<p class="lead">Os gráficos de avaliação cruzam as vendas da loja com os anúncios Meta. Falta ${!WC ? '<code>vendas-woocommerce-*.json</code> (campo <code>mensal</code>)' : '<code>meta-ads-*.md</code> (tabela «Por mês»)'} — ainda sem dados.</p>`;
  const de = [WC.de, META.de].sort().pop(); const ate = [WC.ate, META.ate].sort().pop();
  const meses = intervalo(de, ate);
  const parcial = (k) => k === WC.parcial || META.mapa.get(k)?.parcial;
  const fonteAmbos = `${FV} · <code>mensal</code> · ${FM(META.titulo)}`;
  const defVenda = vendas.definicao_venda ? esc(String(vendas.definicao_venda).split('.')[0]) + '.' : '';
  // antes do 1.º registo da loja
  const antes = [...META.mapa.entries()].filter(([k]) => k < WC.de);
  const antesTxt = antes.length ? ` Antes do 1.º registo da loja (${nomeMes(WC.de)}), a Meta reportou ${int(antes.reduce((s, [, v]) => s + (v.compras || 0), 0))} compras com ${eur(antes.reduce((s, [, v]) => s + (v.gasto || 0), 0))} de gasto (${nomeMes(antes[0][0])} a ${nomeMes(antes[antes.length - 1][0])}) — ficam fora do gráfico porque a loja não tem dados desses meses.` : '';

  // (a) receita das vendas pagas vs gasto Meta (€, um só eixo)
  const A = meses.map((k) => {
    const rec = WC.val(k, 'receita_bruta_com_iva_e_portes'); const n = WC.val(k, 'encomendas'); const g = META.val(k, 'gasto');
    const f = (v) => (v == null ? 'não verificado' : eur(v));
    return { mes: k, parcial: parcial(k), valores: [rec, g], tip: `${nomeMes(k)}: vendas pagas ${f(rec)} (${n == null ? '?' : pl(n, 'encomenda', 'encomendas')}) · gasto Meta ${f(g)}`, linhaTabela: [f(rec), n == null ? 'não verificado' : int(n), f(g)] };
  });
  const ambos = A.filter((m) => m.valores.every((v) => v != null) && (m.valores[0] > 0 || m.valores[1] > 0));
  const piores = ambos.filter((m) => m.valores[1] > m.valores[0]);
  const somaR = ambos.reduce((s, m) => s + m.valores[0], 0); const somaG = ambos.reduce((s, m) => s + m.valores[1], 0);
  const gA = colunasMes({
    titulo: `Em ${piores.length} de ${pl(ambos.length, 'mês', 'meses')}, o gasto em anúncios Meta foi maior do que a receita das vendas pagas`,
    subtitulo: `${nomeMes(de)} a ${nomeMes(ate)}: ${eur(somaG)} gastos em anúncios Meta (soma da tabela mensal, que pode diferir do total da conta por arredondamentos) contra ${eur(somaR)} de vendas pagas na loja (c/ IVA e portes), nos meses com dados dos dois lados.`,
    meses: A, series: [{ nome: 'Vendas pagas (WooCommerce), €', cor: 'var(--s1)' }, { nome: 'Gasto em anúncios Meta, €', cor: 'var(--s2)' }],
    colunasTabela: ['Vendas pagas, €', 'Vendas pagas, n.º', 'Gasto Meta, €'], fmt: (v, eixo) => (eixo ? eur0(v) : eur(v)),
    fonte: `${fonteAmbos}. ${defVenda} «?» = não verificado.`,
    curto: 'vendas pagas vs gasto Meta',
    alt: `Colunas por mês, em euros, de ${nomeMes(de)} a ${nomeMes(ate)}. Em ${piores.length} de ${ambos.length} meses o gasto Meta superou a receita das vendas pagas. Total: ${eur(somaG)} de gasto e ${eur(somaR)} de vendas. Tabela de dados disponível abaixo.`,
  });

  // (b) gasto por venda paga, com o teto do preço do produto
  const teto = foco?.cat?.preco_regular != null ? { valor: foco.cat.preco_regular, rotulo: `Teto: preço de tabela de «${foco.cat.produto}», ${eur(foco.cat.preco_regular)}`, atual: foco.cat.preco_atual }
    : vendas.ultimos_90d?.ticket_medio_com_iva != null ? { valor: vendas.ultimos_90d.ticket_medio_com_iva, rotulo: `Teto: ticket médio 90 dias, ${eur(vendas.ultimos_90d.ticket_medio_com_iva)}` } : null;
  // o teto do produto só vale desde que o produto existe (criação no catálogo ou 1.ª venda, o que vier primeiro)
  const desdeK = foco?.cat ? [foco.cat.criado, foco.obj.resumo?.primeira_encomenda].filter(Boolean).map((d) => String(d).slice(0, 7)).sort()[0] : null;
  const iDesde = desdeK && desdeK > de ? meses.indexOf(desdeK) : 0;
  const B = meses.map((k) => {
    const g = META.val(k, 'gasto'); const n = WC.val(k, 'encomendas');
    if (g == null || n == null) return { mes: k, parcial: parcial(k), valores: [null], tip: `${nomeMes(k)}: não verificado`, linhaTabela: ['não verificado', g == null ? 'não verificado' : eur(g), n == null ? 'não verificado' : int(n)] };
    if (g === 0) return { mes: k, parcial: parcial(k), valores: [null], vazio: true, tip: `${nomeMes(k)}: sem gasto em anúncios`, linhaTabela: ['sem gasto', eur(0), int(n)] };
    if (n === 0) return { mes: k, parcial: parcial(k), valores: [null], especial: true, tip: `${nomeMes(k)}: ${eur(g)} gastos e 0 vendas pagas`, linhaTabela: ['sem venda paga', eur(g), '0'] };
    const v = g / n;
    return { mes: k, parcial: parcial(k), valores: [v], tip: `${nomeMes(k)}: ${eur(v)} por venda paga (${eur(g)} ÷ ${pl(n, 'venda', 'vendas')})`, linhaTabela: [eur(v), eur(g), int(n)] };
  });
  const comGasto = B.filter((m) => !m.vazio && (m.valores[0] != null || m.especial));
  const comTeto = comGasto.filter((m) => meses.indexOf(m.mes) >= iDesde);
  const acima = teto ? comTeto.filter((m) => m.especial || m.valores[0] > teto.valor) : [];
  const gB = colunasMes({
    titulo: teto ? `${iDesde > 0 ? `Desde ${nomeMes(meses[iDesde])}, em` : 'Em'} ${acima.length} de ${pl(comTeto.length, 'mês', 'meses')} com anúncios, cada venda paga custou mais do que ${teto.rotulo.replace(/^Teto: /, 'o ')}` : `Gasto em anúncios Meta por venda paga, por mês`,
    curto: 'gasto por venda paga', cortarExtremo: true,
    subtitulo: `Gasto Meta do mês ÷ vendas pagas na loja no mesmo mês. É um mínimo: se parte das vendas não veio dos anúncios, cada venda dos anúncios custou mais <span class="etq inferencia">inferência</span>.${teto?.atual != null && teto.atual !== teto.valor ? ` Preço atual do produto: ${eur(teto.atual)}.` : ''}${iDesde > 0 ? ` Antes de ${nomeMes(meses[iDesde])} o produto em foco não existia (catálogo: criado ${esc(foco.cat.criado)}): esses meses ficam a cinzento, sem teto.` : ''}`,
    meses: B, series: [{ nome: 'Gasto por venda paga, €', cor: 'var(--s1)' }], colunasTabela: ['Gasto por venda, €', 'Gasto Meta, €', 'Vendas pagas, n.º'],
    fmt: (v, eixo) => (eixo ? eur0(v) : eur(v)), linhas: teto ? [{ valor: teto.valor, rotulo: teto.rotulo, curto: `teto ${eur(teto.valor)}`, desde: iDesde }] : [],
    corDe: teto ? (i, s, v) => (i < iDesde ? 'var(--tinta-3)' : v > teto.valor ? 'var(--critico)' : null) : null,
    legendaExtra: [...(teto ? [{ cor: 'var(--s1)', nome: 'abaixo do teto' }, { cor: 'var(--critico)', nome: 'acima do teto' }, { forma: 'limiar', nome: teto.rotulo.replace(/^Teto: /, 'teto: ') }, ...(iDesde > 0 ? [{ cor: 'var(--tinta-3)', nome: 'antes de o produto existir (sem teto)' }] : [])] : []), { forma: 'oco', nome: 'gasto sem nenhuma venda paga' }],
    fonte: `${fonteAmbos}${foco?.cat ? ` · preço: ${FV} · <code>catalogo</code>` : ''}. Conta: inferência (divisão).`,
    alt: `Colunas por mês com o gasto em anúncios por venda paga${teto ? ` e uma linha tracejada no teto de ${eur(teto.valor)}` : ''}. ${acima.length} de ${comTeto.length} meses com anúncios${iDesde > 0 ? ` desde ${nomeMes(meses[iDesde])}` : ''} ficaram acima do teto, ${B.filter((m) => m.especial).length} deles sem nenhuma venda paga.`,
  });

  // (c) compras reportadas pela Meta vs vendas pagas reais (contagens)
  const C = meses.map((k) => {
    const n = WC.val(k, 'encomendas'); const c = META.val(k, 'compras');
    const f = (v) => (v == null ? 'não verificado' : int(v));
    return { mes: k, parcial: parcial(k), valores: [n, c], tip: `${nomeMes(k)}: ${n == null ? 'não verificado' : pl(n, 'venda paga', 'vendas pagas')} na loja · ${c == null ? 'não verificado' : pl(c, 'compra reportada', 'compras reportadas')} pela Meta`, linhaTabela: [f(n), f(c), n != null && c != null ? (c - n > 0 ? '+' : '') + int(c - n) : '—'] };
  });
  const cAmbos = C.filter((m) => m.valores.every((v) => v != null));
  const sW = cAmbos.reduce((s, m) => s + m.valores[0], 0); const sM = cAmbos.reduce((s, m) => s + m.valores[1], 0);
  const fantasma = cAmbos.filter((m) => m.valores[0] === 0 && m.valores[1] > 0);
  const gC = colunasMes({
    titulo: sM > sW ? `A Meta reportou ${int(sM)} compras, mas a loja só registou ${int(sW)} vendas pagas — ${int(sM - sW)} a mais` : `A Meta reportou ${int(sM)} compras e a loja registou ${int(sW)} vendas pagas`,
    subtitulo: `${nomeMes(de)} a ${nomeMes(ate)}, meses com dados dos dois lados.${fantasma.length ? ` Em ${pl(fantasma.length, 'mês', 'meses')} (${fantasma.map((m) => nomeMes(m.mes)).join(', ')}) a Meta reportou ${int(fantasma.reduce((s, m) => s + m.valores[1], 0))} compras com 0 vendas pagas na loja.` : ''}${antesTxt}`,
    meses: C, series: [{ nome: 'Vendas pagas (WooCommerce)', cor: 'var(--s1)' }, { nome: 'Compras reportadas pela Meta (píxel)', cor: 'var(--s2)' }],
    colunasTabela: ['Vendas pagas', 'Compras Meta', 'Diferença'], fmt: (v) => int(Math.round(v)),
    fonte: `${fonteAmbos}. A Meta atribui compras à sua maneira (janela de atribuição); as duas contagens não se somam.`,
    curto: 'compras Meta vs vendas pagas',
    alt: `Colunas por mês com o número de vendas pagas na loja e de compras reportadas pela Meta. Total: ${sM} compras Meta contra ${sW} vendas pagas.`,
  });
  return gA + gB + gC;
}

// ---------- estado e revisão ----------
const FASES = [['F0', 'Arranque'], ['F1', 'Análise'], ['F2', 'Proposta'], ['F3', 'Artes'], ['F4', 'Implementação'], ['F5', 'Review']];
const aprov = estado.aprovacoes || {};
function voltasDe(texto) {
  const voltas = []; let v = null; let j = null; let emDuros = false;
  for (const l of texto.split('\n')) {
    const mv = l.match(/^## Volta (\d+)\s*(?:—\s*(.*))?/); if (mv) { v = { n: mv[1], nota: (mv[2] || '').trim(), juizes: [] }; voltas.push(v); j = null; continue; }
    const mj = l.match(/^### (.+?)(?:\s+—\s+([^·]+))?(?:·.*)?$/); if (mj && v) { j = { id: mj[1].trim(), papel: (mj[2] || '').trim(), aprovado: null, duros: 0 }; v.juizes.push(j); emDuros = false; continue; }
    const ma = l.match(/^aprovado:\s*(true|false)/); if (ma && j) { j.aprovado = ma[1] === 'true'; continue; }
    if (/^Achados duros/i.test(l)) { emDuros = true; continue; }
    if (emDuros && j && /^\d+\.\s/.test(l)) j.duros++;
    else if (emDuros && /^\S/.test(l) && !/^\d+\.\s/.test(l)) emDuros = false;
  }
  return voltas;
}
function secRevisao() {
  if (!revisoes.length) return `<section id="revisao" aria-labelledby="h-revisao"><h2 id="h-revisao">Revisão independente</h2>${semDados('não há <code>revisao-&lt;fase&gt;.md</code> no ciclo — revisão independente por fazer.')}</section>`;
  const blocos = revisoes.map((r) => {
    const voltas = voltasDe(r.texto);
    if (!voltas.length) return `<div class="cartao"><h3>${esc(r.nome)}</h3><p>${nv} — sem voltas legíveis em ${r.fichs.map((f) => `<code>${esc(f)}</code>`).join(', ')}.</p></div>`;
    const ult = voltas[voltas.length - 1];
    const ok = ult.juizes.length && ult.juizes.every((j) => j.aprovado === true);
    const defeitos = ult.juizes.filter((j) => j.aprovado === false).length;
    const veredito = ok ? `<span class="selo ok">✓ Aprovada na volta ${esc(ult.n)}</span>` : ult.juizes.some((j) => j.aprovado == null) ? `<span class="selo espera">? Veredito incompleto na volta ${esc(ult.n)}</span>` : `<span class="selo ko">✕ Com defeitos na volta ${esc(ult.n)} (${defeitos} juiz${defeitos > 1 ? 'es' : ''})</span>`;
    const nVoltasKo = voltas.filter((v) => v.juizes.some((j) => j.aprovado === false)).length;
    const titulo = `${r.nome}: ${ok ? `aprovada por todos os juízes na volta ${ult.n}${nVoltasKo ? `, depois de ${pl(nVoltasKo, 'volta', 'voltas')} com defeitos` : ', sem voltas com defeitos'}` : `ainda com defeitos na volta ${ult.n}`}`;
    return `<figure class="grafico"><figcaption><span class="g-tit">${esc(ok ? `A ${r.nome.toLowerCase().replace(/ \(f\d\)/, '')} passou na revisão independente (volta ${ult.n} de ${voltas.length})` : `A ${r.nome.toLowerCase().replace(/ \(f\d\)/, '')} ainda tem defeitos por resolver`)}</span><span class="g-sub">${veredito} · ${pl(voltas.length, 'volta', 'voltas')}, ${nVoltasKo} com defeitos · quem reviu: ${esc([...new Set(voltas.flatMap((v) => v.juizes.map((j) => j.id)))].join(', '))}</span></figcaption>
<ul class="legenda"><li><span class="sw" style="background:var(--ok)"></span>aprovado</li><li><span class="sw" style="background:var(--critico)"></span>com defeitos</li><li><span class="sw" style="background:var(--linha)"></span>sem veredito</li></ul>
<div class="g-rolo">${pontosRevisao(voltas, titulo)}</div>
<details class="dados"><summary>Ver os dados em tabela</summary><div class="tabela"><table><caption>${esc(titulo)}</caption><thead><tr><th scope="col">Volta</th><th scope="col">Juiz</th><th scope="col">Veredito</th><th scope="col" class="num">Achados duros</th></tr></thead><tbody>${voltas.flatMap((v) => v.juizes.map((j) => `<tr><td data-rotulo="Volta">${esc(v.n)}${v.nota ? ` <small>${esc(v.nota)}</small>` : ''}</td><td data-rotulo="Juiz">${esc(j.id)}${j.papel ? `<br><small>${esc(j.papel)}</small>` : ''}</td><td data-rotulo="Veredito">${j.aprovado == null ? '—' : j.aprovado ? '✓ aprovado' : '✕ com defeitos'}</td><td data-rotulo="Achados duros" class="num">${j.duros || '—'}</td></tr>`)).join('')}</tbody></table></div></details>
<p class="fonte-nota">Fonte: ${r.fichs.map((f) => `<code>${esc(f)}</code>`).join(' · ')} (linhas <code>aprovado:</code> de cada juiz).</p></figure>`;
  }).join('');
  const resumoRev = sec(proposta, 'Revisão independente');
  return `<section id="revisao" aria-labelledby="h-revisao"><h2 id="h-revisao">Revisão independente</h2><p class="lead">Quem produz não revê: cada fase passa por juízes que só leem e apontam defeitos. O veredito final é o da última volta.</p>${blocos}${resumoRev ? `<h3>O que a revisão mudou na proposta</h3>${colapsavel(resumoRev)}${fonteNota('<code>02-proposta.md</code> §Revisão independente')}` : ''}</section>`;
}

// ---------- decisões: um ecrã por decisão ----------
const semFonte = (t) => t.replace(/\s*\[(fonte|inferência|por confirmar)[^\]]*\]/gi, '').replace(/\s{2,}/g, ' ').trim();
const plano = (t) => String(t).replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
function decisoesLista() {
  const md = sec(proposta, 'Decisões pedidas'); if (!md) return null;
  const intro = []; const itens = []; let atual = null;
  for (const l of md.split('\n')) {
    const m = l.match(/^\d+\.\s+(.*)/);
    if (m) { atual = [m[1]]; itens.push(atual); } else if (atual && /^\s+\S/.test(l)) atual.push(l.trim()); else if (!atual && l.trim()) intro.push(l); else if (atual && l.trim()) { atual = null; intro.push(l); }
  }
  const lista = itens.map((it) => {
    const bruto = it.join(' ');
    const mt = bruto.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    const titulo = (mt ? mt[1] : bruto.split(/[.:—]/)[0]).replace(/[:.]\s*$/, '').trim();
    const resto = semFonte(mt ? mt[2].replace(/^[:—-]\s*/, '') : bruto);
    const resolvida = /^\*{0,2}\s*Resolvido|\bResolvido \d{4}-\d{2}-\d{2}/i.test(bruto);
    // convenção: «Opções …: a · b · c.» (a frase termina em «. Nota» ou no fim) ou a própria lista separada por « · »
    const mo = semFonte(bruto).match(/Opções[^:]*:\s*(.+?)(?:\.\s+(?:Nota|Esta|\*\*)|\.?$)/);
    let partes = (mo ? mo[1] : resto).split(/\s+·\s+/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean);
    let opcoes = partes.length >= 2 && partes.every((x) => x.length <= 240) ? partes : null;
    if (resolvida) opcoes = null;
    if (opcoes) opcoes = opcoes.map((o) => { let t = o.replace(/^ou\s+/i, ''); if (/^\(/.test(t)) t = `${titulo} ${t}`; const rec = /recomendad/i.test(t); t = t.replace(/\s*,?\s*(\*\*)?recomendad[oa](\*\*)?,?/i, '').replace(/^\*\*sem recomendação\*\*\s*/i, ''); t = plano(t); return { txt: t.charAt(0).toUpperCase() + t.slice(1), rec }; });
    const gist = resto.length > 200 ? resto.slice(0, 200).replace(/\s+\S*$/, '') + '…' : resto;
    return { titulo, bruto, opcoes, gist, resolvida };
  });
  return { intro: intro.join('\n'), lista };
}
const GENERICAS = [{ txt: 'Aprovo como proposto', rec: true }, { txt: 'Quero mudar (indico no chat)', rec: false }, { txt: 'Não sei', rec: false }];
function secDecisoes() {
  const d = decisoesLista();
  const selo = aprov.proposta ? `<span class="selo ok">✓ Proposta aprovada</span>` : `<span class="selo espera">A aguardar aprovação da proposta</span>`;
  if (!d) return `<section id="decisoes" data-tab="decisoes" aria-labelledby="h-decisoes"><h2 id="h-decisoes">Decisões pedidas</h2><p class="estado-linha">${selo}</p>${semDados('sem §Decisões pedidas no <code>02-proposta.md</code>.')}</section>`;
  const aDecidir = d.lista.filter((x) => !x.resolvida); const N = aDecidir.length; let k = 0;
  const slides = d.lista.map((x, idx) => {
    const id = idx === 0 ? 'decisoes' : `decisoes-${idx + 1}`;
    const detalhe = x.bruto.length > 240 || /\[(fonte|inferência)/i.test(x.bruto) ? `<details class="mais"><summary>Ver contexto e fontes</summary><div>${inline(x.bruto)}</div></details>` : '';
    if (x.resolvida) return `<section id="${id}" data-tab="decisoes" aria-labelledby="h-${id}"><p class="kick">Já resolvido</p><h2 id="h-${id}">${inline(x.titulo)}</h2><p class="sub">${inline(x.gist)}</p>${detalhe}</section>`;
    k++;
    const ops = x.opcoes || GENERICAS;
    return `<section id="${id}" data-tab="decisoes" data-d="${k}" data-nome="${esc(plano(x.titulo))}" aria-labelledby="h-${id}"><p class="kick">Decisão ${k} de ${N}</p><h2 id="h-${id}">${inline(x.titulo)}</h2>${x.opcoes ? '' : `<p class="sub">${inline(x.gist)}</p>`}
<div class="opcoes" role="group" aria-label="Opções">${ops.map((o) => `<button type="button" class="op" data-v="${esc(o.txt)}" aria-pressed="false"><span>${esc(o.txt)}</span>${o.rec ? '<em class="tag">Recomendado</em>' : ''}</button>`).join('')}</div>${detalhe}</section>`;
  }).join('\n');
  const fim = `<section id="escolhas" data-tab="decisoes" aria-labelledby="h-escolhas"><p class="kick">As tuas escolhas</p><h2 id="h-escolhas">Falta decidir.</h2><ul class="res" id="res"></ul>
<div class="acoes"><button type="button" class="btn" id="copiar">Copiar escolhas</button><button type="button" class="btn sec" id="limpar">Recomeçar</button></div><p class="nota" id="msg" role="status">Cola o texto copiado no chat. As escolhas ficam guardadas neste browser.</p></section>`;
  return slides + '\n' + fim;
}

// ---------- resumo: a 1.ª vista ----------
function secResumo() {
  const d = decisoesLista();
  const faltam = d ? d.lista.filter((x) => !x.resolvida).length : 0;
  const faseAtual = FASES.find(([f]) => f === estado.fase);
  const alertas = meta ? subsecs(meta, 2).filter((x) => /^⚠/.test(x.titulo || '')).map((x) => x.titulo.replace(/^⚠\s*/, '')) : [];
  const ks = kpiLista().slice(0, 4);
  const titulo = aprov.proposta ? 'A proposta está aprovada.' : 'A proposta espera pela tua decisão.';
  return `<section id="resumo" data-tab="resumo" aria-labelledby="h-resumo"><p class="kick">Ciclo ${esc(CICLO)}${faseAtual ? ` · fase ${esc(faseAtual[0])} ${esc(faseAtual[1])}` : ''}</p><h2 id="h-resumo">${titulo}</h2>
<p class="sub">${inline(estado.proxima_accao || '—')}</p>${avisoVoltas()}
<div class="fases-wrap">${faixaFases(FASES, estado.passos)}</div>
${faltam ? `<div class="acoes"><a class="btn" href="#decisoes">Começar as ${faltam} decisões →</a></div>` : ''}
${ks.length ? `<h3 class="sec-t">Números principais</h3><div class="kpis">${ks.join('\n')}</div><p class="fonte-nota"><a href="#numeros">Todos os números e gráficos →</a></p>` : ''}
${alertas.length ? `<h3 class="sec-t">Atenção</h3><ul class="alertas-l">${alertas.map((a) => `<li>${inline(a)}</li>`).join('')}</ul><p class="fonte-nota"><a href="#meta">Ver os anúncios Meta →</a></p>` : ''}</section>`;
}

// pontos do resumo executivo: título (negrito do início) + 1.ª frase curta; o texto completo fica escondido
function resumoCurto(md) {
  const itens = md.split('\n').filter((l) => /^\d+\.\s/.test(l)).map((l) => l.replace(/^\d+\.\s+/, ''));
  const cartoes = itens.map((t) => {
    const m = t.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/); const tit = m ? m[1].replace(/:$/, '') : t.slice(0, 40); const corpo = semFonte(m ? m[2] : t);
    const gist = corpo.length > 150 ? corpo.slice(0, 150).replace(/\s+\S*$/, '') + '…' : corpo;
    return `<div class="cartao"><h3>${inline(tit)}</h3><p>${inline(gist)}</p></div>`;
  });
  return `${cartoes.length ? `<div class="resumo-pontos">${cartoes.join('')}</div>` : ''}${detalhes('Ler o resumo executivo completo', md2html(md, 4))}`;
}
// ---------- proposta ----------
const FORA_PROPOSTA = /^(Resumo executivo|Decisões pedidas|Lacunas|Fontes|Revisão independente|Melhorias ao site|Medição)/;
function secProposta() {
  if (!proposta) return `<section id="proposta" aria-labelledby="h-proposta"><h2 id="h-proposta">Proposta <span class="sec-fase">F2</span></h2>${semDados('falta <code>02-proposta.md</code>.')}</section>`;
  const resumo = sec(proposta, 'Resumo executivo');
  const orc = sec(proposta, 'Orçamento');
  let orcK = '';
  const tab = linhasTab(orc);
  const tot = tab.find((r) => /total/i.test(r[0]));
  if (tot) {
    orcK = `<div class="kpis">${tot.slice(1).map((c, k) => [tab[0][k + 1], c]).filter(([h, c]) => h && c.length < 40 && /\d/.test(c)).map(([h, c]) => kpi(`${inline(tot[0].replace(/\*\*/g, ''))} · ${inline(h)}`, inline(c.replace(/\*\*/g, '')), '', '<code>02-proposta.md</code> §Orçamento')).join('')}</div>`;
  }
  const secs = subsecs(proposta, 2).filter((s) => s.titulo && !FORA_PROPOSTA.test(s.titulo));
  return `<section id="proposta" aria-labelledby="h-proposta"><h2 id="h-proposta">Proposta <span class="sec-fase">F2</span></h2>
${resumo ? resumoCurto(resumo) : ''}
${orcK ? `<h3>Orçamento pedido</h3>${orcK}` : ''}
${secs.map((s) => `<h3>${inline(s.titulo)}</h3>${colapsavel(s.corpo)}`).join('\n')}
${fonteNota('<code>02-proposta.md</code>')}</section>`;
}

// ---------- vendas ----------
function secVendas() {
  if (!vendas) return `<section id="vendas" aria-labelledby="h-vendas"><h2 id="h-vendas">Vendas da loja</h2>${semDados('sem <code>vendas-woocommerce-*.json</code> no ciclo.')}</section>`;
  const v = vendas; const partes = [];
  const jan = [['Todo o histórico', v.total_vendas, v.historico && `${v.historico.de} a ${v.historico.ate}`], ['Últimos 90 dias', v.ultimos_90d, v.ultimos_90d && `${v.ultimos_90d.de} a ${v.ultimos_90d.ate}`], ['Últimos 30 dias', v.ultimos_30d, v.ultimos_30d && `${v.ultimos_30d.de} a ${v.ultimos_30d.ate}`]].filter(([, o]) => o);
  if (jan.length) partes.push(`<div class="tabela larga"><table><caption>Vendas pagas por janela</caption><thead><tr><th scope="col">Janela</th><th scope="col" class="num">Encomendas</th><th scope="col" class="num">Receita c/ IVA e portes</th><th scope="col" class="num">IVA</th><th scope="col" class="num">Receita s/ IVA</th><th scope="col" class="num">Ticket médio</th></tr></thead><tbody>${
    jan.map(([n, o, d]) => `<tr><td data-rotulo="Janela">${n}<br><small>${esc(d || '')}</small></td><td data-rotulo="Encomendas" class="num">${int(o.encomendas)}</td><td data-rotulo="Receita c/ IVA e portes" class="num">${eur(o.receita_bruta_com_iva_e_portes)}</td><td data-rotulo="IVA" class="num">${eur(o.iva)}</td><td data-rotulo="Receita s/ IVA" class="num">${eur(o.receita_sem_iva)}</td><td data-rotulo="Ticket médio" class="num">${eur(o.ticket_medio_com_iva)}</td></tr>`).join('')}</tbody></table></div>${fonteNota(FV + ' · total_vendas, ultimos_90d, ultimos_30d')}`);
  if (v.mensal?.length) {
    const ms = intervalo(WC.de, WC.ate).map((k) => ({ mes: k, parcial: k === WC.parcial, valores: [WC.val(k, 'receita_bruta_com_iva_e_portes')], tip: `${nomeMes(k)}: ${eur(WC.val(k, 'receita_bruta_com_iva_e_portes'))} · ${pl(WC.val(k, 'encomendas'), 'encomenda', 'encomendas')}`, linhaTabela: [eur(WC.val(k, 'receita_bruta_com_iva_e_portes')), int(WC.val(k, 'encomendas'))] }));
    const melhor = ms.reduce((a, b) => ((b.valores[0] || 0) > (a.valores[0] || 0) ? b : a));
    partes.push(colunasMes({ titulo: `O melhor mês da loja foi ${nomeMes(melhor.mes)}, com ${eur(melhor.valores[0])} em vendas pagas`, subtitulo: 'Receita das vendas pagas por mês, c/ IVA e portes. Mês sem barra = 0 encomendas pagas (o ficheiro lê todo o histórico da loja).', meses: ms, series: [{ nome: 'Vendas pagas, €', cor: 'var(--s1)' }], colunasTabela: ['Vendas pagas, €', 'Encomendas'], fmt: (x, e) => (e ? eur0(x) : eur(x)), fonte: `${FV} · <code>mensal</code>`, alt: `Colunas com a receita mensal das vendas pagas de ${nomeMes(WC.de)} a ${nomeMes(WC.ate)}; máximo em ${nomeMes(melhor.mes)}.` }));
  }
  const fig = (titulo, corpo, fonte) => `<figure class="grafico"><figcaption><span class="g-tit">${titulo}</span></figcaption>${corpo}${fonteNota(fonte)}</figure>`;
  const nOk = (r) => typeof r.encomendas === 'number';
  const txtF = (r) => (nOk(r) ? `${int(r.encomendas)} · ${eur(r.receita_com_iva)}` : '<3');
  const meta_ = (r) => /facebook|instagram|meta/i.test(r.chave);
  const bar = (itens, j) => barrasH({ itens, rotulo: (r) => r.chave, valor: (r) => (nOk(r) ? r.encomendas : null), texto: txtF, tip: (r) => `${r.chave} (${j}): ${nOk(r) ? `${pl(r.encomendas, 'encomenda', 'encomendas')} · ${eur(r.receita_com_iva)}` : 'n<3, suprimido'}`, destaque: meta_, rotuloDestaque: 'Meta' });
  if (v.produtos_vendidos?.length) {
    const ps = [...v.produtos_vendidos].sort((a, b) => b.receita_com_iva - a.receita_com_iva);
    partes.push(fig(`«${esc(ps[0].produto)}» é o produto que mais faturou (${eur(ps[0].receita_com_iva)})`, barrasH({ itens: ps, rotulo: (p) => p.produto, valor: (p) => p.receita_com_iva, texto: (p) => `${eur(p.receita_com_iva)} · ${int(p.unidades)} un.`, tip: (p) => `${p.produto}: ${eur(p.receita_com_iva)} c/ IVA, ${pl(p.unidades, 'unidade', 'unidades')}, ${pl(p.encomendas, 'encomenda', 'encomendas')} · ${p.primeira} a ${p.ultima}` }), FV + ' · produtos_vendidos (histórico, c/ IVA, sem portes)'));
  }
  const o = v.origem || {};
  const origemFig = (lista, j, campo) => {
    const top = [...lista].filter(nOk).sort((a, b) => b.encomendas - a.encomendas)[0];
    return fig(top ? `${esc(top.chave)} é a origem com mais encomendas (${j}: ${int(top.encomendas)})` : `Origem das encomendas (${j})`, bar(lista, j) + '<ul class="legenda"><li><span class="sw" style="background:var(--s2)"></span>Facebook/Instagram (Meta)</li><li><span class="sw" style="background:var(--s1)"></span>outras origens</li></ul>', `${FV} · origem.${campo}`);
  };
  const duas = [o.fonte && origemFig(o.fonte, 'histórico', 'fonte'), o.fonte_ultimos_90d && origemFig(o.fonte_ultimos_90d, '90 dias', 'fonte_ultimos_90d')].filter(Boolean);
  if (duas.length) partes.push(`<div class="duas">${duas.join('')}</div>`);
  const extra = [['fonte_x_meio', 'Fonte / meio (utm_source / utm_medium)'], ['campanha', 'Campanha (utm_campaign)'], ['dispositivo', 'Dispositivo'], ['fonte_ia', 'Origem das encomendas do produto em foco']].filter(([c]) => o[c]?.length);
  const outros = [['pagamento', v.pagamento, 'Meio de pagamento'], ['geografia.zona_postal', v.geografia?.zona_postal, 'Zona postal']].filter(([, l]) => l?.length);
  if (extra.length || outros.length) partes.push(detalhes('Origem por fonte/meio, campanha, dispositivo, pagamento e zona', [...extra.map(([c, t]) => `<h3>${esc(t)}</h3>${bar(o[c], t)}${fonteNota(`${FV} · origem.${c}`)}`), ...outros.map(([c, l, t]) => `<h3>${esc(t)}</h3>${bar(l, t)}${fonteNota(`${FV} · ${c}`)}`)].join('')));
  if (foco) {
    const r = foco.obj.resumo || {};
    const prim = Object.entries(r).filter(([, x]) => x != null && typeof x !== 'object');
    const dias = foco.obj.por_dia || [];
    const nomeP = foco.cat?.produto || `produto ${foco.obj.produto_id}`;
    partes.push(`<h3>Produto em foco: «${esc(nomeP)}»</h3>${foco.cat ? `<p>Preço de tabela ${eur(foco.cat.preco_regular)} · preço atual ${eur(foco.cat.preco_atual)} · criado ${esc(foco.cat.criado || '—')}</p>` : ''}
<div class="tabela"><table><caption>Resumo do produto em foco</caption><tbody>${prim.map(([k, x]) => `<tr><th scope="row">${esc(k.replace(/_/g, ' '))}</th><td>${esc(typeof x === 'number' && /receita/.test(k) ? eur(x) : x)}</td></tr>`).join('')}</tbody></table></div>
${dias.length ? fig(`Encomendas por dia de «${esc(nomeP)}», ${esc(dias[0].dia)} a ${esc(dias[dias.length - 1].dia)}`, barrasH({ itens: dias, rotulo: (d) => d.dia, valor: (d) => d.encomendas_venda ?? d.encomendas ?? 0, texto: (d) => `${int(d.encomendas_venda ?? d.encomendas ?? 0)} enc. · ${eur(d.receita_livro_com_iva ?? d.receita_com_iva ?? null)}`, tip: (d) => `${d.dia}: ${pl(d.encomendas_venda ?? d.encomendas ?? 0, 'encomenda', 'encomendas')}`, destaque: (d) => d.na_janela_prevenda === true, rotuloDestaque: 'janela de pré-venda' }), `${FV} · ${esc(foco.chave)}.por_dia`) : ''}`);
  }
  const notas = Object.entries(v).filter(([k, x]) => typeof x === 'string' && /^(nota|definicao|supressao)/.test(k));
  if (v.consentimento_marketing) notas.push(['consentimento_marketing', `${v.consentimento_marketing.estado}${v.consentimento_marketing.detalhe ? ' — ' + v.consentimento_marketing.detalhe : ''}`]);
  if (notas.length) partes.push(detalhes('Notas e definições do ficheiro de vendas', `<ul>${notas.map(([k, x]) => `<li><strong>${esc(k.replace(/_/g, ' '))}:</strong> ${inline(x)}</li>`).join('')}</ul>${fonteNota(FV)}`, true));
  return `<section id="vendas" aria-labelledby="h-vendas"><h2 id="h-vendas">Vendas da loja</h2>
<p class="lead">${v.definicao_venda ? inline(v.definicao_venda) : ''} ${v.historico ? `${int(v.historico.encomendas_todas)} encomendas lidas (${esc(v.historico.de)} a ${esc(v.historico.ate)}).` : ''}</p>
${partes.join('\n')}</section>`;
}

// ---------- anúncios Meta ----------
function secMeta() {
  if (!meta) return `<section id="meta" aria-labelledby="h-meta"><h2 id="h-meta">Anúncios Meta</h2>${semDados('sem <code>meta-ads-*.md</code> no ciclo.')}</section>`;
  const partes = subsecs(meta, 2);
  const intro = (partes.find((s) => !s.titulo)?.corpo || '').split('\n').filter((l) => !/^#\s/.test(l)).join('\n');
  const ativas = partes.filter((s) => /^Campanhas/i.test(s.titulo || '')).flatMap((s) => {
    const [cab, ...rows] = linhasTab(s.corpo); const iE = colIdx(cab || [], /estado/i);
    return iE < 0 ? [] : rows.filter((r) => /ACTIVE/.test(r[iE]) && !/fim \d{4}/.test(r[iE])).map((r) => ({ cab, r, s }));
  });
  const ativasHtml = ativas.length ? `<h3>Campanhas ativas à data da leitura</h3><div class="duas">${ativas.map(({ cab, r, s }) => `<div class="cartao"><p class="estado-linha"><span class="selo ok">● ativa</span> <small>${esc(s.titulo.replace(/^Campanhas\s*—\s*/, ''))}</small></p><h4>${inline(r[0])}</h4><p>${cab.slice(1).map((h, k) => `${esc(h)}: <strong>${inline(r[k + 1])}</strong>`).join(' · ')}</p>${fonteNota(FM(s.titulo))}</div>`).join('')}</div>` : '';
  const alertas = partes.filter((s) => /^⚠/.test(s.titulo || '')).map((s) => `<div class="alerta" role="note"><p class="alerta-t">${inline(s.titulo.replace(/^⚠\s*/, ''))}</p>${md2html(s.corpo, 4)}${fonteNota(FM(s.titulo))}</div>`).join('');
  const corpo = alertas + blocos(partes.filter((s) => s.titulo && !/^⚠/.test(s.titulo)).map((s) => {
    if (/^⚠/.test(s.titulo)) return `<div class="alerta" role="note"><p class="alerta-t">${inline(s.titulo.replace(/^⚠\s*/, ''))}</p>${md2html(s.corpo, 4)}${fonteNota(FM(s.titulo))}</div>`;
    const aberto = /^(Decisão|Verificação)/i.test(s.titulo);
    return detalhes(s.titulo, md2html(s.corpo, 3) + fonteNota(FM(s.titulo)), aberto);
  }));
  return `<section id="meta" aria-labelledby="h-meta"><h2 id="h-meta">Anúncios Meta</h2><div class="prosa lead">${md2html(intro, 4)}</div>${ativasHtml}${corpo}</section>`;
}

// ---------- auditoria, acessos e medição ----------
const ACESSO = { sim: ['ok', '✓'], parcial: ['parcial', '◐'], 'não': ['nao', '✕'], 'não verificado': ['nv', '?'] };
function tabelaConectores() {
  const blocos = conectores.split(/\n(?!\|)/).join('\n');
  const tabs = []; let cur = [];
  for (const l of blocos.split('\n')) { if (l.trim().startsWith('|')) cur.push(l); else if (cur.length) { tabs.push(cur); cur = []; } }
  if (cur.length) tabs.push(cur);
  const t = tabs.map((x) => linhasTab(x.join('\n'))).find((r) => r[0] && colIdx(r[0], /^canal$/i) >= 0);
  if (!t) return `<p>${nv} — <code>conectores.md</code> sem tabela de canais.</p>`;
  const [cab, ...rows] = t;
  const iC = colIdx(cab, /^canal$/i); const iA = colIdx(cab, /^acesso$/i); const iV = colIdx(cab, /^via$/i); const iD = colIdx(cab, /verificado/i);
  const linhas = rows.map((r) => ({ canal: r[iC], acesso: r[iA] || 'não verificado', via: r[iV] || '', ver: r[iD] || '', extra: '' }));
  if (meta) linhas.filter((l) => l.canal === 'meta-ads').forEach((l) => { l.extra = `dados lidos a ${esc(metaData)} em <code>${esc(metaFich)}</code> — ver Anúncios Meta`; });
  if (vendas) linhas.unshift({ canal: 'loja (vendas)', acesso: 'sim', via: 'api', ver: `${vendas.gerado} · <code>${esc(vendasFich)}</code>`, extra: 'linha do painel, não do conectores.md' });
  const cont = {}; linhas.forEach((l) => { cont[l.acesso] = (cont[l.acesso] || 0) + 1; });
  const sel = (a) => { const s = ACESSO[a] || ACESSO['não verificado']; return `<span class="acesso ${s[0]}"><b aria-hidden="true">${s[1]}</b>${esc(a)}</span>`; };
  return `<p class="estado-linha">${Object.entries(cont).map(([k, n]) => `${sel(k)} <span>${n}</span>`).join(' · ')}</p>
<div class="tabela larga"><table><caption>Acessos por canal</caption><thead><tr><th scope="col">Canal</th><th scope="col">Acesso</th><th scope="col">Via</th><th scope="col">Verificado em</th></tr></thead><tbody>${linhas.map((l) => `<tr><td data-rotulo="Canal"><strong>${esc(l.canal)}</strong></td><td data-rotulo="Acesso">${sel(l.acesso)}</td><td data-rotulo="Via">${inline(l.via)}</td><td data-rotulo="Verificado em">${/<code>/.test(l.ver) ? l.ver : inline(l.ver)}${l.extra ? `<br><small>${l.extra}</small>` : ''}</td></tr>`).join('\n')}</tbody></table></div>${fonteNota(`<code>conectores.md</code>${(conectores.match(/Atualizado: (\S+)/) || [])[1] ? ` (atualizado ${esc(conectores.match(/Atualizado: (\S+)/)[1])})` : ''}${vendas ? ` + linha «loja» de <code>${esc(vendasFich)}</code>` : ''}`)}`;
}
function secAuditoria() {
  const ordem = ['crítica', 'alta', 'média', 'baixa'];
  let achados = []; let fonteA = '';
  const mel = sec(proposta, 'Melhorias ao site');
  const t = linhasTab(mel);
  if (t.length > 1) {
    const [cab, ...rows] = t; const iS = colIdx(cab, /severidade|gravidade/i); const iT = colIdx(cab, /^achado/i);
    achados = rows.map((r) => ({ sev: (r[iS] || '').toLowerCase(), titulo: r[iT >= 0 ? iT : 1], campos: cab.map((h, k) => [h, r[k]]).filter(([h], k) => k !== iS && k !== iT && !/^#$/.test(h)) }));
    fonteA = '<code>02-proposta.md</code> §Melhorias ao site/SEO';
  } else if (auditoria?.achados?.length) {
    achados = auditoria.achados.map((a) => ({ sev: a.severidade, titulo: a.regra, campos: [['Evidência', a.evidencia], ['Recomendação', a.recomendacao], ['Área', a.area]] }));
    fonteA = `<code>auditorias/${esc(audFich)}</code>`;
  }
  const cnt = Object.fromEntries(ordem.map((g) => [g, achados.filter((a) => a.sev === g).length]));
  const filtros = achados.length ? `<div class="filtros" role="group" aria-label="Filtrar achados por gravidade"><button type="button" class="filtro" data-sev="todas" aria-pressed="true">Todas (${achados.length})</button>${ordem.filter((g) => cnt[g]).map((g) => `<button type="button" class="filtro" data-sev="${slug(g)}" aria-pressed="false">${g} (${cnt[g]})</button>`).join('')}</div>` : '';
  const cards = achados.map((a) => `<details class="bloco achado" data-sev="${slug(a.sev)}"><summary><span class="sev ${slug(a.sev)}">${esc(a.sev || '—')}</span><span>${inline(a.titulo)}</span></summary><div class="corpo">${a.campos.map(([h, c]) => `<p><strong>${inline(h)}:</strong> ${inline(c)}</p>`).join('')}</div></details>`).join('\n');
  const areas = auditoria?.areas?.length ? detalhes(`Áreas auditadas pelo script (${auditoria.areas.filter((a) => a.estado === 'verificado').length} de ${auditoria.areas.length} verificadas)`, `<div class="tabela larga"><table><caption>Áreas auditadas</caption><thead><tr><th scope="col">Área</th><th scope="col">Estado</th><th scope="col">Nota</th></tr></thead><tbody>${auditoria.areas.map((a) => `<tr><td data-rotulo="Área">${esc(a.area)}</td><td data-rotulo="Estado">${a.estado === 'verificado' ? '<span class="acesso ok"><b aria-hidden="true">✓</b>verificado</span>' : '<span class="acesso nv"><b aria-hidden="true">?</b>não verificado</span>'}</td><td data-rotulo="Nota">${inline(String(a.nota || '').replace(/\s—\s?guardar com:.*/, ''))}</td></tr>`).join('')}</tbody></table></div>${fonteNota(`<code>auditorias/${esc(audFich)}</code> (método ${esc(auditoria.metodo)}, ${esc(auditoria.data)})`)}`) : '';
  const med = sec(proposta, 'Medição');
  const audAn = subsecs(sec(analise, 'Auditoria')).filter((s) => s.titulo);
  return `<section id="auditoria" aria-labelledby="h-auditoria"><h2 id="h-auditoria">Auditoria, acessos e medição</h2>
<p class="lead">O que parte a medição ou a conversão, por gravidade. Abre um achado para ver evidência, impacto e quem corrige.</p>
${achados.length ? `${filtros}<div class="achados">${cards}</div>${fonteNota(fonteA)}` : semDados('sem achados no <code>02-proposta.md</code> nem em <code>auditorias/</code>.')}
<h3>Estado dos acessos</h3>${conectores ? tabelaConectores() : semDados('falta <code>conectores.md</code>.')}
${blocos([...(areas ? [areas] : []), ...audAn.map((s) => detalhes(`Análise (F1) — ${s.titulo}`, md2html(s.corpo, 4)))])}
${med ? `<h3>Medição</h3>${colapsavel(med)}${fonteNota('<code>02-proposta.md</code> §Medição')}` : ''}
</section>`;
}

// ---------- análise e mercado ----------
function secAnalise() {
  if (!analise) return `<section id="analise" aria-labelledby="h-analise"><h2 id="h-analise">Análise <span class="sec-fase">F1</span></h2>${semDados('falta <code>01-analise.md</code>.')}</section>`;
  const dA = dataFich(path.join(DC, '01-analise.md'));
  const posteriores = [vendas && vendas.gerado && `vendas (${vendas.gerado})`, metaData && `anúncios Meta (${metaData})`].filter(Boolean);
  const secs = subsecs(analise, 2).filter((s) => s.titulo && !/^(Auditoria|Mercado|Lacunas|Fontes)/.test(s.titulo));
  return `<section id="analise" aria-labelledby="h-analise"><h2 id="h-analise">Análise <span class="sec-fase">F1</span></h2>
${posteriores.length ? `<p class="nota">Escrita na F1 (ficheiro de ${esc(dA)}). As leituras de ${posteriores.join(' e ')} podem ser posteriores: quando um número diverge, valem as secções Números, Vendas e Anúncios Meta.</p>` : ''}
${blocos(secs.map((s, k) => detalhes(s.titulo, md2html(s.corpo, 3), k === 0 || /^O que se pretende/.test(s.titulo))))}${fonteNota('<code>01-analise.md</code>')}</section>`;
}
function secMercado() {
  const m = sec(analise, 'Mercado');
  if (!m) return `<section id="mercado" aria-labelledby="h-mercado"><h2 id="h-mercado">Mercado</h2>${semDados('sem §Mercado no <code>01-analise.md</code>.')}</section>`;
  const partes = subsecs(m);
  const intro = partes.find((p) => !p.titulo);
  const conc = partes.find((p) => /^Concorrentes/.test(p.titulo || ''));
  let cards = ''; let precos = '';
  if (conc) {
    const [cab, ...rows] = linhasTab(conc.corpo);
    if (cab) {
      const nome = (r) => r[0].replace(/\*\*/g, '').split(' — ')[0];
      cards = `<div class="duas">${rows.map((r) => `<details class="bloco"><summary>${esc(nome(r))}</summary><div class="corpo">${r[0].includes(' — ') ? `<p>${inline(r[0].split(' — ').slice(1).join(' — '))}</p>` : ''}${cab.slice(1).map((h, k) => `<p><strong>${inline(h)}:</strong> ${inline(r[k + 1])}</p>`).join('')}</div></details>`).join('')}</div>`;
      const iP = colIdx(cab, /oferta|preço|preco/i);
      if (iP >= 0) {
        const pts = rows.map((r) => ({ n: nome(r), v: numPT((r[iP].match(/\d+,\d{2} ?€/) || [])[0]) }));
        if (foco?.cat) pts.unshift({ n: `${foco.cat.produto} (preço de tabela)`, v: foco.cat.preco_regular, eu: true }, ...(foco.cat.preco_atual !== foco.cat.preco_regular ? [{ n: `${foco.cat.produto} (preço atual)`, v: foco.cat.preco_atual, eu: true }] : []));
        const lidos = pts.filter((p) => p.v != null && !p.eu).map((p) => p.v);
        precos = `<figure class="grafico"><figcaption><span class="g-tit">${lidos.length ? `Os concorrentes citam preços entre ${eur(Math.min(...lidos))} e ${eur(Math.max(...lidos))}` : 'Preço citado por concorrente'}${foco?.cat ? `; o produto em foco está a ${eur(foco.cat.preco_atual)}` : ''}</span><span class="g-sub">1.º preço citado em cada ficha de concorrente (PVP ou preço de livraria, conforme a ficha).</span></figcaption>${barrasH({ itens: pts, rotulo: (x) => x.n, valor: (x) => x.v, texto: (x) => (x.v == null ? 'não verificado' : eur(x.v)), tip: (x) => `${x.n}: ${x.v == null ? 'preço não lido' : eur(x.v)}`, destaque: (x) => x.eu, rotuloDestaque: 'nosso' })}${fonteNota(`<code>01-analise.md</code> §Mercado › Concorrentes${foco?.cat ? ` · ${FV} · catalogo` : ''}`)}</figure>`;
      }
    }
  }
  const resto = partes.filter((p) => p.titulo && p !== conc);
  return `<section id="mercado" aria-labelledby="h-mercado"><h2 id="h-mercado">Mercado</h2>
${conc ? `<h3>Concorrentes</h3>${cards}${precos}${detalhes('Leitura dos concorrentes', md2html(conc.corpo.split('\n').filter((l) => !l.trim().startsWith('|')).join('\n'), 4))}` : ''}
${blocos([...resto.map((p) => detalhes(p.titulo, md2html(p.corpo, 3), /Tendências/.test(p.titulo))), ...(intro ? [detalhes('Método e fontes do estudo de mercado', md2html(intro.corpo, 3))] : [])])}${fonteNota('<code>01-analise.md</code> §Mercado')}</section>`;
}

// ---------- F3 · F4 · F5 ----------
const EST_TXT = { feito: 'feito', em_curso: 'em curso', pendente: 'por fazer' };
function secFase(id, fase, titulo, alvo, previsto) {
  const st = estado.passos?.[fase] || 'pendente';
  const p = path.join(DC, alvo);
  let corpo = '';
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
    const walk = (d) => fs.readdirSync(d).filter((x) => !x.startsWith('.')).flatMap((x) => (fs.statSync(path.join(d, x)).isDirectory() ? walk(path.join(d, x)) : [path.relative(p, path.join(d, x))])).sort();
    const items = walk(p);
    const imgs = items.filter((x) => /\.(png|jpe?g|webp|svg|gif)$/i.test(x));
    const mds = items.filter((x) => x.endsWith('.md'));
    const rel = path.relative(CLIENTE, p).split(path.sep).map(urlSeg).join('/');
    corpo += imgs.length ? `<div class="galeria">${imgs.map((x) => `<figure><img src="${rel}/${x.split(path.sep).map(urlSeg).join('/')}" alt="${esc(x)}" loading="lazy"><figcaption>${esc(x)}</figcaption></figure>`).join('')}</div>` : '';
    corpo += blocos(mds.map((x) => detalhes(x, md2html(fs.readFileSync(path.join(p, x), 'utf8'), 3))));
    const outros = items.filter((x) => !imgs.includes(x) && !mds.includes(x));
    if (outros.length) corpo += `<p>Outros ficheiros: ${outros.map((x) => `<code>${esc(x)}</code>`).join(' · ')}</p>`;
    if (!items.length) corpo = '';
  } else if (fs.existsSync(p)) {
    const md = fs.readFileSync(p, 'utf8');
    const resumo = sec(md, 'Resumo executivo');
    corpo += (resumo ? `<div class="cartao prosa-l"><h3>Resumo executivo</h3>${md2html(resumo, 4)}</div>` : '') + blocos(subsecs(md, 2).filter((s) => s.titulo && !/^Resumo executivo/.test(s.titulo)).map((s) => detalhes(s.titulo, md2html(s.corpo, 3))));
  }
  const vazio = `<div class="por-fazer"><p><span class="selo espera">${EST_TXT[st] || esc(st)}</span> Ainda sem dados — não existe <code>${esc(alvo)}</code> neste ciclo. A secção preenche-se ao gerar de novo o painel depois de a fase gravar o ficheiro.</p><p><strong>Vai conter:</strong> ${previsto}</p></div>`;
  return `<section id="${id}" aria-labelledby="h-${id}"><h2 id="h-${id}">${titulo} <span class="sec-fase">${fase} · ${EST_TXT[st] || esc(st)}</span></h2>${corpo ? corpo + fonteNota(`<code>ciclos/${esc(CICLO)}/${esc(alvo)}</code>`) : vazio}</section>`;
}

// ---------- lacunas e fontes ----------
const norm = (s) => s.replace(/<[^>]+>/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const palavras = (s) => new Set(norm(s).match(/[a-z0-9]{4,}/g) || []);
function itensDeLista(md) {
  const out = []; let grupo = 'Geral';
  for (const l of md.split('\n')) {
    const h = l.match(/^###\s+(.*)/); if (h) { grupo = h[1].trim(); continue; }
    if (/^\S/.test(l) && !/^([-*]|\d+\.)\s/.test(l) && l.trim().endsWith(':')) { grupo = l.replace(/:$/, '').trim(); continue; }
    const m = l.match(/^([-*]|\d+\.)\s+(.*)/); if (m) out.push({ grupo, txt: m[2] });
  }
  return out;
}
function secLacunas() {
  const origens = [['01-analise.md', sec(analise, 'Lacunas e por confirmar')], ['02-proposta.md', sec(proposta, 'Lacunas e por confirmar')], ['05-review.md', sec(review, 'Não verificado')]].filter(([, md]) => md);
  const novos = [];
  if (meta) subsecs(meta, 2).filter((s) => /^⚠/.test(s.titulo || '')).forEach((s) => novos.push({ grupo: 'Dos anúncios Meta', txt: `**${s.titulo.replace(/^⚠\s*/, '')}** — ver Anúncios Meta [fonte: ${metaFich}]`, origem: metaFich }));
  const todos = [...novos, ...origens.flatMap(([f, md]) => itensDeLista(md).map((x) => ({ ...x, origem: f })))];
  if (!todos.length) return `<section id="lacunas" aria-labelledby="h-lacunas"><h2 id="h-lacunas">Lacunas e por confirmar</h2>${semDados('nenhuma secção de lacunas nos ficheiros do ciclo.')}</section>`;
  const vistos = []; const grupos = new Map(); let dup = 0;
  for (const it of todos) {
    const w = palavras(it.txt);
    if (vistos.find((v) => [...w].filter((x) => v.has(x)).length / Math.min(w.size || 1, v.size || 1) >= 0.7)) { dup++; continue; }
    vistos.push(w);
    if (!grupos.has(it.grupo)) grupos.set(it.grupo, []);
    grupos.get(it.grupo).push(`<li>${inline(it.txt)} <span class="origem">${esc(it.origem)}</span></li>`);
  }
  return `<section id="lacunas" aria-labelledby="h-lacunas"><h2 id="h-lacunas">Lacunas e por confirmar</h2>
<p class="lead">Juntas de ${origens.map(([f]) => `<code>${f}</code>`).join(', ')}${novos.length ? ' e dos anúncios Meta' : ''}; ${dup} repetidas retiradas. Cada item diz de onde vem.</p>
<div class="lacunas">${[...grupos.entries()].map(([g, l]) => `<div class="cartao"><h3>${inline(g)}</h3><ul>${l.join('')}</ul></div>`).join('')}</div></section>`;
}
function secFontes() {
  const linhas = [sec(analise, 'Fontes'), sec(proposta, 'Fontes'), sec(review, 'Fontes')].join('\n').split('\n').filter((l) => /^[-*]\s/.test(l)).map((l) => l.replace(/^[-*]\s+/, ''));
  const urls = new Set(); const fich = new Set();
  for (const l of linhas) {
    const us = l.match(/https?:\/\/[^\s·]+/g);
    if (us && l.replace(/https?:\/\/[^\s·]+/g, '').replace(/[·\s]/g, '').length < 3) us.forEach((u) => urls.add(u)); else fich.add(l);
  }
  const lidos = [['estado.json', path.join(CLIENTE, 'estado.json')], ['marca.md', path.join(CLIENTE, 'marca.md')], ['conectores.md', path.join(CLIENTE, 'conectores.md')], audFich && [`auditorias/${audFich}`, path.join(audDir, audFich)],
    ...['01-analise.md', '02-proposta.md', ...revisoes.flatMap((r) => r.fichs), vendasFich, metaFich, '04-implementacao.md', '05-review.md'].filter(Boolean).map((f) => [`ciclos/${CICLO}/${f}`, path.join(DC, f)])].filter((x) => x && fs.existsSync(x[1]));
  return `<section id="fontes" aria-labelledby="h-fontes"><h2 id="h-fontes">Fontes</h2>
<div class="duas"><div class="cartao"><h3>Ficheiros lidos por este painel</h3><ul>${lidos.map(([n, p]) => `<li><code>${esc(n)}</code> <span class="origem">modificado ${dataFich(p)}</span></li>`).join('')}</ul></div>
${fich.size ? `<div class="cartao"><h3>Fontes citadas nos relatórios</h3><ul>${[...fich].map((f) => `<li>${inline(f)}</li>`).join('')}</ul></div>` : ''}</div>
${urls.size ? detalhes(`Endereços citados (${urls.size})`, `<ul>${[...urls].map((u) => `<li>${inline(u)}</li>`).join('')}</ul>`) : ''}
<p class="fonte-nota">Painel gerado por <code>painel.mjs</code> (Marketeer) a partir destes ficheiros; nenhum ficheiro de origem foi alterado.</p></section>`;
}

// ---------- montagem ----------
const CSS = fs.readFileSync(path.join(AQUI, 'estilo.css'), 'utf8');
const JS = `
(function(){
  var raiz=document.documentElement,bt=document.querySelector('.tema');
  function escuro(){return raiz.dataset.tema? raiz.dataset.tema==='escuro' : matchMedia('(prefers-color-scheme: dark)').matches;}
  function rot(){bt.textContent=escuro()?'Modo claro':'Modo escuro';bt.setAttribute('aria-pressed',escuro()?'true':'false');}
  try{var g=localStorage.getItem('mkt-tema');if(g)raiz.dataset.tema=g;}catch(e){}
  if(bt){rot();bt.addEventListener('click',function(){raiz.dataset.tema=escuro()?'claro':'escuro';try{localStorage.setItem('mkt-tema',raiz.dataset.tema);}catch(e){}rot();});}
  function escala(){document.querySelectorAll('.g-corpo').forEach(function(c){var e=c.querySelector('.eixo-y'),g=c.querySelector('.graf.col');if(!e||!g)return;var w=+g.getAttribute('width'),h=+g.getAttribute('height'),ew=+e.getAttribute('width');var f=Math.max(1,Math.min(1.5,(c.clientWidth-ew)/w));g.style.width=w*f+'px';g.style.height=h*f+'px';e.style.width=ew*f+'px';e.style.height=h*f+'px';});}escala();addEventListener('resize',escala);
  raiz.classList.add('js');
  var secs=[].slice.call(document.querySelectorAll('main>section[id]')),links=[].slice.call(document.querySelectorAll('.nav-in a')),main=document.getElementById('conteudo'),cur=0;
  var KEY='mkt-escolhas-'+document.body.dataset.chave,st={};try{st=JSON.parse(localStorage.getItem(KEY)||'{}');}catch(e){}
  var ds=secs.filter(function(s){return s.dataset.d;});
  function guarda(){try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}}
  function marca(){ds.forEach(function(s){[].forEach.call(s.querySelectorAll('.op'),function(b){b.setAttribute('aria-pressed',st[s.dataset.d]===b.dataset.v?'true':'false');});});}
  function fim(){var ul=document.getElementById('res');if(!ul)return;var f=0;ul.innerHTML='';ds.forEach(function(s){var v=st[s.dataset.d];if(!v)f++;var li=document.createElement('li');if(!v)li.className='falta';li.innerHTML='<span></span><b></b>';li.children[0].textContent=s.dataset.nome;li.children[1].textContent=v||'por decidir';ul.appendChild(li);});document.getElementById('h-escolhas').textContent=f?('Faltam '+f+' de '+ds.length+'.'):'Tudo decidido.';}
  function mostrar(subir){var id=(location.hash||'').slice(1);var k=secs.findIndex(function(s){return s.id===id;});if(k<0)k=0;cur=k;var s=secs[k],tab=s.dataset.tab||s.id;
    secs.forEach(function(x){x.classList.toggle('ativa',x===s);});
    links.forEach(function(a){a.setAttribute('aria-current',a.getAttribute('href')==='#'+tab?'true':'false');});
    document.getElementById('prog').style.width=(secs.length>1?k/(secs.length-1)*100:100)+'%';
    document.getElementById('cont').textContent=(k+1)+' / '+secs.length;
    document.getElementById('ant').disabled=k===0;document.getElementById('seg').disabled=k===secs.length-1;
    if(s.id==='escolhas')fim();escala();main.scrollTop=0;scrollTo(0,0);}
  function ir(k){k=Math.max(0,Math.min(secs.length-1,k));location.hash='#'+secs[k].id;}
  addEventListener('hashchange',function(){mostrar(true);});
  document.getElementById('ant').onclick=function(){ir(cur-1);};document.getElementById('seg').onclick=function(){ir(cur+1);};
  addEventListener('keydown',function(e){if(/INPUT|TEXTAREA|SELECT/.test((e.target.tagName||'')))return;if(e.key==='ArrowRight')ir(cur+1);else if(e.key==='ArrowLeft')ir(cur-1);});
  document.addEventListener('click',function(e){var o=e.target.closest&&e.target.closest('.op');if(o){var d=o.closest('section').dataset.d;st[d]=o.dataset.v;guarda();marca();}});
  var cp=document.getElementById('copiar');if(cp){cp.onclick=function(){var t='Decisões da proposta ('+document.body.dataset.nome+', ciclo '+document.body.dataset.ciclo+'):\\n'+ds.map(function(s,k){return (k+1)+'. '+s.dataset.nome+': '+(st[s.dataset.d]||'por decidir');}).join('\\n');var m=document.getElementById('msg');(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){m.textContent='Copiado. Cola no chat.';},function(){m.textContent=t;});};}
  var lp=document.getElementById('limpar');if(lp){lp.onclick=function(){st={};guarda();marca();fim();};}
  marca();mostrar(false);
  // gráficos: uma paragem de Tab por gráfico; setas percorrem as marcas
  [].slice.call(document.querySelectorAll('svg.graf, .barras')).forEach(function(c){
    var ms=[].slice.call(c.querySelectorAll('.marca'));if(!ms.length)return;ms[0].setAttribute('tabindex','0');
    ms.forEach(function(m,k){m.addEventListener('keydown',function(e){var n=null;
      if(e.key==='ArrowRight'||e.key==='ArrowDown')n=ms[Math.min(ms.length-1,k+1)];else if(e.key==='ArrowLeft'||e.key==='ArrowUp')n=ms[Math.max(0,k-1)];
      else if(e.key==='Home')n=ms[0];else if(e.key==='End')n=ms[ms.length-1];
      if(n){e.preventDefault();ms.forEach(function(x){x.setAttribute('tabindex','-1');});n.setAttribute('tabindex','0');n.focus();}});});
  });
  document.querySelectorAll('.filtro').forEach(function(b){b.addEventListener('click',function(){var s=b.getAttribute('data-sev');
    document.querySelectorAll('.filtro').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false');});
    document.querySelectorAll('.achado').forEach(function(a){a.classList.toggle('escondido',s!=='todas'&&a.getAttribute('data-sev')!==s);});});});
  var tip=document.getElementById('tip');
  function pos(x,y){var w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.min(innerWidth-w-8,Math.max(8,x+12))+'px';var t=y-h-12;tip.style.top=(t<8?y+16:t)+'px';}
  function on(el,x,y){tip.textContent=el.getAttribute('data-tip');tip.classList.add('on');pos(x,y);}
  document.addEventListener('mousemove',function(e){var el=e.target.closest&&e.target.closest('[data-tip]');if(el)on(el,e.clientX,e.clientY);else tip.classList.remove('on');});
  document.addEventListener('focusin',function(e){var el=e.target.closest&&e.target.closest('[data-tip]');if(el){var r=el.getBoundingClientRect();on(el,r.left+r.width/2,r.top);}});
  document.addEventListener('focusout',function(){tip.classList.remove('on');});
  document.addEventListener('touchstart',function(e){var el=e.target.closest&&e.target.closest('[data-tip]');if(el){var t=e.touches[0];on(el,t.clientX,t.clientY);}else tip.classList.remove('on');},{passive:true});
  addEventListener('beforeprint',function(){document.querySelectorAll('details').forEach(function(d){d.dataset.era=d.open?'1':'0';d.open=true;});});
  addEventListener('afterprint',function(){document.querySelectorAll('details[data-era]').forEach(function(d){d.open=d.dataset.era==='1';});});
})();`;

const SECOES = [
  ['resumo', 'Resumo', secResumo()],
  ['decisoes', 'Decisões', secDecisoes()],
  ['numeros', 'Números', `<section id="numeros" aria-labelledby="h-numeros"><h2 id="h-numeros">Números</h2><p class="lead">As vendas pagas da loja são a medida de verdade; o que a Meta reporta lê-se ao lado, nunca somado.</p>${kpis()}${graficos()}</section>`],
  ['revisao', 'Revisão', secRevisao()],
  ['proposta', 'Proposta', secProposta()],
  ['vendas', 'Vendas', secVendas()],
  ['meta', 'Meta', secMeta()],
  ['auditoria', 'Auditoria', secAuditoria()],
  ['analise', 'Análise', secAnalise()],
  ['mercado', 'Mercado', secMercado()],
  ['artes', 'Artes', secFase('artes', 'F3', 'Artes', '03-artes', 'as peças da F3 (imagens e briefs por peça), o estado de aprovação de cada uma e a revisão independente das artes.')],
  ['implementacao', 'Implementação', secFase('implementacao', 'F4', 'Implementação', '04-implementacao.md', 'o que foi montado em cada plataforma (campanhas em pausa, UTMs, eventos), o gate de medição e o custo em € por canal.')],
  ['review', 'Review', secFase('review', 'F5', 'Review', '05-review.md', 'resultados por canal contra o baseline (mesmas janelas e vias), decisões cortar/manter/escalar e no máximo 3 ações para o ciclo seguinte.')],
  ['lacunas', 'Lacunas', secLacunas()],
  ['fontes', 'Fontes', secFontes()],
];
// separadores agrupados: uma vista de cada vez, por esta ordem
const GRUPOS = [['Agora', ['resumo', 'decisoes']], ['Evidência', ['numeros', 'vendas', 'meta', 'mercado', 'analise']], ['Trabalho', ['proposta', 'revisao', 'auditoria', 'artes', 'implementacao', 'review']], ['Apoio', ['lacunas', 'fontes']]];
const ORDEM = GRUPOS.flatMap(([, ids]) => ids);
SECOES.sort((a, b) => ORDEM.indexOf(a[0]) - ORDEM.indexOf(b[0]));
const navHtml = GRUPOS.map(([g, ids]) => `<div class="nav-g"><span class="nav-gl">${g}</span>${ids.map((id) => SECOES.find((x) => x[0] === id)).filter(Boolean).map(([id, n]) => `<a href="#${id}">${n}</a>`).join('')}</div>`).join('');
// a frase do estado.json cita um n.º de voltas diferente do que os ficheiros de revisão têm? mostra o real ao lado
function avisoVoltas() {
  const m = String(estado.proxima_accao || '').match(/(\d+)\s+voltas?/); if (!m) return '';
  const faseRev = { F2: 'proposta', F3: 'artes', F4: 'implementacao', F5: 'review' }[estado.fase];
  const r = revisoes.find((x) => x.fase === faseRev) || revisoes[revisoes.length - 1]; if (!r) return '';
  const n = voltasDe(r.texto).length;
  return n && n !== +m[1] ? `<p class="g-nota"><span class="selo espera">A revisão já vai em ${pl(n, 'volta', 'voltas')}</span> — contado em ${r.fichs.map((f) => `<code>${esc(f)}</code>`).join(', ')}; a frase acima vem do <code>estado.json</code> (${esc(estado.actualizado || '—')}).</p>` : '';
}
const hoje = new Date().toISOString().slice(0, 10);
const faseAtual = FASES.find(([f]) => f === estado.fase);
const html = `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="gerador" content="marketeer-painel">
<title>${esc(nomeMarca)} — painel do ciclo ${esc(CICLO)}</title>
<style>${CSS}</style>
</head>
<body data-chave="${esc(estado.slug || path.basename(CLIENTE))}-${esc(CICLO)}" data-nome="${esc(nomeMarca)}" data-ciclo="${esc(CICLO)}">
<a class="saltar" href="#conteudo">Saltar para o conteúdo</a>
<div class="barra" aria-hidden="true"><i id="prog"></i></div>
<header class="topo"><div class="topo-in">
<div class="sobre"><p class="marca-n"><b>${esc(nomeMarca)}</b> · painel de marketing, ciclo ${esc(CICLO)}</p><span class="meta">Estado de ${esc(estado.actualizado || '—')} · gerado a ${hoje}</span><span id="cont" class="cont"></span><button type="button" class="tema" aria-pressed="false">Modo escuro</button></div>
</div></header>
<nav class="secoes" aria-label="Secções do painel"><div class="nav-in">${navHtml}</div></nav>
<main id="conteudo" tabindex="-1">
${SECOES.map((s) => s[2]).join('\n')}
</main>
<footer class="rodape"><button type="button" class="nav" id="ant">← Anterior</button><span class="rod-n">Números com fonte e data. Sem acesso = «não verificado», nunca zero.</span><button type="button" class="nav pri" id="seg">Seguinte →</button></footer>
<div id="tip" role="tooltip"></div>
<script>${JS}</script>
</body>
</html>
`;

// ---------- escrita (nunca por cima de um ficheiro que não foi gerado por este painel) ----------
let saida = path.resolve(args.saida || path.join(CLIENTE, 'painel.html'));
if (fs.existsSync(saida) && !/<meta name="gerador" content="marketeer-painel">/.test(fs.readFileSync(saida, 'utf8'))) {
  const base = saida.replace(/\.html$/, ''); let n = 2;
  while (fs.existsSync(`${base}-v${n}.html`)) n++;
  saida = `${base}-v${n}.html`;
}
// nome acessível: cada tabela sem <caption> recebe o título mais próximo antes dela (repetidos levam número)
const nomesTab = new Map();
const htmlFinal = html.replace(/<table>(?!<caption)/g, (m, off) => {
  const tits = [...html.slice(Math.max(0, off - 20000), off).matchAll(/<(h[2-6]|figcaption|summary)[^>]*>([\s\S]*?)<\/\1>/g)];
  let nome = (tits.length ? tits[tits.length - 1][2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '') || 'Tabela';
  const k = (nomesTab.get(nome) || 0) + 1; nomesTab.set(nome, k);
  return `<table><caption class="sr">Tabela: ${esc(nome)}${k > 1 ? ` (${k})` : ''}</caption>`;
});
// HTML bem formado: cada etiqueta de bloco/inline que abre tem de fechar
const desequil = ['strong', 'em', 'a', 'span', 'code', 'section', 'details', 'summary', 'div', 'table', 'figure', 'ul', 'ol', 'li', 'blockquote']
  .map((t) => [t, (htmlFinal.match(new RegExp(`<${t}[\\s>]`, 'g')) || []).length, (htmlFinal.match(new RegExp(`</${t}>`, 'g')) || []).length]).filter(([, a, f]) => a !== f);
if (desequil.length) { console.error('erro: HTML desequilibrado — ' + desequil.map(([t, a, f]) => `<${t}> ${a} abertas / ${f} fechadas`).join(' · ')); process.exitCode = 3; }
const restos = html.match(/\{\{|undefined|NaN/g);
if (restos) console.error(`aviso: o HTML tem ${restos.length} ocorrência(s) de ${[...new Set(restos)].join(', ')}`);
fs.writeFileSync(saida, htmlFinal);
console.log(`painel: ${saida} (${(html.length / 1024).toFixed(0)} KB)`);
