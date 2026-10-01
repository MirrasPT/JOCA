// Testes do auditoria/correr.mjs (#9), escritos a partir dos critérios de aceitação do issue, do
// comentário da varredura da onda 2 e de D-012/D-015 c/D-016 — não a partir do corpo de correr.mjs.
// Tudo corre numa raiz temporária com um dossier próprio; os módulos são sempre injectados (sem rede).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { auditarCliente, resumir, ordenarAchados, METODO, MODULOS } from '../scripts/auditoria/correr.mjs';
import { validarAuditoria } from '../scripts/auditoria/formato.mjs';
import { validarDossier, validarFicheiroAuditoria, normalizarSite } from '../scripts/validar-dossier.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CORRER = join(RAIZ, 'scripts', 'auditoria', 'correr.mjs');
const VALIDAR = join(RAIZ, 'scripts', 'validar-dossier.mjs');
const SLUG = 'padaria-teste';
// 00:30 de 25/09 em hora local: em Lisboa (UTC+1) ainda é dia 24 em UTC — apanha a data em UTC.
const HOJE = new Date(2026, 8, 25, 0, 30);
const DATA = '2026-09-25';

const pastas = [];
after(() => pastas.forEach((p) => rmSync(p, { recursive: true, force: true })));
const novaPasta = () => {
  const p = mkdtempSync(join(tmpdir(), 'marketeer-auditar-'));
  pastas.push(p);
  return p;
};

const dossier = ({ slug = SLUG, site = 'https://padaria.invalid' } = {}) => `---
# comentário de topo: tem de sobreviver à actualização
cliente:
  nome: Padaria Teste
  slug: ${slug}
  sector: restauração # comentário inline
  site: ${site}
  responsavel: equipa
marca: <sem fonte>
publico: <sem fonte>
objectivos: []
concorrentes: []
canais:
  # canais conhecidos
  - tipo: ga4
    id: <sem fonte>
    acesso: false
estado: dossier criado
actualizado: 2026-09-24
---

# Padaria Teste

Corpo livre do dossier, que também fica intacto.
`;

function novaRaiz(opts = {}) {
  const raiz = novaPasta();
  const slug = opts.slug ?? SLUG;
  mkdirSync(join(raiz, 'clientes', slug), { recursive: true });
  writeFileSync(join(raiz, 'clientes', slug, 'dossier.md'), opts.texto ?? dossier(opts));
  return raiz;
}

const caminhoDossier = (raiz, slug = SLUG) => join(raiz, 'clientes', slug, 'dossier.md');
const pastaAuditorias = (raiz, slug = SLUG) => join(raiz, 'clientes', slug, 'auditorias');

// Fotografia de todos os ficheiros da raiz (caminho relativo → conteúdo): "nada gravado" = igual.
function fotografia(raiz) {
  const r = {};
  const andar = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else r[relative(raiz, p)] = readFileSync(p, 'utf8');
    }
  };
  andar(raiz);
  return r;
}

const achado = (area, slug, severidade, extra = {}) => ({
  area,
  regra: `${area}.${slug}`,
  severidade,
  evidencia: `https://padaria.invalid/ — evidência ${slug}`,
  recomendacao: `recomendação ${slug}`,
  skill: 'seo',
  ...extra,
});

// Módulo injectável. `resultado` é o { areas, achados } devolvido, ou uma função (args) → isso.
// `chamadas` regista cada chamada a auditar, com os argumentos recebidos.
function modulo(nome, resultado, chamadas = []) {
  return {
    nome,
    web: true,
    importar: async () => ({
      auditar: async (args) => {
        chamadas.push({ nome, args });
        return typeof resultado === 'function' ? resultado(args) : resultado;
      },
    }),
  };
}
const verificado = (nome, achados = []) => ({ areas: [{ area: nome, estado: 'verificado' }], achados });
const CONTAS = MODULOS.find((m) => m.nome === 'contas');

