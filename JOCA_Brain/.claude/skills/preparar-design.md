---
name: preparar-design
description: "Desenha um ecra dentro do sistema visual do projecto e entrega-o como ficheiro HTML local aberto no browser. Comeca por apurar que design JA existe (Figma, marca, site a rodar, mockups) para nao reinventar o que esta decidido. MUST be invoked when the user says: preparar design, desenhar ecra, mockup do ecra, /preparar-design, briefing de design. SHOULD also invoke when: fazer o ecra, como vai ser esta pagina, desenhar a interface, mockup, protipo do ecra, ecra novo."
triggers: preparar design, desenhar ecra, mockup do ecra, preparar-design, briefing de design, fazer o ecra, desenhar a interface, mockup, prototipo do ecra, ecra novo
argument-hint: "[nome-do-ecra]"
chain: validar-design, novo-issue
---
# Preparar design — do que ja existe ate ao mockup no browser

Produzes o mockup de um ecra **dentro do sistema visual do projecto**, e entrega-lo como **ficheiro
`.html` local dentro do projecto, aberto no browser** (`open <f>`) — nao um bloco de HTML na consola.
**Publicar como Artifact so a pedido explicito do utilizador** (`soul.md`, Hard Limits).

O nome do ecra vem em `$ARGUMENTS`. Se vier vazio, pergunta qual e.

---

## FASE 1 — O que ja existe (perguntar antes de desenhar)

**A pergunta que mais trabalho poupa e "isto ja esta decidido?".** Desenhar de raiz um ecra cuja
marca ja existe produz um mockup que vai ser rejeitado por razoes que ninguem escreveu em lado
nenhum.

### 1a. Olhar primeiro — zero perguntas

Uma pergunta que o disco ja responde e uma pergunta que nao se faz:

```bash
ls docs/DESIGN.md docs/BRAND.md BRAND.md 2>/dev/null
ls docs/mockups/ 2>/dev/null
# tokens ja declarados?
sed -n '/@theme/,/^}/p' resources/css/app.css 2>/dev/null    # Laravel / Tailwind 4
sed -n '/@theme/,/^}/p' app/globals.css 2>/dev/null          # Next.js / Tailwind 4
grep -rn "ThemeData\|ColorScheme.fromSeed" lib/ 2>/dev/null | head    # Flutter
# componentes que ja existem
ls resources/views/components/ components/ui/ src/components/ lib/ui/widgets/ 2>/dev/null
```

### 1b. Perguntar o que sobrar — com `AskUserQuestion`

Uma pergunta de cada vez, opcoes concretas, sempre com um recomendado. **Nunca despejes um
questionario em texto corrido.**

**Pergunta 1 — de onde vem o design?**

| Opcao | O que faz a seguir |
|---|---|
| **Ja ha um sistema neste repo** (`docs/DESIGN.md` preenchido) | Le-o e salta para a Fase 2 |
| **Ha marca/identidade fora do repo** (manual, Figma, site a rodar) | Vai a Fase 1c extrair os tokens **medidos** |
| **Ha uma referencia que quero seguir** (um produto que ele gosta) | Pede o URL; extrai principios, **nunca copia** |
| **Nao ha nada — decidir agora** | Corre as quatro decisoes (Fase 1d) |

**Se o utilizador disser que ja existe design, pede o artefacto antes de continuar** — ficheiro,
URL, screenshot ou link do Figma. "Existe design" sem o artefacto e a mesma coisa que nao existir,
e desenhar por cima de uma descricao verbal e como o mockup foge do que estava decidido.

**Redesenho de formulario: listar os campos e medir o uso real antes de redesenhar.** Para cada
campo, a distribuicao de valores em producao (quantos preenchem, que valores aparecem) e uma
pergunta ao utilizador: "este campo herdado faz sentido neste produto?". Campos herdados de outro
produto passaram rondas de redesign sem ninguem perguntar, e o utilizador teve de perguntar varias
vezes "o que e a area" (2026-09-25).

### 1c. Extrair tokens de design existente — medir, nunca estimar

> **Tokens sao factos.** Cores, tipos e espacamentos sem token **medido** ou documentado sao
> `TODO: token em falta`, nunca um valor plausivel. Um hex inventado passa o build e so esta errado.

