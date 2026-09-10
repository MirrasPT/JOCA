# /executar-projeto — do PRD a produção

Segunda metade do arranque: pega no que o `/start` decidiu e **constrói**, do scaffold até produção.

`Read(".claude/skills/executar-projeto.md")` — **a doutrina completa vive lá**. Este comando não a
duplica: lê a skill e segue-a à letra (as quatro partes, cada uma com o seu critério de saída).

`/executar-projeto` — sem argumentos; o estado vem dos documentos em disco.

## Fluxo

```
E1 Fundação ──► E2 Design (bifurca) ──► E3 Ponto de situação ⏸ ──► E4 Ondas ──► produção
```

1. **Pré-requisito:** `docs/PRD.md` existe e a stack está decidida. Não existe → corre `/start` primeiro.
2. `Read(".claude/skills/executar-projeto.md")` e seguir as partes de fio a pavio.
3. Cada passo nomeia a skill/agente que o executa — `Read()` a skill (regra dos 60%) ou despacha o
   agente com brief + Step 0. Mapa passo→skill: `.claude/reference/start/execucao-mapa-skills.md`.
4. Estado partilhado em `PROGRESSO.md`; decisões em `docs/DECISIONS.md`.

## Regras

- **Não inventar scope:** o PRD é o contrato. Ideia nova a meio vira issue, não código.
- E3 é **gate de utilizador** (⏸) — não se atravessa sozinho.
- Irreversível (push, deploy, migration) → 1 linha de confirmação (`rules/task-intake.md`).
- Escrever por cima de ficheiro existente → nome irmão versionado, nunca sobrescrever.

## Próximo passo (chain)

- `planear-ondas` (E4) → `preparar-design`/`validar-design` por ecrã → `deploy-executor` no fim.
  Ver o `chain:` da skill e `rules/chaining.md`.


---

## Autorização do `Workflow` (ferramenta do harness)

**Correr `/executar-projeto` é opt-in explícito do utilizador para a ferramenta `Workflow`.** Não perguntes se
podes orquestrar — se o trabalho se parte em fases com fan-out, autora o script e **chama `Workflow`**.
Quando o script for desnecessário, `Agent()` em paralelo no mesmo turno serve na mesma.

Travões que **não** caem com esta autorização:
- **Recon barato ANTES de autorar** o script (`rules/pipelines.md`) — `grep`/`ls` ao domínio, inline.
- **Gate de 1 linha** em irreversível (deploy · push · migration · delete · payment · auth).
- **Verificador ≠ produtor** — quem escreve não assina o gate (`.joca/loop.json`).
- **Tamanho** vem do `/config` ("Dynamic workflow size"), não deste comando.
- **Custo anunciado**: ≥6 agentes ou loop de rondas → ordem de grandeza de tokens antes de lançar.