const lerGravada = (caminho) => JSON.parse(readFileSync(caminho, 'utf8'));
const area = (auditoria, nome) => auditoria.areas.find((a) => a.area === nome);

// ---------------------------------------------------------------------------------------------
// Critério 1: corre os módulos disponíveis e um módulo que falha não aborta os outros
// ---------------------------------------------------------------------------------------------

test('módulo que lança fica "erro" com nota; os outros ficam "verificado" com os seus achados', async () => {
  const raiz = novaRaiz();
  const chamadas = [];
  const modulos = [
    modulo('seo', verificado('seo', [achado('seo', 'title-ausente', 'alta')]), chamadas),
    modulo('presenca', () => { throw new Error('rebentou a meio'); }, chamadas),
    modulo('tracking', verificado('tracking', [achado('tracking', 'sem-consentimento', 'media')]), chamadas),
  ];
  const { caminho, auditoria } = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assert.deepEqual(chamadas.map((c) => c.nome).sort(), ['presenca', 'seo', 'tracking'], 'nem todos os módulos correram');
  assert.equal(area(auditoria, 'seo').estado, 'verificado');
  assert.equal(area(auditoria, 'tracking').estado, 'verificado');
  const falhou = area(auditoria, 'presenca');
  assert.equal(falhou?.estado, 'erro');
  assert.ok(falhou.nota?.trim(), 'área em erro sem nota');
  assert.deepEqual(auditoria.achados.map((a) => a.regra).sort(), ['seo.title-ausente', 'tracking.sem-consentimento']);
  assert.deepEqual(lerGravada(caminho), auditoria, 'o gravado não é o devolvido');
});

test('módulo cujo auditar rejeita (Promise rejeitada) não aborta os outros', async () => {
  const raiz = novaRaiz();
  const modulos = [
    { nome: 'seo', web: true, importar: async () => ({ auditar: () => Promise.reject(new Error('timeout')) }) },
    modulo('presenca', verificado('presenca')),
  ];
  const { auditoria } = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assert.equal(area(auditoria, 'seo').estado, 'erro');
  assert.equal(area(auditoria, 'presenca').estado, 'verificado');
});

test('import que falha por pacote em falta (ERR_MODULE_NOT_FOUND) → "erro" com "dependências em falta (npm ci)"', async () => {
  const raiz = novaRaiz();
  const modulos = [
    modulo('seo', verificado('seo')),
    // pacote que não existe — o mesmo erro que o tracking dá sem `playwright` instalado
    { nome: 'tracking', web: true, importar: () => import('pacote-que-nao-existe-marketeer-teste') },
    modulo('presenca', verificado('presenca')),
  ];
  const { auditoria } = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assert.equal(area(auditoria, 'seo').estado, 'verificado');
  assert.equal(area(auditoria, 'presenca').estado, 'verificado');
  const a = area(auditoria, 'tracking');
  assert.equal(a?.estado, 'erro', 'import falhado não ficou erro');
  assert.match(a.nota, /depend[eê]ncias em falta/i, 'nota não fala de dependências');
  assert.match(a.nota, /npm ci/, 'nota não diz para correr npm ci');
});

test('import de um ficheiro do próprio repo que não existe fica "erro" com nota, sem abortar os outros', async () => {
  const raiz = novaRaiz();
  const modulos = [{ nome: 'seo', web: true, importar: () => import('./ficheiro-que-nao-existe.mjs') }, modulo('presenca', verificado('presenca'))];
  const { auditoria } = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assert.equal(area(auditoria, 'seo')?.estado, 'erro');
  assert.ok(area(auditoria, 'seo').nota?.trim());
  assert.ok(!area(auditoria, 'seo').nota.includes(RAIZ), 'nota com caminho absoluto da máquina');
  assert.equal(area(auditoria, 'presenca').estado, 'verificado');
});

