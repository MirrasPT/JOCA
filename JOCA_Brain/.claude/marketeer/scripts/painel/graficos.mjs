// Gráficos SVG inline, sem bibliotecas. Regras: um só eixo Y, marcas finas com topo arredondado (4 px),
// 2 px de intervalo entre colunas vizinhas, grelha em linha fina sólida, texto sempre em tinta (nunca na cor da série),
// legenda sempre que há ≥ 2 séries, tabela de dados ao lado, dica (data-tip) por marca.
import { esc, int } from './md.mjs';

let gid = 0;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const nomeMes = (k) => { const [a, m] = k.split('-').map(Number); return `${MESES[m - 1]} ${a}`; };

function passoBonito(max) {
  const raw = max / 4; const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || p;
}
// coluna com topo arredondado (r) e base reta
function coluna(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Colunas por mês (uma ou mais séries, mesmo eixo e mesma unidade).
 * meses: [{ mes:'AAAA-MM', parcial?, valores:[n|null], tip, especial?, vazio?, linhaTabela? }]
 * series: [{ nome, cor }] · fmt(v, eixo) · linhas: [{ valor, rotulo, desde? (índice do 1.º mês) }] (limiar, tracejado)
 * corDe(i, s, v) → cor opcional por marca · cortarExtremo: valor isolado muito acima dos outros é cortado e anotado.
 * O eixo Y é um SVG à parte, fora da zona que desliza, para nunca desaparecer num ecrã estreito.
 */
export function colunasMes({ titulo, subtitulo = '', meses, series, fmt, linhas = [], corDe = null, legendaExtra = [], fonte, alt, colunasTabela = null, cortarExtremo = false, curto = '' }) {
  gid++;
  const n = meses.length; const k = series.length;
  const slot = k > 1 ? 44 : 34; const ML = 64; const MR = 14; const MT = 26; const MB = 44; const H = 300;
  const W = ML + MR + n * slot; const PH = H - MT - MB;
  const vals = meses.flatMap((m) => m.valores).filter((v) => typeof v === 'number');
  const ord = [...vals].sort((a, b) => b - a);
  let max = Math.max(1, ...vals, ...linhas.map((l) => l.valor));
  let corte = null;
  if (cortarExtremo && ord.length > 2 && ord[0] > 2 * ord[1]) { corte = Math.max(ord[1], ...linhas.map((l) => l.valor)) * 1.2; max = corte; }
  const passo = passoBonito(max); const topo = Math.ceil(max / passo) * passo;
  const y = (v) => MT + PH - (Math.min(v, topo) / topo) * PH;
  const bw = Math.min(18, (slot - 10 - 2 * (k - 1)) / k);
  let grelha = ''; let eixoY = '';
  for (let v = 0; v <= topo + 1e-9; v += passo) {
    grelha += `<line class="grelha" x1="${ML}" x2="${W - MR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
    eixoY += `<text class="eixo" x="${ML - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(fmt(v, true))}</text>`;
  }
  let marcas = ''; let eixoX = ''; let anoAnt = null;
  meses.forEach((m, i) => {
    const x0 = ML + i * slot; const cx = x0 + slot / 2; const largura = k * bw + 2 * (k - 1);
    let barras = '';
    m.valores.forEach((v, s) => {
      const x = cx - largura / 2 + s * (bw + 2);
      if (v == null) { if (m.especial || m.vazio) return; barras += `<text class="eixo nd" x="${(x + bw / 2).toFixed(1)}" y="${(MT + PH - 4).toFixed(1)}" text-anchor="middle">?</text>`; return; }
      const cor = (corDe && corDe(i, s, v)) || series[s].cor;
      if (v === 0) { barras += `<rect x="${x.toFixed(1)}" y="${(MT + PH - 2).toFixed(1)}" width="${bw.toFixed(1)}" height="2" fill="${cor}" opacity=".55"/>`; return; }
      barras += `<path d="${coluna(x, y(v), bw, MT + PH - y(v))}" fill="${cor}"/>`;
      if (v > topo) barras += `<text class="corte-t" x="${(x + bw / 2).toFixed(1)}" y="${MT - 8}" text-anchor="middle">↑ ${esc(fmt(v))}</text>`;
    });
    if (m.especial) barras += `<circle cx="${cx}" cy="${MT + PH - 9}" r="5" class="oco"/>`;
    marcas += `<g class="marca" tabindex="-1" role="img" aria-label="${esc(m.tip)}" data-tip="${esc(m.tip)}"><rect class="alvo" x="${x0}" y="${MT}" width="${slot}" height="${PH}"/>${barras}</g>`;
    const [a, mm] = m.mes.split('-');
    eixoX += `<text class="eixo" x="${cx}" y="${MT + PH + 16}" text-anchor="middle">${MESES[+mm - 1]}${m.parcial ? '*' : ''}</text>`;
    // ano por baixo de cada janeiro (e do 1.º mês, se não houver janeiro logo a seguir)
    if (a !== anoAnt && (+mm === 1 || (i === 0 && +mm < 12))) eixoX += `<text class="eixo ano" x="${cx}" y="${MT + PH + 33}" text-anchor="middle">${a}</text>`;
    anoAnt = a;
  });
  const lin = linhas.map((l) => { const x1 = ML + (l.desde || 0) * slot; return `<line class="limiar" x1="${x1}" x2="${W - MR}" y1="${y(l.valor).toFixed(1)}" y2="${y(l.valor).toFixed(1)}"/><text class="limiar-t" x="${W - MR - 2}" y="${(y(l.valor) - 7).toFixed(1)}" text-anchor="end">${esc(l.curto || l.rotulo)}</text>`; }).join('');
  const base = `<line class="base" x1="${ML}" x2="${W - MR}" y1="${MT + PH}" y2="${MT + PH}"/>`;
  const eixoSvg = `<svg class="graf eixo-y" viewBox="0 0 ${ML} ${H}" width="${ML}" height="${H}" aria-hidden="true">${eixoY}</svg>`;
  const svg = `<svg class="graf col" viewBox="${ML} 0 ${W - ML} ${H}" width="${W - ML}" height="${H}" role="group" aria-labelledby="g${gid}t" aria-describedby="g${gid}d"><title id="g${gid}t">${esc(titulo)}</title><desc id="g${gid}d">${esc(alt)}</desc>${grelha}${base}${marcas}${lin}${eixoX}</svg>`;
  const leg = [...(k > 1 ? series.map((s) => ({ cor: s.cor, nome: s.nome })) : []), ...legendaExtra];
  const legHtml = leg.length ? `<ul class="legenda">${leg.map((l) => `<li>${l.forma === 'oco' ? '<span class="sw oco" aria-hidden="true"></span>' : l.forma === 'limiar' ? '<span class="sw limiar" aria-hidden="true"></span>' : `<span class="sw" style="background:${l.cor}" aria-hidden="true"></span>`}${esc(l.nome)}</li>`).join('')}</ul>` : '';
  const cab = colunasTabela || series.map((s) => s.nome);
  const tab = `<details class="dados"><summary>Ver os dados em tabela<span class="sr"> — ${esc(curto || titulo)}</span></summary><div class="tabela"><table><caption>${esc(titulo)}</caption><thead><tr><th scope="col">Mês</th>${cab.map((c) => `<th scope="col" class="num">${esc(c)}</th>`).join('')}</tr></thead><tbody>${
    meses.map((m) => `<tr><td data-rotulo="Mês">${nomeMes(m.mes)}${m.parcial ? ' (parcial)' : ''}</td>${(m.linhaTabela || m.valores.map((v) => (v == null ? 'não verificado' : fmt(v)))).map((c, j) => `<td data-rotulo="${esc(cab[j])}" class="num">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  const notas = [meses.some((m) => m.parcial) && '* mês ainda a decorrer à data da leitura (valores parciais).', corte && `↑ coluna cortada no topo do eixo para não esmagar as outras; o valor real está escrito por cima dela.`].filter(Boolean);
  return `<figure class="grafico" id="graf-${gid}"><figcaption><span class="g-tit">${esc(titulo)}</span>${subtitulo ? `<span class="g-sub">${subtitulo}</span>` : ''}</figcaption>${legHtml}<p class="g-dica">Desliza o gráfico na horizontal para ver todos os meses; a escala fica fixa à esquerda.</p><div class="g-corpo">${eixoSvg}<div class="g-rolo" tabindex="0" role="region" aria-label="Gráfico: ${esc(curto || titulo)} (desliza na horizontal num ecrã estreito)">${svg}</div></div>${notas.map((t) => `<p class="g-nota">${t}</p>`).join('')}<p class="fonte-nota">Fonte: ${fonte}</p>${tab}</figure>`;
}

// Barras horizontais (categorias): uma só série, valor à ponta
export function barrasH({ itens, rotulo, valor, texto, tip, destaque = () => false, rotuloDestaque = '' }) {
  const max = Math.max(1, ...itens.map((i) => (typeof valor(i) === 'number' ? valor(i) : 0)));
  return `<div class="barras">${itens.map((it) => {
    const v = valor(it); const ok = typeof v === 'number';
    return `<div class="barra marca" tabindex="-1" role="img" aria-label="${esc(tip(it))}" data-tip="${esc(tip(it))}"><div class="b-rot">${esc(rotulo(it))}${destaque(it) && rotuloDestaque ? ` <span class="selo mini">${esc(rotuloDestaque)}</span>` : ''}</div><div class="b-trilho">${ok ? `<svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="${Math.max(0.8, (v / max) * 100).toFixed(2)}" height="12" rx="2" fill="${destaque(it) ? 'var(--s2)' : 'var(--s1)'}"/></svg>` : '<span class="suprimido">suprimido (n&lt;3)</span>'}</div><div class="b-val">${esc(texto(it))}</div></div>`;
  }).join('')}</div>`;
}

// Estado do ciclo: um segmento SVG por fase, colado ao rótulo dela (alinha em qualquer largura)
const EST = { feito: ['feito', 'Feito'], em_curso: ['curso', 'Em curso'], pendente: ['pendente', 'Por fazer'] };
export function faixaFases(fases, passos) {
  const resumo = fases.map(([f, nome]) => `${f} ${nome}: ${EST[passos?.[f]]?.[1] || 'Por fazer'}`).join('; ');
  const feitas = fases.filter(([f]) => passos?.[f] === 'feito').length;
  return `<div class="fases" role="img" aria-label="Estado do ciclo — ${feitas} de ${fases.length} fases feitas. ${esc(resumo)}">
<ol class="fases-l" aria-hidden="true">${fases.map(([f, nome]) => { const e = EST[passos?.[f]] || EST.pendente; return `<li class="${e[0]}"><svg class="faixa" viewBox="0 0 100 14" preserveAspectRatio="none"><rect class="seg ${e[0]}" x="0" y="0" width="100" height="14" rx="4"/></svg><span class="f-id">${f}</span><span class="f-n">${esc(nome)}</span><span class="f-e"><span class="ico ${e[0]}">${e[0] === 'feito' ? '✓' : e[0] === 'curso' ? '●' : '○'}</span>${e[1]}</span></li>`; }).join('')}</ol></div>`;
}

// Veredito da revisão: uma coluna por volta, um ponto por juiz (✓ aprovado · ✕ com defeitos)
export function pontosRevisao(voltas, titulo) {
  gid++;
  const maxJ = Math.max(1, ...voltas.map((v) => v.juizes.length));
  const cw = 76; const W = voltas.length * cw; const H = 30 + maxJ * 30;
  let s = '';
  voltas.forEach((v, i) => {
    const cx = i * cw + cw / 2;
    s += `<text class="eixo" x="${cx}" y="14" text-anchor="middle">Volta ${esc(v.n)}</text>`;
    v.juizes.forEach((j, r) => {
      const cy = 34 + r * 30; const ok = j.aprovado === true; const nd = j.aprovado == null;
      const tip = `Volta ${v.n} · ${j.id}${j.papel ? ' (' + j.papel + ')' : ''}: ${nd ? 'sem veredito' : ok ? 'aprovado' : `com defeitos${j.duros ? ` — ${j.duros} achado(s) duro(s)` : ''}`}`;
      s += `<g class="marca" tabindex="-1" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}"><circle cx="${cx}" cy="${cy}" r="11" class="${nd ? 'p-nd' : ok ? 'p-ok' : 'p-ko'}"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" class="p-t">${nd ? '?' : ok ? '✓' : '✕'}</text></g>`;
    });
  });
  return `<svg class="graf rev" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-labelledby="g${gid}r"><title id="g${gid}r">${esc(titulo)}</title>${s}</svg>`;
}
export { int };
