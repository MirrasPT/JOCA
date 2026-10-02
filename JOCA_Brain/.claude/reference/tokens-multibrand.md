# Tokens multi-marca (N produtos irmãos sob uma marca-mãe)

Referência on-demand, chamada por `skills/design-system.md` (tokens de um produto em `design-system-tokens.md`). Era a skill
`design-system-multibrand` até 2026-10-01 (F2.5 do plano de skills).

## Índice
- Quando usar
- Decisão 0 — quantos membros, antes de escolher o eixo (≤9 cor · >9 família + forma)
- Camadas de tokens para N marcas (`primitives` → `brands/<id>` → `ladder` → `semantic`)
- A escada partilhada + a matiz que roda (contraste por construção)
- Convenção de papéis fixa (degraus por papel)
- O gamut recorta a intensidade, nunca a luminosidade
- Quando a cor esgota (>9): a forma assume
- Onde vive o override por marca
- Como se gera
- Como se prova que funciona
- Regra de processo · Anti-patterns

`design-system-tokens.md` resolve tokens para **um** produto. Esta referência resolve a camada por cima: uma
**marca-mãe** com **N produtos/módulos irmãos**, cada um com identidade própria mas obrigados a
ler-se como família. Nasceu de uma sessão real em que a arquitectura desenhada para 8 marcas apanhou
um catálogo de 25 (o caso está contado em `design-system.md` § "O eixo de variação tem um TECTO").

Pré-requisito: `Read(".claude/skills/design-system.md")` — secções **"O eixo de variação tem um
TECTO"** e **"Um identificador, uma palavra"**. Não repetidas aqui.

## Quando usar

- A marca-mãe vai ter mais do que um produto/app/módulo com identidade visual própria.
- "Cada app tem uma cor" ou "cada tenant tem um tema" está a ser desenhado do zero.
- O catálogo de marcas já existe mas cresceu além do que a arquitectura original previa.

---

## Decisão 0 — quantos membros vai ter a família, ANTES de escolher o eixo

Correr o número primeiro, não quando rebentar:

| N esperado de membros | Estratégia | Porquê |
|---|---|---|
| ≤ 9 | 1 matiz por marca — a cor sozinha identifica | o tecto do eixo de cor é ~9; a derivação está em `design-system.md` § "O eixo de variação tem um TECTO" — corre-a para o teu caso antes de assumir o 9 |
| > 9 | Agrupar em **famílias** (~5) por critério funcional; **a cor identifica a família, a forma identifica o membro** dentro dela | é o padrão da Google Workspace: 4 cores, 15 apps — a cor não escala, a forma não tem tecto prático |

**Sinal de alarme a vigiar:** se a doutrina escrita (brand guide, DESIGN.md) já diz que a forma/glifo
é o sinal primário e os tokens ainda assumem cor única por marca, **o documento e a arquitectura
discordam** — isso é o aviso. Corre o número aí, não no dia em que a marca nº 9 não se distingue da 4.

Se a estratégia é "> 9": o critério de agrupamento em famílias é **função do módulo** (ex.: gestão vs
comunicação vs financeiro), nunca semelhança visual — famílias por semelhança visual colapsam-se
sozinhas assim que dois módulos parecidos entram na mesma família por acidente.

---

## Camadas de tokens para N marcas

Estende as 3 camadas de `design-system-tokens.md` (global → semantic → component) com uma camada nova **entre**
global e semantic — é aqui que mora a única coisa que varia por marca:

```
primitives.json      -- escada de luminosidade/chroma PARTILHADA, 10 degraus, SEM matiz fixa
       ↓ (a mesma curva L,C para todas as marcas)
brands/<id>.json      -- 1 valor por marca: a matiz (H). Nada mais diverge aqui.
       ↓ (references)
ladder.<id>.json       -- primitives + H da marca = paleta completa da marca (gerado, não editado)
       ↓ (references)
semantic.json           -- papéis FIXOS e partilhados por toda a família (action=500, text=800…)
       ↓ (compiled)
tokens/<id>.tokens.css   -- 1 ficheiro por marca, resolve a cadeia inteira
```

**A regra que faz isto funcionar:** `brands/<id>.json` tem **um campo a mais** que os outros
(a matiz) e mais nada — largura, densidade, tipografia, espaçamento, papéis semânticos são
**partilhados por toda a família**. Se um segundo campo começar a divergir por marca (um radius
diferente, um peso de fonte diferente), deixou de ser uma família — é N produtos com o mesmo tokens.css
por coincidência. Decidir isso é decisão de marca, não acidente de implementação.