test('import que lança outro erro (não ERR_MODULE_NOT_FOUND) também fica "erro" sozinho', async () => {
  const raiz = novaRaiz();
  const modulos = [
    { nome: 'seo', web: true, importar: async () => { throw new SyntaxError('módulo partido'); } },
    modulo('presenca', verificado('presenca')),
  ];
  const { auditoria } = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assert.equal(area(auditoria, 'seo').estado, 'erro');
  assert.ok(area(auditoria, 'seo').nota?.trim());
  assert.equal(area(auditoria, 'presenca').estado, 'verificado');
});

test('D-016: módulo que repete regra sem alvo fica "erro"; os outros não são afectados', async () => {
  const raiz = novaRaiz();
  const repetido = verificado('tracking', [
    achado('tracking', 'tag-duplicada', 'media'),
    achado('tracking', 'tag-duplicada', 'media'),
  ]);
  const modulos = [modulo('seo', verificado('seo', [achado('seo', 'title-ausente', 'alta')])), modulo('tracking', repetido)];
  const { caminho, auditoria } = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assert.equal(area(auditoria, 'tracking').estado, 'erro');
  assert.equal(area(auditoria, 'seo').estado, 'verificado');
  assert.ok(!auditoria.achados.some((a) => a.area === 'tracking'), 'achados de área em erro inválida ficaram');
  assert.deepEqual(validarAuditoria(readFileSync(caminho, 'utf8'), SLUG, DATA), []);
});

test('D-016: o mesmo módulo com regra repetida mas alvos diferentes fica "verificado"', async () => {
  const raiz = novaRaiz();
  const r = verificado('tracking', [
    achado('tracking', 'disparo-antes-consentimento', 'alta', { alvo: 'ga4' }),
    achado('tracking', 'disparo-antes-consentimento', 'alta', { alvo: 'meta-pixel' }),
  ]);
  const { auditoria } = await auditarCliente(SLUG, { raiz, modulos: [modulo('tracking', r)], hoje: HOJE });
  assert.equal(area(auditoria, 'tracking').estado, 'verificado');
  assert.deepEqual(auditoria.achados.map((a) => a.alvo).sort(), ['ga4', 'meta-pixel']);
});

test('módulo que devolve algo fora do formato fica "erro" sozinho', async () => {
  const raiz = novaRaiz();
  const modulos = [
    modulo('seo', { lixo: true }),
    modulo('presenca', verificado('presenca', [{ area: 'presenca', regra: 'presenca.sem-evidencia', severidade: 'alta' }])),
    modulo('tracking', verificado('tracking')),
  ];
  const { caminho, auditoria } = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assert.equal(area(auditoria, 'seo')?.estado, 'erro');
  assert.equal(area(auditoria, 'presenca')?.estado, 'erro');
  assert.equal(area(auditoria, 'tracking').estado, 'verificado');
  assert.deepEqual(validarAuditoria(readFileSync(caminho, 'utf8'), SLUG, DATA), []);
});

test('um módulo com várias áreas devolve-as todas na auditoria', async () => {
  const raiz = novaRaiz();
  const r = { areas: [{ area: 'presenca.gbp', estado: 'verificado' }, { area: 'presenca.instagram', estado: 'verificado' }], achados: [] };
  const { auditoria } = await auditarCliente(SLUG, { raiz, modulos: [modulo('presenca', r)], hoje: HOJE });
  assert.deepEqual(auditoria.areas.map((a) => a.area), ['presenca.gbp', 'presenca.instagram']);
});

// ---------------------------------------------------------------------------------------------
// Critério 2: grava auditorias/<AAAA-MM-DD>.json válido; 2.ª auditoria no mesmo dia não sobrescreve
// ---------------------------------------------------------------------------------------------

