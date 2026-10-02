# Formato de decisão (ADR)

Como registar uma decisão técnica. Chamado por `plan` (Fase 3) e `start`. Era a skill `adr` (fundida aqui, 2026-10-01).

**Onde vivem as decisões:** `docs/DECISIONS.md` — uma entrada por decisão, numerada `D1`, `D2`… (doutrina de projecto, `rules/pipelines.md`).
Projecto que já use `docs/adr/NNNN-titulo.md` (um ficheiro por decisão + `README.md` índice) mantém-se assim — não se migra.

## Quando merece entrada

| Categoria | Exemplos |
|---|---|
| Tecnologia | framework, linguagem, base de dados, cloud |
| Arquitectura | monólito vs serviços, event-driven, CQRS |
| API | REST vs GraphQL, versionamento, mecanismo de auth |
| Dados | desenho do schema, normalização, estratégia de cache |
| Infra | modelo de deploy, CI/CD, monitorização |
| Segurança | estratégia de auth, cifra, gestão de segredos |
| Testes | framework, metas de cobertura, E2E vs integração |
| Fora da stack da casa | sempre (`rules/stack-padrao.md`) |

**Não merece:** convenções de nomes/formatação (vão para o `CLAUDE.md` do projecto), escolhas triviais sem alternativa real, decisões já revertidas e esquecidas.

**Sinais:** explícitos («vamos usar X», «escolhemos X em vez de Y», «regista esta decisão», «porque escolhemos X») → escrever.
Implícitos (comparação de frameworks com conclusão, escolha de schema justificada, decisão de auth/infra) → **sugerir**, não criar sozinho.

## Formato da entrada

```markdown
## D<N>: <Título da decisão>

**Data:** YYYY-MM-DD · **Estado:** proposta | aceite | obsoleta | substituída por D<M> · **Decidido por:** <quem>

**Contexto:** <2-5 frases: o problema ou restrição que obrigou a decidir>

**Decisão:** <1-3 frases, no presente: «usamos X»>

**Alternativas consideradas:**
- <A> — prós / contras — rejeitada porque <razão concreta>
- <B> — prós / contras — rejeitada porque <razão concreta>

**Consequências:** positivas · negativas (tradeoffs) · riscos e mitigação
```

Boas práticas: específico («Pest para testes», não «um framework de testes») · o porquê pesa mais do que a escolha ·
alternativas rejeitadas sempre («escolhemos sem mais» não é razão) · consequências honestas · legível em 2 minutos
(contexto >10 linhas é demais) · decisão registada à posteriori leva a data original.

## Processo

1. `docs/DECISIONS.md` não existe → confirmar antes de o criar.
2. Identificar a escolha → contexto → alternativas → consequências.
3. **Número reservado, não escolhido:** com branches/agentes em paralelo, o caller atribui no brief os números de cada frente
   antes do fan-out (frente A → próximo livre, frente B → +1). Duas branches que «varrem e incrementam» apanham o mesmo número (aconteceram dois D98).
4. Mostrar o rascunho; escrever só depois de aprovado.
5. «Porque escolhemos X?» → procurar em `docs/DECISIONS.md` (ou `docs/adr/README.md`), apresentar Contexto + Decisão; não existe → oferecer registá-la agora.

## Prefixo `D` é só do registo de decisões

`D11`, `D98`… são **só** entradas de `docs/DECISIONS.md` / `docs/adr/`. Folhas de trabalho (respostas de entrevista, triagem,
listas de opções, rascunhos) usam `R1`, `A1`, `V1` — nunca `D`. Documentos citam a decisão **com o título**, nunca um rótulo de
folha de trabalho; se o título não bater com o que o texto afirma, parar e reportar.
> Caso real (2026-09-09): uma folha de trabalho numerou respostas `D11-D67` enquanto `docs/DECISIONS.md` tinha `D11-D32` com outro
> significado — **323 citações** ficaram a apontar para a decisão errada.

## Ciclo de vida e revogação

`proposta → aceite → [obsoleta | substituída por D<M>]` — a substituída liga sempre à nova.

Uma decisão revogada **não se apresenta como defeito**: o código continua a fazer o que ela manda e nenhum gate acusa. O sinal costuma
ser o utilizador a descrever o produto de forma diferente da decisão. Ao revogar:
1. **`grep` pelo número** (`D34`, `ADR-0034`) em `docs/`, `src/` e nos textos de interface — `grep -rn "D34" docs src resources`.
2. **Listar os dependentes** — cada ficheiro que a assumia (docs de teste, componentes, PRD).
3. **Escrever o que se perde**, por extenso, na entrada nova.
4. **Marcar a antiga como substituída** com ligação — nunca apagar.

Caso real (projecto interno, 2026-08-25): 4 decisões revogadas na mesma sessão; `COMO-TESTAR.md`, `Brain.tsx` e `PRD.md` continuaram a citar a
decisão morta — foi a varredura final que apanhou, porque o passo 1 não existia.

## Ligações

- `plan` Fase 3 fechada com decisão tomada → sugerir entrada.
- `tech-spec` §8 (decisões técnicas) → as significativas ganham entrada.
- PRD com «Decision Log» → linha de resumo lá, entrada completa aqui.
- `/save` → se a sessão criou decisões, dizê-lo no resumo.
