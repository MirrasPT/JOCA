// Memória de projectos por pastas (2026-10-01): lib memoria-projecto + migrar-memoria-pastas + os
// consumidores, sempre numa árvore descartável com pastas `<slug>/index.md` e uma ficha plana antiga
// `<slug>.md` que já NÃO se lê (fase D, issue #82): só se detecta. Nunca lê a memória real. Uso: node --test .claude/scripts/test/memoria-pastas.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = join(SCRIPTS, '..', 'hooks');
const WIN = process.platform === 'win32';
const P = (w, m) => (WIN ? w : m);      // caminho desta máquina

// Brain descartável: scripts + lib + hooks copiados; memória em pastas + 1 ficha plana antiga (velha.md).
function brainTemp() {
  const raiz = mkdtempSync(join(tmpdir(), 'joca-memoria-pastas-'));
  const brain = join(raiz, 'JOCA_Brain');
  mkdirSync(join(brain, '.claude', 'scripts', 'lib'), { recursive: true });
  mkdirSync(join(brain, '.claude', 'hooks'), { recursive: true });
  for (const f of ['joca-checkpoint.mjs', 'joca-slug.cjs', 'migrar-memoria-pastas.mjs'])
    copyFileSync(join(SCRIPTS, f), join(brain, '.claude', 'scripts', f));
  copyFileSync(join(SCRIPTS, 'lib', 'memoria-projecto.cjs'), join(brain, '.claude', 'scripts', 'lib', 'memoria-projecto.cjs'));
  copyFileSync(join(HOOKS, 'session-intake.js'), join(brain, '.claude', 'hooks', 'session-intake.js'));
  const proj = join(brain, 'memory', 'projects');
  for (const d of ['alfa', 'beta', 'acmetrix']) mkdirSync(join(proj, d), { recursive: true });
  writeFileSync(join(proj, 'alfa', 'index.md'), `---\nname: alfa\ndirectorio_win: "C:\\\\P\\\\Alfa"\ndirectorio_mac: "/P/Alfa"\numbrella: beta\n---\n# Alfa\n`);
  writeFileSync(join(proj, 'velha.md'), `---\nname: velha\ndirectorio_win: "C:\\\\P\\\\Velha"\ndirectorio_mac: "/P/Velha"\numbrella: beta\n---\n# Velha\n`);
  writeFileSync(join(proj, 'beta', 'index.md'), [
    '---', 'name: beta', 'description: "Beta"', 'aliases: [beta_antiga, gama-velha#redes-sociais]',
    'directorio_win: "C:\\\\P\\\\Beta"', 'directorio_mac: "/P/Beta"',
    'directorio_area_redes_sociais_win: "C:\\\\P\\\\Beta\\\\Redes"', 'directorio_area_redes_sociais_mac: "/P/Beta/Redes"',
    '---', '# Beta', ''].join('\n'));
  writeFileSync(join(proj, 'beta', 'geral.md'), '# Geral — beta\nstack: laravel\n');
  writeFileSync(join(proj, 'acmetrix', 'index.md'), '---\nname: acmetrix\numbrella: beta\n---\n# O\n');
  return { raiz, brain, proj };
}
const libDe = (brain) => createRequire(import.meta.url)(join(brain, '.claude', 'scripts', 'lib', 'memoria-projecto.cjs'));

