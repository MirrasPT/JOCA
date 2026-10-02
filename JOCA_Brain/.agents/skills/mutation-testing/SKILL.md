---
name: mutation-testing
description: "Partir código de propósito, uma mutação de cada vez, para confirmar que um teste — ou um gate acabado de escrever — acusa mesmo a falha. Fluxo MANUAL dentro da sessão de trabalho, não Stryker/PIT numa pipeline de CI, numa árvore que pode ter trabalho de outras frentes por committar. MUST be invoked when the user says: mutation testing, teste de mutação, testes de mutação, partir o código de propósito, o teste apanha isto, confirmar que o gate acusa, mutante sobreviveu, mutation score. SHOULD also invoke when: um teste ou gate novo nunca foi visto a falhar, quer confirmar cobertura real antes de fechar um issue, ou PIT/Stryker/mutmut são mencionados fora de uma pipeline de CI."
triggers: mutation testing, teste de mutação, testes de mutação, partir o código de propósito, o teste apanha isto, confirmar que o gate acusa, mutante sobreviveu, mutation score, mutante equivalente, validar teste novo, gate acusa a falha, PIT mutation testing, Stryker mutation testing, teste que nunca falhou
origin: local
chain: escrever-testes, tester-code
---

# Mutation testing manual — partir de propósito, um mutante de cada vez

Fluxo **manual**, dentro da sessão, para provar que um teste ou um gate recém-escrito **acusa** a
falha que diz proteger — não a suite de Stryker/PIT a correr sozinha em CI. É a receita da linha do
`chaining.md` §Verificação: *«gate ou teste novo: parte-o de propósito e reporta se acusou»*.

**Porque esta skill existe:** numa sessão, 8 mutações manuais encontraram 4 defeitos reais e
validaram 3 gates novos — mas 2 vezes o resultado foi «54 passed» com a mutação **por aplicar**: o
CRLF do Windows fez um `sed` multi-linha não casar, em silêncio, e o verde foi lido como prova. O
passo 4 existe só por causa disto.

## Quando usar / quando não

| Situação | Usar? |
|---|---|
| Acabaste de escrever um teste ou um gate e queres provar que ele apanha o defeito | Sim |
| Issue a fechar e a suite passa toda à primeira, sem nunca ter visto vermelho | Sim |
| Queres montar Stryker/PIT como gate contínuo de CI | Não — isto é o passo manual antes disso; ver §Escalar para ferramenta |
| Escolher framework de testes, TDD, subir cobertura % | Não — `escrever-testes` cobre isso |

## Passos

### 1. Escolher a mutação pelo predicado — nunca ao acaso

Ler o que o teste **alega** e escolher o operador (taxonomia PIT) que o contradiz directamente:

| O teste alega… | Operador | Mutação típica |
|---|---|---|
| «rejeita no limite» / «aceita até N» | Conditional Boundary | `>` ↔ `>=`, `<` ↔ `<=` |
| «só quando X» / «nunca quando X» | Negate Conditionals | `==` ↔ `!=`, `&&` ↔ `\|\|` |
| «devolve Y» / «devolve vazio/nulo quando…» | Return Values | trocar o valor devolvido (`Y` → `null`/`0`/`''`/`true`/`false`) |
| «chama/despacha X» (envia email, grava log, dispara evento) | Void Method Call | remover ou comentar a chamada |

Uma mutação só prova algo se atacar exactamente o que o teste diz defender — mutar uma linha ao
calhas não valida nada, só gasta a sessão.

### 2. Confirmar que vale a pena mutar esta linha

- **Sem teste que exercite este método/predicado, salta.** `grep -n "<nome_do_método>" <ficheiro_de_testes>`
  — zero resultados = a mutação não tem quem a apanhe, não prova nada. **Zero num ficheiro só não
  chega:** alargar a `grep -rn "<nome_do_método>" tests/` antes de concluir que não há cobertura — em
  suites multi-ficheiro o teste vive muitas vezes noutra pasta, e um falso «não coberto» salta um
  predicado que estava protegido.
- **Saltar DTOs, config, records, enums simples e migrations.** Só produzem mutantes equivalentes
  (sintacticamente diferentes, semanticamente indistinguíveis) — ruído puro.
- Correr o teste candidato **antes** de mutar e confirmar que já passa (baseline verde). Sem baseline
  verde, um «falhou» depois da mutação não prova nada.

### 3. Mutar em segurança — cópia primeiro, nunca git para desfazer

```bash
# 1. cópia antes de tocar em nada (a árvore pode ter trabalho de outras frentes por committar)
cp <caminho/ficheiro.ext> /tmp/ficheiro.mutado.bak

# 2. CONFIRMAR QUE O PADRÃO É ÚNICO — senão isto deixa de ser "um mutante de cada vez"
grep -n '>= *limite' <caminho/ficheiro.ext>            # anota o nº da linha
grep -c '>= *limite' <caminho/ficheiro.ext>            # >1 → NUNCA usar sed global

# 3. aplicar a mutação NUMA LINHA SÓ (exemplo: boundary >= → >, linha 42)
# macOS (BSD sed) — extensão de backup obrigatória, mesmo vazia:
sed -i '' '42s/>= *limite/> limite/' <caminho/ficheiro.ext>
# Windows Git Bash / Linux (GNU sed) — sem extensão:
sed -i '42s/>= *limite/> limite/' <caminho/ficheiro.ext>
```

