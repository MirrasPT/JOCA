# Motion Choreography — varios elementos a mexer ao mesmo tempo

Referencia on-demand. Consumida por `skills/anima.md`. Adaptado de `LottieFiles/motion-design-skill` (MIT).

Uma animacao isolada quase nunca falha. O que falha e o **conjunto**: cinco coisas boas a acontecer
ao mesmo tempo leem-se como ruido. Este ficheiro e sobre o conjunto.

---

## As duas regras de 1/3

**Distancia:** nenhum movimento percorre >1/3 do ecra sem keyframe intermedio. Quebrar com mudanca
de direccao, variacao de velocidade ou ajuste de arco.

**Elementos:** com 3+ elementos animados, no maximo **1/3 activos em simultaneo**. Escalonar para
que o elemento 1 assente quando o 3 comeca.

---

## Direccao partilhada

Todos os elementos entram **da mesma direccao** ou de uma origem partilhada. Direccoes misturadas = caos.

Quando varios elementos reagem a **um** trigger:
- todos arrancam dentro de **50ms** uns dos outros;
- podem **chegar** em alturas diferentes (aterragem escalonada);
- mesma familia de easing; o movimento nasce no ponto do trigger.

---

## Counter-motion (o que da peso)

| Movimento principal | Counter-motion | Racio de velocidade |
|---|---|---|
| Entra pela esquerda | fundo desloca-se para a direita | 20-30% |
| Escala para cima | sombra escala para baixo | 10-20% |
| Roda CW | ambiente deriva CCW | 15-25% |
| Sobe (Y up) | sombra alarga e suaviza | 20-30% |

## Profundidade por velocidade

| Camada | Deslocamento | Velocidade |
|---|---|---|
| Foreground | 1.0x | mais rapida |
| Midground | 0.5x | media |
| Background | 0.2x | mais lenta |

---

## Estrutura de uma sequencia

| Fase | Fatia da duracao | O que acontece |
|---|---|---|
| Setup | 20-30% | elementos entram, cena estabelece-se |
| Accao | 30-40% | movimento principal |
| Resolucao | 30-40% | assentar, reaccoes secundarias |

Deixar **100-200ms de quietude** depois da resolucao antes de comecar movimento novo.

---

## Stagger — padrao e orcamento

| Padrao | Delay entre itens | Orcamento total |
|---|---|---|
| Micro cascade | 20-40ms | <200ms |
| Standard | 50-100ms | <400ms |
| Dramatic | 100-200ms | <600ms |
| Wave | 30-60ms | <500ms |

**O total do stagger tem de ficar <500ms.** 20 itens × 40ms = 800ms → reduzir o passo ou agrupar.

Direccao: cima-para-baixo (listas) · esq-para-dta (horizontais) · centro-para-fora (hero) ·
aleatorio (organico) · invertido (saidas).

- Todos os elementos escalonados usam a **mesma familia de easing**.
- Varia so o tempo de arranque, **nunca a curva**.
- Opcional: o ultimo elemento leva um overshoot ligeiro, como pontuacao.

---

## Dirigir a atencao

| Tecnica | Como |
|---|---|
| Movimento condutor | animar o alvo antes do contexto |
| Movimento de seguimento | assentar no ponto focal |
| Movimento ambiente | continuo subtil na periferia |
| Movimento apontador | direccional em direccao ao CTA |
