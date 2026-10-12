#!/usr/bin/env node
/**
 * resume-base — o "ponto base de situação" do /resume numa só chamada, saída compacta.
 *
 * Uso: node .claude/scripts/resume-base.mjs [<path-alvo>] [--sem-fetch]
 *   path-alvo omitido → CWD. Só LÊ (o único efeito é `git fetch`, que se desliga com --sem-fetch).
 *
 * Secções: RESOLUÇÃO · PASTA/GIT · VIVO · CONTRATOS · RETOMA · MEMÓRIA · CHECKPOINT · DECISÕES.
 * Secção sem nada a dizer não aparece. Cada linha ⚠ é um sinal que o /resume trata
 * (ver .claude/commands/resume.md → tabela «Sinal → ler»).
 */
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const BRAIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const mem = require('./lib/memoria-projecto.cjs');

const args = process.argv.slice(2);
const semFetch = args.includes('--sem-fetch');
const alvo = resolve(args.find((a) => !a.startsWith('--')) || process.cwd());
const out = [];
const sec = (t) => out.push(`== ${t}`);
const ln = (s) => out.push(s);

const run = (cmd, a, cwd, ms = 20000) => {
  try { return execFileSync(cmd, a, { cwd, encoding: 'utf8', timeout: ms, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (_) { return null; }
};
const git = (a, cwd = alvo) => run('git', a, cwd);
const NUVEM = /CloudStorage|Google ?Drive|GoogleDrive-|(^|[\\/])MEGA([\\/]|$)|Dropbox|OneDrive|^G:[\\/]/i;

// ---------- RESOLUÇÃO ----------
sec('RESOLUÇÃO');
let r = null;
try { r = mem.resolverProjecto(alvo); } catch (e) { ln(`⚠ resolver falhou: ${e.message}`); }
if (r) {
  const fich = r.ficheiro ? r.ficheiro.replace(BRAIN + '/', '').replace(BRAIN + '\\', '') : '-';
  ln(`via=${r.via} slug=${r.slug || '-'} area=${r.area || '-'} index=${fich}`);
  if (r.ambiguo) ln(`⚠ AMBÍGUO → perguntar: ${r.candidatos.map((c) => c.slug).join(' | ')}`);
  if (!r.slug && r.quaseIguais?.length) ln(`⚠ QUASE-IGUAIS (listar, nunca carregar): ${r.quaseIguais.map((q) => q.slug || q).join(' | ')}`);
  if (!r.slug && !r.ambiguo && !r.quaseIguais?.length) ln('⚠ SEM MEMÓRIA → projecto novo (sugerir /start)');
  if (r.via === 'caminho-mae' && r.candidatos?.some((c) => c.prof <= homedir().length + 10)) ln('⚠ casou só pela pasta-mãe e a pasta é genérica — confirmar que é este o projecto');
  if (r.irmas?.length) ln(`irmãs (pasta-mãe): ${r.irmas.map((i) => i.slug || i).join(', ')}`);
}
try { const p = mem.fichasPlanas(); if (p.length) ln(`⚠ FICHA PLANA ANTIGA: ${p.join(', ')} — juntar à pasta com node .claude/scripts/migrar-memoria-pastas.mjs; não carregar`); } catch (_) {}
const slug = r?.slug || null;
if (r?.ficheiro) {
  try { const fm = readFileSync(r.ficheiro, 'utf8').slice(0, 4000); const q = fm.match(/^directorio[a-z_]*_estado: *quebrado/m); if (q) ln('⚠ directorio quebrado (pasta declarada não existe) — resolver por nome; corrigir no /save'); } catch (_) {}
}

// ---------- PASTA / GIT ----------
sec('PASTA/GIT');
if (!existsSync(alvo)) {
  ln(`⚠ PROJECTO NÃO EXISTE NESTA MÁQUINA: ${alvo} — reference/resume/nuvem.md §Raízes de nuvem`);
} else {
  const n = (() => { try { return readdirSync(alvo).filter((f) => f !== '.DS_Store').length; } catch (_) { return -1; } })();
  if (n >= 0 && n <= 1) ln(`⚠ PASTA VAZIA/STUB (${n} itens) → reference/resume/pasta-vazia.md`);
  if (NUVEM.test(alvo)) ln('⚠ REPO EM DRIVE DE NUVEM — git saltado → reference/resume/nuvem.md §Repo em drive de nuvem');
  else if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') ln('⚠ SEM GIT nesta pasta → reference/resume/sem-git.md');
  else {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    const up = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    let fetchOk = true;
    if (!semFetch && git(['remote'])) fetchOk = git(['fetch', '--quiet', 'origin']) !== null;
    ln(`branch=${branch}${up ? ` upstream=${up}` : ' (sem upstream)'}${fetchOk ? '' : ' ⚠ fetch falhou (offline/auth) — atrás/à frente pode estar velho'}`);
    if (up) {
      const [ahead, behind] = (git(['rev-list', '--left-right', '--count', 'HEAD...@{u}']) || '0\t0').split(/\s+/);
      ln(`à frente=${ahead} atrás=${behind}${+behind > 0 ? ' ⚠ CLONE ATRÁS — sincronizar antes de editar' : ''}`);
    }
    for (const b of new Set(['main', 'master'])) {
      if (git(['rev-parse', '-q', '--verify', `origin/${b}`]) && b !== branch) {
        const c = git(['rev-list', '--count', `HEAD..origin/${b}`]);
        if (+c > 0) ln(`⚠ origin/${b}: ${c} commit(s) que não tenho (branch por omissão pode não ser onde se trabalha)`);
      }
    }
    const ultimos = git(['log', '--format=%h %ad %s', '--date=short', '-3']);
    if (ultimos) ln(`últimos commits:\n${ultimos.split('\n').map((l) => '  ' + l.slice(0, 110)).join('\n')}`);
    const topo = git(['rev-parse', '--show-toplevel']) || alvo;
    const sujos = (git(['status', '--porcelain']) || '').split('\n').filter(Boolean);
    ln(`ficheiros sujos=${sujos.length}`);
    const backups = (git(['for-each-ref', '--format=%(refname:short)', 'refs/heads/backup', 'refs/heads/stash', 'refs/remotes/origin/backup', 'refs/remotes/origin/stash']) || '').split('\n').filter(Boolean);
    if (backups.length) ln(`⚠ Existe branch de backup/stash (${backups.slice(0, 3).join(', ')}${backups.length > 3 ? ` +${backups.length - 3}` : ''}) — verificar antes de reconstruir trabalho (git log --all)`);
    const defRef = ['origin/main', 'origin/master'].find((x) => git(['rev-parse', '-q', '--verify', x]));
    const semUp = (git(['for-each-ref', '--format=%(refname:short) %(upstream:short)', 'refs/heads']) || '').split('\n').filter(Boolean)
      .map((l) => l.split(' ')).filter(([b, u]) => b && !u && b !== branch && !/^(backup|stash)\//.test(b))
      .map(([b]) => `${b}(${defRef ? git(['rev-list', '--count', `${defRef}..${b}`]) : '?'})`);
    if (semUp.length) ln(`branches sem upstream (commits próprios): ${semUp.slice(0, 6).join(', ')}${semUp.length > 6 ? ` +${semUp.length - 6}` : ''} — 0 = vazia (propor apagar, com gate); >0 = trabalho só neste disco`);
    const pr = branch && branch !== 'HEAD' ? run('gh', ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,title', '-q', '.[]|"#\\(.number) \\(.title)"'], alvo, 15000) : null;
    if (pr) ln(`PR aberto: ${pr.split('\n').join(' · ').slice(0, 140)}`);
    // VIVO: ficheiros sujos escritos há <30 min = território de outra sessão
    const vivos = sujos.map((l) => l.slice(3).replace(/^"|"$/g, '').replace(/.* -> /, ''))
      .map((f) => { try { return [f, (Date.now() - statSync(join(topo, f)).mtimeMs) / 6e4]; } catch (_) { return null; } })
      .filter((x) => x && x[1] < 30);
    if (vivos.length) {
      ln(`⚠ WORKING TREE VIVA: ${vivos.length} ficheiro(s) escritos há <30 min (ex.: ${vivos.slice(0, 3).map(([f, m]) => `${f} ${Math.round(m)}min`).join(', ')}) — não tocar; processos → .claude/reference/sessoes-paralelas.md`);
    }
  }
}

// ---------- CONTRATOS por fechar ----------
{
  const dir = join(alvo, '.joca', 'loop');
  const fs_ = [];
  try { for (const f of readdirSync(dir)) if (f.endsWith('.json')) fs_.push(join(dir, f)); } catch (_) {}
  if (existsSync(join(alvo, '.joca', 'loop.json'))) fs_.push(join(alvo, '.joca', 'loop.json'));
  const linhas = [];
  for (const f of fs_) {
    try {
      const l = JSON.parse(readFileSync(f, 'utf8'));
      const p = (l.passos || []).filter((s) => s.estado !== 'verificado');
      if (!p.length) continue;
      const ts = [Date.parse(l.criado || ''), Date.parse(l.actualizado || ''), statSync(f).mtimeMs].filter(Number.isFinite); // última escrita, como o stop-continuar.js
      const idade = ts.length ? (Date.now() - Math.max(...ts)) / 36e5 : null;
      const aberto = p.filter((s) => s.estado !== 'feito');
      linhas.push({ t: ts.length ? Math.max(...ts) : 0, txt: `${basename(f).slice(0, 8)} · ${p.length} por fechar (${aberto.length} pendente/em curso, ${p.length - aberto.length} feito por verificar)${idade != null && idade > 6 ? ' · EXPIRADO >6h sem escrita' : ''}` +
        (aberto[0] ? `\n    [${aberto[0].estado}] ${String(aberto[0].descricao || aberto[0].desc || aberto[0].id).slice(0, 90)}` : '') });
    } catch (_) {}
  }
  if (linhas.length) { sec(`CONTRATOS por fechar: ${linhas.length} (de outra sessão: não tocar nem apagar; detalhe: ficheiros em .joca/loop/)`); linhas.sort((x, y) => y.t - x.t); linhas.slice(0, 4).forEach((x) => ln(x.txt)); if (linhas.length > 4) ln(`  … +${linhas.length - 4}`); }
}

// ---------- RETOMA (só existência + gotchas; o conteúdo lê-se a seguir) ----------
{
  const achados = [];
  for (const f of ['docs/RETOMAR.md', 'docs/HANDOFF.md', 'RETOMAR.md', 'HANDOFF.md', 'PROGRESSO.md', 'CLAUDE.md', 'AGENTS.md']) {
    if (!existsSync(join(alvo, f))) continue;
    let extra = '';
    try {
      const t = readFileSync(join(alvo, f), 'utf8');
      if (f === 'PROGRESSO.md') {
        const h = t.split('\n').filter((l) => /^## /.test(l));
        const dup = [...new Set(h.filter((x, i) => h.indexOf(x) !== i))];
        if (dup.length) extra = ` ⚠ INCOERENTE: secções duplicadas ${dup.join(' ; ')}`;
      } else if (f.endsWith('CLAUDE.md') || f.endsWith('AGENTS.md')) {
        const g = t.split('\n').filter((l) => /^#{1,4} .*(gotcha|armadilha|aviso|⚠|cuidado|nunca)/i.test(l)).slice(0, 4);
        if (g.length) extra = ` · secções de gotchas: ${g.map((x) => x.replace(/^#+ /, '')).join(' | ').slice(0, 120)}`;
      }
    } catch (_) {}
    achados.push(`${f}${extra}`);
  }
  if (achados.length) { sec('NA PASTA DO PROJECTO (ler por esta ordem: RETOMAR/HANDOFF → PROGRESSO → gotchas)'); achados.forEach((a) => ln('  ' + a)); }
}

// ---------- MEMÓRIA: caminhos mortos + ⏳ velhos ----------
if (slug) {
  const pasta = join(BRAIN, 'memory', 'projects', slug);
  const mortos = new Set(); const velhos = [];
  try {
    for (const f of readdirSync(pasta)) {
      if (!f.endsWith('.md') || f === 'arquivo.md') continue;
      const t = readFileSync(join(pasta, f), 'utf8');
      for (const m of t.matchAll(/`((?:\/Users\/|~\/)[^`]+)`/g)) {
        const cam = m[1].replace(/:\d+$/, ''); // `ficheiro:linha` → ficheiro
        if (/[<>*{}$]|AppData|^~\/\.claude\/(projects|dev-mods)/.test(cam)) continue; // placeholders e paths de outra máquina
        const p = cam.startsWith('~/') ? join(homedir(), cam.slice(2)) : cam;
        if (!existsSync(p)) mortos.add(cam);
      }
      for (const l of t.split('\n')) {
        const d = (l.match(/⏳\(verificado (\d{4}-\d{2}-\d{2})\)/) || [])[1];
        if (!d) continue;
        const dias = Math.floor((Date.now() - Date.parse(d)) / 864e5);
        if (dias > 30) velhos.push(`há ${dias} dias · ${f}: ${l.trim().slice(0, 90)}`);
      }
    }
  } catch (_) {}
  if (mortos.size || velhos.length) {
    sec('MEMÓRIA');
    [...mortos].slice(0, 8).forEach((p) => ln(`⚠ NAO EXISTE: ${p}`));
    if (mortos.size > 8) ln(`  … +${mortos.size - 8} caminhos mortos`);
    velhos.slice(0, 5).forEach((v) => ln(`⏳ VELHO ${v}`));
    if (velhos.length > 5) ln(`  … +${velhos.length - 5} ⏳ velhos`);
  }
}

// ---------- CHECKPOINT + DECISÕES (limitados — o `active` completo chega a >100 KB) ----------
if (slug) {
  const cpJs = join(BRAIN, '.claude/scripts/joca-checkpoint.mjs');
  const lista = (run('node', [cpJs, 'list', '--slug', slug], BRAIN) || '').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
  const deliberado = lista.find((n) => !/-auto(-wip)?\.md$/.test(n));
  let cp = null; let origem = '';
  if (deliberado) {
    try { cp = readFileSync(join(BRAIN, 'memory', 'checkpoints', slug, deliberado), 'utf8'); origem = deliberado; } catch (_) {}
  }
  if (!cp) { cp = run('node', [cpJs, 'latest', '--slug', slug], BRAIN); origem = lista.length ? '(só automáticos — sem próxima acção)' : '(sem checkpoints)'; }
  if (cp) {
    // header (status) + secções que dizem onde parámos; o resto (ficheiros tocados) fica de fora
    const status = (cp.match(/^status: *(.+)$/m) || [])[1];
    const pega = (re, max) => { const m = cp.match(new RegExp(`^## (?:${re})[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm')); return m ? m[1].split('\n').filter((l) => l.trim()).slice(0, max).map((l) => l.slice(0, 170)) : []; };
    const prox = pega('Pr[óo]xima a[cç]+[aã]o', 6);
    const rest = pega('Trabalho restante', 6);
    const dec = pega('Decisões desta sessão', 4);
    sec(`CHECKPOINT ${origem}${status ? ` · status=${status}` : ''}`);
    if (!prox.length && !rest.length) ln('  (sem «Próxima acção»)');
    for (const [t, ls] of [['Próxima acção', prox], ['Trabalho restante', rest], ['Decisões da sessão', dec]]) if (ls.length) { ln(`  ${t}:`); ls.forEach((l) => ln('  ' + l)); }
  }
  const dec = run('node', [join(BRAIN, '.claude/scripts/joca-brain.mjs'), 'active', '--slug', slug], BRAIN);
  if (dec) {
    const itens = dec.split('\n').filter((l) => l.startsWith('- '));
    if (itens.length) {
      sec(`DECISÕES ACTIVAS (${itens.length}; as 6 mais recentes — resto: joca-brain search "<termo>" --slug ${slug})`);
      itens.slice(-6).forEach((l) => ln('  ' + l.slice(0, 200)));
    }
  }
}

console.log(out.join('\n'));
