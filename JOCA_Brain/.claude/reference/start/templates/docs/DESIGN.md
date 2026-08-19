# Sistema de design

Este ficheiro define as restrições visuais do produto. **Todo o ecrã novo é
composto dentro delas.** Não se introduzem cores, tamanhos ou componentes novos
sem uma decisão explícita registada aqui.

Lido pelo Claude em qualquer sessão de design ou de implementação de interface.

---

## As quatro decisões

Estas são deliberadas e humanas. É aqui que vive a identidade do produto.

**Tipografia:** <família> para interface, <família> para títulos (se diferente)
Escala: 12 / 14 / 16 / 20 / 24 / 32 / 48

**Cor de marca:** <hex> — usada em ações primárias e estados ativos. Nada mais.
**Neutra:** <escala, ex. slate / zinc / stone>

**Forma:** raio de cantos <valor> · bordas <espessura e cor>

**Densidade:** <compacta | equilibrada | espaçosa>
Unidade base de espaçamento: <4px | 8px>

---

## Cores

| Uso | Token | Quando |
|---|---|---|
| Primária | `brand-600` | Ação principal do ecrã — **uma por ecrã** |
| Texto | `neutral-900` | Corpo |
| Texto secundário | `neutral-500` | Metadados, legendas |
| Fundo | `white` / `neutral-50` | Página e superfícies |
| Borda | `neutral-200` | Separadores, contornos |
| Sucesso / Aviso / Erro | `emerald-600` / `amber-600` / `red-600` | Apenas feedback de estado |

Regra: **cor comunica, não decora.** Se um elemento não muda de significado com a cor, é neutro.

---

## Componentes base

Vivem em `resources/views/components/`. Um ecrã compõe-se destes:

- `x-button` — variantes: primary, secondary, ghost, danger
- `x-input` / `x-select` / `x-textarea` — com label, hint e erro
- `x-card` — superfície com padding consistente
- `x-badge` — estados e etiquetas
- `x-table` — cabeçalho, linhas, estado vazio
- `x-modal`
- `x-empty-state` — ícone, título, descrição, ação
- `x-alert` — info, sucesso, aviso, erro

**Criar componente novo exige justificação.** Se algo aparece em dois ecrãs, é
componente. Se aparece num, é composição.

---

## Regras de composição

1. **Uma ação primária por ecrã.** As restantes são secundárias ou ghost.
2. **Largura máxima de texto:** ~70 caracteres. Conteúdo largo em `max-w-3xl`.
3. **Espaçamento vertical** entre secções: sempre o mesmo valor. Não afinar caso a caso.
4. **Alinhamento à esquerda** por defeito. Números alinhados à direita em tabelas.
5. **Nada de sombras** exceto em elementos flutuantes (modal, dropdown).

---

## Estados obrigatórios

Todo o ecrã que mostra dados tem de definir os quatro:

- **Vazio** — primeira utilização. Explica o que aparecerá aqui e dá a ação para começar.
- **A carregar** — skeleton, não spinner, quando a estrutura é conhecida.
- **Erro** — o que falhou, em linguagem humana, e o que fazer a seguir.
- **Cheio** — com muitos dados. Onde a paginação ou o scroll entram.

Um ecrã sem estado vazio definido não está desenhado.

---

## Acessibilidade — mínimos

- Contraste de texto ≥ 4.5:1 (≥ 3:1 para texto grande)
- Todos os controlos alcançáveis por teclado, com foco visível
- Ícone sozinho como ação leva sempre `aria-label`
- A informação nunca é transmitida só por cor

---

## Registo de alterações

Alterações ao sistema ficam aqui, com data e razão.

| Data | Alteração | Porquê |
|---|---|---|
| | | |