test('lib: lista só pastas, detecta a ficha plana sem a ler, resolve só por igualdade', () => {
  const { raiz, brain, proj } = brainTemp();
  try {
    const m = libDe(brain);
    const l = m.listarProjectos(proj);
    assert.deepEqual(l.map((p) => p.slug), ['acmetrix', 'alfa', 'beta']);
    assert.equal(m.caminhoRelativo('beta'), 'memory/projects/beta/index.md');
    // ficha plana antiga: detectada (para o migrar e o doctor), nunca lida nem resolvida
    assert.deepEqual(m.fichasPlanas(proj).map((p) => [p.slug, p.temPasta]), [['velha', false]]);
    assert.equal(m.ficheiroProjecto('velha', proj), null);
    assert.deepEqual(m.ficheirosDoProjecto('velha', {}, proj), []);
    assert.equal(m.resolverProjecto(P('C:\\P\\Velha', '/P/Velha'), proj).slug, null);
    assert.equal(m.resolverProjecto('velha', proj).slug, null);
    // caminho exacto, subpasta, área por directorio_area_*
    assert.equal(m.resolverProjecto(P('C:\\P\\Beta', '/P/Beta'), proj).slug, 'beta');
    assert.equal(m.resolverProjecto(P('C:\\P\\Alfa', '/P/Alfa'), proj).slug, 'alfa');
    const sub = m.resolverProjecto(P('C:\\P\\Alfa\\src', '/P/Alfa/src'), proj);
    assert.deepEqual([sub.via, sub.slug], ['caminho-mae', 'alfa']);
    const area = m.resolverProjecto(P('C:\\P\\Beta\\Redes', '/P/Beta/Redes'), proj);
    assert.deepEqual([area.via, area.slug, area.area], ['caminho', 'beta', 'redes-sociais']);
    // slug, alias, alias de área
    assert.equal(m.resolverProjecto('Beta', proj).via, 'slug');
    const al = m.resolverProjecto('/x/Beta_Antiga', proj);
    assert.deepEqual([al.via, al.slug, al.area], ['alias', 'beta', null]);
    const ala = m.resolverProjecto('gama-velha', proj);
    assert.deepEqual([ala.slug, ala.area], ['beta', 'redes-sociais']);
    // quase-igual: lista, nunca escolhe
    const q = m.resolverProjecto('iacmetrix', proj);
    assert.equal(q.slug, null);
    assert.deepEqual(q.quaseIguais, ['acmetrix']);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('migrar: dry-run não escreve; apply prova e migra; 2.ª corrida não muda nada; rollback repõe', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'joca-migrar-'));
  const proj = join(raiz, 'projects');
  mkdirSync(join(proj, 'archive'), { recursive: true });
  writeFileSync(join(proj, '.gitkeep'), '');
  writeFileSync(join(proj, 'archive', 'um-historico.md'), '# hist\n');
  writeFileSync(join(proj, 'um.md'), '---\r\nname: um\r\ndirectorio_win: "C:\\\\U"\r\n---\r\n\r\n# Um\r\n## Estado actual\r\nfase 2\r\n');
  writeFileSync(join(proj, 'dois.md'), '---\ntype: project\n---\n# Dois\ntexto\n\ntexto\n');       // sem name/description
  writeFileSync(join(proj, 'velho.md'), '---\nname: velho\nestado: absorvida\nabsorvida_por: um\n---\n# Velho\n→ um\n');
  const index = join(raiz, 'INDEX.md');
  writeFileSync(index, '- [um](projects/um.md) — x\n- [velho](projects/velho.md) — y\n');
  const run = (...a) => spawnSync(process.execPath, [join(SCRIPTS, 'migrar-memoria-pastas.mjs'), '--projdir', proj,
    '--index', index, '--backup', join(raiz, 'bk', 'backup'), ...a], { encoding: 'utf8' });
  try {
    const dry = run();
    assert.equal(dry.status, 0, dry.stdout + dry.stderr);
    assert.match(dry.stdout, /dry-run/);
    assert.ok(existsSync(join(proj, 'um.md')) && !existsSync(join(proj, 'um')));

    const ap = run('--apply', '--forca');
    assert.equal(ap.status, 0, ap.stdout + ap.stderr);
    assert.match(ap.stdout, /prova: 2\/2 destinos ok · linhas antes (\d+) · conteúdo depois \1/);
    assert.deepEqual(readdirSync(proj).sort(), ['.gitkeep', 'archive', 'dois', 'um']);
    const idx = readFileSync(join(proj, 'um', 'index.md'), 'utf8');
    assert.match(idx, /^---\r\nname: um\r\n/);                     // CRLF preservado
    assert.match(idx, /aliases: \[velho\]/);                        // absorvida → alias
    assert.match(idx, /\.\.\/archive\/um-historico\.md/);           // archive/ fica e é apontado
    assert.match(idx, /## Estado global\r\nfase 2\r\n/);             // 1.ª linha verbatim, não inventada
    assert.equal(readFileSync(join(proj, 'um', 'geral.md'), 'utf8'), '\r\n# Um\r\n## Estado actual\r\nfase 2\r\n');
    assert.match(readFileSync(join(proj, 'um', 'arquivo.md'), 'utf8'), /# Velho\n→ um/);
    assert.match(readFileSync(join(proj, 'dois', 'index.md'), 'utf8'), /^---\nname: dois\ntype: project\ndescription: "Dois — por resumir"\n---/);
    assert.equal(readFileSync(index, 'utf8'), '- [um](projects/um/index.md) — x\n- [velho](projects/um/index.md) — y\n');
    assert.ok(existsSync(join(proj, 'archive', 'um-historico.md')));

    const de2 = run('--apply');
    assert.match(de2.stdout, /nada a migrar/);

    const rb = spawnSync(process.execPath, [join(SCRIPTS, 'migrar-memoria-pastas.mjs'), '--rollback', '--backup', join(raiz, 'bk', 'backup')], { encoding: 'utf8' });
    assert.equal(rb.status, 0, rb.stdout + rb.stderr);
    assert.deepEqual(readdirSync(proj).sort(), ['.gitkeep', 'archive', 'dois.md', 'um.md', 'velho.md']);
    assert.match(readFileSync(index, 'utf8'), /projects\/um\.md/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('joca-checkpoint: sub-entradas por umbrella lidas dos index (a ficha plana não conta)', () => {
  const { raiz, brain } = brainTemp();
  try {
    const r = spawnSync(process.execPath, [join(brain, '.claude', 'scripts', 'joca-checkpoint.mjs'), 'latest', '--slug', 'beta'], { encoding: 'utf8', cwd: raiz });
    assert.match(r.stdout, /sem checkpoints para beta nem para (alfa, acmetrix|acmetrix, alfa)/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('joca-slug: alias de pasta vem do index; alias de área não muda o slug', () => {
  const { raiz, brain } = brainTemp();
  try {
    const s = createRequire(import.meta.url)(join(brain, '.claude', 'scripts', 'joca-slug.cjs'));
    assert.equal(s.normalizeSlug('Beta_Antiga'), 'beta');
    assert.equal(s.normalizeSlug('gama-velha'), 'gama-velha');
    assert.equal(s.normalizeSlug('JOCA_Brain'), 'joca');
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('session-intake: co-actividade vê ficheiros dentro das pastas (não a ficha plana)', () => {
  const { raiz, brain } = brainTemp();
  try {
    const r = spawnSync(process.execPath, [join(brain, '.claude', 'hooks', 'session-intake.js')], { input: '{}', encoding: 'utf8', cwd: raiz });
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    assert.match(ctx, /Co-actividade/);
    assert.match(ctx, /alfa\/index\.md/);
    assert.match(ctx, /beta\/(index|geral)\.md/);
    assert.doesNotMatch(ctx, /velha\.md/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

// Volta 2 (verificador): match mais longo no [projecto] — um slug contido num mais comprido na mesma
// posição não dispara. Pastas de teste + 1 ficha plana antiga (não dispara).
test('prompt-triage: o match mais longo ganha; o curto sozinho continua a casar', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'joca-triage-longo-'));
  const brain = join(raiz, 'JOCA_Brain');
  try {
    mkdirSync(join(brain, '.claude', 'scripts', 'lib'), { recursive: true });
    mkdirSync(join(brain, '.claude', 'hooks'), { recursive: true });
    copyFileSync(join(SCRIPTS, 'lib', 'memoria-projecto.cjs'), join(brain, '.claude', 'scripts', 'lib', 'memoria-projecto.cjs'));
    copyFileSync(join(HOOKS, 'prompt-triage.js'), join(brain, '.claude', 'hooks', 'prompt-triage.js'));
    const proj = join(brain, 'memory', 'projects');
    const pastas = ['acme', 'acme-pink', 'joca', 'joca-open-source', 'joca-docs', 'loja-plus',
      'ana-silva', 'ana-silva-redes-sociais', 'colmeia', 'rpg'];
    for (const s of pastas) { mkdirSync(join(proj, s), { recursive: true }); writeFileSync(join(proj, s, 'index.md'), `---\nname: ${s}\n---\n# ${s}\n`); }
    for (const s of ['loja-plus-csp', 'colmeia-stocks', 'vendas']) { mkdirSync(join(proj, s), { recursive: true }); writeFileSync(join(proj, s, 'index.md'), `---\nname: ${s}\n---\n`); }
    writeFileSync(join(proj, 'kalimba.md'), '---\nname: kalimba\n---\n');  // ficha plana antiga: já não se lê
    const triar = (prompt) => {
      const r = spawnSync(process.execPath, [join(brain, '.claude', 'hooks', 'prompt-triage.js')], { input: JSON.stringify({ prompt }), encoding: 'utf8' });
      const c = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
      return { certos: [...c.matchAll(/\[projecto\] ([a-z0-9-]+) →/g)].map((m) => m[1]), c };
    };
    const pares = [['continua o acme-pink', 'acme-pink'], ['continua o joca open source', 'joca-open-source'],
      ['abre o loja-plus-csp', 'loja-plus-csp'], ['o joca docs', 'joca-docs'],
      ['ana silva redes sociais de outubro', 'ana-silva-redes-sociais'], ['colmeia stocks bug', 'colmeia-stocks']];
    for (const [p, longo] of pares) {
      const t = triar(p);
      assert.deepEqual(t.certos, [longo], p);
      assert.doesNotMatch(t.c, /\[projecto\?\]/, p);
    }
    assert.deepEqual(triar('o acme').certos, ['acme']);
    assert.deepEqual(triar('o joca e o joca docs').certos.sort(), ['joca', 'joca-docs']);   // 2 posições → os dois
    assert.deepEqual(triar('continua o rpg').certos, ['rpg']);
    assert.doesNotMatch(triar('vendas do mês').c, /\[projecto\??\]/);
    assert.doesNotMatch(triar('continua o kalimba').c, /\[projecto\??\] kalimba/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('migrar --rollback: recusa e lista se uma pasta foi editada depois; sem edições copia o estado actual antes de repor', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'joca-rollback-'));
  const proj = join(raiz, 'projects');
  mkdirSync(proj, { recursive: true });
  writeFileSync(join(proj, 'um.md'), '---\nname: um\n---\n# Um\n');
  writeFileSync(join(proj, 'dois.md'), '---\nname: dois\n---\n# Dois\n');
  const bk = join(raiz, 'bk', 'backup');
  const run = (...a) => spawnSync(process.execPath, [join(SCRIPTS, 'migrar-memoria-pastas.mjs'), '--projdir', proj, '--backup', bk, ...a], { encoding: 'utf8' });
  try {
    assert.equal(run('--apply', '--forca').status, 0);
    // edição posterior → recusa, nada apagado
    const geralOrig = readFileSync(join(proj, 'um', 'geral.md'));
    writeFileSync(join(proj, 'um', 'geral.md'), '# Um\nlinha nova depois da migração\n');
    const r1 = run('--rollback');
    assert.equal(r1.status, 1);
    assert.match(r1.stdout, /rollback recusado: 1 ficheiro\(s\)[\s\S]*um\/geral\.md \(conteúdo mudou\)/);
    assert.ok(existsSync(join(proj, 'um', 'geral.md')) && !existsSync(join(proj, 'um.md')));
    // ficheiro novo numa pasta → também recusa
    writeFileSync(join(proj, 'um', 'geral.md'), geralOrig);
    writeFileSync(join(proj, 'dois', 'redes.md'), 'x\n');
    assert.match(run('--rollback').stdout, /dois\/redes\.md \(ficheiro novo\)/);
    rmSync(join(proj, 'dois', 'redes.md'));
    // sem edições → cópia do estado actual + repõe
    const r3 = run('--rollback');
    assert.equal(r3.status, 0, r3.stdout + r3.stderr);
    const copia = readdirSync(join(raiz, 'bk')).find((n) => n.startsWith('antes-do-rollback-'));
    assert.ok(copia && existsSync(join(raiz, 'bk', copia, 'um', 'index.md')));
    assert.deepEqual(readdirSync(proj).sort(), ['dois.md', 'um.md']);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});
