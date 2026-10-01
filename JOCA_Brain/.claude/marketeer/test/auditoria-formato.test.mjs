// Testes do formato da auditoria (#3), escritos a partir dos critérios de aceitação do issue.
// Base: a auditoria fictícia do _exemplo. Cada caso parte de uma cópia válida e muda uma coisa só,
// para que a rejeição se deva a essa mudança e não a outra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validarAuditoria } from '../scripts/auditoria/formato.mjs';
import { validarFicheiroAuditoria } from '../scripts/validar-dossier.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DADOS = join(RAIZ, 'test', 'fixtures');
const PASTA_EXEMPLO = join(DADOS, 'clientes', '_exemplo');
const FICHEIRO_EXEMPLO = readdirSync(join(PASTA_EXEMPLO, 'auditorias')).find((f) => f.endsWith('.json'));
const DATA_EXEMPLO = FICHEIRO_EXEMPLO?.replace(/\.json$/, '');
const TEXTO_EXEMPLO = FICHEIRO_EXEMPLO ? readFileSync(join(PASTA_EXEMPLO, 'auditorias', FICHEIRO_EXEMPLO), 'utf8') : '';

const copia = () => JSON.parse(TEXTO_EXEMPLO);
const validar = (obj, slug = '_exemplo', data = DATA_EXEMPLO) => validarFicheiroAuditoria(JSON.stringify(obj), slug, data);
const rejeita = (obj, msg, ...args) => assert.ok(validar(obj, ...args).length > 0, msg);
const aceita = (obj, msg, ...args) => assert.deepEqual(validar(obj, ...args), [], msg);

// ---------------------------------------------------------------------------------------------
// Critério: o _exemplo ganha uma auditoria fictícia válida usada nos testes
// ---------------------------------------------------------------------------------------------

test('o _exemplo tem uma auditoria em auditorias/<data>.json', () => {
  assert.ok(FICHEIRO_EXEMPLO, 'falta clientes/_exemplo/auditorias/*.json');
  assert.match(DATA_EXEMPLO, /^\d{4}-\d{2}-\d{2}$/);
});

test('a auditoria do _exemplo é válida (formato e ficheiro)', () => {
  assert.deepEqual(validarAuditoria(TEXTO_EXEMPLO, '_exemplo', DATA_EXEMPLO), []);
  assert.deepEqual(validarFicheiroAuditoria(TEXTO_EXEMPLO, '_exemplo', DATA_EXEMPLO), []);
});

test('a auditoria do _exemplo está marcada como fictícia e exercita o formato', () => {
  const a = copia();
  assert.equal(a.ficticio, true);
  assert.ok(a.achados.length > 0, 'uma auditoria de exemplo sem achados não exercita o formato do achado');
  const estados = new Set(a.areas.map((ar) => ar.estado));
  for (const e of ['verificado', 'nao-verificado', 'erro']) assert.ok(estados.has(e), `o exemplo não usa o estado ${e}`);
});

// ---------------------------------------------------------------------------------------------
// Critério: cada achado tem área, severidade (critica/alta/media/baixa), evidência, recomendação, skill
// ---------------------------------------------------------------------------------------------

for (const campo of ['area', 'regra', 'severidade', 'evidencia', 'recomendacao', 'skill']) {
  test(`achado sem "${campo}" é rejeitado`, () => {
    const a = copia();
    delete a.achados[0][campo];
    rejeita(a, `achado sem ${campo} passou`);
  });

  test(`achado com "${campo}" vazio é rejeitado`, () => {
    const a = copia();
    a.achados[0][campo] = '   ';
    rejeita(a, `achado com ${campo} em branco passou`);
  });
}

test('as quatro severidades critica/alta/media/baixa são aceites', () => {
  for (const s of ['critica', 'alta', 'media', 'baixa']) {
    const a = copia();
    a.achados[0].severidade = s;
    aceita(a, `severidade ${s} recusada`);
  }
});

test('severidade fora da lista é rejeitada', () => {
  for (const s of ['urgente', 'crítica', 'Alta', 'média', 'high', 3]) {
    const a = copia();
    a.achados[0].severidade = s;
    rejeita(a, `severidade ${s} aceite`);
  }
});

