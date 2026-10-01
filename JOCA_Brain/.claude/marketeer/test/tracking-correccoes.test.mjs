// Correcções pedidas depois da suite de aceitação do #7: a checklist distingue os quatro estados
// com marcas diferentes e tem legenda.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliar, checklist, checklistMarkdown, LEGENDA } from '../scripts/tracking/checklist.mjs';

const linha = (md, item) => md.split('\n').find((l) => l.includes(item));

test('checklist: ✓ API · ✗ falha · ☐ manual do GA4 · ? não confirmado, com legenda', async () => {
  const lidos = avaliar({
    conta: [{ customer: { id: '1', autoTaggingEnabled: false } }],
    conversoes: [],
    objectivos: [{ campaign: { name: 'C', status: 'PAUSED' }, campaignConversionGoal: { category: 'SUBMIT_LEAD_FORM', origin: 'WEBSITE', biddable: true } }],
  });
  const { itens: manuais } = await checklist('x', { raiz: '/nao/existe' });
  const md = checklistMarkdown({ itens: [...lidos, ...manuais.filter((x) => x.estado === 'manual')], conta: '1' });
  assert.ok(md.includes(LEGENDA));
  assert.match(LEGENDA, /✓ confirmado pela API.*✗ falha confirmada.*☐ manual \(verificar no GA4\).*\? a API não conseguiu confirmar/);
  assert.match(linha(md, 'Objectivos de conversão'), /^\| ✓ \|/);
  assert.match(linha(md, 'Etiquetagem automática'), /^\| ✗ \|/);
  assert.match(linha(md, 'Conversões importadas do GA4'), /^\| \? \|/);
  assert.match(linha(md, 'Retenção de dados do GA4'), /^\| ☐ \|/);
});

test('checklist: sem acesso à API, os itens que se leriam dela ficam "?" e os do GA4 "☐"', async () => {
  const r = await checklist('x', { raiz: '/nao/existe' });
  const md = checklistMarkdown(r);
  assert.match(linha(md, 'Etiquetagem automática'), /^\| \? \|/);
  assert.match(linha(md, 'Objectivos de conversão'), /^\| \? \|/);
  assert.match(linha(md, 'Tráfego interno'), /^\| ☐ \|/);
});

// ── prova: formulário (servidor local, sem rede externa) ────────────────────────────────────────
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';

// Assíncrono: o servidor de teste corre neste processo (um spawnSync prendia-o).
const correr = (args) => new Promise((ok) => execFile(process.execPath, args, { encoding: 'utf8' }, (e, stdout) => ok({ status: e ? e.code : 0, stdout })));
import { fileURLToPath } from 'node:url';
import { provar, comandoDaProva } from '../scripts/tracking/prova.mjs';

const PAGINAS = {
  '/form-get.html': '<!doctype html><html><body><form method="get" action="/recebido"><input name="nome"><button type="submit">Enviar</button></form></body></html>',
  '/sem-form.html': '<!doctype html><html><body><p>Sem formulário.</p></body></html>',
};

async function servidor() {
  const pedidos = [];
  const srv = createServer((req, res) => {
    pedidos.push(`${req.method} ${req.url}`);
    const pag = PAGINAS[req.url.split('?')[0]];
    res.writeHead(pag ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(pag ?? 'não existe');
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  return { base: `http://127.0.0.1:${srv.address().port}`, pedidos, fechar: () => new Promise((ok) => srv.close(ok)) };
}

test('prova D: um <form method="get"> na mesma origem não sai para a rede', { timeout: 120000 }, async () => {
  const s = await servidor();
  try {
    const url = `${s.base}/form-get.html`;
    const r = await provar(url, { formulario: url });
    assert.ok(!r.erro, r.erro);
    assert.deepEqual(s.pedidos.filter((p) => p.includes('/recebido')), [], 'o envio GET chegou ao servidor');
    assert.equal(r.cenarios.filter((c) => c.id.startsWith('D')).length, 2);
  } finally {
    await s.fechar();
  }
});

test('prova D: --abrir e --form errados → linha ✗ com o seletor e saída 1', { timeout: 180000 }, async () => {
  const s = await servidor();
  try {
    const url = `${s.base}/sem-form.html`;
    const script = fileURLToPath(new URL('../scripts/tracking/prova.mjs', import.meta.url));
    const abrir = await correr([script, url, '--formulario', url, '--abrir', '#nao-existe']);
    assert.equal(abrir.status, 1);
    assert.match(abrir.stdout, /✗ D201 .*não abriu o formulário \(#nao-existe\)/);
    const form = await correr([script, url, '--formulario', url, '--form', '#nao-existe']);
    assert.equal(form.status, 1);
    assert.match(form.stdout, /✗ D201 .*nenhum formulário visível \(#nao-existe\)/);
  } finally {
    await s.fechar();
  }
});

test('prova: o comando para reproduzir leva URL, --formulario, --abrir e --form com aspas de shell', () => {
  assert.equal(comandoDaProva('https://x.pt/', { formulario: 'https://x.pt/c', abrir: '[data-a="c"]', form: '[data-cform]', cliente: 'x' }),
    `node "<MKT>/scripts/tracking/prova.mjs" 'https://x.pt/' --formulario 'https://x.pt/c' --abrir '[data-a="c"]' --form '[data-cform]' --cliente 'x'`);
});