É o padrão que o Style Dictionary documenta como *multi-brand-multi-platform*: primitivos e semânticos
resolvidos por referência (`outputReferences`), e só o ficheiro de marca muda por build — a cadeia de
alias mantém-se legível no CSS emitido em vez de ser inlined e perdida. ([Style Dictionary — Examples](https://styledictionary.com/getting-started/examples/))

---

## A escada partilhada + a matiz que roda

O mecanismo central. Todas as marcas herdam a **mesma curva de luminosidade e chroma por degrau** —
só a matiz (H) roda por marca.

```json
// primitives.json — L,C fixos, H é PARÂMETRO, não valor
{
  "brand-scale": {
    "50":  { "$value": "oklch(0.97 0.02 {H})" },
    "300": { "$value": "oklch(0.80 0.10 {H})" },
    "500": { "$value": "oklch(0.55 0.18 {H})", "$description": "pico de chroma" },
    "700": { "$value": "oklch(0.38 0.14 {H})" },
    "800": { "$value": "oklch(0.28 0.10 {H})" },
    "900": { "$value": "oklch(0.16 0.06 {H})" }
  }
}
```

```json
// brands/pos.json — só isto
{ "hue": 262 }
// brands/crm.json
{ "hue": 34 }
```

**Consequência que justifica a arquitectura toda:** como a luminosidade (L) é idêntica em todas as
marcas em cada degrau, o **contraste passa a ser propriedade da construção, não uma regra a cumprir**.
Deixa de existir um par marca/tom que possa chumbar WCAG isoladamente — se `text` no degrau 800 tem
contraste ≥4.5:1 contra `surface` no degrau 50 para uma marca, tem para as 25, porque L(800) e L(50)
são os mesmos números em todas. QA de contraste por marca deixa de ser um passo manual repetido N
vezes; é um passo feito **uma vez**, na curva partilhada.

(Exemplo ilustrativo — os valores L/C acima não são medidos de nenhum projecto; a curva real deriva do
`DESIGN.md` da marca-mãe, como em `design-system-tokens.md`.)

---

## Convenção de papéis fixa — o que impede a família de dispersar

Sem uma convenção **igual para todas as marcas**, cada marca escolhe o seu degrau para "acção" ou
"texto" e a família deixa de se ler como família — mesmo com a escada partilhada.

| Papel semântico | Degrau fixo | Porquê este e não outro |
|---|---|---|
| `action` (CTA, botão primário) | 500 | pico de chroma da curva — o ponto mais vívido é sempre o mesmo degrau em qualquer marca |
| `text` | 800 | L suficientemente baixa para 4.5:1 contra `surface` (50) em qualquer H, por construção |
| `focus-ring` | 700 | intermédio entre acção e texto — visível sem competir com o CTA |
| `border` | 300 | mesmo raciocínio: L partilhada garante contraste mínimo consistente |
| `surface-tint` | 50 | quase-branco tingido, mesmo H da marca |

Isto é uma **decisão de arquitectura, não de gosto** — muda-se junto para todas as marcas de uma vez,
nunca por marca. Uma marca "precisar" de um action mais escuro é sinal de que a curva L/C está errada
para essa matiz (ver gamut abaixo), não motivo para lhe dar um degrau próprio.

---

## O gamut recorta a INTENSIDADE, nunca a luminosidade

Ao rodar H mantendo L,C fixos, algumas matizes ficam fora do gamut sRGB no chroma pedido — o renderer
clipa o **chroma**, nunca a luminosidade. O efeito visível é uma marca a parecer "apagada" ou "menos
viva" que as outras no mesmo degrau.

**Isto não é o sistema a falhar.** L manteve-se igual → o contraste da secção anterior continua válido.
O que perdeu-se foi saturação percebida, não legibilidade. Se uma matiz sai sistematicamente "lavada",
o diagnóstico é o ângulo de H contra o limite do gamut sRGB para essa faixa de matizes (amarelos e
verdes claros são os que mais clipam), não um bug na cadeia de tokens. Não "compensar" subindo o
chroma pedido — isso não muda o resultado clipado, só o esconde no ficheiro fonte.

---

## Quando a cor esgota (> 9): a forma assume, a cor recua para família

Derivação completa e o número (`360°/40°≈9`) vivem em `design-system.md` — aqui só a parte
operacional que falta lá: **como agrupar**.

1. Definir as ~5 famílias por **função do módulo** (não por semelhança visual).
2. Cada família recebe 1 matiz — a mesma escada partilhada acima, rodada por família em vez de por
   marca individual.
3. Dentro da família, cada membro recebe uma **forma/glifo** próprios (registo de assets — ver
   `design-system-componentes.md`, secção "Registo de assets — nunca um `Record` fechado": o glifo do membro
   nº 26 tem de degradar de forma visível, nunca partir o build).
4. O `id` do membro continua a ser a chave única de tudo (subdomínio = atributo = ficheiro gerado) —
   `design-system.md`, secção "Um identificador, uma palavra".

---

## Onde vive o override por marca

- **`brands/<id>.json`** — só a matiz (e, se a família > 9, a referência ao glifo). Nunca cor completa,
  nunca radius/espaçamento/tipografia.
- **`semantic.json`** — nunca tem override por marca. Se um papel precisa de valor diferente por
  marca, o papel está mal definido — volta à convenção fixa acima.
- Ficheiro por marca gerado, nunca editado à mão — mesma regra de `design-system-tokens.md`: "Generated
  artifacts — one file, one responsibility".

---

## Como se gera

Não é um gerador novo — é o mesmo pipeline de `design-system-tokens.md` com uma rotação:

1. Definir a curva L,C por degrau uma vez (igual ao `global.json` de `design-system-tokens.md`, mas com H como
   parâmetro em vez de valor fixo).
2. Por marca: escolher H respeitando a distância angular mínima da Decisão 0 (≥40° entre vizinhas na
   mesma família, se N ≤ 9; entre famílias, se N > 9).
3. Compilar `tokens/<id>.tokens.css` substituindo `{H}` pelo valor da marca — resto da cadeia
   (`semantic.json` → `component.json`) fica intacto e partilhado.
4. Se o output for consumido por várias plataformas (web + mobile), `outputReferences: true`
   (ou equivalente) preserva a cadeia de alias no ficheiro emitido — não faz inline dos valores,
   para a marca continuar trocável no runtime. ([Style Dictionary — multi-brand example](https://github.com/style-dictionary/style-dictionary/issues/1484))

Não inventar bibliotecas: o gerador concreto é o mesmo script/processo já usado por `design-system-tokens.md`
no projecto — esta referência só acrescenta o parâmetro H e o ficheiro `brands/<id>.json`.

---

## Como se prova que funciona

| O quê | Teste | Não prova |
|---|---|---|
| A troca de marca funciona | atributo (`data-app`/`data-brand`) posto no **`<html>`**, uso documentado | posto num `<div>` aninhado |
| Contraste da família | medir contra o **pintado** (fundo real, incl. gamut clipado), não contra o token cru | ler o valor OKLCH e assumir 4.5:1 |
| Membro sem asset ainda desenhado | degrada para placeholder **reconhecível como "por desenhar"** | `Record` fechado que parte o build no membro N+1 |
| Id resolve | gerador **falha o build** num id sem correspondência — nunca pinta com a cor da marca-mãe por omissão | passar silenciosamente para o fallback |
| Duas marcas vizinhas distinguem-se | comparar lado a lado no mesmo componente, não só o valor de H isolado | diff numérico de H sem olhar |

---

## Regra de processo (herdada, não repetida)

Se a decisão de quantas famílias/matizes/formas vier de uma direcção que o dono do produto já
escolheu (ex.: uma exploração visual, um quadro aprovado): **iguala-se, não se sistematiza**.
Produzir "a versão consistente" por iniciativa própria é a mesma armadilha documentada em
`design-shotgun.md` §"A direcção escolhida é um CONTRATO visual" — aplica-se aqui a paletas e
sistemas de marca tanto quanto a mockups.

---

## Anti-patterns

| Errado | Correcto |
|---|---|
| Escolher "1 matiz por marca" sem calcular o tecto | Correr `360°/40°` para o N esperado ANTES de adoptar o eixo |
| `brands/<id>.json` com paleta completa por marca | Só a matiz (H); L,C vêm da curva partilhada |
| Papel semântico (`action`, `text`) num degrau diferente por marca | Convenção de degrau fixa para toda a família |
| Ver uma matiz "apagada" e subir o chroma no ficheiro fonte | Diagnosticar clip de gamut primeiro — L não mudou, o contraste continua válido |
| Agrupar famílias por semelhança visual | Agrupar por função do módulo |
| `Record<AppId, …>` fechado para assets de marca | `Partial<Record>` + fallback reconhecível (`design-system-componentes.md`) |
| Testar a troca de tema num `<div>` | Testar no `<html>`, uso documentado |
| Sistematizar uma direcção de marca já escolhida por iniciativa própria | Igualar; sistematização vive ao lado, como alternativa |
| Doutrina escrita e tokens implementados a discordar sobre o sinal primário | Correr o número no início; é o alarme, não ruído |
