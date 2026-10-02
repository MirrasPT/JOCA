---
name: questionario-local
description: "Gera uma página HTML local, aberta no browser, para rondas de teste manual passo-a-passo ou levantamentos de requisitos por itens com opção recomendada pré-marcada — nunca um formulário no chat, nunca um Artifact do claude.ai. MUST be invoked when the user says: ronda de teste, questionário local, testar isto tudo, checklist de teste, banco de provas, levantamento por página. SHOULD also invoke when: fazer um formulário para eu responder, quero rever isto por itens, preciso de testar a app toda, questionário de requisitos. NEVER invoke for a short decision with 1-2 options — that is AskUserQuestion, not this skill."
triggers: ronda de teste, questionário local, banco de provas, checklist de teste, testar isto tudo, levantamento por página, formulário para eu responder, questionário de requisitos, rever por itens
chain: novo-issue, docs/DECISIONS.md
origin: local
---
# Questionário local — ronda de teste / levantamento por página HTML

Gera um ficheiro `.html` autónomo, aberto no browser, com itens marcáveis, contador e resumo
copiável no fim. Substitui o formulário no chat e o Artifact do claude.ai para este tipo de tarefa.

**Anti-trigger explícito:** uma decisão curta de 1-2 opções ("MySQL ou Postgres?", "avanço ou não?")
é `AskUserQuestion`, nunca esta skill — esta skill serve só quando há **vários** itens a marcar de
uma vez (ronda ou levantamento). Usar esta skill para uma pergunta única é o mesmo excesso que
`AskUserQuestion` item-a-item é para uma ronda de 20 passos, ao contrário.

**Porque não no chat / não Artifact:** um item de teste ou de levantamento não é uma pergunta
rápida — é trabalho que se faz ao lado, marca-se à medida que se avança, e fica pendurado no
terminal se for `AskUserQuestion` item a item (rejeitado ao vivo, ver memória
`rondas-de-teste-em-formulario-no-chat`). Artifact é opt-in, nunca o default para este tipo de
output (`soul.md` Hard Limits + memória `artefactos-sempre-locais-nunca-claude-ai`).

---

## Os dois usos

| Uso | Item = | Estados | Recomendado por omissão? |
|---|---|---|---|
| **Ronda de teste** | um passo/percurso a validar na app | Pendente → OK → Falha → Parcial (ciclo por clique) | não — parte-se de Pendente |
| **Levantamento de requisitos** | uma pergunta com opções | Nenhuma → uma opção seleccionada · "Outra" com texto livre | sim — a 1ª opção vem pré-marcada como recomendada |

Ordem no levantamento: **âmbito/funcionalidades antes de stack/detalhe técnico** — perguntar a
stack antes de o âmbito estar fechado obriga a reverter a decisão mais tarde (incidente medido,
projecto interno, 2026-09-05: resposta de stack teve de ser desfeita após 3 emendas ao âmbito).

---

## Passo 1 — Reunir a spec (zero perguntas extra se o pedido já as tem)

Lista de secções, cada uma com os seus itens. Deriva da conversa ou do pedido — não abras
`AskUserQuestion` para montar a spec se o pedido já descreve os itens (isso é o próprio anti-padrão
que esta skill evita). Só perguntas se faltar mesmo informação para saber o que testar/levantar.

```
secção: "Percurso de login" (ronda de teste)
  item: "Criar conta com email novo"
  item: "Recuperar password"

secção: "Base de dados" (levantamento)
  pergunta: "Motor de BD", id: "motor-bd"
  opções: ["MySQL (recomendado)", "PostgreSQL", "SQLite", "Outra"]
```

## Passo 2 — Escrever o HTML (`Write`, template abaixo)

`test -f <destino>` antes — **escrever por cima de um ficheiro existente é irreversível**; se
existir, `<nome>-v2.html`. Destino por omissão: `docs/questionario/<slug>.html` dentro do projecto
(não no scratchpad — não sobrevive ao `/save`).

Mecanismo medido no template gémeo `.claude/reference/start/design-direcoes.html` (usado pelo
`/start` Fase 5.2): cada item é um `<div role="radio">`/`.item` clicável; um botão **"Gerar
resumo"** lê o estado de todos os itens e escreve um bloco `=== ... === FIM ===` numa `<textarea>`;
um botão **"Copiar"** usa `navigator.clipboard.writeText` com fallback `execCommand("copy")`. O
template abaixo tem os dois blocos de item (ronda + levantamento) e o script único que trata ambos
— repete o bloco que precisares por secção, o script serve para a página toda sem alteração.