| Fonte | Como extrair |
|---|---|
| **Site a rodar** | `site-capture` para o screenshot + `getComputedStyle` nos elementos-chave. Medir, nao ler do CSS por olho |
| **Figma** | Ler os *variables*/styles se houver acesso; senao, pedir export dos tokens ou screenshot em alta |
| **Manual de marca (PDF)** | `markitdown` para extrair; confirmar os hex com o utilizador |
| **Screenshot/imagem** | `Read()` a imagem e tirar a paleta — e depois **confirmar cada valor** com o utilizador |

Escrever o resultado em `docs/DESIGN.md` **antes** de desenhar. E o contrato.

### 1d. As quatro decisoes — so se nao houver nada

Explica primeiro, em duas frases, porque isto vem antes dos ecras: sem sistema definido, cada ecra
sai bonito isolado e o conjunto sai incoerente — e isso so se nota ao decimo ecra, quando corrigir ja
e refazer.

Uma decisao de cada vez, com `AskUserQuestion` e **opcoes concretas com preview**:

1. **Tipografia** — 2-3 propostas com nomes reais e o par display/corpo.
2. **Cor de marca** — pede a cor, ou propoe 3 hex. Depois a neutra: slate (fria), zinc (neutra),
   stone (quente).
3. **Forma** — cantos rectos, `0.5rem` ou `0.75rem`.
4. **Densidade** — compacta (aplicacao de trabalho, muitos dados) ou espacosa (produto publico).

---

## FASE 2 — Reunir o briefing

1. **O sistema:** `docs/DESIGN.md`, inteiro.
2. **Os tokens reais**, a letra (o bloco medido/declarado da Fase 1).
3. **Os componentes que ja existem** (o `ls` da Fase 1a).
4. **O issue do ecra**, com os criterios de aceitacao:

```bash
gh issue list --search "<nome-do-ecra>" --state open
gh issue view <numero>
```

5. **Os fluxos onde o ecra aparece**, de `docs/PRODUTO.md` — quem chega aqui, vindo de onde, e o que
   quer fazer.
6. **Elemento novo num ecra existente → o peso visual desejado.** Propor 2-3 niveis de destaque
   (icone · linha · cartao) **numa so ronda**, em vez de iterar. Um mockup deu 3 voltas por
   "destaque a mais" porque o briefing nao perguntava o peso visual (2026-09-28).

---

## FASE 3 — Desenhar e abrir no browser

**Carrega a skill `artifact-design` antes de escrever a pagina** — e obrigatorio, e e ela que
calibra o tratamento visual (vale para o ficheiro local, nao so para Artifacts).

Escreve o mockup em `docs/mockups/<ecra>.html` (`test -f` antes — ver «Guardar em disco») e abre-o
com `open docs/mockups/<ecra>.html`. O utilizador ve-o no browser dele e comenta no chat.

### O que o mockup tem de ter

- **Um ficheiro HTML autonomo.** Tailwind 4 pelo build de browser:

```html
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style type="text/tailwindcss">
  @theme { /* copiado A LETRA do projecto */ }
</style>
```

  **Nao usar `https://cdn.tailwindcss.com` nem `tailwind.config` inline** — e sintaxe do Tailwind 3 e
  produziria classes que nao existem na aplicacao.

  ⚠ **O bloco do CDN acima so vale para o ficheiro aberto LOCALMENTE** — que e a entrega por omissao
  nesta instalacao (`.html` em disco, aberto no browser). **Publicar como Artifact e opt-in, so a
  pedido explicito do utilizador.**

  ⚠ **Dentro de um Artifact a CSP bloqueia scripts de hosts externos** (a unica excepcao e o Google
  Fonts). O `<script src="https://cdn.jsdelivr.net/...">` nao carrega e a pagina sai **sem CSS
  nenhum** — serifas do browser e botoes nativos. Ja aconteceu, e foi o utilizador a ver a pagina
  partida primeiro. Se a entrega for Artifact, o CSS vai **proprio e inline** (`<style>` com as
  regras que o ecra usa), nao por CDN.

