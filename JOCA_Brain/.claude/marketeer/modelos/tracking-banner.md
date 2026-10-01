# Banner de cookies e Consent Mode v2 — guia e modelos

> Modelo do marketeer (medição planeada na F2 e provada no gate da F4 do `/marketeer <marca>`), tirado do que está em produção num site
> de cliente (setembro de 2026) e provado com `tracking/prova.mjs`. **Aplica-se no repo do site do cliente**, por
> quem o mantém — o marketeer não escreve nesses repos. Adaptar os nomes (`st_`/`ck`) ao site;
> manter as regras. Texto visível ao visitante em PT-PT e com **revisão jurídica obrigatória**.

## Regras (não negociáveis)

1. **Default denied antes do GTM.** O `gtag('consent','default',…)` vai **inline no `<head>`, antes
   do snippet do GTM**. Se estiver depois (ou num ficheiro `defer`), o GTM lê o dataLayer sem ele.
2. **Todas as tags do contentor exigem consentimento** (o `tracking/gtm.mjs` gera-as assim): o GTM pode
   carregar sempre, mas nada grava cookies nem envia hits até haver «Aceitar».
3. **Recusar com o mesmo peso que Aceitar** — mesma classe CSS, mesmo tamanho, cor e posição, lado a
   lado. «Personalizar» pode ser secundário.
4. **Sem «fechar sem escolher»**: sem escolha nada se guarda e nada é concedido; o banner volta.
5. **Revogação no rodapé de todas as páginas** («Preferências de cookies») que reabre o banner; ao
   retirar uma categoria, apagam-se os cookies dela **também com `domain=`** (o GA e o Ads gravam no
   domínio de topo e só morrem com o mesmo `domain=`).
6. **Versão da escolha**: sobe-se sempre que as categorias ou as ferramentas mudam — a escolha antiga
   deixa de valer e o banner volta a perguntar.
7. **Sem cookie-wall**: com tudo recusado o site funciona igual (formulários incluídos).
8. Acessível: `role="dialog"`, título e texto ligados por `aria-labelledby`/`aria-describedby`,
   alcançável por Tab, Escape fecha quando foi reaberto pelo rodapé e o foco volta ao link.

Variante aceite (usada em produção noutro site): só injectar o GTM **depois** do consentimento. Também passa a prova;
exige um evento de revogação no contentor. O padrão da casa é o de cima (GTM sempre, tags com
consentimento) porque não depende de código a carregar scripts.

## 1. Consentimento inline (no `<head>`, antes do GTM)

```html
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){ window.dataLayer.push(arguments); }
(function () {
  'use strict';
  var VERSAO = '1';            // subir quando as categorias/ferramentas mudarem
  var CHAVE = 'cookies_escolha';

  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', wait_for_update: 500
  });

  function ler() {
    try {
      var e = JSON.parse(localStorage.getItem(CHAVE));
      if (e && e.versao === VERSAO && typeof e.estatistica === 'boolean' && typeof e.marketing === 'boolean') return e;
    } catch (x) {}
    return null;
  }
  function sinais(e) {
    var ads = e.marketing ? 'granted' : 'denied';
    return { analytics_storage: e.estatistica ? 'granted' : 'denied', ad_storage: ads, ad_user_data: ads, ad_personalization: ads };
  }
  // Apaga por prefixo sem domain e em cada nível do host (ex.: .cliente.pt).
  function apagar(re) {
    var expira = 'expires=Thu, 01 Jan 1970 00:00:00 GMT', partes = location.hostname.split('.'), doms = [];
    for (var i = 0; i < partes.length - 1; i++) doms.push(partes.slice(i).join('.'));
    document.cookie.split(';').forEach(function (c) {
      var nome = c.split('=')[0].trim();
      if (!re.test(nome)) return;
      document.cookie = nome + '=; ' + expira + '; path=/';
      doms.forEach(function (d) {
        document.cookie = nome + '=; ' + expira + '; path=/; domain=' + d;
        document.cookie = nome + '=; ' + expira + '; path=/; domain=.' + d;
      });
    });
  }
  function guardar(estatistica, marketing) {
    var e = { estatistica: !!estatistica, marketing: !!marketing, versao: VERSAO, em: new Date().toISOString() };
    try { localStorage.setItem(CHAVE, JSON.stringify(e)); } catch (x) {}
    gtag('consent', 'update', sinais(e));
    if (!e.estatistica) apagar(/^_ga/);
    if (!e.marketing) apagar(/^_gcl/);
    return e;
  }
  // Evento do contrato do dataLayer; `depois` corre quando o GTM o processou (máx. 1 s).
  function evento(nome, props, depois) {
    var d = { event: nome };
    for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) d[k] = props[k];
    if (typeof depois === 'function') {
      var feito = false, uma = function () { if (!feito) { feito = true; depois(); } };
      d.eventCallback = uma; d.eventTimeout = 1000; setTimeout(uma, 1000);
    }
    window.dataLayer.push(d);
  }

  var escolha = ler();
  if (escolha) gtag('consent', 'update', sinais(escolha));

  // clique_telefone: número da EMPRESA, só algarismos, sem o 351.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href^="tel:"]');
    if (a) evento('clique_telefone', { numero: a.getAttribute('href').replace(/\D/g, '').replace(/^351(?=\d{9}$)/, '') });
  });

  window.Consentimento = { ler: ler, guardar: guardar, evento: evento };
})();
</script>
<!-- a seguir: o snippet do GTM (GTM-…) -->
```