test('o erro vem do achado certo quando só o segundo está partido', () => {
  const a = copia();
  assert.ok(a.achados.length >= 2, 'o exemplo precisa de 2 achados para este caso');
  delete a.achados[1].skill;
  const erros = validar(a);
  assert.ok(erros.length > 0);
  assert.ok(erros.some((e) => e.includes('achados[1]')), `erro não identifica o achado: ${erros}`);
});

test('achado que não é objecto é rejeitado', () => {
  const a = copia();
  a.achados.push('um achado solto');
  rejeita(a, 'achado em string passou');
});

test('lista de achados vazia é aceite (auditoria sem problemas encontrados)', () => {
  const a = copia();
  a.achados = [];
  aceita(a, 'auditoria sem achados recusada');
});

// ---------------------------------------------------------------------------------------------
// Critério: estado por área — verificado · nao-verificado (sem acesso) · erro
// ---------------------------------------------------------------------------------------------

test('os três estados de área são aceites', () => {
  for (const estado of ['verificado', 'nao-verificado', 'erro']) {
    const a = copia();
    a.areas = [{ area: 'seo', estado, nota: 'motivo' }];
    // achados só em área verificada/erro; em nao-verificado fica sem achados
    if (estado === 'nao-verificado') a.achados = [];
    aceita(a, `estado ${estado} recusado`);
  }
});

test('área sem estado é rejeitada', () => {
  const a = copia();
  delete a.areas[0].estado;
  rejeita(a, 'área sem estado passou');
});

test('estado de área fora da lista é rejeitado', () => {
  for (const estado of ['ok', 'verificada', 'nao_verificado', 'sem-acesso', '', null]) {
    const a = copia();
    a.areas[0].estado = estado;
    rejeita(a, `estado ${estado} aceite`);
  }
});

test('auditoria sem lista de áreas é rejeitada', () => {
  const a = copia();
  delete a.areas;
  rejeita(a, 'auditoria sem areas passou');
});

// ---------------------------------------------------------------------------------------------
// Critério: a auditoria regista a versão do método
// ---------------------------------------------------------------------------------------------

test('a auditoria do _exemplo regista a versão do método', () => {
  const a = copia();
  assert.equal(typeof a.metodo, 'string');
  assert.ok(a.metodo.trim().length > 0);
});

test('auditoria sem versão do método é rejeitada', () => {
  const a = copia();
  delete a.metodo;
  rejeita(a, 'auditoria sem metodo passou');
});

test('versão do método vazia é rejeitada', () => {
  for (const v of ['', '  ', null]) {
    const a = copia();
    a.metodo = v;
    rejeita(a, `metodo ${JSON.stringify(v)} aceite`);
  }
});

// ---------------------------------------------------------------------------------------------
// Critério: npm run validar rejeita um achado sem evidência
// ---------------------------------------------------------------------------------------------

test('achado com evidência nula é rejeitado', () => {
  const a = copia();
  a.achados[0].evidencia = null;
  rejeita(a, 'evidencia null passou');
});

test('achado com evidência não textual é rejeitado', () => {
  for (const v of [42, {}, [], true]) {
    const a = copia();
    a.achados[0].evidencia = v;
    rejeita(a, `evidencia ${JSON.stringify(v)} passou`);
  }
});

test('o erro de evidência em falta menciona a evidência', () => {
  const a = copia();
  delete a.achados[0].evidencia;
  const erros = validar(a);
  assert.ok(erros.some((e) => /evid[eê]ncia/i.test(e)), `erro não fala de evidência: ${erros}`);
});

