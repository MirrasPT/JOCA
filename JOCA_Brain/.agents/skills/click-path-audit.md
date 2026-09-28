---
name: click-path-audit
description: "Segue cada botão/acção da UI desde o handler até ao estado final e apanha o que a leitura ficheiro a ficheiro não vê: a chamada que desfaz a anterior, handlers mortos, corridas async, closures obsoletas, efeitos que repõem o estado, estados que não voltam. MUST be invoked when the user says: o botão não faz nada, clico e não acontece nada, botão morto, click path, auditar botões, o estado não volta, o modal não abre, depois do refactor os botões deixaram de funcionar. SHOULD also invoke depois de mexer numa store partilhada (Zustand/Redux/context/Livewire) ou antes de release em fluxos críticos. Adaptado de affaan-m/ECC click-path-audit (MIT)."
triggers: click path, click-path, botao nao faz nada, botão não faz nada, clico e nao acontece, clico e não acontece, botao morto, botão morto, handler morto, auditar botoes, auditar botões, estado nao volta, estado não volta, sequential undo, store partilhada, depois do refactor os botoes, dead handler, button does nothing
chain: escrever-testes, tester-ui-ux
---
# click-path-audit — do clique ao estado final

Cada função funciona sozinha; juntas, anulam-se. Esta skill segue **cada** botão, toggle e submit até ao estado final
e compara-o com o que o rótulo promete. Adaptado de affaan-m/ECC `skills/click-path-audit` (MIT).

Caso que a originou: «Novo email» chamava `setComposeMode(true)` e depois `selectThread(null)`. O `selectThread` repunha
`composeMode: false` como efeito lateral. O botão não fazia nada, sem erro, sem crash, com tipos certos.

O gate de runtime (`gate-runtime.mjs --clicar`) prova que o clique **acontece**. Esta skill prova que o **estado final** é o prometido.

## Passo 1 — Mapa das stores (primeiro, sequencial)

Para cada store/contexto no âmbito (Zustand, Redux, context, componente Livewire/Alpine):
```
STORE: emailStore
  setComposeMode(bool)  → define: {composeMode}
  selectThread(t|null)  → define: {selectedThread, messages} REPÕE: {composeMode:false, composeData:null}
REPOSIÇÕES PERIGOSAS (limpam estado que não é delas):
  selectThread → repõe composeMode (dono: setComposeMode)
```
Sem este mapa o bug do exemplo é invisível. Em fan-out, este passo é **fundação**: um agente faz o mapa, os outros recebem-no no brief.

## Passo 2 — Cada ponto de toque

```
PONTO: [rótulo] em [Componente:linha]
  HANDLER: onClick → {
    1. fnA() → define {X: true}
    2. fnB() → define {Y: null} REPÕE {X: false}   ← CONFLITO
  }
  ESPERADO: [o que o rótulo promete]
  REAL: [estado final]
```

Procurar os seis padrões:
1. **Desfazer sequencial** — uma chamada posterior repõe o que a anterior definiu.
2. **Corrida async** — duas promessas escrevem o mesmo campo; o estado final depende de qual chega primeiro.
3. **Closure obsoleta** — o handler lê um valor capturado antigo (`setCount(count + 1)` duas vezes = +1).
4. **Transição em falta** — «Guardar» só valida; «Apagar» liga uma flag e nunca chama a API; «Enviar» aponta a um endpoint removido.
5. **Ramo morto** — a condição que guarda a acção é sempre falsa nesse momento; handler ligado a nada.
6. **Efeito que interfere** — um `useEffect`/watcher/`updated()` observa o campo e repõe-no.

Mais dois, comuns na casa:
- **Estado que não volta** — modal fecha mas `loading`/`erro`/selecção fica; reabrir mostra o estado anterior; «Cancelar» não repõe o formulário.
- **Handler duplo** — o mesmo evento dispara dois handlers (pai e filho, `wire:click` + `@click`) que se anulam.

## Passo 3 — Evidência de runtime

Cada achado confirma-se no browser, não só na leitura:
- Gate: `node .claude/scripts/gate-runtime.mjs --base <url> --rotas <rota> --clicar "<seletor do ponto>"` (erros novos após o clique).
- Estado final: ler o DOM depois do clique (o elemento que devia aparecer existe? o texto mudou?) via `browser-automate` ou Claude in Chrome.
- Regras de evidência: `.claude/reference/gates-runtime.md`. Sem runtime disponível → o achado sai como `não verificado em runtime`.

## Passo 4 — Relatório

```
CLICK-PATH-001 [CRITICAL|HIGH|MEDIUM|LOW]
  Ponto: [rótulo] em [ficheiro:linha]
  Padrão: [um dos 8]
  Traço:
    1. [chamada] → define {campo: valor}
    2. [chamada] → REPÕE {campo: valor}  ← CONFLITO
  Esperado: …
  Real: …  (evidência: comando + resultado)
  Correcção: …
```

## Âmbito

Caro. Escolher o tamanho:
- **Uma página** — depois de construir uma página nova ou de um «o botão não faz nada».
- **Uma store** — depois de mudar uma acção partilhada: auditar todos os consumidores dessa acção.
- **App inteira** — antes de release ou depois de um refactor grande: 1 agente faz o mapa (Passo 1), depois 1 agente por página, em paralelo.

Não serve para: bug de API (forma da resposta, endpoint em falta) → `/debug`; layout e estilo → `tester-ui-ux`; performance → `tester-performance`.

## Próximo passo (chain)
- Cada bug confirmado → `escrever-testes` (um teste que falha antes da correcção), noutra sessão.
- UI alterada na correcção → `tester-ui-ux`.
