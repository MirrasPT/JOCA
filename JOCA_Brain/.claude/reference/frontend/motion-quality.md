# Motion Quality — rubrica de auditoria de movimento

Referencia on-demand. Consumida por `skills/design-review.md` (quando a review inclui movimento) e
pelo checklist de `skills/anima.md`. Adaptado de `LottieFiles/motion-design-skill` (MIT).

Cada item e binario: passa ou nao passa. "Podia estar melhor" nao e um veredito.

---

## Rubrica

**Visual**
- [ ] Elementos >40px para movimento, >100px para detalhe
- [ ] Legivel a velocidade real, sem slow-motion
- [ ] 1/3 de distancia: nenhum movimento continuo >1/3 do container
- [ ] 1/3 de densidade: no maximo 1/3 dos elementos activos ao mesmo tempo
- [ ] Arcos naturais, salvo se mecanico for intencional

**Tecnica**
- [ ] Sem easing linear em movimento espacial
- [ ] Duracao proporcional a distancia e ao tipo de elemento
- [ ] Ease-out nas entradas, ease-in nas saidas
- [ ] Duracao de entrada ≥ duracao de saida
- [ ] Mudancas de estado importantes nao sao so opacidade
- [ ] Stagger total <500ms
- [ ] Follow-through: elementos filhos desfasados 50-150ms

**Emocional**
- [ ] Arquetipo definido antes de escolher propriedades (ver `motion-personality.md`)
- [ ] Estrutura setup → accao → resolucao
- [ ] Intensidade proporcional a importancia da interaccao
- [ ] Mesma interaccao = mesma animacao, sempre
- [ ] Ainda aceitavel a centesima vez que se ve

**Performance**
- [ ] Movimento principal em transform + opacity
- [ ] <20 elementos animados por viewport
- [ ] Nenhuma propriedade que dispara layout
- [ ] 60fps (30fps aceitavel em ambiente)

**Acessibilidade**
- [ ] Alternativa de `prefers-reduced-motion` que **substitui**, nao apaga
- [ ] Sem gatilhos vestibulares sem alternativa
- [ ] Informacao critica nunca so por movimento
- [ ] Animacoes >5s sao pausaveis

---

## Severidade

| Tier | Falhas |
|---|---|
| **CRITICAL** | easing linear em movimento espacial · so-opacidade em estados importantes · excede a regra de 1/3 do ecra · stagger >500ms · animacao de propriedade de layout a causar jank |
| **HIGH** | duracao desalinhada do tipo de elemento · easing direccional errado · personalidade inconsistente · sem follow-through · **sem alternativa de reduced-motion** |
| **MEDIUM** | overshoot desalinhado · arcos podiam ser melhores · sem counter-motion |

---

## Diagnostico: sintoma → causa

| Problema | Causa provavel | Correccao |
|---|---|---|
| Parece robotico | easing linear ou sem arcos | curvas de easing + trajectorias em arco |
| Parece lento demais | duracao longa para o tipo de elemento | ver a tabela de duracoes, usar ease-out |
| Parece plano/barato | so existe a camada primaria | ver "tres camadas" abaixo |
| Distrai demasiado | elementos a mais a mexer | aplicar a regra de 1/3, reduzir amplitude |
| Sem personalidade | easing generico em todo o lado | aplicar o arquetipo de forma consistente |

### As tres camadas (ferramenta de diagnostico, nao regra)

| Camada | Papel | Amplitude |
|---|---|---|
| Primary | a accao que o olho segue | 100% |
| Secondary | riqueza de apoio (sombras, elementos ligados) | 30-50%, desfasada 50-100ms, easing diferente |
| Ambient | vida de fundo | 10-20%, continua, nunca pede atencao |

⚠ **Usar so para diagnosticar "parece plano".** A fonte manda ter sempre as tres camadas; nos nao.
Isso colide com a regra de `anima.md` (se nao orienta, confirma ou narra, **nao animar**) e com
`yagni`. Maximo 2-3 elementos activos.

---

## Adaptacao ao contexto

| Plataforma | Modificador de duracao | Complexidade |
|---|---|---|
| Desktop | 1.0x (base) | completa |
| Tablet | 0.9x | standard |
| Mobile | 0.8x | reduzida (1-2 propriedades) |
| TV / Kiosk | 1.3x | completa |

**Mobile:** preferir opacity + transform · feedback de toque <100ms · **orcamento de stagger −30%** ·
evitar parallax.
**Desktop:** hover, cursor tracking, stagger multi-coluna, coreografia espacial.

**Deslocamento por largura de container:**

| Largura | Deslocamento max | Duracao |
|---|---|---|
| <400px | 20% da largura | 0.8x |
| 400-800px | 25% da largura | 1.0x |
| 800-1200px | 20% da largura | 1.0x |
| >1200px | 15% da largura | 1.1x |

**Dark mode:** reduzir intensidade 10-20% (claro sobre escuro tem mais impacto); evitar flashes de branco puro.

**Orcamento por propriedade:**

| Tier | Propriedades | Max elementos |
|---|---|---|
| Optimal | transform, opacity | ilimitado (GPU) |
| Good | + color, clip-path | 10-15 |
| Acceptable | + width, height, margin | 5-8 |
| Evitar | box-shadow, border-radius, filter | 1-3 |

**Substituicoes de reduced-motion:**

| Movimento original | Alternativa |
|---|---|
| Entrada em slide | so fade de opacidade |
| Bounce / spring | instantaneo ou ease-out simples |
| Parallax | posicao estatica |
| Auto-play | pausado, iniciado pelo utilizador |
| Coreografia complexa | um unico fade |