// Pelo CLI: pasta temporária com clientes/<slug>/dossier.md + auditorias/<data>.json.
// Corre o mesmo comando do "npm run validar" (node scripts/validar-dossier.mjs clientes) com cwd
// na pasta temporária. O controlo (mesma pasta com evidência) prova que a falha vem da evidência.
function correrValidarNumaPasta(auditoria, nome = `${DATA_EXEMPLO}.json`) {
  const dir = mkdtempSync(join(tmpdir(), 'marketeer-auditoria-'));
  try {
    const cliente = join(dir, 'clientes', '_exemplo');
    mkdirSync(join(cliente, 'auditorias'), { recursive: true });
    copyFileSync(join(PASTA_EXEMPLO, 'dossier.md'), join(cliente, 'dossier.md'));
    mkdirSync(join(cliente, 'auditorias', nome, '..'), { recursive: true });
    writeFileSync(join(cliente, 'auditorias', nome), JSON.stringify(auditoria, null, 2));
    return spawnSync(process.execPath, [join(RAIZ, 'scripts', 'validar-dossier.mjs'), 'clientes'], { cwd: dir, encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('CLI: pasta com auditoria válida sai com 0 (controlo)', () => {
  const r = correrValidarNumaPasta(copia());
  assert.equal(r.status, 0, r.stderr);
});

test('CLI: achado sem evidência faz o validar sair com código ≠ 0', () => {
  const a = copia();
  delete a.achados[0].evidencia;
  const r = correrValidarNumaPasta(a);
  assert.notEqual(r.status, 0, `saiu com 0:\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /auditorias/, 'o erro não aponta o ficheiro da auditoria');
});

test('CLI: achado com evidência vazia faz o validar sair com código ≠ 0', () => {
  const a = copia();
  a.achados[0].evidencia = '';
  const r = correrValidarNumaPasta(a);
  assert.notEqual(r.status, 0, `saiu com 0:\n${r.stdout}${r.stderr}`);
});

// Mesmo comando do "npm run validar", sem passar pelo npm: no Windows o npm é npm.cmd e o spawnSync
// sem shell dá ENOENT. O caminho impresso usa o separador do SO, daí o join().
test('npm run validar (MARKETEER_RAIZ, sem argumentos) passa com a auditoria do _exemplo', () => {
  const r = spawnSync(process.execPath, [join(RAIZ, 'scripts', 'validar-dossier.mjs')], { cwd: RAIZ, encoding: 'utf8', env: { ...process.env, MARKETEER_RAIZ: DADOS } });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes(join('auditorias', FICHEIRO_EXEMPLO)), `a auditoria do _exemplo não foi validada:\n${r.stdout}`);
});

// ---------------------------------------------------------------------------------------------
// Regras acrescentadas pelo implementador (NÃO vêm dos critérios do issue #3)
// ---------------------------------------------------------------------------------------------

test('[extra] achado numa área nao-verificado é recusado', () => {
  const a = copia();
  const semAcesso = a.areas.find((ar) => ar.estado === 'nao-verificado');
  assert.ok(semAcesso, 'o exemplo precisa de uma área nao-verificado');
  a.achados[0].area = semAcesso.area;
  a.achados[0].regra = `${semAcesso.area}.title-ausente`;
  rejeita(a, 'achado em área sem acesso passou');
});

test('[extra] achado numa área com estado erro é aceite', () => {
  const a = copia();
  const comErro = a.areas.find((ar) => ar.estado === 'erro');
  assert.ok(comErro, 'o exemplo precisa de uma área com erro');
  a.achados[0].area = comErro.area;
  a.achados[0].regra = `${comErro.area}.title-ausente`;
  aceita(a, 'achado em área com erro recusado');
});

test('[extra] achado numa área que não está em "areas" é recusado', () => {
  const a = copia();
  a.achados[0].area = 'area-inexistente';
  a.achados[0].regra = 'area-inexistente.title-ausente';
  rejeita(a, 'achado com área fora do âmbito passou');
});

test('[extra] "cliente" diferente da pasta é recusado', () => {
  rejeita(copia(), 'cliente não bate com a pasta e passou', 'outro-cliente', DATA_EXEMPLO);
});

test('[extra] "data" diferente do nome do ficheiro é recusada', () => {
  rejeita(copia(), 'data não bate com o ficheiro e passou', '_exemplo', '2000-01-01');
});

test('[extra] "data" fora do formato AAAA-MM-DD é recusada', () => {
  const a = copia();
  a.data = '24/09/2026';
  rejeita(a, 'data mal formatada passou', '_exemplo', undefined);
});

test('[extra] CLI: auditoria com "cliente" de outra pasta sai com código ≠ 0', () => {
  const a = copia();
  a.cliente = 'outro-cliente';
  const r = correrValidarNumaPasta(a);
  assert.notEqual(r.status, 0, `saiu com 0:\n${r.stdout}${r.stderr}`);
});

test('[extra] "areas" vazia é recusada', () => {
  const a = copia();
  a.areas = [];
  a.achados = [];
  rejeita(a, 'auditoria com areas vazia passou');
});

// ---------------------------------------------------------------------------------------------
// Revisão do PR #16
// ---------------------------------------------------------------------------------------------

test('[revisão] "regra" do achado tem o formato <area>.<slug-kebab>', () => {
  for (const r of ['seo', 'seo.', 'seo.Title-Ausente', 'seo.title_ausente', 'seo.title--ausente', 'seo title', 42]) {
    const a = copia();
    a.achados[0].regra = r;
    rejeita(a, `regra ${JSON.stringify(r)} aceite`);
  }
});

test('[revisão] o prefixo da "regra" tem de ser a "area" do achado', () => {
  const a = copia();
  a.achados[0].regra = 'ga4.title-ausente';
  rejeita(a, 'regra de outra área aceite');
});

test('[revisão] "regra" com área composta (modulo.subarea) é aceite', () => {
  const a = copia();
  a.areas.push({ area: 'presenca.instagram', estado: 'verificado' });
  a.achados[0].area = 'presenca.instagram';
  a.achados[0].regra = 'presenca.instagram.bio-sem-link';
  aceita(a, 'regra em área composta recusada');
});

test('[revisão] todos os achados do _exemplo têm "regra"', () => {
  for (const ac of copia().achados) assert.match(ac.regra, /^[a-z0-9.-]+$/);
});

test('[revisão] 2.ª auditoria no mesmo dia: AAAA-MM-DD-<sufixo>.json é aceite', () => {
  for (const sufixo of ['2', 'tarde', 'pos-migracao']) {
    aceita(copia(), `sufixo ${sufixo} recusado`, '_exemplo', `${DATA_EXEMPLO}-${sufixo}`);
    const r = correrValidarNumaPasta(copia(), `${DATA_EXEMPLO}-${sufixo}.json`);
    assert.equal(r.status, 0, `CLI recusou ${DATA_EXEMPLO}-${sufixo}.json:\n${r.stderr}`);
  }
});

test('[revisão] com sufixo, a data do nome continua a ter de bater com "data"', () => {
  rejeita(copia(), 'data de outro dia aceite', '_exemplo', '2000-01-01-2');
});

test('[revisão] nome de ficheiro fora da convenção é recusado', () => {
  for (const nome of ['relatorio', `${DATA_EXEMPLO}_2`, `${DATA_EXEMPLO}-`, `${DATA_EXEMPLO}-Tarde`, `x${DATA_EXEMPLO}`]) {
    rejeita(copia(), `nome ${nome}.json aceite`, '_exemplo', nome);
  }
});

test('[revisão] CLI: .json numa subpasta de auditorias/ é recusado', () => {
  const r = correrValidarNumaPasta(copia(), join('antigas', `${DATA_EXEMPLO}.json`));
  assert.notEqual(r.status, 0, `saiu com 0:\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /JSON fora de auditorias\//);
});

test('[revisão] CLI: .json solto na pasta do cliente é recusado', () => {
  const r = correrValidarNumaPasta(copia(), join('..', 'notas.json'));
  assert.notEqual(r.status, 0, `saiu com 0:\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /JSON fora de auditorias\//);
});

// Caminho de segurança de validarFicheiroAuditoria: segredos e campos de credenciais nas auditorias.
test('[revisão] campo de credencial (api_key) num achado é recusado', () => {
  const a = copia();
  a.achados[0].api_key = 'abc';
  const erros = validar(a);
  assert.ok(erros.some((e) => /campo proibido .*api_key/.test(e)), `api_key passou: ${erros}`);
});

test('[revisão] token OAuth Google (ya29.) na evidência é recusado', () => {
  const a = copia();
  a.achados[0].evidencia = `https://exemplo.invalid/?t=ya29.${'a'.repeat(25)}`;
  const erros = validar(a);
  assert.ok(erros.some((e) => /segredo/.test(e)), `token passou: ${erros}`);
});

test('[revisão] JSON com BOM é aceite', () => {
  assert.deepEqual(validarFicheiroAuditoria(`﻿${TEXTO_EXEMPLO}`, '_exemplo', DATA_EXEMPLO), []);
});

test('[revisão] JSON partido é recusado', () => {
  assert.ok(validarFicheiroAuditoria('{', '_exemplo', DATA_EXEMPLO).length > 0, '"{" passou');
});

test('[revisão] evidência "<sem fonte>" é recusada', () => {
  const a = copia();
  a.achados[0].evidencia = '<sem fonte>';
  rejeita(a, 'evidência <sem fonte> passou');
});

test('[revisão] área repetida em "areas" é recusada', () => {
  const a = copia();
  a.areas.push({ area: 'seo', estado: 'erro', nota: 'repetida' });
  const erros = validar(a);
  assert.ok(erros.some((e) => /repetida/.test(e)), `área repetida passou: ${erros}`);
});

test('[revisão] "data" inexistente no calendário é recusada', () => {
  for (const d of ['2026-02-31', '2026-13-01', '2026-00-10', '2025-02-29']) {
    const a = copia();
    a.data = d;
    rejeita(a, `data ${d} aceite`, '_exemplo', d);
  }
  const a = copia();
  a.data = '2028-02-29';
  aceita(a, 'dia bissexto recusado', '_exemplo', '2028-02-29');
});

test('[revisão] área nao-verificado ou erro sem "nota" é recusada', () => {
  for (const estado of ['nao-verificado', 'erro']) {
    for (const nota of [undefined, '', '  ']) {
      const a = copia();
      const ar = a.areas.find((x) => x.estado === estado);
      if (nota === undefined) delete ar.nota;
      else ar.nota = nota;
      rejeita(a, `área ${estado} com nota ${JSON.stringify(nota)} passou`);
    }
  }
});

test('[revisão] área verificado sem "nota" é aceite', () => {
  const a = copia();
  delete a.areas.find((x) => x.estado === 'verificado').nota;
  aceita(a, 'área verificada sem nota recusada');
});

// ---------------------------------------------------------------------------------------------
// D-016 (#9): o achado tem "alvo" opcional; "regra"+"alvo" é único na auditoria
// ---------------------------------------------------------------------------------------------

const comAlvos = (...alvos) => {
  const a = copia();
  const base = a.achados[0];
  a.achados = alvos.map((alvo) => {
    const ac = { ...base };
    if (alvo !== undefined) ac.alvo = alvo;
    return ac;
  });
  return a;
};

test('[D-016] a mesma "regra" com "alvo" diferente é aceite', () => {
  aceita(comAlvos('ga4', 'meta-pixel'), 'regra repetida com alvos diferentes recusada');
  aceita(comAlvos('GA4 G-ABC123', 'GA4 G-XYZ789', 'instagram'), 'três alvos diferentes recusados');
});

test('[D-016] "regra"+"alvo" repetido é recusado', () => {
  rejeita(comAlvos('ga4', 'ga4'), 'regra+alvo repetido passou');
  rejeita(comAlvos('ga4', 'meta-pixel', 'ga4'), 'regra+alvo repetido (não consecutivo) passou');
});

test('[D-016] a mesma "regra" repetida sem "alvo" é recusada (sem alvo = alvo vazio)', () => {
  rejeita(comAlvos(undefined, undefined), 'regra repetida sem alvo passou');
});

test('[D-016] a mesma "regra" com e sem "alvo" é aceite', () => {
  aceita(comAlvos(undefined, 'ga4'), 'um sem alvo e outro com alvo recusados');
});

test('[D-016] "alvo" igual em regras diferentes é aceite', () => {
  const a = comAlvos('ga4', 'ga4');
  a.achados[1].regra = 'seo.imagens-sem-alt';
  aceita(a, 'o mesmo alvo em regras diferentes foi recusado');
});

test('[D-016] "alvo" que não é texto é recusado', () => {
  for (const v of [42, {}, ['ga4'], true]) rejeita(comAlvos(v), `alvo ${JSON.stringify(v)} passou`);
});

test('[D-016] CLI: regra+alvo repetido faz o validar sair com código ≠ 0', () => {
  const r = correrValidarNumaPasta(comAlvos('ga4', 'ga4'));
  assert.notEqual(r.status, 0, `saiu com 0:\n${r.stdout}${r.stderr}`);
  assert.equal(correrValidarNumaPasta(comAlvos('ga4', 'meta-pixel')).status, 0, 'controlo com alvos diferentes falhou');
});