```html
<!doctype html><meta charset="utf-8">
<title>{{TITULO}}</title>
<style>
  body{font:15px/1.5 -apple-system,system-ui,sans-serif;max-width:52rem;margin:0 auto;padding:2rem 1rem 7rem;color:#17181c}
  h1{font-size:1.5rem} h2{font-size:1.05rem;margin-top:2rem;border-bottom:1px solid #e3e4e8;padding-bottom:.4rem}
  .pergunta{color:#4b4e57;margin:.2rem 0 .6rem}
  .item{border:1px solid #e3e4e8;border-radius:8px;padding:.7rem 1rem;margin:.5rem 0;cursor:pointer;display:flex;justify-content:space-between;gap:1rem}
  .item[data-estado="ok"]{border-color:#2e7d5b;background:#eefaf3}
  .item[data-estado="falha"]{border-color:#c0392b;background:#fdecea}
  .item[data-estado="parcial"]{border-color:#d97706;background:#fef6e6}
  .item .estado{font-weight:600;font-size:.8rem;white-space:nowrap}
  .grupo{display:flex;flex-direction:column;gap:.5rem;margin:.5rem 0 1.2rem}
  .opcao{border:1px solid #e3e4e8;border-radius:8px;padding:.6rem .9rem;cursor:pointer;display:flex;align-items:center;gap:.6rem}
  .opcao[aria-checked="true"]{border-color:#3556c9;background:#e9edfb}
  .tag-rec{font-size:.7rem;color:#3556c9;font-weight:600;margin-left:auto;white-space:nowrap}
  .outra-texto{border:1px solid #ccc;border-radius:4px;padding:.25rem .5rem;font:inherit;flex:1;min-width:8rem}
  textarea{width:100%;min-height:12rem;font-family:monospace;font-size:.8rem}
  .bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e3e4e8;padding:.8rem 1rem;display:flex;gap:1rem;align-items:center}
  button{padding:.5rem 1rem;border-radius:6px;border:1px solid #ccc;cursor:pointer}
</style>
<h1>{{TITULO}}</h1>
<p id="contador">0/0 respondidos</p>

<!-- BLOCO A — item de RONDA DE TESTE (repetir por item; ciclo de 4 estados) -->
<h2>{{SECCAO}}</h2>
<div class="item" data-tipo="check" data-id="{{ID}}" data-estado="pendente">
  <span>{{TEXTO_ITEM}}</span><span class="estado">PENDENTE</span>
</div>
<!-- FIM BLOCO A -->

<!-- BLOCO B — grupo de LEVANTAMENTO (repetir por pergunta; 1ª opção nasce pré-marcada = recomendada) -->
<h2>{{SECCAO}}</h2>
<p class="pergunta">{{PERGUNTA}}</p>
<div class="grupo" role="radiogroup" aria-label="{{PERGUNTA}}" data-id="{{ID}}" data-recomendado="{{VALOR_1}}">
  <div class="opcao" role="radio" aria-checked="true" tabindex="0" data-v="{{VALOR_1}}">
    <span>{{TEXTO_1}}</span><span class="tag-rec">recomendado</span></div>
  <div class="opcao" role="radio" aria-checked="false" tabindex="0" data-v="{{VALOR_2}}">
    <span>{{TEXTO_2}}</span></div>
  <div class="opcao" role="radio" aria-checked="false" tabindex="0" data-v="Outra">
    <span>Outra:</span><input type="text" class="outra-texto" placeholder="especificar"></div>
</div>
<!-- FIM BLOCO B -->

<div class="bar">
  <span id="resumo-status"></span>
  <button id="gerar">Gerar resumo</button>
</div>
<div id="out" style="display:none;margin-top:1rem">
  <textarea id="outtext" readonly></textarea>
  <button id="copiar">Copiar</button> <span id="copiado" hidden>Copiado.</span>
</div>
<script>
(function(){
  var CICLO={pendente:"ok",ok:"falha",falha:"parcial",parcial:"pendente"};
  var ROTULO={pendente:"PENDENTE",ok:"OK",falha:"FALHA",parcial:"PARCIAL"};
  var itensCheck=[].slice.call(document.querySelectorAll('.item[data-tipo="check"]'));
  var gruposRadio=[].slice.call(document.querySelectorAll('[role="radiogroup"]'));

  function contar(){
    var feitosCheck=itensCheck.filter(function(i){return i.dataset.estado!=="pendente";}).length;
    var feitosRadio=gruposRadio.filter(function(g){return g.querySelector('.opcao[aria-checked="true"]');}).length;
    var total=itensCheck.length+gruposRadio.length;
    document.getElementById("contador").textContent=(feitosCheck+feitosRadio)+"/"+total+" respondidos";
  }

  itensCheck.forEach(function(it){
    it.addEventListener("click",function(){
      var novo=CICLO[it.dataset.estado];
      it.dataset.estado=novo;
      it.querySelector(".estado").textContent=ROTULO[novo];
      contar();
    });
  });

  gruposRadio.forEach(function(grp){
    var opcoes=[].slice.call(grp.querySelectorAll(".opcao"));
    function escolher(op){
      opcoes.forEach(function(o){o.setAttribute("aria-checked","false");});
      op.setAttribute("aria-checked","true");
      contar();
    }
    opcoes.forEach(function(op){
      op.addEventListener("click",function(e){
        if(e.target.classList.contains("outra-texto"))return;
        escolher(op);
      });
      op.addEventListener("keydown",function(e){
        if(e.key===" "||e.key==="Enter"){e.preventDefault();escolher(op);}
      });
    });
  });

  function valorGrupo(grp){
    var sel=grp.querySelector('.opcao[aria-checked="true"]');
    if(!sel)return null;
    if(sel.dataset.v==="Outra"){
      var inp=sel.querySelector(".outra-texto");
      return "Outra: "+((inp&&inp.value.trim())?inp.value.trim():"(vazio)");
    }
    return sel.dataset.v;
  }

  document.getElementById("gerar").addEventListener("click",function(){
    var linhas=["=== {{TITULO}} ==="];
    itensCheck.forEach(function(it){
      // Ronda de teste: só o estado. `<<< ALTERADO` é exclusivo do levantamento (difere da recomendada).
      linhas.push(it.dataset.id+": "+ROTULO[it.dataset.estado]);
    });
    gruposRadio.forEach(function(grp){
      var v=valorGrupo(grp), rec=grp.dataset.recomendado;
      var alt=(v&&rec&&v!==rec)?" <<< ALTERADO":"";
      linhas.push(grp.dataset.id+": "+(v||"(sem resposta)")+alt);
    });
    linhas.push("=== FIM ===");
    document.getElementById("outtext").value=linhas.join("\n");
    document.getElementById("out").style.display="block";
  });

  document.getElementById("copiar").addEventListener("click",function(){
    var ta=document.getElementById("outtext");ta.select();
    function ok(){var m=document.getElementById("copiado");m.hidden=false;setTimeout(function(){m.hidden=true;},2000);}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(ta.value).then(ok,function(){document.execCommand("copy");ok();});}
    else{document.execCommand("copy");ok();}
  });
  contar();
})();
</script>
```