test('grava clientes/<slug>/auditorias/<AAAA-MM-DD>.json (data local) e o ficheiro é válido', async () => {
  const raiz = novaRaiz();
  const modulos = [modulo('seo', verificado('seo', [achado('seo', 'title-ausente', 'alta')]))];
  const { caminho, auditoria } = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assert.equal(caminho, join(pastaAuditorias(raiz), `${DATA}.json`));
  const texto = readFileSync(caminho, 'utf8');
  assert.deepEqual(validarAuditoria(texto, SLUG, DATA), []);
  assert.deepEqual(validarFicheiroAuditoria(texto, SLUG, DATA), []);
  assert.equal(auditoria.cliente, SLUG);
  assert.equal(auditoria.data, DATA);
  assert.equal(auditoria.metodo, METODO);
  assert.equal(typeof METODO, 'string');
  assert.ok(METODO.trim());
});

test('2.ª auditoria no mesmo dia grava -2 e a 1.ª fica byte a byte; a 3.ª grava -3', async () => {
  const raiz = novaRaiz();
  let n = 0;
  const modulos = [modulo('seo', () => verificado('seo', [achado('seo', `corrida-${++n}`, 'baixa')]))];
  const r1 = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  const antes = readFileSync(r1.caminho);
  const r2 = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  const r3 = await auditarCliente(SLUG, { raiz, modulos, hoje: new Date(2026, 8, 25, 23, 59) });
  assert.equal(r2.caminho, join(pastaAuditorias(raiz), `${DATA}-2.json`));
  assert.equal(r3.caminho, join(pastaAuditorias(raiz), `${DATA}-3.json`));
  assert.ok(readFileSync(r1.caminho).equals(antes), 'a 1.ª auditoria do dia foi alterada');
  assert.deepEqual(readdirSync(pastaAuditorias(raiz)).sort(), [`${DATA}-2.json`, `${DATA}-3.json`, `${DATA}.json`]);
  assert.equal(lerGravada(r2.caminho).achados[0].regra, 'seo.corrida-2');
  assert.equal(lerGravada(r3.caminho).achados[0].regra, 'seo.corrida-3');
  for (const [c, nome] of [[r2.caminho, `${DATA}-2`], [r3.caminho, `${DATA}-3`]]) {
    assert.deepEqual(validarFicheiroAuditoria(readFileSync(c, 'utf8'), SLUG, nome), [], `${nome}.json inválido`);
  }
});

test('auditoria de outro dia não mexe nas do dia anterior', async () => {
  const raiz = novaRaiz();
  const modulos = [modulo('seo', verificado('seo'))];
  const r1 = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  const antes = readFileSync(r1.caminho);
  const r2 = await auditarCliente(SLUG, { raiz, modulos, hoje: new Date(2026, 8, 26, 10) });
  assert.equal(r2.caminho, join(pastaAuditorias(raiz), '2026-09-26.json'));
  assert.ok(readFileSync(r1.caminho).equals(antes));
});

test('um <data>.json que já lá estava (de outra pessoa) não é sobrescrito', async () => {
  const raiz = novaRaiz();
  mkdirSync(pastaAuditorias(raiz), { recursive: true });
  const alheio = join(pastaAuditorias(raiz), `${DATA}.json`);
  writeFileSync(alheio, 'conteúdo alheio — não tocar\n');
  const { caminho } = await auditarCliente(SLUG, { raiz, modulos: [modulo('seo', verificado('seo'))], hoje: HOJE });
  assert.equal(caminho, join(pastaAuditorias(raiz), `${DATA}-2.json`));
  assert.equal(readFileSync(alheio, 'utf8'), 'conteúdo alheio — não tocar\n');
});

// ---------------------------------------------------------------------------------------------
// Critério 3: achados ordenados por severidade no resumo mostrado
// ---------------------------------------------------------------------------------------------

