---
name: validar-design
description: "Valida um mockup contra o sistema visual do projecto e prepara as notas de implementacao. Porteiro, nao autor: assinala o que esta fora e devolve, nao redesenha. MUST be invoked when the user says: validar design, validar o mockup, /validar-design, o mockup esta bom, rever o ecra. SHOULD also invoke when: posso implementar este ecra, conferir o mockup, o design bate certo com o sistema, aprovar o mockup."
triggers: validar design, validar o mockup, validar-design, o mockup esta bom, rever o ecra, posso implementar este ecra, conferir o mockup, aprovar o mockup
argument-hint: "[nome-do-ecra]"
chain: novo-issue, a11y-fixer
---
# Validar design — porteiro, nao autor

Recebes um mockup e verificas se ele cabe no sistema. **Nao redesenhas o ecra**; assinalas o que esta
fora e devolves para correccao.

O nome do ecra vem em `$ARGUMENTS`. Se vier vazio, pergunta qual e.

## Ler primeiro

1. `docs/DESIGN.md` — as restricoes
2. Os tokens reais do projecto:
   - Laravel/Livewire: `sed -n '/@theme/,/^}/p' resources/css/app.css`
   - Next.js: `sed -n '/@theme/,/^}/p' app/globals.css`
   - Flutter: `grep -n "ColorScheme\|ThemeData" lib/theme.dart`
3. Os componentes que existem: `ls resources/views/components/ components/ui/ lib/ui/widgets/ 2>/dev/null`
4. O mockup: `docs/mockups/<ecra>.html`
5. O issue do ecra, para os criterios de aceitacao

Se o mockup nao estiver em `docs/mockups/`, pede o ficheiro e grava-o la antes de continuar.

## Verificar

### 1. Tokens

```bash
sed -n '/@theme/,/}/p' docs/mockups/<ecra>.html
```

Compara com os do projecto. **Bloqueia** se houver valores diferentes. Um mockup com tokens proprios
produz um ecra que parece certo isolado e destoa no conjunto.

Procura tambem cores e medidas escritas a mao que deviam ser tokens: `#hex` soltos, `text-[13px]`,
`rounded-[6px]`.

### 2. Componentes

Lista os blocos do mockup e mapeia cada um para:

- um componente da biblioteca base que ja existe (Flux · shadcn/ui · Material 3)
- um componente proprio que ja existe
- **um componente novo** → vira issue com a label `area: design`

Se o mockup nao trouxer comentarios a marcar isto, fa-lo tu e **assinala a omissao**.

### 3. Os quatro estados

Confirma que existem, e que nao sao decorativos:

- **Vazio** — explica o que aparecera aqui e da a accao para comecar?
- **A carregar** — skeleton quando a estrutura e conhecida, nao spinner?
- **Erro** — diz o que falhou em linguagem humana e o que fazer a seguir?
- **Cheio** — mostra onde entra paginacao ou scroll? O layout aguenta o texto mais longo?

**Bloqueia** se faltar algum. Um ecra sem estado vazio definido nao esta desenhado.

### 4. Regras de composicao

Contra o `docs/DESIGN.md`: uma unica accao primaria, alinhamentos, espacamento vertical constante,
sombras so em elementos flutuantes, truncagem de texto longo.

### 5. Criterios de aceitacao

O ecra permite tudo o que o issue exige? Faz alguma coisa que estava declarada fora de ambito?

### 6. Acessibilidade — medida, nao estimada

> **Contraste verifica-se contra o que e PINTADO, nao contra o token.** Um gradiente exige as duas
> pontas (pior caso); uma cor com alpha exige compor sobre o fundo real. Ler o hex do `@theme` e
> declarar "passa AA" e adivinhar.

- Contraste de texto >= 4.5:1 (>= 3:1 para texto grande), **calculado**
- Foco visivel em tudo o que e alcancavel por teclado
- `aria-label` em accoes so com icone
- Informacao nunca transmitida apenas por cor
- Alvos de toque >= 44px em mobile e Flutter

> **`id` + `<label for>` NAO nomeia um controlo headless que renda `<button>`** (Radix Checkbox,
> Switch, RadioGroup). O nome acessivel de um `button` vem de `aria-label`/`aria-labelledby`/conteudo.
> Se o mockup marcar blocos como Radix/shadcn, verificar isto explicitamente.

## Devolver

```
## <ecra> — validacao

**Veredicto:** aprovado | aprovado com correccoes | devolver

### Bloqueia
<ficheiro:linha — o que esta errado, e a consequencia>

### Devia corrigir
<...>

### Componentes novos necessarios
| Componente | Onde aparece | Porque nao chega o que existe |

### Notas de implementacao
<mapa bloco → componente real, e o que exige logica de servidor>
```

## Depois de aprovado

- Abre os issues dos componentes novos, com `area: design`
- Confirma que o mockup esta commitado em `docs/mockups/`
- Se a validacao revelou uma regra que faltava no sistema — uma decisao que o mockup teve de tomar e
  o `DESIGN.md` nao cobria — **acrescenta-a ao `DESIGN.md`, com data e razao, no registo de
  alteracoes.** E assim que o sistema cresce: a partir de casos reais, nao de previsao.

## Nao fazer

- Nao redesenhes o ecra. Se estiver errado, devolve com o motivo.
- Nao aceites tokens ou componentes fora do sistema por serem "melhores" neste ecra. Se forem mesmo
  melhores, muda-se o sistema primeiro — decisao explicita, registada, aplicada a todos os ecras.
- **Nao inventes problemas para parecer util.** Uma validacao que encontra sempre alguma coisa deixa
  de ser levada a serio. Se nao ha nada que bloqueie, di-lo claramente.

## Proximo passo (chain)

- Componentes novos identificados → `novo-issue` para cada um (`area: design`).
- Violacoes de acessibilidade → `a11y-fixer` depois de o ecra estar implementado (aqui so se
  assinala; o mockup nao e o codigo final).
- Aprovado → implementar. O mockup passa a ser a referencia, **nao** o componente final.
