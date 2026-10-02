#!/usr/bin/env node
/**
 * migrar-memoria-pastas — converte as fichas planas `memory/projects/<slug>.md` em pastas
 * `memory/projects/<slug>/` (index.md + geral.md [+ áreas · arquivo.md]). Fase B do desenho
 * da memória por pastas (2026-10-01, §4).
 *
 *   node .claude/scripts/migrar-memoria-pastas.mjs              # dry-run (omissão): relatório, nada escrito
 *   node .claude/scripts/migrar-memoria-pastas.mjs --apply      # backup → escreve → prova → remove as planas
 *   node .claude/scripts/migrar-memoria-pastas.mjs --rollback   # repõe do backup; recusa se alguma pasta foi editada depois, e copia o estado actual antes
 *   opções: --projdir <dir> · --index <INDEX.md> · --backup <dir> · --forca (ignora co-actividade <45 min)
 *
 * Regras (porquê, ao lado):
 * - Corpo VERBATIM: nada se reescreve. O frontmatter vai tal qual para o index.md; só se ACRESCENTAM
 *   linhas geradas (name em falta, description em falta, aliases, corpo do index, cabeçalhos de bloco).
 * - Prova antes de apagar: por destino, o multiconjunto das linhas das fontes ⊆ linhas novas, e
 *   linhas novas = linhas das fontes + linhas geradas (planeadas). Falha → não apaga nada.
 * - Nunca escreve por cima: ficheiro de destino que já exista → pára.
 * - Idempotente: slug já em pasta e sem ficha plana → salta. Correr 2× não muda nada.
 * - `archive/`, `.gitkeep`, `*.bak*` ficam como estão (o index aponta para o histórico em archive/).
 * - Fusões decididas pelo utilizador (desenho §7.1): FUSOES abaixo, com as fronteiras verificadas.
 * - Absorvidas com `absorvida_por:` (desenho §4.2.5) → bloco no arquivo.md do alvo + alias do alvo.
 * - Credenciais escritas nas fichas: não se mexem nem se listam (decisão §7.4).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BRAIN = path.resolve(AQUI, '..', '..');
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
const flag = (n) => process.argv.includes(`--${n}`);
const PROJ = path.resolve(arg('projdir') || path.join(BRAIN, 'memory', 'projects'));
const INDEX_MD = arg('index') ? path.resolve(arg('index')) : (arg('projdir') ? null : path.join(BRAIN, 'memory', 'INDEX.md'));
const HOJE = new Date().toISOString().slice(0, 10);
const BACKUP = path.resolve(arg('backup') || path.join(os.homedir(), '.claude', 'joca-runs', '2026-10-01-memoria-pastas', 'backup-pre-migracao'));
const MANIFESTO = path.join(BACKUP, '..', 'migracao-manifesto.json');
const APPLY = flag('apply');

// Aliases de pasta de disco que viviam em joca-slug.cjs (desenho §4.2.4) — passam para o index.
// Formato: { '<slug>': ['<nome_de_pasta_antigo>', …] }. Vazio por omissão; cada instalação acrescenta os seus.
const ALIASES_SEMENTE = {};

// Fusões decididas pelo utilizador (desenho §3 + §7.1): várias fichas planas → uma pasta com áreas.
// Vazio por omissão. Formato de cada entrada (intervalos 1-based inclusivos da ficha principal,
// verificados por `fronteiras` (linha → início esperado) e pelo nº total de linhas; se a ficha mudou, pára):
//   '<slug>': {
//     principal: '<slug>', totalLinhas: <n>, fm: [1, <fim do frontmatter>],
//     fronteiras: { <linha>: '<início literal da linha>', … },
//     areas: { 'geral.md': [[a, b], …], '<area>.md': [[a, b]], 'arquivo.md': [[a, b]] },   // cobre o corpo todo, sem sobreposição
//     titulos: { '<area>.md': '<Título>' }, ler: { '<area>.md': '<resumo · ler: quando>' },
//     fundidas: { '<slug-fundido>': { corpo: '<area>.md', area: '<area_snake>' | null, alias: '<alias>[#<area>]' } },
//   }
const FUSOES = {};

// ── utilitários ───────────────────────────────────────────────────────────────
// Linhas CRUAS: parte em '\n' e mantém o '\r' na linha → preserva os bytes (CRLF ou LF).
function linhas(texto) {
  const l = texto.split('\n');
  if (l[l.length - 1] === '') l.pop();
  return l;
}
const eolDe = (texto) => (texto.includes('\r\n') ? '\r' : '');
function fmFim(ls) {            // índice (0-based) da linha `---` que fecha o frontmatter, ou -1
  if (!ls.length || ls[0].replace(/\r$/, '') !== '---') return -1;
  for (let i = 1; i < ls.length; i++) if (ls[i].replace(/\r$/, '') === '---') return i;
  return -1;
}
const limpa = (l) => l.replace(/\r$/, '');
const campoFm = (fmLs, k) => { const l = fmLs.find((x) => new RegExp(`^${k}:`).test(limpa(x))); return l ? limpa(l).replace(new RegExp(`^${k}:\\s*`), '') : null; };
function valorSimples(v) {
  if (v == null) return null;
  let s = v.trim();
  if (/^["']/.test(s)) { const q = s[0]; const f = s.indexOf(q, 1); s = f > 0 ? s.slice(1, f) : s.slice(1); }
  else s = s.replace(/\s+#.*$/, '');
  return s.trim() || null;
}
const yamlStr = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const corta = (s, n = 200) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const hash = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// Primeira linha de conteúdo da 1.ª secção de estado (verbatim, cortada a 200) — nunca inventada.
function estadoGlobal(corpoLs) {
  const i = corpoLs.findIndex((l) => /^#{2,3} .*(estado|última sessão|ultima sessao)/i.test(limpa(l)));
  if (i === -1) return null;
  for (let j = i + 1; j < corpoLs.length; j++) {
    const t = limpa(corpoLs[j]).trim();
    if (!t) continue;
    if (/^#/.test(t)) return null;
    return corta(t.replace(/^[-*>]\s+/, ''));
  }
  return null;
}
function titulo(corpoLs, slug) {
  const h = corpoLs.map(limpa).find((l) => /^# /.test(l));
  return corta(h ? h.slice(2).trim() : slug, 120);
}

// ── plano ─────────────────────────────────────────────────────────────────────
// Destino = { slug, ficheiros: Map(nome → [{tipo:'orig'|'gen', linha, fonte?}]), fontes:[ficheiro], eol, mtime }
function lerFonte(slug) {
  const f = path.join(PROJ, `${slug}.md`);
  const txt = fs.readFileSync(f, 'utf8');
  const ls = linhas(txt);
  const fim = fmFim(ls);
  return { slug, ficheiro: f, txt, ls, eol: eolDe(txt), fim, fm: fim > 0 ? ls.slice(1, fim) : [], corpo: ls.slice(fim + 1), mtime: fs.statSync(f).mtime };
}

function planear() {
  const planas = fs.readdirSync(PROJ, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.')).map((e) => e.name.slice(0, -3)).sort();
  const fontes = new Map(planas.map((s) => [s, lerFonte(s)]));
  const destinos = new Map();
  const avisos = [];
  const consumidas = new Set();

  const novoDestino = (slug, eol) => {
    if (!destinos.has(slug)) destinos.set(slug, { slug, ficheiros: new Map(), fontes: [], eol, mtime: new Date(0), aliases: [], extraFm: [], arquivo: [], areas: [] });
    return destinos.get(slug);
  };
  const add = (d, nome, linhasArr) => { if (!d.ficheiros.has(nome)) d.ficheiros.set(nome, []); d.ficheiros.get(nome).push(...linhasArr); };
  const orig = (fonte, ls) => ls.map((l) => ({ tipo: 'orig', linha: l, fonte }));
  const gen = (d, ...ls) => ls.map((l) => ({ tipo: 'gen', linha: l + d.eol }));
  const tocar = (d, fonte) => { d.fontes.push(fonte.ficheiro); if (fonte.mtime > d.mtime) d.mtime = fonte.mtime; consumidas.add(fonte.slug); };

  // 0. pasta já existe para um slug com ficha plana → estado parcial; não adivinha
  for (const s of planas) {
    if (fs.existsSync(path.join(PROJ, s))) avisos.push(`✗ ${s}: existe ${s}.md E a pasta ${s}/ — resolve à mão (nada feito a este slug)`);
  }
  const bloqueados = new Set(planas.filter((s) => fs.existsSync(path.join(PROJ, s))));

  // 1. fusões decididas
  for (const [alvo, F] of Object.entries(FUSOES)) {
    if (!fontes.has(F.principal) || bloqueados.has(F.principal)) continue;
    const P = fontes.get(F.principal);
    const erro = [];
    if (P.ls.length !== F.totalLinhas) erro.push(`tem ${P.ls.length} linhas, o plano espera ${F.totalLinhas}`);
    for (const [n, ini] of Object.entries(F.fronteiras)) if (!limpa(P.ls[n - 1] || '').startsWith(ini)) erro.push(`L${n} não começa por «${ini}»`);
    if (P.fim !== F.fm[1] - 1) erro.push(`frontmatter não acaba na L${F.fm[1]}`);
    // cobertura: cada linha do corpo vai para exactamente 1 ficheiro
    const vistos = new Array(P.ls.length + 1).fill(0);
    for (const ivs of Object.values(F.areas)) for (const [a, b] of ivs) for (let i = a; i <= b; i++) vistos[i]++;
    for (let i = F.fm[1] + 1; i <= P.ls.length; i++) if (vistos[i] !== 1) erro.push(`L${i} coberta ${vistos[i]}×`);
    if (erro.length) { avisos.push(`✗ fusão ${alvo}: ${erro.slice(0, 5).join(' · ')} — a ficha mudou; nada feito a este grupo`); bloqueados.add(F.principal); for (const k of Object.keys(F.fundidas)) bloqueados.add(k); continue; }

    const d = novoDestino(alvo, P.eol);
    d.fusao = F;
    tocar(d, P);
    d.fmOrig = orig(P.ficheiro, P.ls.slice(0, F.fm[1]));                 // ---, chaves, --- (verbatim)
    for (const [nome, ivs] of Object.entries(F.areas)) {
      const tit = F.titulos[nome];
      add(d, nome, gen(d, `# ${tit} — ${alvo}`, ''));
      for (const [a, b] of ivs) add(d, nome, orig(P.ficheiro, P.ls.slice(a - 1, b)));
    }
    for (const [s, cfg] of Object.entries(F.fundidas)) {
      if (!fontes.has(s)) { avisos.push(`· fusão ${alvo}: ${s}.md já não existe — salto`); continue; }
      const Q = fontes.get(s);
      tocar(d, Q);
      d.aliases.push(cfg.alias);
      if (cfg.corpo !== 'arquivo.md') {
        if (!d.ficheiros.has(cfg.corpo)) add(d, cfg.corpo, gen(d, `# ${F.titulos[cfg.corpo]} — ${alvo}`, ''));
        add(d, cfg.corpo, orig(Q.ficheiro, Q.corpo));
      } else {
        add(d, 'arquivo.md', gen(d, '', `## ${s}.md (corpo) — fundida em ${alvo} ${HOJE}`, ''));
        add(d, 'arquivo.md', orig(Q.ficheiro, Q.corpo));
      }
      add(d, 'arquivo.md', gen(d, '', `## ${s}.md (frontmatter original) — fundida em ${alvo} ${HOJE}`, '```yaml'));
      add(d, 'arquivo.md', orig(Q.ficheiro, Q.ls.slice(0, Q.fim + 1)));
      add(d, 'arquivo.md', gen(d, '```'));
      if (cfg.area) {
        for (const l of Q.fm) {
          const m = limpa(l).match(/^directorio(_[a-z_]*)?:(.*)$/);
          if (m) d.extraFm.push(`directorio_area_${cfg.area}${m[1] || ''}:${m[2]}`);
        }
      }
    }
  }

  // 2. absorvidas com absorvida_por → arquivo do alvo (o alvo é processado no passo 3)
  const absorvidas = new Map();     // alvo → [fonte]
  for (const s of planas) {
    if (consumidas.has(s) || bloqueados.has(s)) continue;
    const Q = fontes.get(s);
    const est = valorSimples(campoFm(Q.fm, 'estado'));
    const por = valorSimples(campoFm(Q.fm, 'absorvida_por'));
    if (est !== 'absorvida') continue;
    if (!por) { avisos.push(`· ${s}: estado absorvida SEM absorvida_por — migra como pasta própria (alvo não se adivinha)`); continue; }
    const temAlvo = fontes.has(por) || fs.existsSync(path.join(PROJ, por, 'index.md'));
    if (!temAlvo) { avisos.push(`· ${s}: absorvida_por ${por} não existe — migra como pasta própria`); continue; }
    if (!fontes.has(por) && fs.existsSync(path.join(PROJ, por, 'index.md'))) {
      avisos.push(`· ${s}: alvo ${por} já está em pasta — migra como pasta própria (juntar à mão ao ${por}/arquivo.md)`); continue;
    }
    if (!absorvidas.has(por)) absorvidas.set(por, []);
    absorvidas.get(por).push(Q);
    consumidas.add(s);
  }

  // 3. fichas normais → <slug>/index.md + geral.md (+ arquivo.md das absorvidas)
  for (const s of planas) {
    if (consumidas.has(s) || bloqueados.has(s)) continue;
    const P = fontes.get(s);
    if (P.fim < 1) { avisos.push(`✗ ${s}: sem frontmatter — nada feito`); continue; }
    const d = novoDestino(s, P.eol);
    tocar(d, P);
    d.fmOrig = orig(P.ficheiro, P.ls.slice(0, P.fim + 1));
    add(d, 'geral.md', orig(P.ficheiro, P.corpo));
    for (const Q of absorvidas.get(s) || []) {
      tocar(d, Q);
      d.aliases.push(Q.slug);
      add(d, 'arquivo.md', gen(d, ...(d.ficheiros.has('arquivo.md') ? [''] : [`# Arquivo — ${s}`, '']),
        `## ${Q.slug}.md — absorvida (absorvida_em ${valorSimples(campoFm(Q.fm, 'absorvida_em')) || '?'}), movida para aqui ${HOJE}`, '```yaml'));
      add(d, 'arquivo.md', orig(Q.ficheiro, Q.ls.slice(0, Q.fim + 1)));
      add(d, 'arquivo.md', gen(d, '```'));
      add(d, 'arquivo.md', orig(Q.ficheiro, Q.corpo));
    }
  }

  // 4. index.md de cada destino
  for (const d of destinos.values()) {
    d.aliases.unshift(...(ALIASES_SEMENTE[d.slug] || []).filter((a) => !d.aliases.includes(a)));
    construirIndex(d, fontes);
  }
  return { planas, destinos, avisos, bloqueados };
}

function construirIndex(d, fontes) {
  const fmLs = d.fmOrig;                         // [---, ...chaves, ---] verbatim
  const chaves = fmLs.slice(1, -1).map((x) => limpa(x.linha));
  const out = [fmLs[0]];
  if (!chaves.some((l) => /^name:/.test(l))) out.push(...genL(d, `name: ${d.slug}`));
  out.push(...fmLs.slice(1, -1));
  const corpoFonte = d.fusao ? fontes.get(d.fusao.principal).corpo : fontes.get(d.slug).corpo;
  const tit = titulo(corpoFonte, d.slug);
  if (!chaves.some((l) => /^description:/.test(l))) out.push(...genL(d, `description: ${yamlStr(`${tit} — por resumir`)}`));
  if (d.aliases.length) out.push(...genL(d, `aliases: [${d.aliases.join(', ')}]`));
  out.push(...d.extraFm.map((l) => ({ tipo: 'gen', linha: l + d.eol })));
  out.push(fmLs[fmLs.length - 1]);

  const est = estadoGlobal(d.fusao ? corpoFonte : fontes.get(d.slug).corpo);
  const nomes = [...d.ficheiros.keys()];
  const ordem = ['geral.md', ...nomes.filter((n) => !['geral.md', 'arquivo.md'].includes(n)).sort(), 'arquivo.md'].filter((n) => nomes.includes(n));
  const fixos = new Set(['geral.md', 'pastas.md', 'acessos.md', 'normas.md', 'config.md', 'arquivo.md']);
  const corpo = [`# ${tit}`, '## Estado global', est || 'por resumir — ler geral.md', '## Ficheiros'];
  for (const n of ordem) {
    const desc = d.fusao?.ler?.[n] || (n === 'geral.md' ? `conteúdo integral da ficha antiga (migrada ${HOJE}) · ler: detalhe, decisões, pendentes`
      : n === 'arquivo.md' ? 'fichas absorvidas/fundidas · ler: só se nada acima responder' : 'ler: quando a tarefa for desta área');
    corpo.push(`- ${n} — ${desc}`);
  }
  for (const h of [`${d.slug}-historico.md`, `${d.slug}-original.md`]) {
    if (fs.existsSync(path.join(PROJ, 'archive', h))) corpo.push(`- ../archive/${h} — histórico antigo (fica em archive/) · ler: \`grep -n\` só se nada acima responder`);
  }
  corpo.push('## Áreas');
  const areas = ordem.filter((n) => !fixos.has(n) || n === 'geral.md');
  for (const n of areas) corpo.push(`- **${n.slice(0, -3)}** — estado por resumir · ler ${n}`);
  out.push(...genL(d, ...corpo.map((l) => corta(l))));
  d.ficheiros.set('index.md', out);
  d.indexCorpo = corpo;
}
function genL(d, ...ls) { return ls.map((l) => ({ tipo: 'gen', linha: l + d.eol })); }

// ── limites do index (desenho §1.1) ───────────────────────────────────────────
function limitesIndex(d) {
  const corpo = d.indexCorpo;
  const naoVazias = corpo.filter((l) => l.trim()).length;
  const bytes = Buffer.byteLength(corpo.join('\n'), 'utf8');
  const longas = corpo.filter((l) => l.length > 200).length;
  const fmN = d.ficheiros.get('index.md').length - corpo.length - 2;
  const areas = d.indexCorpo.filter((l) => /^- \*\*/.test(l)).length;
  return { naoVazias, bytes, longas, fmN, areas, ok: naoVazias <= 40 && bytes <= 4000 && longas === 0 && areas <= 9 };
}