// Cada achado leva um marcador único na regra e na evidência; a posição no resumo é a 1.ª ocorrência.
const MARCAS = { critica: 'zq-marca-critica', alta: 'zq-marca-alta', media: 'zq-marca-media', baixa: 'zq-marca-baixa' };
const desordenados = () => ['baixa', 'media', 'critica', 'alta', 'baixa', 'critica'].map((s, i) =>
  achado('seo', `${MARCAS[s]}-${i}`, s));
function posicoes(texto, achados) {
  return achados.map((a) => {
    const i = texto.indexOf(a.regra.split('.')[1]);
    assert.ok(i >= 0, `o resumo não mostra o achado ${a.regra}:\n${texto}`);
    return { severidade: a.severidade, i };
  });
}
const PESO = { critica: 0, alta: 1, media: 2, baixa: 3 };
function assertOrdenado(texto, achados) {
  const p = posicoes(texto, achados).sort((a, b) => a.i - b.i).map((x) => x.severidade);
  const esperado = [...p].sort((a, b) => PESO[a] - PESO[b]);
  assert.deepEqual(p, esperado, `ordem no resumo: ${p.join(' > ')}`);
}

test('resumir mostra os achados de input desordenado por severidade: critica > alta > media > baixa', () => {
  const achados = desordenados();
  const auditoria = { cliente: SLUG, data: DATA, metodo: METODO, areas: [{ area: 'seo', estado: 'verificado' }], achados };
  const texto = resumir(auditoria);
  assert.equal(typeof texto, 'string');
  assertOrdenado(texto, achados);
});

test('o resumo de uma auditoria real (auditarCliente) sai ordenado, venham os achados por que ordem vierem', async () => {
  const raiz = novaRaiz();
  const achados = desordenados();
  const modulos = [
    modulo('seo', verificado('seo', achados.filter((_, i) => i % 2 === 0))),
    modulo('presenca', verificado('presenca', achados.filter((_, i) => i % 2 === 1).map((a) => ({ ...a, area: 'presenca', regra: a.regra.replace(/^seo\./, 'presenca.') })))),
  ];
  const { caminho, auditoria } = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assertOrdenado(resumir(auditoria, caminho), auditoria.achados);
});

test('resumo de auditoria sem achados não rebenta e mostra as áreas', () => {
  const auditoria = { cliente: SLUG, data: DATA, metodo: METODO, areas: [{ area: 'seo', estado: 'verificado' }, { area: 'contas.ga4', estado: 'nao-verificado', nota: 'por implementar' }], achados: [] };
  const texto = resumir(auditoria);
  assert.equal(typeof texto, 'string');
  assert.ok(texto.length > 0);
});

test('ordenarAchados ordena por severidade sem perder achados nem mexer no input', () => {
  const input = desordenados();
  const copia = structuredClone(input);
  const r = ordenarAchados(input);
  assert.deepEqual(r.map((a) => a.severidade), ['critica', 'critica', 'alta', 'media', 'baixa', 'baixa']);
  assert.equal(r.length, input.length);
  assert.deepEqual(input, copia, 'ordenarAchados alterou o array recebido');
});

// ---------------------------------------------------------------------------------------------
// Critério 4: o dossier actualizado passa `npm run validar` (e mantém os comentários — varredura)
// ---------------------------------------------------------------------------------------------

