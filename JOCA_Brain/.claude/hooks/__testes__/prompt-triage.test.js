// Testes do prompt-triage.js — `node --test ".claude/hooks/__testes__/*.test.js"`
// Só lê SKILL_INDEX.json; a memória de projectos é uma pasta de fixtures FICTÍCIAS em tmp
// (JOCA_PROJECTS_DIR), para não depender dos projectos reais de quem corre os testes.
// HOOK_TRIAGE=<caminho> aponta a uma cópia (teste de mutação) — a cópia tem de ficar em
// .claude/hooks/ do Brain para achar SKILL_INDEX.json por __dirname.
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = process.env.HOOK_TRIAGE || path.join(__dirname, '..', 'prompt-triage.js');
const PROJ = fs.mkdtempSync(path.join(os.tmpdir(), 'joca-triagem-'));
for (const [slug, fm] of Object.entries({
  acme: '',                                                       // slug de uma palavra (recall)
  vendas: '',                                                     // slug de uma só palavra comum
  acmetrix: '',                                                   // alvo do quase-igual
  'loja-da-acme': 'aliases: [loja-acme-redes-sociais#redes-sociais]\n', // alias com área
  'acme-site-v4': 'aliases: [acmecorp]\n',                        // alias de uma palavra
})) {
  fs.mkdirSync(path.join(PROJ, slug));
  fs.writeFileSync(path.join(PROJ, slug, 'index.md'), `---\nname: ${slug}\ndescription: fixture\n${fm}---\n`);
}
after(() => fs.rmSync(PROJ, { recursive: true, force: true }));

function triar(prompt) {
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ prompt }), encoding: 'utf8',
    env: { ...process.env, JOCA_PROJECTS_DIR: PROJ } });
  return JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
}

// T003
test('«em ambas… depois… e manda» → não é «pequeno e indivisível»', () => {
  const c = triar('em ambas as versões optimiza as animações e o código… depois atualiza no live e manda as duas versões ao cliente');
  assert.doesNotMatch(c, /pequeno e indivisível/);
  assert.match(c, /Vale fan-out/);
});
test('«em ambas as versões» é escala', () => {
  assert.match(triar('optimiza as imagens em ambas as versões'), /trabalho repetido em vários sítios/);
});
test('«. Depois publica» conta como segunda parte', () => {
  assert.match(triar('muda a cor do botão. Depois publica.'), /2 partes independentes/);
});
test('«e manda» conta como parte', () => {
  assert.match(triar('corrige o texto do rodapé e manda ao cliente'), /2 partes independentes/);
});

// B09
test('viabilidade com palavra irreversível → sem [plano]', () => {
  const c = triar('dá para fazer deploy disto em produção?');
  assert.match(c, /pergunta de viabilidade/); assert.doesNotMatch(c, /\[plano\]/);
});
test('pedido irreversível normal mantém o [plano]', () => {
  assert.match(triar('faz deploy disto em produção'), /\[plano\] acção irreversível/);
});

// T039 T106 T175 + não estragar o [projecto] aprovado
test('[projecto] traz o recall do slug', () => {
  // memória por pastas: `acme/index.md` (a ficha plana `acme.md` já não se lê)
  assert.match(triar('continua o acme'), /\[projecto\] acme → ler memory\/projects\/acme\/index\.md \+ `node ".*joca-brain\.mjs" recall --slug acme`/);
});
test('«vendas do mês» continua sem [projecto] nem [projecto?]', () => {
  assert.doesNotMatch(triar('vendas do mês'), /\[projecto\??\]/);
});
// Memória por pastas (2026-10-01): só igualdade manda ler; parecido → candidatos, nunca adivinhado
test('quase-igual «iacmetrix» → [projecto?] acmetrix, sem [projecto]', () => {
  const c = triar('abre o iacmetrix');
  assert.match(c, /\[projecto\?\] candidatos: [^—]*acmetrix/);
  assert.doesNotMatch(c, /\[projecto\] /);
});
test('alias exacto de área → projecto da pasta + ficheiro da área', () => {
  assert.match(triar('loja acme redes sociais de novembro'),
    /\[projecto\] loja-da-acme → ler memory\/projects\/loja-da-acme\/index\.md \+ área memory\/projects\/loja-da-acme\/redes-sociais\.md/);
});
test('alias de uma palavra («acmecorp») sem «projecto» não dispara', () => {
  assert.doesNotMatch(triar('manda o email à acmecorp'), /\[projecto\] acme-site-v4/);
  assert.match(triar('abre o projecto acmecorp'), /\[projecto\] acme-site-v4/);   // controlo positivo
});

// Regressões do resto do output
test('pergunta curta com «todos» continua directa', () => {
  assert.match(triar('qual o acesso do admin em todos os ambientes?'), /pergunta sem trabalho decomponível/);
});
test('uma tarefa com vocabulário de 2 domínios continua 1 parte', () => {
  assert.match(triar('refactoriza o componente de login em react'), /domínio único/);
});

// F4.1 — encaminhamento em 2 níveis (domínio → ramo): o domínio só reordena as 3 sugeridas
test('domínio decisivo reordena dentro das 3: IDOR → security à frente de rest-api', () => {
  assert.match(triar('check for IDOR in the orders endpoint'), /\[skill\] security «[^»]*», security-review (?:\(agente\) )?«[^»]*», rest-api /);
});
test('domínio sem margem não mexe na ordem: «AI slop deste artigo» → stop-slop primeiro', () => {
  assert.match(triar('remove o AI slop deste artigo'), /\[skill\] stop-slop «/);
});
test('o domínio nunca troca nomes: continuam no máximo 3', () => {
  const m = triar('configura o GA4 no site').match(/\[skill\] (.*?) →/);
  assert.ok(m); assert.equal(m[1].split(', ').length, 3);
  assert.match(m[1], /^analytics-tracking /);
});
