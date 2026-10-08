// Markdown mínimo → HTML, sem bibliotecas. Só o que os ficheiros do marketeer usam.
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// separador de milhares «.» e decimal «,» sempre (o pt-PT do Intl não agrupa números de 4 algarismos)
const agrupa = (n, casas) => { const [i, d] = Math.abs(n).toFixed(casas).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : ''); };
export const eur = (n) => (n == null || Number.isNaN(n) ? 'não verificado' : agrupa(n, 2) + ' €');
export const eur0 = (n) => (n == null ? '—' : agrupa(n, 0) + ' €');
export const int = (n) => (n == null ? '—' : typeof n === 'number' ? agrupa(n, 0) : String(n));
export const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// «1.224,24 €» → 1224.24 · «—» → null
export function numPT(s) {
  const m = String(s ?? '').replace(/\*\*/g, '').match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/);
  return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : null;
}

// secção «## titulo» (até ao próximo cabeçalho de nível ≤)
export function sec(md, titulo, nivel = 2) {
  if (!md) return '';
  const h = '#'.repeat(nivel) + ' ';
  const linhas = md.split('\n');
  const i = linhas.findIndex((l) => l.startsWith(h) && l.slice(h.length).trim().startsWith(titulo));
  if (i < 0) return '';
  let j = i + 1;
  while (j < linhas.length) { const m = linhas[j].match(/^(#+)\s/); if (m && m[1].length <= nivel) break; j++; }
  return linhas.slice(i + 1, j).join('\n').replace(/<!--[\s\S]*?-->/g, '').trim();
}
// blocos «### » (ou do nível pedido); o bloco sem título é a introdução
export function subsecs(md, nivel = 3) {
  const h = '#'.repeat(nivel) + ' ';
  const out = []; let atual = { titulo: null, corpo: [] };
  for (const l of String(md || '').split('\n')) {
    if (l.startsWith(h)) { out.push(atual); atual = { titulo: l.slice(h.length).trim(), corpo: [] }; } else atual.corpo.push(l);
  }
  out.push(atual);
  return out.map((s) => ({ titulo: s.titulo, corpo: s.corpo.join('\n').replace(/<!--[\s\S]*?-->/g, '').trim() })).filter((s) => s.titulo || s.corpo);
}
// linhas de tabela markdown → matriz (sem a linha separadora)
export function linhasTab(md) {
  return String(md || '').split('\n').filter((l) => l.trim().startsWith('|'))
    .map((l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim()))
    .filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
}
export const colIdx = (cab, re) => cab.findIndex((h) => re.test(h.replace(/\*\*/g, '')));

export function inline(s) {
  const codes = []; const urls = [];
  s = String(s ?? '').replace(/`?<sem fonte>`?/g, '\u0001');
  // código e ligações saem ANTES do escape: o href fica com o URL original (sem «&amp;» partido) e sem pontuação final
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/https?:\/\/[^\s<>)\]»"`\u0000]+/g, (u) => { const m = u.match(/^(.*?)([.,;:!?]*)$/); urls.push(m[1]); return `\u0002${urls.length - 1}\u0002${m[2]}`; });
  let t = esc(s);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
  t = t.replace(/\[(fonte|inferência|inferencia|por confirmar)((?:[^\[\]]|\[[^\]]*\])*)\]/gi, (m, tipo, resto) => {
    const k = /fonte/i.test(tipo) ? 'fonte' : /infer/i.test(tipo) ? 'inferencia' : 'confirmar';
    return `<span class="etq ${k}">${tipo}${resto}</span>`;
  });
  // «não verificado» vira etiqueta; um <strong> só se consome quando envolve exatamente a etiqueta (nunca só o fecho)
  t = t.replace(/<strong>(não verificad[oa]s?)<\/strong>|(não verificad[oa]s?)/g, (m, a, b) => `<span class="etq nv">${a || b}</span>`);
  t = t.replace(/\u0002(\d+)\u0002/g, (_, i) => { const u = urls[+i]; return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, ''))}</a>`; });
  t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
  t = t.replace(/\u0001/g, '<span class="etq sf">sem fonte</span>');
  return t;
}

const celulaNum = (c) => !/\d{4}-\d{2}/.test(c) && /^[\s\d.,<>≈→−%€+×÷=/*-]+$/.test(c) && /\d/.test(c);
// tabela: cada <td> leva data-rotulo (no telemóvel as tabelas largas viram fichas empilhadas)
export function tabela(linhas) {
  const rows = linhas.map((l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim()));
  const head = rows[0]; const body = rows.slice(2);
  const larga = head.length > 3 ? ' larga' : '';
  return `<div class="tabela${larga}"><table><thead><tr>${head.map((h) => `<th scope="col">${inline(h)}</th>`).join('')}</tr></thead><tbody>${
    body.map((r) => `<tr>${r.map((c, k) => `<td data-rotulo="${esc((head[k] || '').replace(/[*`]/g, ''))}"${celulaNum(c) ? ' class="num"' : ''}>${inline(c)}</td>`).join('')}</tr>`).join('\n')}</tbody></table></div>`;
}
function lista(linhas) {
  const ind = (l) => l.match(/^\s*/)[0].length;
  let html = ''; const pilha = [];
  for (const l of linhas) {
    const m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
    if (!m) { html += ' ' + inline(l.trim()); continue; }
    const n = ind(l); const tag = /\d/.test(m[2]) ? 'ol' : 'ul';
    if (!pilha.length || n > pilha[pilha.length - 1].n) { html += `<${tag}>`; pilha.push({ n, tag }); } else {
      while (pilha.length > 1 && n < pilha[pilha.length - 1].n) html += `</li></${pilha.pop().tag}>`;
      html += '</li>';
    }
    html += `<li>${inline(m[3])}`;
  }
  while (pilha.length) html += `</li></${pilha.pop().tag}>`;
  return html;
}
// base = nível HTML do cabeçalho mais alto do bloco; os outros descem a partir dele, sem saltos
export function md2html(md, base = 3) {
  const L = String(md || '').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const niveis = [...new Set(L.map((l) => (l.match(/^(#{1,6})\s/) || [])[1]?.length).filter(Boolean))].sort();
  const out = []; let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('```')) { const b = []; i++; while (i < L.length && !L[i].startsWith('```')) b.push(L[i++]); i++; out.push(`<pre>${esc(b.join('\n'))}</pre>`); continue; }
    const h = l.match(/^(#{1,6})\s+(.*)/);
    if (h) { const n = Math.min(6, base + niveis.indexOf(h[1].length)); out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (l.trim().startsWith('|')) { const b = []; while (i < L.length && L[i].trim().startsWith('|')) b.push(L[i++]); out.push(b.length > 1 ? tabela(b) : `<p>${inline(b[0])}</p>`); continue; }
    if (l.startsWith('>')) { const b = []; while (i < L.length && L[i].startsWith('>')) b.push(L[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${b.map(inline).join('<br>')}</blockquote>`); continue; }
    if (/^\s*([-*]|\d+\.)\s/.test(l)) {
      const b = []; while (i < L.length && (/^\s*([-*]|\d+\.)\s/.test(L[i]) || (/^\s{2,}\S/.test(L[i]) && b.length))) b.push(L[i++]);
      out.push(lista(b)); continue;
    }
    const p = []; while (i < L.length && L[i].trim() && !/^(#|\||>|```|\s*([-*]|\d+\.)\s)/.test(L[i])) p.push(L[i++]);
    out.push(`<p>${p.map(inline).join('<br>')}</p>`);
  }
  return out.join('\n');
}
export const detalhes = (titulo, corpo, aberto = false) =>
  `<details class="bloco"${aberto ? ' open' : ''}><summary>${inline(titulo)}</summary><div class="corpo">${corpo}</div></details>`;
// secção com «###» → introdução visível + subsecções colapsáveis
// blocos colapsáveis em grelha: 1 coluna no telemóvel, 2–3 em ecrã largo
// abertos por omissão vão juntos à frente (colunas próprias); os fechados seguem em colunas equilibradas (CSS columns)
export const blocos = (lista) => {
  const abertos = lista.filter((h) => /^<details class="bloco" open/.test(h)); const fechados = lista.filter((h) => !abertos.includes(h));
  return (abertos.length ? `<div class="blocos abertos${abertos.length === 1 ? ' um' : ''}">${abertos.join('\n')}</div>` : '') + (fechados.length ? `<div class="blocos">${fechados.join('\n')}</div>` : '');
};
export const colapsavel = (md, aberto = false) => { const ss = subsecs(md); const intro = ss.filter((s) => !s.titulo).map((s) => `<div class="prosa">${md2html(s.corpo, 4)}</div>`).join(''); return intro + blocos(ss.filter((s) => s.titulo).map((s) => detalhes(s.titulo, md2html(s.corpo, 4), aberto))); };
// recebe HTML já escapado (quem chama usa esc()/<code>)
export const fonteNota = (t) => `<p class="fonte-nota">Fonte: ${t}</p>`;