⚠ **`sed` sem endereço de linha substitui TODAS as ocorrências do ficheiro.** Um padrão que aparece
em 3 sítios produz 3 mutações de uma vez, sem aviso — e um teste que falhe deixa de dizer qual delas
o matou. Prefixar sempre o número da linha, mesmo quando o `grep -c` deu 1: o custo é zero e protege
de um padrão que se torna ambíguo quando o ficheiro mudar.

| Máquina | Sed | Gotcha |
|---|---|---|
| macOS (BSD) | `sed -i '' 's/…/…/' f` | sem o `''`, o próximo argumento é lido como extensão de backup — corrompe em silêncio |
| Windows Git Bash (GNU) | `sed -i 's/…/…/' f` | ficheiro tocado no Windows fica em CRLF — ver passo 4 |
| Linux (GNU) | igual ao Git Bash | |

Padrão multi-linha ou âncora `$`/`^` contra um ficheiro CRLF falha em silêncio (o `\r` fica colado ao
fim de cada linha) — `file <ficheiro>` antes, se o `sed` não casar sem erro nenhum.

### 4. Confirmar que a mutação ENTROU — antes de ler qualquer verde/vermelho

Este é o passo que faltou nos dois falsos-positivos. Nunca correr o teste sem isto primeiro:

```bash
# o padrão ANTIGO tem de ter desaparecido:
grep -c '>= *limite' <caminho/ficheiro.ext>   # tem de dar 0
# o padrão NOVO tem de estar lá:
grep -c '> limite'   <caminho/ficheiro.ext>   # tem de dar >0

# ficheiro com outras alterações por committar → isolar com git diff:
git diff -- <caminho/ficheiro.ext> | grep '> limite'
# ficheiro NOVO (ainda não trackeado) → o diff vem vazio e não prova nada:
git status --short <caminho/ficheiro.ext>   # "??" = novo; vale o grep simples acima
```

`sed` que devolve exit code 0 sem ter casado nada é o modo de falha exacto que gerou «54 passed» com
a mutação por aplicar. `grep -c` a zero (ou sem subir) = a mutação não entrou — corrigir o padrão do
`sed`, não avançar para o passo 5.

### 5. Correr o teste/gate visado e interpretar

```bash
./vendor/bin/pest --filter=<NomeDoTeste>      # Laravel/Pest
npm test -- --run -t "<nome do teste>"        # Vitest
flutter test --plain-name "<nome do teste>"   # Flutter
```

- **Mutante morto** (o teste falhou) → o teste/gate protege o que dizia proteger. Confirmado.
- **Mutante sobreviveu** (passou tudo, mutação confirmada no passo 4) → ou é um defeito real por
  trás de um teste fraco, ou o mutante é **equivalente** (ver §Mutation score). Investigar qual das
  duas — um sobrevivente é um padrão a seguir, não um número a baixar.

### 6. Desfazer — sempre por cópia, nunca por git

```bash
cp /tmp/ficheiro.mutado.bak <caminho/ficheiro.ext>
grep -c '>= *limite' <caminho/ficheiro.ext>   # tem de voltar ao valor de antes da mutação
```

`git checkout -- <ficheiro>` / `git restore <ficheiro>` **nunca** — descartam qualquer outro trabalho
por committar na mesma árvore, de outras frentes. A cópia feita no passo 3 é a única via de retorno.

## Mutation score e mutante equivalente

`score = mortos / (total − equivalentes)`. Mutante **equivalente**: sintacticamente diferente do
original, semanticamente indistinguível — nenhum teste o pode matar, por definição; não conta como
falha do teste e sai do denominador. Não perseguir 100% — um score alto cheio de asserções vazias
para «matar» mutantes é pior do que um score baixo honesto.

## Escalar para ferramenta (deixar de ser manual)

Quando a confirmação passa de 1-3 mutações pontuais para dezenas, num diff grande:

| Stack | Ferramenta | Nota |
|---|---|---|
| JVM | PIT | muta bytecode, filtra por cobertura primeiro |
| JS/TS | Stryker | mesmo filtro por cobertura |
| .NET | Stryker.NET | idem |
| Python | mutmut / Cosmic Ray | idem |

Todas isolam **1 mutante por execução** — o mesmo princípio deste fluxo manual, só automatizado.
Escolher/configurar a ferramenta é outra sessão; esta skill não monta pipeline de CI.

## Anti-patterns

| Errado | Correcto |
|---|---|
| Ler «passou tudo» sem confirmar que a mutação entrou no ficheiro | Passo 4 — `grep -c` aos dois padrões antes de correr o teste |
| Desfazer com `git checkout --`/`git restore` | `cp` da cópia feita no passo 3 — a árvore pode ter trabalho de outra frente |
| Mutar uma linha ao acaso | Escolher pelo predicado que o teste alega defender (passo 1) |
| Mutar DTO/config/linha sem teste que a cubra | Saltar — só gera mutante equivalente, ruído |
| Tratar mutante equivalente como falha do teste | Documentar como equivalente, remover do denominador |
| Usar mutation score para avaliar pessoas/equipas | Sobrevivente é padrão a investigar, nunca KPI de avaliação |
| `sed -i` igual em Mac e Windows | BSD precisa de `''`; confirmar a máquina antes (tabela do passo 3) |
| `sed` global a mutar N sítios de uma vez | Endereço de linha (`42s/…/…/`) + `grep -c` a confirmar unicidade antes |

## Próximo passo (chain)

- Mutante sobreviveu por teste fraco (não por mutante equivalente) → `escrever-testes` para cobrir o
  predicado que faltava.
- Confirmação feita, gate/teste provado → `tester-code` revê o diff final contra os critérios.
- Volume grande de mutações a caminho de virar rotina → parar, propor ferramenta (§Escalar), não
  continuar manual mutante-a-mutante.
