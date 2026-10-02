# Motion Patterns — receitas de estado de UI

Referencia on-demand, ligada de `skills/anima.md`. Ler quando a tarefa pede feedback de estado:
clique, hover, erro, loading, sucesso, disabled. Adaptado de `LottieFiles/motion-design-skill` (MIT,
© 2025 LottieFiles): `patterns/state-feedback.md`, `LottieFiles/motion-design-skill:reference/property-selection.md`,
`LottieFiles/motion-design-skill:reference/timing-easing-tables.md` (repo de terceiros, não nesta árvore).

Os numeros sao ponto de partida dentro do arquetipo do projecto (`anima.md`), nao substituem o arquetipo.
Movimento "ambiente" (respirar, flutuar, pulsar em repouso) **nao entra aqui**: se nao orienta, confirma
ou narra, nao se anima. Reduced-motion: substituir, nunca apagar (`anima.md` §prefers-reduced-motion).

---

## Conteúdo

- Receitas
- Propriedade certa por objectivo
- Ressalto final (overshoot) por contexto
- Curva por direccao

## Receitas

**Clique em botao** (por arquetipo)
- Playful: 0.95 (60ms, ease-out) → 1.05 (80ms) → 1.0 (120ms, mola). Total ~260ms
- Premium: 0.98 (80ms) → 1.0 (150ms, sem overshoot); opacidade a 90% no press. Total ~230ms
- Corporate: 0.97 (60ms) → 1.0 (100ms), overshoot 0-2%; fundo −10%. Total ~160ms

**Hover** — entra **<100ms**, sai **150-200ms** (sair mais devagar le-se como polido)

| Elemento | Efeito |
|---|---|
| Botao | escala 1.02-1.05 |
| Card | escala 1.01-1.02 + sombra |
| Link | cor + sublinhado |
| Icone | escala 1.1 + rotacao 2-5° |
| Imagem | escala 1.03 com `overflow: hidden`, 150ms |

**Abanar de erro** — horizontal ±10-15px, 2-3 ciclos com amplitude decrescente, ease-in-out,
300-400ms no total, **sem overshoot**, assenta na origem. Tinta vermelha em simultaneo.

**Erro de formulario (submit)** — em sequencia:
1. botao volta ao normal (200ms)
2. mensagem de erro entra (250ms)
3. campos afectados a vermelho (150ms, stagger 30ms)
4. scroll suave ate ao 1.º erro (300ms, ease-in-out)

**Validacao inline** — texto de erro desce + aparece (200ms) · borda a vermelho (150ms) · icone entra
em escala (150ms, +50ms). Abanar opcional, 1 so (200ms).

**Spinner** — 360° continuo, **linear**, 1000-1500ms por volta.
**Skeleton** — varrimento esquerda→direita, 1500-2000ms; base 10-20% de opacidade, pico 30-40%.
**Indeterminado** — posicao/largura a oscilar, 1500-2500ms, ease-in-out; continuo, nunca frenetico.
**Barra de progresso** — `transform` (ou largura), ease-in-out.

**Sucesso (check)**
1. contentor 0.9→1.0 (200ms, ease-out-back, overshoot 5-10%)
2. traco do check desenha-se (150ms, ease-out, +100ms)
3. cor para verde (200ms)
Total 400-500ms.

**Toggle / switch** — polegar desliza 120-180ms ease-in-out; cor da pista muda em simultaneo.
Playful pode ressaltar no destino; Premium sem overshoot.

**Desactivar / activar** — opacidade para 50-60% (200ms), escala opcional 98%; volta a 100% (200ms).

**Foco** — anel 95%→100% + opacidade (150ms); navegacao por teclado <100ms e tem de funcionar com
reduced-motion.

---

## Propriedade certa por objectivo

| Objectivo | Principal | Secundaria | Evitar |
|---|---|---|---|
| Entrada | posicao | opacidade | rotacao |
| Saida | posicao | opacidade | crescer (scale up) |
| Clique | escala | cor | posicao |
| Hover | escala ou cor | opacidade | posicao |
| Sucesso | escala | cor + opacidade | posicao |
| Erro | posicao (abanar) | cor | escala |
| Loading | rotacao | opacidade | posicao |
| Toggle | posicao | cor | rotacao |
| Notificacao | posicao + escala | opacidade | rotacao |
| Apagar | escala + opacidade | posicao | crescer |
| Seleccao | escala | cor, opacidade | rotacao |
| Progresso | posicao ou escala | cor | opacidade |

- **Duas propriedades e o ponto optimo:** a principal leva o significado, a secundaria o acabamento.
- **Nunca so opacidade** numa mudanca de estado importante — juntar posicao ou escala.
- Preferir `transform` + `opacity`. `width`/`height`/`margin`/`padding` forcam layout; `box-shadow` e pintura cara.

---

## Ressalto final (overshoot) por contexto

| Contexto | Overshoot |
|---|---|
| Sucesso | 5-10% |
| **Erro** | **0%** |
| Feedback (clique, toggle) | 2-5% |
| Celebracao | 15-25% |
| Premium | 0% |

Cruza com o tecto do arquetipo e do peso do elemento (`anima.md`): vale o **menor** dos tectos.
Overshoot so em propriedades espaciais — cor e opacidade nunca.

## Curva por direccao

Entrada = ease-out · Saida = ease-in · Em ecra = ease-in-out · Ciclo = curva suave (sine) ·
**Rotacao continua / progresso = linear** (com ease-out, um spinner acelera e trava a cada volta).
