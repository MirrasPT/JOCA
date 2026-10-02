---
name: electron-teste-ao-vivo
description: "Conduz uma sessão de teste ao vivo de uma app Electron com o dono a olhar para a janela real, cruzando o que ele relata com o log do processo — sem matar a app dele a meio. MUST be invoked when the user says: testar a app ao vivo, sessão de testes com o dono, corre a app e eu testo, ver isto na janela real, gate de runtime do Electron, banco de provas. SHOULD also invoke when: gate ficou verde mas o dono viu um defeito, curl diz que funciona mas a janela não, a app fechou-se a meio do teste, quero ver o processo a reagir em tempo real, o dono ainda tem a app aberta."
triggers: testar app electron ao vivo, sessão de testes com o dono, gate de runtime electron, janela real vs curl verde, dono fechou a app a meio, app do dono está aberta, node-pty spawn-helper sem permissão, app.exit vs app.quit, gate que mata a app do dono
origin: local
chain: novo-issue
---

# Electron — teste ao vivo com o dono

Método para sessões em que **o dono usa a app real** enquanto tu observas o processo por baixo. Não substitui os gates automáticos (doutrina geral em `.claude/reference/gates-runtime.md`) — cobre o que só aparece com o dono a olhar para a janela: sete defeitos apanhados numa sessão destas tinham todos os gates verdes.

## Antes de arrancar

1. **Não montes outro processo se já houver um vivo.** `pgrep -f "<nome-do-app>"` antes de qualquer `npm run dev`/arranque — se o dono já tem a app aberta, é essa que se usa, não uma segunda instância.
2. **Log para ficheiro, fora de qualquer pasta com hot-reload.** Escrever dentro de `desktop/electron/**` (ou equivalente vigiado pelo watcher) reinicia a app sozinha a meio da sessão — regra medida: enquanto o dono testa, nenhum agente escreve nessa zona.
3. **Nunca assumir que o dono sabe reabrir a app.** Dar o comando exacto ou dizer em que ícone clicar antes de a fechar ou reiniciar.

## Durante a sessão

- **Cruzar o timestamp do relato do dono com o timestamp do registo.** É o que distingue "não fez nada" de "fez, mas 18 s depois de ele desistir de olhar" ou "recusou três vezes em silêncio" — sem essa comparação o diagnóstico é uma hipótese, não uma medição.
- **`curl`/200 ao núcleo não prova que a janela funciona.** `curl` não tem `Origin`; a página tem. Testar a chamada a partir da própria janela (DevTools do Electron — inferido, não medido), não uma chamada à parte.
- **O gate de runtime do Electron corre em dev (`http://localhost:<porta>`), nunca sobre o build (`file://`).** Em `file://` o Electron não exige CORS — um gate escrito para apanhar um erro de CORS passa sempre a verde ali, mesmo com o defeito por resolver.

## O erro que já aconteceu: gate que mata a app que se acabou de proibir matar

Um brief que diz "nunca mates a app do dono" e três linhas depois manda correr um gate que mata a árvore de processos por desenho é uma contradição — e ganha o comando executável, não a frase. Antes de meter qualquer gate/script no brief: **saber o que ele mata ou reinicia**. Se colidir com a sessão do dono, ou o gate sai do brief, ou entra com o passo de confirmar antes de correr. Confirmar o estado do processo **por efeito** (`pgrep`, o próprio log, ficheiro de estado) — nunca pela linha do relatório de um agente, que pode dizer "não estava a correr" depois de o ter matado.

## Gotchas medidos (Electron + node-pty)

| Sintoma | Causa | Fix |
|---|---|---|
| `pty.spawn()` rebenta com `posix_spawnp failed` (não diz que é permissão) | `spawn-helper` do `node-pty` chega do npm sem bit de execução | `postinstall` que corrige o bit |
| processo filho fica órfão ao fechar a app | `app.exit()` salta o `before-quit` | usar `app.quit()` |
| gate "verde" mas o dono vê o defeito na hora | o gate mede uma palavra/estado que a UI deixou de pintar — passa por sorte com a janela numa certa posição | um gate que nunca falhou é um gate por testar: parti-lo de propósito antes de confiar |

## O dono assina o gate

Quem escreve o código não assina o gate de runtime — só o dono, a olhar para a janela, decide se passou. Reportar "está a funcionar" sem essa sessão é a mesma falha de um agente a assinar o próprio trabalho.

Se a sessão trouxer vários itens a marcar (limiar é juízo, não medido), entregar como **página HTML local aberta no browser**, nunca formulário no chat — um item de teste é uma sessão de trabalho, não uma pergunta rápida. Cada defeito encontrado abre issue na hora (`chain: novo-issue`), mesmo que não se corrija já.
