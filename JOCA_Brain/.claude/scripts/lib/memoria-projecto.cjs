// memoria-projecto — FONTE ÚNICA para ler a memória de projectos (nível 3).
//
//   memory/projects/<slug>/index.md  (+ geral.md, <area>.md, pastas.md, normas.md, config.md, acessos.md, arquivo.md)
//
// Fase D do desenho da memória por pastas: a ficha plana
// antiga `memory/projects/<slug>.md` deixou de ser lida. Só `fichasPlanas()` a vê, para o
// doctor avisar quando uma cópia antiga a traz.
// Resolução SÓ por igualdade (caminho · slug · alias); o resto vira lista de quase-iguais, nunca escolha.
// `lintMemoria()` é a fonte única dos limites (o doctor §7 e o validate-skill --all chamam-na).
//
// CLI (para /resume, /start, /save — devolve JSON):
//   node .claude/scripts/lib/memoria-projecto.cjs resolver "<path-alvo | nome>"
//   node .claude/scripts/lib/memoria-projecto.cjs ficheiro <slug>     → caminho do index.md
//   node .claude/scripts/lib/memoria-projecto.cjs listar
//   node .claude/scripts/lib/memoria-projecto.cjs quase <nome>
//   node .claude/scripts/lib/memoria-projecto.cjs planas             → fichas planas antigas (exit 1 se houver)
//   node .claude/scripts/lib/memoria-projecto.cjs lint               → limites das pastas (exit 1 se houver erros)
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJ_DIR = path.resolve(__dirname, '..', '..', '..', 'memory', 'projects');
const RESERVADOS = new Set(['index', 'geral', 'pastas', 'acessos', 'normas', 'config', 'arquivo']);
const IGNORAR_DIR = (n) => n.startsWith('.') || n.startsWith('_') || n === 'archive';

function lerDir(d) { try { return fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return []; } }

