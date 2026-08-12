# Motion Personality — arquetipos de movimento

Referencia on-demand. Consumida por `skills/anima.md` (a tabela resumo vive la; o detalhe esta aqui).
Adaptado de `LottieFiles/motion-design-skill` (MIT).

O arquetipo escolhe-se **uma vez por projecto** e vale para tudo. Trocar de arquetipo entre
componentes e a forma mais rapida de um produto se ler como template montado a pressa.

---

## Os 4 arquetipos

### Playful
| Parametro | Valor |
|---|---|
| Duracao | 150-300ms |
| Easing | ease-out-back / springs |
| Overshoot | 10-20% |
| Trajectoria | arcos e curvas, nunca recta |
| Squash-stretch | sim, nos impactos |

Assinatura: bounce a assentar, squash no press, wobble de rotacao, stagger variado.
Onde: apps infantis, jogos casuais, social, celebracoes, onboarding, ferramentas criativas.

### Premium / Luxo
| Parametro | Valor |
|---|---|
| Duracao | 350-600ms |
| Easing | cubic-bezier(0.4, 0, 0.2, 1) |
| Overshoot | 0% |
| Trajectoria | curvas suaves, parallax subtil |
| Squash-stretch | nunca |

Assinatura: fades lentos, escala subtil (98%→100%), pausas generosas, poucas propriedades (opacidade + uma).
Onde: moda, financas, marcas de luxo, SaaS premium, portfolios, editorial.

### Corporate / Profissional — **default de UI**
| Parametro | Valor |
|---|---|
| Duracao | 200-400ms |
| Easing | cubic-bezier(0.2, 0, 0, 1) |
| Overshoot | 0-3% |
| Trajectoria | rectas, arcos pequenos so para enfase |
| Squash-stretch | nao |

Assinatura: timing consistente, transicoes de estado claras, movimento funcional, stagger uniforme.
Onde: enterprise, dashboards, ferramentas de negocio, admin, saude, banca.

### Energetic / Dinamico
| Parametro | Valor |
|---|---|
| Duracao | 100-250ms |
| Easing | ease-out-expo / elastic |
| Overshoot | 15-30% |
| Trajectoria | arcos dramaticos, deslocamento grande, diagonal |
| Squash-stretch | sim, exagerado |

Assinatura: mudancas de escala grandes (50-150%), transicoes de cor rapidas, rajadas de particulas,
stagger a acelerar, entradas pela margem.
Onde: gaming, desporto, musica, eventos, marketing, fitness.

---

## Escolher pelo brief

| Palavras no brief | Arquetipo |
|---|---|
| divertido, bouncy, giro, amigavel | Playful |
| elegante, minimal, luxo, sofisticado | Premium |
| limpo, profissional, negocio, dashboard | Corporate |
| dinamico, energetico, ousado, entusiasmante | Energetic |
| (nao dito) + UI | **Corporate** |
| (nao dito) + ilustracao | **Playful** |

---

## Identidade de movimento da marca (3 constantes)

**1. Easing de assinatura** — 80% das animacoes:
Playful `ease-out-back` · Premium `(0.4,0,0.2,1)` · Corporate `(0.2,0,0,1)` · Energetic `ease-out-expo`

**2. Paleta de duracoes**

| Tier | Playful | Premium | Corporate | Energetic |
|---|---|---|---|---|
| Quick | 150ms | 350ms | 200ms | 100ms |
| Standard | 250ms | 500ms | 300ms | 180ms |
| Slow | 400ms | 800ms | 450ms | 300ms |

**3. Padrao de entrada**
Playful: bounce de baixo · Premium: fade lento + escala 98%→100% · Corporate: slide da direita +
opacidade · Energetic: snap da margem + overshoot

---

## Misturar arquetipos

- **90% no arquetipo primario.** Momentos especificos podem pedir emprestado a outro.
- A mudanca de personalidade entra a easing, nao a corte.
- Exemplo legitimo: dashboard Corporate que pede Playful emprestado **so** no estado de sucesso.

⚠ Isto nao e licenca para variar. Se mais de 10% das animacoes fogem ao arquetipo, nao ha arquetipo —
ha ausencia de decisao.
