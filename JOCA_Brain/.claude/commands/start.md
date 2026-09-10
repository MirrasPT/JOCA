# /start — arranque de projecto (novo ou existente)

Entrada única de qualquer projecto: entrevista por formulários → PRD inicial → stack da casa →
infra → direcção de design → engata na execução.

`Read(".claude/skills/start.md")` — **a doutrina completa vive lá**. Este comando não a duplica:
lê a skill e segue-a à letra (regras de formulário, Fase 0 de leitura do disco, fases, artefactos).

`/start [nome-do-projeto]` — sem argumento, o nome sai da pasta actual e confirma-se no formulário.

## Fluxo

1. `Read(".claude/skills/start.md")` e seguir as fases de lá, de fio a pavio.
2. Stack: `rules/stack-padrao.md` (a stack da casa). Sair dela exige razão em `docs/DECISIONS.md`.
3. A **forma de trabalho** que a skill instala (issue antes de código · design validado antes de UI ·
   testes em sessão separada · `PROGRESSO.md` + `docs/DECISIONS.md` · ondas com portão) é **regra
   global**, não uma consequência deste comando — `rules/pipelines.md` §Doutrina de projecto.
4. Projecto que já existe em disco liga-se com o **mesmo** questionário, pré-preenchido a partir dos
   ficheiros encontrados: o utilizador confirma em vez de escrever.

## Regras

- Nada é irreversível até ao scaffold. Escrever por cima de ficheiro existente → nome irmão
  versionado, nunca sobrescrever (soul.md / `rules/task-intake.md`).
- Não inventar conteúdo de produto: o problema, o público e as fronteiras são do utilizador.

## Próximo passo (chain)

- Documentos e decisões fechados → skill `executar-projeto` (fundação → design → gate → ondas).
  Notificar `[chain → executar-projeto]`. Ver `rules/chaining.md`.


---

## Autorização do `Workflow` (ferramenta do harness)

**Correr `/start` é opt-in explícito do utilizador para a ferramenta `Workflow`.** Não perguntes se
podes orquestrar — se o trabalho se parte em fases com fan-out, autora o script e **chama `Workflow`**.
Quando o script for desnecessário, `Agent()` em paralelo no mesmo turno serve na mesma.

Travões que **não** caem com esta autorização:
- **Recon barato ANTES de autorar** o script (`rules/pipelines.md`) — `grep`/`ls` ao domínio, inline.
- **Gate de 1 linha** em irreversível (deploy · push · migration · delete · payment · auth).
- **Verificador ≠ produtor** — quem escreve não assina o gate (`.joca/loop.json`).
- **Tamanho** vem do `/config` ("Dynamic workflow size"), não deste comando.
- **Custo anunciado**: ≥6 agentes ou loop de rondas → ordem de grandeza de tokens antes de lançar.