// ── prova ─────────────────────────────────────────────────────────────────────
function multiconj(ls) { const m = new Map(); for (const l of ls) m.set(l, (m.get(l) || 0) + 1); return m; }
function provar(d, fontesTxt) {
  // fontesTxt: Map(ficheiro → texto ANTES). Lê o que está em disco agora.
  const dir = path.join(PROJ, d.slug);
  const novas = [];
  for (const n of d.ficheiros.keys()) novas.push(...linhas(fs.readFileSync(path.join(dir, n), 'utf8')));
  const antes = []; for (const f of d.fontes) antes.push(...linhas(fontesTxt.get(f)));
  const geradas = [...d.ficheiros.values()].flat().filter((x) => x.tipo === 'gen').length;
  const mn = multiconj(novas.map(limpa));
  const falta = [];
  for (const [l, c] of multiconj(antes.map(limpa))) if ((mn.get(l) || 0) < c) falta.push(l.slice(0, 40));
  return { antes: antes.length, depois: novas.length, geradas, conteudo: novas.length - geradas, falta: falta.length,
    ok: falta.length === 0 && novas.length === antes.length + geradas };
}

// ── rollback ──────────────────────────────────────────────────────────────────
if (flag('rollback')) {
  if (!fs.existsSync(MANIFESTO)) { console.error(`sem manifesto em ${MANIFESTO} — nada a repor`); process.exit(1); }
  const man = JSON.parse(fs.readFileSync(MANIFESTO, 'utf8'));
  // 1. Editado depois da migração? (desenho §4.2.10) — hash do registo quando existe; senão mtime posterior
  //    ao apply (os ficheiros novos ficaram com o mtime da ficha de origem, logo ≤ apply). Editado → pára, não apaga.
  const aplicado = man.aplicado_em ? Date.parse(man.aplicado_em) : fs.statSync(MANIFESTO).mtimeMs;
  const editados = [];
  for (const s of man.pastas) {
    const dir = path.join(man.projdir, s);
    if (!fs.existsSync(dir)) continue;
    for (const n of fs.readdirSync(dir)) {
      const f = path.join(dir, n); const rel = `${s}/${n}`;
      if (!fs.statSync(f).isFile()) { editados.push(`${rel} (não é ficheiro da migração)`); continue; }
      const reg = man.registo?.[rel];
      if (man.registo && !reg) editados.push(`${rel} (ficheiro novo)`);
      else if (reg && reg !== hash(f)) editados.push(`${rel} (conteúdo mudou)`);
      else if (!reg && fs.statSync(f).mtimeMs > aplicado + 1000) editados.push(`${rel} (mtime depois do apply)`);
    }
  }
  if (man.index && man.indexHash && fs.existsSync(man.index) && hash(man.index) !== man.indexHash) editados.push('INDEX.md (conteúdo mudou)');
  if (editados.length) {
    console.log(`✗ rollback recusado: ${editados.length} ficheiro(s) editado(s) depois da migração — nada apagado:`);
    for (const e of editados) console.log(`  ${e}`);
    console.log('  Juntar à mão essas edições às fichas planas do backup, ou apagar a pasta depois de as guardar.');
    process.exit(1);
  }
  // 2. Mesmo sem edições: cópia do estado actual antes de repor
  const copia = path.join(man.backup, '..', `antes-do-rollback-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(copia, { recursive: true });
  for (const s of man.pastas) if (fs.existsSync(path.join(man.projdir, s))) fs.cpSync(path.join(man.projdir, s), path.join(copia, s), { recursive: true, preserveTimestamps: true });
  if (man.index && fs.existsSync(man.index)) fs.copyFileSync(man.index, path.join(copia, 'INDEX.md'));
  console.log(`cópia do estado actual: ${copia}`);
  for (const s of man.pastas) fs.rmSync(path.join(man.projdir, s), { recursive: true, force: true });
  for (const f of man.removidas) fs.copyFileSync(path.join(man.backup, f), path.join(man.projdir, f));
  if (man.index) fs.copyFileSync(path.join(man.backup, '..', 'INDEX.md.antes'), man.index);
  console.log(`✓ rollback: ${man.pastas.length} pasta(s) removida(s), ${man.removidas.length} ficha(s) reposta(s)`);
  process.exit(0);
}

// ── correr ────────────────────────────────────────────────────────────────────
const { planas, destinos, avisos } = planear();
const fontesTxt = new Map();
for (const d of destinos.values()) for (const f of d.fontes) fontesTxt.set(f, fs.readFileSync(f, 'utf8'));

console.log(`\nmigrar-memoria-pastas — ${APPLY ? 'APPLY' : 'dry-run'} · ${PROJ}`);
console.log(`fichas planas: ${planas.length} · destinos (pastas): ${destinos.size}\n`);
if (!destinos.size) { console.log('✓ nada a migrar (já tudo em pastas).'); for (const a of avisos) console.log(a); process.exit(0); }
console.log('slug | fontes (linhas) | ficheiros novos | linhas geradas | index (linhas não vazias / bytes / áreas)');
let excedeIndex = 0;
for (const d of [...destinos.values()].sort((a, b) => a.slug.localeCompare(b.slug))) {
  const fl = d.fontes.map((f) => `${path.basename(f)}(${linhas(fontesTxt.get(f)).length})`).join(' + ');
  const gerad = [...d.ficheiros.values()].flat().filter((x) => x.tipo === 'gen').length;
  const L = limitesIndex(d); if (!L.ok) excedeIndex++;
  console.log(`${d.slug} | ${fl} | ${[...d.ficheiros.keys()].join(', ')} | ${gerad} | ${L.naoVazias}/${L.bytes}B/${L.areas}${L.ok ? '' : ' ✗ LIMITE'}`);
}
if (avisos.length) { console.log('\nAvisos:'); for (const a of avisos) console.log('  ' + a); }
if (excedeIndex) { console.log(`\n✗ ${excedeIndex} index fora dos limites — nada escrito.`); process.exit(1); }
for (const d of destinos.values()) for (const n of d.ficheiros.keys()) {
  if (fs.existsSync(path.join(PROJ, d.slug, n))) { console.log(`✗ ${d.slug}/${n} já existe — não escrevo por cima.`); process.exit(1); }
}
if (!APPLY) { console.log('\n(dry-run — nada escrito. --apply para migrar.)'); process.exit(0); }

// co-actividade: ficha escrita há <45 min = outra sessão pode estar a meio
const recentes = [...fontesTxt.keys()].filter((f) => Date.now() - fs.statSync(f).mtimeMs < 45 * 60 * 1000);
if (recentes.length && !flag('forca')) {
  console.log(`\n✗ ${recentes.length} ficha(s) escrita(s) há <45 min (${recentes.map((f) => path.basename(f)).join(', ')}) — outra sessão activa? --forca para avançar.`);
  process.exit(1);
}

// backup integral (nunca por cima)
if (fs.existsSync(BACKUP)) { console.log(`✗ o backup ${BACKUP} já existe — não escrevo por cima. Usa --backup <dir>.`); process.exit(1); }
fs.cpSync(PROJ, BACKUP, { recursive: true, preserveTimestamps: true });
if (INDEX_MD && fs.existsSync(INDEX_MD)) fs.copyFileSync(INDEX_MD, path.join(BACKUP, '..', 'INDEX.md.antes'));
const nBackup = fs.readdirSync(BACKUP).length;
console.log(`\nbackup: ${BACKUP} (${nBackup} entradas)`);

// escrever
const criadas = [];
for (const d of destinos.values()) {
  const dir = path.join(PROJ, d.slug);
  fs.mkdirSync(dir, { recursive: true });
  criadas.push(d.slug);
  for (const [n, ls] of d.ficheiros) {
    const f = path.join(dir, n);
    fs.writeFileSync(f, ls.map((x) => x.linha + '\n').join(''), { encoding: 'utf8', flag: 'wx' });
    fs.utimesSync(f, d.mtime, d.mtime);           // mantém o mtime: não é co-actividade
  }
}

// provar ANTES de apagar
let falhas = 0; const tabela = [];
for (const d of destinos.values()) {
  const p = provar(d, fontesTxt);
  tabela.push({ slug: d.slug, fontes: d.fontes.map((f) => path.basename(f)), ...p });
  if (!p.ok) { falhas++; console.log(`✗ prova falhou: ${d.slug} (antes ${p.antes}, depois ${p.depois}, geradas ${p.geradas}, linhas em falta ${p.falta})`); }
}
const somaAntes = tabela.reduce((a, t) => a + t.antes, 0), somaConteudo = tabela.reduce((a, t) => a + t.conteudo, 0);
console.log(`prova: ${tabela.length - falhas}/${tabela.length} destinos ok · linhas antes ${somaAntes} · conteúdo depois ${somaConteudo}`);
if (falhas || somaAntes !== somaConteudo) {
  console.log('✗ prova falhou — as pastas novas ficam para inspecção, as fichas planas NÃO foram apagadas. --rollback repõe.');
  fs.writeFileSync(MANIFESTO, JSON.stringify({ projdir: PROJ, backup: BACKUP, pastas: criadas, removidas: [], index: null, tabela }, null, 2));
  process.exit(1);
}

// remover as planas (só depois da prova)
const removidas = [];
for (const d of destinos.values()) for (const f of d.fontes) { fs.unlinkSync(f); removidas.push(path.basename(f)); }

// INDEX.md: links ](projects/<x>.md) → nova casa (substituição exacta; nº de linhas igual)
let indexTrocas = 0;
if (INDEX_MD && fs.existsSync(INDEX_MD)) {
  const destinoDe = new Map();
  for (const d of destinos.values()) {
    for (const f of d.fontes) {
      const s = path.basename(f, '.md');
      const fz = d.fusao?.fundidas?.[s];
      destinoDe.set(s, fz && fz.corpo !== 'arquivo.md' ? `${d.slug}/${fz.corpo}` : `${d.slug}/index.md`);
    }
  }
  const t = fs.readFileSync(INDEX_MD, 'utf8');
  const n = t.replace(/\]\(projects\/([a-z0-9._-]+)\.md\)/g, (m, s) => (destinoDe.has(s) ? (indexTrocas++, `](projects/${destinoDe.get(s)})`) : m));
  if (linhas(n).length !== linhas(t).length) { console.log('✗ INDEX.md mudaria de nº de linhas — não escrito'); }
  else if (indexTrocas) fs.writeFileSync(INDEX_MD, n, 'utf8');
}

// registo por ficheiro (hash) — o --rollback recusa repor por cima de edições posteriores
const registo = {};
for (const s of criadas) for (const n of fs.readdirSync(path.join(PROJ, s))) registo[`${s}/${n}`] = hash(path.join(PROJ, s, n));
fs.writeFileSync(MANIFESTO, JSON.stringify({ projdir: PROJ, backup: BACKUP, aplicado_em: new Date().toISOString(), pastas: criadas, removidas,
  index: indexTrocas ? INDEX_MD : null, indexHash: indexTrocas ? hash(INDEX_MD) : null, registo, tabela }, null, 2));
console.log(`✓ ${criadas.length} pasta(s) criada(s) · ${removidas.length} ficha(s) plana(s) removida(s) · INDEX.md: ${indexTrocas} link(s)`);
console.log(`manifesto: ${MANIFESTO}`);