- **O bloco `@theme` copiado a letra** do projecto, para o mockup usar exactamente os mesmos tokens
  que a aplicacao. Um mockup com tokens proprios produz um ecra que parece certo isolado e destoa no
  conjunto.

- **Os quatro estados**, separados por cabecalho, um a seguir ao outro:
  1. **Vazio** — primeira utilizacao: explica o que aparecera aqui e da a accao para comecar
  2. **A carregar** — skeleton quando a estrutura e conhecida, nao spinner
  3. **Erro** — o que falhou, em linguagem humana, e o que fazer a seguir
  4. **Cheio** — com muitos dados: onde entra a paginacao, e se o layout aguenta o texto mais longo

- **Dados de exemplo plausiveis** — nomes e valores reais do dominio, **nunca "Lorem ipsum" nem
  "Teste 1"**. Dados falsos irrealistas escondem problemas de layout que so aparecem com conteudo
  real.

- **Ficheiro local verificado como o utilizador o abre:** sem `--allow-file-access-from-files` no browser
  de teste — ou auto-contido, com imagens em base64. Verificado com a flag, um HTML com caminhos
  relativos saiu sem imagens no browser do utilizador (2026-08-27).

- **Comentarios HTML a marcar** que componente cada bloco vai ser na implementacao.

- **Uma lista no fim:** componentes novos que este ecra exige.

### Por stack

| Stack | O mockup aproxima | Marcar em comentario |
|---|---|---|
| **DS renderizavel no projecto** (React/Vue instalado, importado pela app) | **Nao se aproxima** — o mockup e uma **ROTA na app** com os componentes reais | nada a marcar: o componente ja e o proprio |
| **Laravel + Livewire** | Flux UI so existe em Blade — aproxima-se com HTML+Tailwind | `<!-- flux:button variant=primary -->` |
| **Next.js** | shadcn/ui tem equivalente em HTML+Tailwind | `<!-- <Button variant="default"> -->` |
| **Flutter** | Material 3 nao e HTML — o mockup e **referencia visual**, nao estrutura | `<!-- FilledButton -->` · e converter tokens para `ColorScheme` na implementacao |

Sem essas marcas, quem implementa reconstroi a decisao a partir do aspecto, e e ai que o implementado
comeca a afastar-se do desenhado.

⚠ **O HTML so se justifica quando o DS nao corre fora do seu ambiente** (Flux em Blade, Material em
Flutter). Se o design system esta instalado e a app ja o importa, aproximar em HTML **esconde a
conclusao**: num caso real o mockup desenhou tres icones diferentes e o componente verdadeiro rendia
o mesmo relogio nas tres origens. O ganho de usar a rota nao e estetico — e a parede aparecer no
mockup em vez de aparecer na implementacao.

### Guardar em disco

O ficheiro local e a entrega **e** o que fica versionado (se o utilizador pedir Artifact, publica-se
a partir deste mesmo ficheiro):

```bash
test -f docs/mockups/<ecra>.html && echo "JA EXISTE — usar <ecra>-v2.html"
```

**Escrever por cima de um mockup ja aprovado e irreversivel.** Se existir, nome irmao versionado.

---

## Terminar

Diz ao utilizador:

- Que o mockup ficou em `docs/mockups/<ecra>.html` e ja esta aberto no browser
- As decisoes de composicao que tomaste, e porque
- Onde tiveste de sair do sistema de design, se tiveste — candidato a componente novo ou a alteracao
  do `DESIGN.md`
- Que ao aprovar deve correr `/validar-design <ecra>` **antes** de implementar

## Nao fazer

- Nao introduzir cores, tamanhos ou raios fora do sistema.
- Nao escrever Blade, React ou Dart real nesta skill — isto e design.
- Nao usar bibliotecas de componentes externas no mockup.
- Nao inventar tokens quando o design existente nao os deu — `TODO: token em falta`.

## Proximo passo (chain)

- Mockup aprovado pelo utilizador → `validar-design <ecra>` (porteiro: tokens, estados, a11y).
- O mockup revelou componentes novos → `novo-issue` para cada um, com a label `area: design`.
- O sistema visual nao existia e foi decidido agora → gravar em `docs/DESIGN.md` antes de sair.