## 2. Banner (HTML)

```html
<div class="ck" data-cookies hidden role="dialog" aria-modal="false" aria-labelledby="ck-titulo" aria-describedby="ck-texto">
  <h2 id="ck-titulo">Cookies neste site</h2>
  <p id="ck-texto">Com a sua autorização, usamos cookies de estatística (Google Analytics) para perceber
    como o site é usado e de marketing (Google Ads) para medir as nossas campanhas. Se recusar, nada
    disto é ativado e o site funciona igual. Pode mudar a escolha a qualquer momento em «Preferências
    de cookies», no rodapé. <a href="/politica-de-privacidade#cookies">Política de Privacidade</a></p>
  <div data-cookies-painel hidden>
    <label><input type="checkbox" checked disabled> <strong>Necessários</strong> — sempre ativos.</label>
    <label><input type="checkbox" data-cookies-cat="estatistica"> <strong>Estatística</strong> — Google Analytics.</label>
    <label><input type="checkbox" data-cookies-cat="marketing"> <strong>Marketing</strong> — Google Ads.</label>
  </div>
  <!-- Recusar e Aceitar: A MESMA classe (mesmo peso visual) -->
  <button type="button" class="ck__btn" data-cookies-accao="recusar">Recusar</button>
  <button type="button" class="ck__btn" data-cookies-accao="aceitar">Aceitar todos</button>
  <button type="button" class="ck__btn ck__btn--sec" data-cookies-accao="personalizar" aria-expanded="false">Personalizar</button>
  <button type="button" class="ck__btn ck__btn--sec" data-cookies-accao="guardar" hidden>Guardar escolha</button>
</div>

<!-- Rodapé de TODAS as páginas -->
<a href="/politica-de-privacidade#cookies" data-cookies-abrir>Preferências de cookies</a>
```

## 3. Banner (comportamento)

```js
(function () {
  var el = document.querySelector('[data-cookies]'), api = window.Consentimento;
  if (!el || !api) return;
  var painel = el.querySelector('[data-cookies-painel]'), guardarBtn = el.querySelector('[data-cookies-accao="guardar"]');
  var est = el.querySelector('[data-cookies-cat="estatistica"]'), mkt = el.querySelector('[data-cookies-cat="marketing"]');
  var reaberto = false, voltar = null;
  function abrir(pedido) {
    var e = api.ler(); est.checked = !!(e && e.estatistica); mkt.checked = !!(e && e.marketing);
    painel.hidden = true; guardarBtn.hidden = true; reaberto = !!pedido; el.hidden = false;
    if (pedido) el.querySelector('.ck__btn').focus();
  }
  function fechar() { el.hidden = true; reaberto = false; if (voltar) { voltar.focus(); voltar = null; } }
  el.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-cookies-accao]'); if (!b) return;
    var a = b.getAttribute('data-cookies-accao');
    if (a === 'aceitar') { api.guardar(true, true); fechar(); }
    else if (a === 'recusar') { api.guardar(false, false); fechar(); }
    else if (a === 'guardar') { api.guardar(est.checked, mkt.checked); fechar(); }
    else if (a === 'personalizar') { painel.hidden = false; guardarBtn.hidden = false; b.setAttribute('aria-expanded', 'true'); est.focus(); }
  });
  el.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && reaberto) fechar(); });
  document.addEventListener('click', function (ev) {
    var l = ev.target.closest('[data-cookies-abrir]'); if (!l) return;
    ev.preventDefault(); voltar = l; abrir(true);
  });
  if (!api.ler()) abrir(false);
})();
```

## 4. Evento de lead (no código do formulário)

```js
// SÓ no 2xx do envio. 4xx/5xx/erro de rede → nenhum evento. Só o nome do formulário, nunca dados
// do visitante nem o id que o servidor devolve.
fetch(endpoint, { method: 'POST', body }).then(function (res) {
  if (res.ok) window.Consentimento.evento('generate_lead', { formulario: 'contacto' }, irParaObrigado);
  else mostrarErro();
});
```

## 5. Prova (antes de publicar o GTM)

```bash
node "<MKT>/scripts/tracking/prova.mjs" https://<site>/ --cliente <slug> \
  --formulario https://<site>/<página> [--abrir '<seletor que abre o modal>'] [--form '<seletor do formulário>']
```
Tem de dar: 0 pedidos a GA/doubleclick/googleadservices sem interacção e depois de Recusar; GA4 e
Ads depois de Aceitar; 1 evento de lead com o envio respondido 201 e 0 com 422. O envio é sempre
interceptado — nunca se cria um lead real.