Como nasce o "recomendado": a opção que representa a recomendação é a que traz `aria-checked="true"`
e a `<span class="tag-rec">recomendado</span>` no HTML **antes** de qualquer clique — o estado inicial
é dados no markup, não calculado por JS. O grupo guarda o mesmo valor em `data-recomendado` no
`role="radiogroup"`. No "Gerar resumo", `valorGrupo()` lê a opção seleccionada NO MOMENTO (que pode
continuar a ser a recomendada, ou ter mudado por clique do utilizador) e compara com
`data-recomendado`: diferentes → `<<< ALTERADO` no resumo, igual → sem marca. "Outra" com texto
livre conta sempre como alterado, salvo se `data-recomendado="Outra"` (caso raro).

## Passo 3 — Guardar, abrir, e como a resposta volta à sessão

```bash
open docs/questionario/<slug>.html
```

O utilizador marca os itens no browser (fica ao lado, sem bloquear o terminal), carrega em **Gerar
resumo**, depois **Copiar**, e cola o bloco de volta no chat. É texto simples entre `=== ... ===` e
`=== FIM ===` — não há ficheiro JSON a descarregar nem upload: a sessão continua pelo que ele colar.
Interpreta o bloco linha a linha (`id: VALOR [<<< ALTERADO]`).

## Gotchas medidos

- HTML local verifica-se **sem** `--allow-file-access-from-files`, ou entrega-se auto-contido
  (imagens em base64) — verificado com a flag, um HTML com caminhos relativos saiu sem imagens no
  browser do utilizador (`html-review.md`, 2026-08-27).
- `test -f` antes de escrever — mockup/questionário já aprovado não se sobrescreve; nome irmão
  versionado (`preparar-design.md`).
- **Comando de terminal num banco de provas leva sempre `cd <caminho absoluto> &&` no bloco a
  colar.** «Correr `npm run regua` dentro da pasta do projecto» sem o `cd` no comando literal fez o
  dono corrê-lo na HOME, e falhou com `ENOENT` (projecto interno, 2026-09-22).
- Item marcado `FALHA` numa ronda de teste **abre issue na hora**, mesmo sem corrigir agora
  (doutrina de projecto, `rules/pipelines.md`) — ver chain abaixo.

## Não fazer

- Não usar esta skill para uma decisão curta de 1-2 opções — isso é `AskUserQuestion`, nunca uma
  página HTML.
- Não gerar `AskUserQuestion` item a item para o mesmo conjunto de perguntas que esta página cobre.
- Não publicar como `Artifact` sem pedido explícito.
- Não perguntar stack/detalhe técnico antes do âmbito estar fechado, num levantamento.

## Próximo passo (chain)

- Ronda de teste com itens em `FALHA` → `novo-issue` por cada um.
- Levantamento com respostas `<<< ALTERADO` face ao recomendado, sobre uma decisão técnica → 1
  entrada em `docs/DECISIONS.md` (acção directa — registar a decisão final e o porquê, não um
  segundo skill/agente).