test('dossier actualizado: "estado" e "actualizado" mudam, passa validarDossier e mantém comentários e corpo', async () => {
  const raiz = novaRaiz();
  await auditarCliente(SLUG, { raiz, modulos: [modulo('seo', verificado('seo'))], hoje: HOJE });
  const texto = readFileSync(caminhoDossier(raiz), 'utf8');
  assert.deepEqual(validarDossier(texto, SLUG), []);
  const fm = parse(texto.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  assert.equal(String(fm.actualizado), DATA, '"actualizado" não é a data local da auditoria');
  assert.notEqual(fm.estado, 'dossier criado', '"estado" não foi actualizado');
  assert.ok(String(fm.estado).trim());
  assert.ok(texto.includes('# comentário de topo: tem de sobreviver à actualização'), 'comentário de topo perdido');
  assert.ok(texto.includes('# comentário inline'), 'comentário inline perdido');
  assert.ok(texto.includes('# canais conhecidos'), 'comentário dentro da lista perdido');
  assert.ok(texto.includes('Corpo livre do dossier, que também fica intacto.'), 'corpo do dossier perdido');
  assert.equal(fm.cliente.sector, 'restauração');
});

test('npm run validar (mesmo comando, sem npm) passa sobre a raiz depois de auditar', async () => {
  const raiz = novaRaiz();
  await auditarCliente(SLUG, { raiz, modulos: [modulo('seo', verificado('seo', [achado('seo', 'title-ausente', 'alta')]))], hoje: HOJE });
  await auditarCliente(SLUG, { raiz, modulos: [modulo('seo', verificado('seo'))], hoje: HOJE });
  const r = spawnSync(process.execPath, [VALIDAR, 'clientes'], { cwd: raiz, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(r.stdout.includes(join('auditorias', `${DATA}.json`)), `a auditoria não foi validada:\n${r.stdout}`);
  assert.ok(r.stdout.includes(join('auditorias', `${DATA}-2.json`)));
});

// ---------------------------------------------------------------------------------------------
// Varredura: `site: <sem fonte>` → áreas web "nao-verificado" sem chamar os módulos
// ---------------------------------------------------------------------------------------------

test('site <sem fonte>: áreas web "nao-verificado" com nota e zero chamadas aos módulos', async () => {
  const raiz = novaRaiz({ site: '<sem fonte>' });
  const chamadas = [];
  const modulos = [
    modulo('seo', verificado('seo', [achado('seo', 'title-ausente', 'alta')]), chamadas),
    modulo('presenca', verificado('presenca'), chamadas),
    modulo('tracking', verificado('tracking'), chamadas),
  ];
  const { caminho, auditoria } = await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assert.equal(chamadas.length, 0, `módulos chamados sem site: ${chamadas.map((c) => c.nome)}`);
  for (const nome of ['seo', 'presenca', 'tracking']) {
    const a = area(auditoria, nome);
    assert.equal(a?.estado, 'nao-verificado', `${nome} não ficou nao-verificado`);
    assert.ok(a.nota?.trim(), `${nome} sem nota`);
  }
  assert.deepEqual(auditoria.achados, []);
  assert.deepEqual(validarAuditoria(readFileSync(caminho, 'utf8'), SLUG, DATA), []);
});

test('site <sem fonte>: módulo não-web continua a correr', async () => {
  const raiz = novaRaiz({ site: '<sem fonte>' });
  const chamadas = [];
  const semWeb = { ...modulo('outro', verificado('outro'), chamadas), web: false };
  const { auditoria } = await auditarCliente(SLUG, { raiz, modulos: [modulo('seo', verificado('seo'), chamadas), semWeb], hoje: HOJE });
  assert.deepEqual(chamadas.map((c) => c.nome), ['outro']);
  assert.equal(area(auditoria, 'outro').estado, 'verificado');
  assert.equal(area(auditoria, 'seo').estado, 'nao-verificado');
});

test('o site chega aos módulos já normalizado, o mesmo para todos', async () => {
  const bruto = 'https://padaria.invalid';
  const raiz = novaRaiz({ site: bruto });
  const chamadas = [];
  const modulos = [modulo('seo', verificado('seo'), chamadas), modulo('presenca', verificado('presenca'), chamadas)];
  await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assert.equal(chamadas.length, 2);
  assert.notEqual(normalizarSite(bruto), bruto, 'controlo: o bruto tem de mudar ao normalizar');
  for (const c of chamadas) assert.equal(c.args.site, normalizarSite(bruto));
});

// ---------------------------------------------------------------------------------------------
// Varredura / D-015 c: `auditar` nunca recebe `obter`
// ---------------------------------------------------------------------------------------------

test('cada auditar recebe { site, cliente } e nunca "obter"', async () => {
  const raiz = novaRaiz();
  const chamadas = [];
  const modulos = ['seo', 'presenca', 'tracking'].map((n) => modulo(n, verificado(n), chamadas));
  await auditarCliente(SLUG, { raiz, modulos, hoje: HOJE });
  assert.equal(chamadas.length, 3);
  for (const { nome, args } of chamadas) {
    assert.ok(!('obter' in args), `${nome} recebeu obter`);
    assert.equal(args.site, normalizarSite('https://padaria.invalid'));
    assert.equal(args.cliente?.slug, SLUG, `${nome} não recebeu o slug do cliente`);
    assert.ok(Array.isArray(args.cliente?.canais), `${nome} não recebeu os canais`);
  }
});

// ---------------------------------------------------------------------------------------------
// Contas (#8): o módulo real está ligado e não é web — corre também sem site
// ---------------------------------------------------------------------------------------------

test('MODULOS tem seo, presenca, gbp, tracking e contas (ligado, #8; gbp D-023)', () => {
  assert.deepEqual(MODULOS.map((m) => m.nome), ['seo', 'presenca', 'gbp', 'tracking', 'contas']);
  assert.equal(CONTAS.porImplementar, undefined);
  assert.ok(!CONTAS.web, 'contas não depende do site');
  assert.ok(Array.isArray(CONTAS.areas) && CONTAS.areas.length > 0);
  for (const m of MODULOS) assert.equal(typeof m.importar, 'function');
});

test('contas corre também sem site: as suas áreas não ficam por "sem site"', async () => {
  const raiz = novaRaiz({ site: '<sem fonte>' });
  const { auditoria } = await auditarCliente(SLUG, { raiz, modulos: [CONTAS], hoje: HOJE });
  for (const nome of CONTAS.areas) {
    const a = area(auditoria, nome);
    assert.ok(a, `${nome} em falta`);
    assert.doesNotMatch(a.nota ?? '', /sem site/, `${nome} tratada como módulo web`);
  }
});

// ---------------------------------------------------------------------------------------------
// Erros: cada erro lança e não grava nada (nem auditoria, nem dossier)
// ---------------------------------------------------------------------------------------------

async function lancaSemGravar(raiz, slug, opts = {}, msg = '') {
  const antes = fotografia(raiz);
  const chamadas = [];
  const modulos = opts.modulos ?? [modulo('seo', verificado('seo'), chamadas)];
  await assert.rejects(auditarCliente(slug, { raiz, modulos, hoje: HOJE }), msg);
  assert.deepEqual(fotografia(raiz), antes, `${msg}: ficou alguma coisa gravada`);
  return chamadas;
}

test('slug "../x" lança e não grava nada — mesmo com um dossier válido em <raiz>/x', async () => {
  const raiz = novaRaiz();
  mkdirSync(join(raiz, 'x'));
  writeFileSync(join(raiz, 'x', 'dossier.md'), dossier({ slug: 'x' }));
  const chamadas = await lancaSemGravar(raiz, '../x', {}, '../x');
  assert.equal(chamadas.length, 0, 'correu os módulos para um slug inválido');
  // O slug é recusado como slug, antes de ler o que está fora de clientes/ — não por acaso, pelo
  // dossier que lá encontrou não bater certo.
  await assert.rejects(auditarCliente('../x', { raiz, modulos: [], hoje: HOJE }), (e) => {
    assert.match(e.message, /slug/i);
    assert.doesNotMatch(e.message, /dossier/i, `recusado pelo dossier, não pelo slug: ${e.message}`);
    return true;
  });
});

test('slugs inválidos lançam e não gravam nada', async () => {
  for (const slug of ['', 'Padaria-Teste', 'a/b', '..', 'x y', undefined]) {
    await lancaSemGravar(novaRaiz(), slug, {}, `slug ${JSON.stringify(slug)}`);
  }
});

test('dossier inexistente lança e não grava nada', async () => {
  const raiz = novaRaiz();
  const chamadas = await lancaSemGravar(raiz, 'cliente-que-nao-existe', {}, 'dossier inexistente');
  assert.equal(chamadas.length, 0);
});

test('dossier inválido lança e não grava nada', async () => {
  const semFrontmatter = novaRaiz({ texto: '# só um título, sem frontmatter\n' });
  assert.equal((await lancaSemGravar(semFrontmatter, SLUG, {}, 'dossier sem frontmatter')).length, 0);
  // Dossier inválido não chega a correr módulos (seriam pedidos à rede para uma auditoria que não se grava).
  const slugTrocado = novaRaiz({ texto: dossier({ slug: 'outro-cliente' }) });
  assert.equal((await lancaSemGravar(slugTrocado, SLUG, {}, 'dossier com slug de outro cliente')).length, 0, 'correu os módulos com o dossier inválido');
  const siteInvalido = novaRaiz({ site: 'ftp://padaria.invalid' });
  assert.equal((await lancaSemGravar(siteInvalido, SLUG, {}, 'dossier com site inválido')).length, 0, 'correu os módulos com o dossier inválido');
});

test('auditoria que sai inválida (duas vezes a mesma área) lança e não grava nada', async () => {
  const raiz = novaRaiz();
  const modulos = [modulo('seo', verificado('seo')), modulo('seo', verificado('seo'))];
  await lancaSemGravar(raiz, SLUG, { modulos }, 'área repetida entre módulos');
});

// ---------------------------------------------------------------------------------------------
// CLI: node scripts/auditoria/correr.mjs <slug> [raiz]
// ---------------------------------------------------------------------------------------------

const correrCli = (...args) => spawnSync(process.execPath, [CORRER, ...args], { encoding: 'utf8' });

test('CLI: slug inexistente sai com 1, mostra ✗ e não grava nada', () => {
  const raiz = novaRaiz();
  const antes = fotografia(raiz);
  const r = correrCli('cliente-que-nao-existe', raiz);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /✗/);
  assert.deepEqual(fotografia(raiz), antes);
});

test('CLI: slug "../x" sai com 1 e ✗', () => {
  const raiz = novaRaiz();
  mkdirSync(join(raiz, 'x'));
  writeFileSync(join(raiz, 'x', 'dossier.md'), dossier({ slug: 'x' }));
  const antes = fotografia(raiz);
  const r = correrCli('../x', raiz);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /✗/);
  assert.deepEqual(fotografia(raiz), antes);
});

test('CLI: sem argumentos sai com código ≠ 0', () => {
  const r = correrCli();
  assert.notEqual(r.status, 0);
});

// Caso feliz sem rede: com `site: <sem fonte>` nenhum módulo web é chamado e o de contas não chama a
// rede (o dossier de teste não tem property ID do GA4).
test('CLI: caso feliz (site <sem fonte>) sai com 0, imprime o resumo e grava auditoria válida', () => {
  const raiz = novaRaiz({ site: '<sem fonte>' });
  const r = correrCli(SLUG, raiz);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.trim().length > 0, 'não imprimiu o resumo');
  assert.doesNotMatch(r.stdout + r.stderr, /✗/);
  const ficheiros = readdirSync(pastaAuditorias(raiz));
  assert.equal(ficheiros.length, 1);
  const nome = ficheiros[0].replace(/\.json$/, '');
  assert.deepEqual(validarFicheiroAuditoria(readFileSync(join(pastaAuditorias(raiz), ficheiros[0]), 'utf8'), SLUG, nome), []);
  const v = spawnSync(process.execPath, [VALIDAR, 'clientes'], { cwd: raiz, encoding: 'utf8' });
  assert.equal(v.status, 0, v.stderr);
});