// [{ slug, ficheiro, dir }] — ficheiro = o index.md (o único que se lê por omissão).
function listarProjectos(projDir = PROJ_DIR) {
  const out = [];
  for (const e of lerDir(projDir)) {
    if (!e.isDirectory() || IGNORAR_DIR(e.name)) continue;
    const idx = path.join(projDir, e.name, 'index.md');
    if (fs.existsSync(idx)) out.push({ slug: e.name, ficheiro: idx, dir: path.join(projDir, e.name) });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

// Fichas planas antigas (`<slug>.md` na raiz de projects/): NÃO se lêem, só se detectam para avisar
// (chegam de uma cópia antiga sincronizada, ou de código antigo). [{ slug, ficheiro, temPasta }]
function fichasPlanas(projDir = PROJ_DIR) {
  return lerDir(projDir)
    .filter((e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.'))
    .map((e) => {
      const slug = e.name.slice(0, -3);
      return { slug, ficheiro: path.join(projDir, e.name), temPasta: fs.existsSync(path.join(projDir, slug, 'index.md')) };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function ficheiroProjecto(slug, projDir = PROJ_DIR) {
  if (!slug) return null;
  const idx = path.join(projDir, slug, 'index.md');
  return fs.existsSync(idx) ? idx : null;
}

// Caminho relativo à raiz do Brain, para mensagens.
function caminhoRelativo(slug) {
  return `memory/projects/${slug}/index.md`;
}

// Todos os .md de um projecto (todos menos arquivo.md por omissão), index primeiro.
function ficheirosDoProjecto(slug, { comArquivo = false } = {}, projDir = PROJ_DIR) {
  const f = ficheiroProjecto(slug, projDir);
  if (!f) return [];
  const d = path.dirname(f);
  return fs.readdirSync(d).filter((n) => n.endsWith('.md') && (comArquivo || n !== 'arquivo.md'))
    .sort((a, b) => (a === 'index.md' ? -1 : b === 'index.md' ? 1 : a.localeCompare(b)))
    .map((n) => path.join(d, n));
}

// Frontmatter → Map(chave → valor cru). Só linhas `chave: valor` de topo (o resto ignora-se).
function lerFrontmatter(ficheiro, max = 8000) {
  let t;
  try {
    const fd = fs.openSync(ficheiro, 'r');
    const buf = Buffer.alloc(max);
    const n = fs.readSync(fd, buf, 0, max, 0);
    fs.closeSync(fd);
    t = buf.slice(0, n).toString('utf8');
  } catch (_) { return new Map(); }
  return parseFrontmatter(t);
}
function parseFrontmatter(texto) {
  const t = String(texto).replace(/\r\n/g, '\n');
  const campos = new Map();
  if (!t.startsWith('---\n')) return campos;
  const fim = t.indexOf('\n---', 3);
  if (fim === -1) return campos;
  for (const l of t.slice(4, fim).split('\n')) {
    const m = l.match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    if (m && !campos.has(m[1])) campos.set(m[1], m[2]);
  }
  return campos;
}
// Valor escalar: tira comentário ` # …`, aspas e desfaz `\\` do YAML entre aspas duplas.
function valor(raw) {
  if (raw == null) return null;
  let v = String(raw).trim();
  if (v.startsWith('"')) { const f = v.indexOf('"', 1); v = f > 0 ? v.slice(1, f).replace(/\\\\/g, '\\') : v.slice(1); }
  else if (v.startsWith("'")) { const f = v.indexOf("'", 1); v = f > 0 ? v.slice(1, f) : v.slice(1); }
  else v = v.replace(/\s+#.*$/, '').trim();
  return !v || v === 'null' || v === '~' ? null : v;
}
// Valor que pode ser lista `[a, "b"]` ou escalar → array.
function lista(raw) {
  if (raw == null) return [];
  const s = String(raw).replace(/\s+#[^\]]*$/, '').trim();
  if (!s.startsWith('[')) { const v = valor(s); return v ? [v] : []; }
  const dentro = s.slice(1, s.lastIndexOf(']') > 0 ? s.lastIndexOf(']') : undefined);
  const out = []; let cur = ''; let q = null;
  for (const c of dentro) {
    if (q) { if (c === q) q = null; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === ',') { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map((v) => v.replace(/\\\\/g, '\\')).filter((v) => v && v !== 'null');
}

// aliases: [x, y#area] → [{ nome, area }]
function aliasesDe(campos) {
  return lista(campos.get('aliases')).map((a) => {
    const [nome, area] = a.split('#');
    return { nome: nome.trim().toLowerCase(), area: area ? area.trim() : null };
  }).filter((a) => a.nome);
}

// Índice de todos os projectos: slug → { campos, aliases, ... }. Cache por projDir.
const _cache = new Map();
function indice(projDir = PROJ_DIR) {
  if (_cache.has(projDir)) return _cache.get(projDir);
  const r = listarProjectos(projDir).map((p) => {
    const campos = lerFrontmatter(p.ficheiro);
    return { ...p, campos, aliases: aliasesDe(campos), distinto: lista(campos.get('distinto_de')).map((s) => s.toLowerCase()) };
  });
  _cache.set(projDir, r);
  return r;
}

// alias → { slug, area } (alias repetido entre pastas = ambíguo → null, não se usa).
function mapaAliases(projDir = PROJ_DIR) {
  const m = new Map();
  for (const p of indice(projDir)) {
    for (const a of p.aliases) {
      const v = m.get(a.nome);
      if (v === undefined) m.set(a.nome, { slug: p.slug, area: a.area });
      else if (v && v.slug !== p.slug) m.set(a.nome, null);
    }
  }
  return m;
}

const normSlug = (s) => String(s).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80).toLowerCase();

function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// Quase-iguais (critério do lint, desenho §1.4): Levenshtein ≤2, um contém o outro, ou token comum ≥5 letras.
function eQuaseIgual(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (!a || !b || a === b) return false;
  if (levenshtein(a, b) <= 2) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  const ta = new Set(a.split(/[-_\s.]+/).filter((t) => t.length >= 5));
  return b.split(/[-_\s.]+/).some((t) => t.length >= 5 && ta.has(t));
}
function quaseIguais(nome, projDir = PROJ_DIR) {
  const n = normSlug(nome);
  const out = [];
  for (const p of indice(projDir)) {
    if (p.distinto.includes(n)) continue;
    if (eQuaseIgual(n, p.slug) || eQuaseIgual(n.replace(/_/g, '-'), p.slug)
      || p.aliases.some((a) => eQuaseIgual(n, a.nome))) out.push(p.slug);
  }
  return out;
}

// Caminho → forma comparável (expande ~, separadores, caixa no Windows, sem barra final).
function normPath(p) {
  let s = String(p).trim();
  if (s.startsWith('~/') || s.startsWith('~\\')) s = path.join(os.homedir(), s.slice(2));
  s = s.replace(/[\\/]+/g, '/').replace(/\/+$/, '');
  return /^[A-Za-z]:\//.test(s) || process.platform === 'win32' || process.platform === 'darwin' ? s.toLowerCase() : s;
}
function realOuNada(p) { try { return normPath(fs.realpathSync(p)); } catch (_) { return null; } }

// Pares (chave, caminho) de `directorio*` que decidem resolução (sem _anterior/_nota/_estado).
function caminhosDe(campos) {
  const out = [];
  for (const [k, raw] of campos) {
    if (!/^directorio[a-z_]*$/.test(k) || /_anterior|_nota|_estado/.test(k)) continue;
    for (const v of lista(raw)) {
      if (/^<.*>$/.test(v)) continue;            // placeholder não é caminho
      const am = k.match(/^directorio_area_(.+?)(?:_(?:win|mac))?$/);
      out.push({ chave: k, caminho: v, area: am ? am[1].replace(/_/g, '-') : null });
    }
  }
  return out;
}

/**
 * resolverProjecto(alvo) — desenho §2.1, só igualdade:
 *  1. caminho exacto (ou realpath) == directorio* · subpasta de um directorio* → essa entrada
 *  2. slug exacto (basename normalizado) · 3. alias exacto · 4. nada → quase-iguais (o caller pergunta)
 *  ≥2 no mesmo passo → `ambiguo: true` com a lista (o caller pergunta).
 * Devolve { via, slug, area, ficheiro, candidatos, irmas, quaseIguais, ambiguo }.
 */
function resolverProjecto(alvo, projDir = PROJ_DIR) {
  const res = { alvo, via: null, slug: null, area: null, ficheiro: null, candidatos: [], irmas: [], quaseIguais: [], ambiguo: false };
  const fim = (via, lst) => {
    const uniq = [...new Map(lst.map((x) => [x.slug + '#' + (x.area || ''), x])).values()];
    const slugs = [...new Set(uniq.map((x) => x.slug))];
    res.via = via; res.candidatos = uniq;
    if (slugs.length === 1) {
      res.slug = slugs[0];
      res.area = uniq.length === 1 ? uniq[0].area : null;
      res.ficheiro = ficheiroProjecto(res.slug, projDir);
    } else res.ambiguo = true;
    return res;
  };
  const ix = indice(projDir);
  const pareceCaminho = /[\\/]/.test(alvo) || /^[A-Za-z]:/.test(alvo) || alvo.startsWith('~');
  if (pareceCaminho) {
    const a = normPath(alvo); const ar = realOuNada(alvo);
    const exactos = [], maes = [];
    for (const p of ix) {
      for (const c of caminhosDe(p.campos)) {
        const v = normPath(c.caminho);
        if (v === a || (ar && realOuNada(c.caminho) === ar)) exactos.push({ slug: p.slug, area: c.area, chave: c.chave });
        else if (a.startsWith(v + '/')) maes.push({ slug: p.slug, area: c.area, chave: c.chave, prof: v.length });
        else if (v.startsWith(a + '/')) res.irmas.push(p.slug);
      }
    }
    res.irmas = [...new Set(res.irmas)];
    if (exactos.length) {
      // a mesma pasta casada pela chave principal e por uma de área → fica a principal
      const semArea = exactos.filter((x) => !x.area);
      const porSlug = new Map();
      for (const x of exactos) if (!porSlug.has(x.slug) || !x.area) porSlug.set(x.slug, semArea.find((y) => y.slug === x.slug) || x);
      return fim('caminho', [...porSlug.values()]);
    }
    if (maes.length) {
      const prof = Math.max(...maes.map((m) => m.prof));
      return fim('caminho-mae', maes.filter((m) => m.prof === prof));
    }
  }
  const base = String(alvo).split(/[\\/]+/).filter(Boolean).pop() || '';
  const n = normSlug(base);
  const nHif = n.replace(/[_\s]+/g, '-');
  const porSlug = ix.filter((p) => p.slug === n || p.slug === nHif);
  if (porSlug.length) return fim('slug', porSlug.map((p) => ({ slug: p.slug, area: null })));
  const al = mapaAliases(projDir);
  const hit = al.get(n) || al.get(nHif);
  if (hit) return fim('alias', [hit]);
  res.quaseIguais = quaseIguais(n, projDir);
  return res;
}

// ── Lint dos limites (desenho §1.1/§1.4, decisão §7.3) ────────────────────────────────────────────
// O frontmatter do index conta À PARTE, com tecto próprio de 20 linhas: os limites de 40 linhas e 4 000 B
// são do CORPO, que é o que se lê em cada /resume. O frontmatter são dados para scripts (o do joca tem ~2,8 KB).
const LIMITES = { corpoLinhas: 40, corpoBytes: 4000, fmLinhas: 20, linhasPorArea: 3, areas: 8, areaBytes: 40 * 1024 };
const NOME_AREA = /^[a-z0-9-]+$/;

function partirIndex(texto) {
  const t = String(texto).replace(/\r\n/g, '\n');
  if (!t.startsWith('---\n')) return { fm: null, corpo: t };
  const fim = t.indexOf('\n---', 3);
  if (fim === -1) return { fm: null, corpo: t };
  const depois = t.indexOf('\n', fim + 4);
  return { fm: t.slice(4, fim).split('\n'), corpo: depois === -1 ? '' : t.slice(depois + 1) };
}
// Linhas de uma secção `## <titulo>` (até ao próximo `#`/`##`).
function seccao(corpo, re) {
  const out = []; let dentro = false;
  for (const l of corpo.split('\n')) {
    if (/^#{1,2} /.test(l)) { dentro = re.test(l.replace(/^#+\s*/, '')); continue; }
    if (dentro) out.push(l);
  }
  return out;
}

/**
 * lintMemoria(projDir) → { pastas, erros: [{slug, msg}], avisos: [{slug, msg}], foraDoLimite: [slug] }
 * erros  — ficha plana antiga presente · pasta sem index.md · name ≠ pasta · frontmatter >20 linhas ·
 *          corpo do index >40 linhas não vazias ou >4 000 B · mini-estado de uma área >3 linhas ·
 *          .md da pasta não listado em §Ficheiros (ou listado e inexistente) · área fora de [a-z0-9-]
 * avisos — >8 áreas · área (ou geral.md) >40 KB: sugere arquivar partes acabadas, nunca arquiva sozinho
 */
function lintMemoria(projDir = PROJ_DIR) {
  const erros = [], avisos = [];
  const e = (slug, msg) => erros.push({ slug, msg });
  const w = (slug, msg) => avisos.push({ slug, msg });
  let pastas = 0;
  for (const p of fichasPlanas(projDir)) {
    e(p.slug, `ficha plana antiga ${p.slug}.md (${p.temPasta ? 'ao lado da pasta' : 'sem pasta'}) — já não é lida; juntar o conteúdo ao index.md da pasta`);
  }
  for (const d of lerDir(projDir)) {
    if (!d.isDirectory() || IGNORAR_DIR(d.name)) continue;
    const slug = d.name; const dir = path.join(projDir, slug);
    pastas++;
    const idx = path.join(dir, 'index.md');
    if (!fs.existsSync(idx)) { e(slug, 'pasta sem index.md'); continue; }
    const { fm, corpo } = partirIndex(fs.readFileSync(idx, 'utf8'));
    if (!fm) e(slug, 'index.md sem frontmatter');
    else {
      const nome = valor(parseFrontmatter(`---\n${fm.join('\n')}\n---`).get('name'));
      if (nome !== slug) e(slug, `name «${nome || ''}» ≠ nome da pasta`);
      if (fm.length > LIMITES.fmLinhas) e(slug, `frontmatter do index com ${fm.length} linhas (máx. ${LIMITES.fmLinhas})`);
    }
    const naoVazias = corpo.split('\n').filter((l) => l.trim()).length;
    const bytes = Buffer.byteLength(corpo, 'utf8');
    if (naoVazias > LIMITES.corpoLinhas) e(slug, `corpo do index com ${naoVazias} linhas não vazias (máx. ${LIMITES.corpoLinhas})`);
    if (bytes > LIMITES.corpoBytes) e(slug, `corpo do index com ${bytes} B (máx. ${LIMITES.corpoBytes})`);
    // mini-estado: cada `- ` de topo em §Áreas abre um bloco; as linhas indentadas a seguir contam
    let bloco = null, n = 0;
    const fecha = () => { if (bloco && n > LIMITES.linhasPorArea) e(slug, `mini-estado da área «${bloco}» com ${n} linhas (máx. ${LIMITES.linhasPorArea})`); };
    for (const l of seccao(corpo, /^Áreas\b/i)) {
      if (!l.trim()) continue;
      if (/^[-*] /.test(l)) { fecha(); bloco = (l.match(/\*\*([^*]+)\*\*/) || [null, l.slice(2, 30)])[1]; n = 1; }
      else if (bloco) n++;
    }
    fecha();
    // §Ficheiros: cada .md da pasta listado; o nome que ABRE a linha (`- geral.md — …`) tem de existir.
    // Caminhos com `/` (`../archive/x.md`) e nomes citados no meio da descrição não contam.
    const listados = new Set();
    for (const l of seccao(corpo, /^Ficheiros\b/i)) {
      const m = l.match(/^[-*]\s+[`[]?([^\s`\]]+?\.md)\b/i);
      if (m && !/[\\/]/.test(m[1])) listados.add(m[1]);
    }
    const mds = lerDir(dir).filter((x) => x.isFile() && x.name.endsWith('.md')).map((x) => x.name);
    for (const m of mds) if (m !== 'index.md' && !listados.has(m)) e(slug, `${m} não está listado em §Ficheiros do index`);
    for (const m of listados) if (!mds.includes(m)) e(slug, `§Ficheiros lista ${m}, que não existe na pasta`);
    const areas = mds.filter((m) => m !== 'index.md' && !RESERVADOS.has(m.slice(0, -3)));
    for (const a of areas) if (!NOME_AREA.test(a.slice(0, -3))) e(slug, `área com nome inválido: ${a} (só [a-z0-9-])`);
    if (areas.length > LIMITES.areas) w(slug, `${areas.length} áreas (máx. ${LIMITES.areas}) — arquivar ou fundir uma`);
    for (const a of [...areas, 'geral.md']) {
      const f = path.join(dir, a);
      if (!fs.existsSync(f)) continue;
      const tam = fs.statSync(f).size;
      if (tam > LIMITES.areaBytes) w(slug, `${a} com ${Math.round(tam / 1024)} KB (>40 KB) — sugerir ao utilizador arquivar partes acabadas`);
    }
  }
  const foraDoLimite = [...new Set(erros.filter((x) => /corpo do index|mini-estado|frontmatter do index/.test(x.msg)).map((x) => x.slug))];
  return { pastas, erros, avisos, foraDoLimite };
}

module.exports = {
  PROJ_DIR, RESERVADOS, LIMITES, listarProjectos, fichasPlanas, ficheiroProjecto, caminhoRelativo, ficheirosDoProjecto, lintMemoria,
  lerFrontmatter, parseFrontmatter, valor, lista, aliasesDe, mapaAliases, quaseIguais, eQuaseIgual,
  resolverProjecto, caminhosDe, normSlug, levenshtein,
};

if (require.main === module) {
  const [cmd, arg] = process.argv.slice(2);
  const dir = process.env.JOCA_PROJ_DIR || PROJ_DIR;
  const out = (o) => process.stdout.write(JSON.stringify(o, null, 2) + '\n');
  if (cmd === 'resolver' && arg) out(resolverProjecto(arg, dir));
  else if (cmd === 'ficheiro' && arg) { const f = ficheiroProjecto(arg, dir); if (f) console.log(f); else process.exit(1); }
  else if (cmd === 'listar') for (const p of listarProjectos(dir)) console.log(`${p.slug}\t${p.ficheiro}`);
  else if (cmd === 'quase' && arg) out(quaseIguais(arg, dir));
  else if (cmd === 'planas') { const p = fichasPlanas(dir); out(p); process.exit(p.length ? 1 : 0); }
  else if (cmd === 'lint') { const r = lintMemoria(dir); out(r); process.exit(r.erros.length ? 1 : 0); }
  else { console.error('uso: memoria-projecto.cjs resolver <path|nome> | ficheiro <slug> | listar | quase <nome> | planas | lint'); process.exit(2); }
}
