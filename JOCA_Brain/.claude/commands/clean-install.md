# /clean-install — auditar, optimizar e consolidar instalações JOCA

Para quando alguém já usa JOCA há tempo (possivelmente com várias cópias/versões na mesma
máquina) e se queixa de **consumo excessivo de tokens**. Este comando não copia nada às cegas:
audita tudo o que existe, compara com o baseline actual do `Joca-Open-Source`, propõe uma tabela de
optimizações, e só depois de aprovada consolida a memória, arquiva as instalações antigas numa
pasta `Old` e promove uma instalação nova, limpa e optimizada a produção.

**Objectivo em cada fase: reduzir tokens sem perder memória.** Nunca apagar — arquivar. Nunca
aplicar sem mostrar a tabela e esperar aprovação explícita. Termina sempre com o **graphify**
instalado e correndo sobre TODOS os projectos ligados ao JOCA + o próprio JOCA_Brain — é a peça
final que torna a memória (de código E de conhecimento) barata de consultar dali em diante.

Scope: a máquina do utilizador (instalações JOCA + config/MCPs/CLIs relacionados + todos os
projectos que o JOCA já conhece via `memory/projects/`). Não toca em ficheiros fora disto.

---

## Fase -1 — Onde é que isto está a correr (ler primeiro, sempre)

Este comando **nunca deve correr de dentro de uma instalação JOCA já existente e madura**
(`memory/soul.md` já calibrado, sem sinais de acabar de ser clonada). Se corresse lá, estaria a
tentar arquivar/mover a própria pasta de onde o Claude Code está a correr — self-reference, risco
de estado inconsistente a meio. O fluxo correcto (documentado em `clean-install.md` da raiz do
`Joca-Open-Source` + no `README.md` público): o utilizador cria uma pasta nova e vazia, abre um
terminal Claude Code lá, e o bootstrap clona o `Joca-Open-Source` PARA DENTRO dela antes de este
comando arrancar.

**Verificar ao arrancar:**
- Se `memory/soul.md` do cwd já está calibrado (sem placeholders `<YOUR_*>`) e o repo tem histórico
  de mais de poucos commits desde o clone → provável instalação madura, não bootstrap. PARAR e
  instruir o utilizador a criar uma pasta nova vazia e recomeçar pelo `clean-install.md` da raiz.
- Caso normal (bootstrap): cwd é uma cópia fresca do `Joca-Open-Source`, acabada de clonar — **esta
  pasta é a instalação NOVA a partir de agora, e nunca entra na lista de "instalações antigas" que
  a Fase 0/1 vai descobrir noutros sítios da máquina.** Não se move mais tarde (ver Fase 4).

## Fase 0+1 — Descoberta e auditoria (delegada, read-only)

Despachar `Agent(subagent_type="clean-install-audit")` com o brief:
- Objectivo: encontrar TODAS as instalações JOCA nesta máquina **excepto o cwd actual** (é a
  instalação nova, ver Fase -1 — não é um achado, é o baseline), inventariar MCPs/CLIs
  relacionados, e comparar cada instalação encontrada contra ESTE cwd (já é o baseline mais
  recente do `Joca-Open-Source`, clonado no bootstrap — não precisa de clonar outro).
- Step 0 obrigatório: `Read(".claude/agents/clean-install-audit.md")` já traz a doutrina completa
  (o agente lê-a a si próprio como primeiro passo).
- Não aplicar nada. Não apagar nada. Só ler, comparar, e escrever o relatório.
- Devolver: path do relatório (`~/joca-clean-install-report-<data>.md`) + resumo de 3-5 linhas
  (quantas instalações encontradas, achado mais grave, poupança estimada de tokens).

Enquanto não houver relatório, não avançar para a Fase 2.

## Fase 2 — Tabela de recomendação + gate único

Ler o relatório do agente. Apresentar ao utilizador uma tabela numerada:

| # | Categoria | Item | Estado actual | Recomendação | Impacto (tokens) | Risco |
|---|---|---|---|---|---|---|

Categorias: **OPTIMIZAR** (cortar bloat sem mudar comportamento — descriptions de agentes,
CLAUDE.md/soul.md inchados) · **ACTUALIZAR** (skill/agente/regra atrás do baseline) · **APAGAR**
(skill morta, MCP banido instalado, instalação duplicada) · **MCP→CLI** (trocar um MCP caro por um
CLI equivalente) · **SUBSTITUIR** (ferramenta/plataforma diferente reduz custo) · **MANTER**
(já está bem — lista para transparência, não para acção).

Perguntar também, explicitamente, separado da tabela: **o `soul.md`/`CLAUDE.md` actuais ainda
reflectem quem a pessoa é?** Mostrar os valores actuais (autonomy_level, communication_mode,
alignment do utilizador) e perguntar via `AskUserQuestion` — manter tal como está, ou recalibrar
(mesmas 4 perguntas do `/migrate` Fase 4: autonomia, comunicação, tratamento de erros, auto-test).

**Gate obrigatório** — aceitar resposta em qualquer destas formas:
- `all` — aplica tudo o que está na tabela.
- `1,3,5` — só os números indicados.
- `all except 4` — tudo menos o indicado.
- `cancel` — pára aqui, nada muda, relatório fica guardado para revisão posterior.

Nada da Fase 3 em diante corre sem esta resposta.

## Fase 3 — Aplicar (só após aprovação)

Esta pasta (cwd) já é um clone fresco do `Joca-Open-Source` — não há checkout/clone novo a fazer
aqui, isso já aconteceu no bootstrap (Fase -1). Só falta aplicar por cima:

1. Aplicar só os itens aprovados na Fase 2, por esta ordem de prioridade: paths mortos/segurança
   primeiro, depois optimizações (cortes de bloat), depois actualizações, depois MCP→CLI/substituições.
2. **Consolidar memória de TODAS as instalações antigas encontradas** (esta instalação, por ser
   fresca, ainda não tem `memory/projects/`, `memory/tools/`, `memory/feedback/` populados):
   - `memory/projects/*.md` — por nome de ficheiro; em conflito (mesmo nome, conteúdo diferente em
     2+ instalações antigas), o `mtime` mais recente vence — anexar uma nota "conteúdo mais antigo
     substituído, ver arquivo em `Old/`" para não perder rasto.
   - `memory/tools/*.md` — idem.
   - `memory/feedback/*` — **nunca se descarta**: agregar tudo; em conflito de NOME de ficheiro
     (não de conteúdo), renomear com sufixo da instalação de origem em vez de sobrescrever.
   - `memory/soul.md` — recalibrado (se decidido na Fase 2) ou copiado tal e qual da instalação
     antiga mais recente.
3. Regenerar `SKILL_INDEX.json` (`python3 .claude/scripts/build-skill-index.py`) e os agentes-espelho
   (`node .claude/scripts/skill-agents.mjs`) sobre esta instalação.
4. **Graphify é OBRIGATÓRIO nesta instalação** (ver `memory/tools/clis.md`) — se não estiver
   instalado na máquina, instalar agora: `uv tool install graphifyy` (entrypoint `graphify`) +
   `bash .claude/scripts/graphify-patch.sh`. Sem isto a Fase 6 abaixo não tem o que correr.

## Fase 4 — Arquivar as instalações antigas + apontar produção para aqui (confirmação curta)

**Esta instalação (cwd) NÃO se move** — o utilizador já escolheu este local de propósito ao criar
a pasta no bootstrap (Fase -1). Só as instalações antigas se mexem, e só para arquivo. 1 linha de
confirmação antes de mover seja o que for (soul.md: nunca irreversível/sem-volta-fácil sem
confirmação explícita, mesmo sendo "mover" e não "apagar").

1. Criar `Old/` (default: `$HOME/Old`, ou perguntar se já existir algo com esse nome).
2. Mover (nunca apagar) CADA instalação antiga encontrada na Fase 0 para
   `Old/<nome-original>-<data>` — preservar tudo, incluindo `.git/`.
3. Actualizar `~/CLAUDE.md` (secção JOCA) para apontar para o path desta instalação (cwd) como a
   produção — é o único "apontar produção para aqui" que este comando faz; nenhuma pasta se move
   para nenhum outro sítio.

## Fase 5 — Verificação final

1. `node .claude/scripts/joca-doctor.mjs` na instalação nova — tem de sair limpo (exit 0).
2. Se houver `JOCA_OS`: `npm run setup` + arrancar + `curl` ao health-check (mesmo padrão do
   `/migrate` Fase 6).

## Fase 6 — Graphify em todos os projectos (obrigatória, corre sempre no fim)

Só depois de tudo o resto estar feito (memória consolidada, instalação promovida, `joca-doctor.mjs`
limpo): percorrer TODOS os projectos ligados ao JOCA (um `.md` por projecto em
`memory/projects/*.md`, cada um com um campo `directorio:`/`path:` no frontmatter) e correr o
graphify em cada um — este é o motivo de todo o resto: dar ao JOCA/Claude Code uma memória de
código barata de consultar em vez de reabrir ficheiros gigantes.

Para cada projecto (path do frontmatter, ler um a um):

```bash
for PY in python python3; do command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import graphify" 2>/dev/null && break; done
"$PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('<path-do-projecto>'))"
"$PY" .claude/scripts/graphify-deps.py "<path-do-projecto>"
```

**Política de inclusão/exclusão (obrigatória, não alterar por projecto):**
- **Incluir tudo o que é conteúdo**: código (html/css/js/ts/php/py/etc.), texto (com o conteúdo,
  não só o nome do ficheiro), imagens (jpg/png/webp/svg/etc.), ficheiros de media (vídeo/áudio).
  O graphify v0.8.5+ já mapeia código + docs/PDF/imagens/vídeo nativamente — não restringir tipos.
- **Excluir só infra/dependências**: `node_modules/`, `vendor/`, `.venv/`, build output
  (`dist/`, `build/`, `.next/`), lockfiles (`package-lock.json`, `*.lock`), cache, `.git/` — é
  exactamente o que os `.graphifyignore` do repo já fazem (raiz + `JOCA_Brain/`); **não inventar
  um `.graphifyignore` novo por projecto** a menos que o projecto tenha ruído próprio óbvio.
- Nunca excluir por SER imagem/media/texto — só por SER infra/dependência/build.

Depois de cada projecto: confirmar que `<projecto>/graphify-out/graph.json` foi criado/actualizado
(`mtime` recente). Se um projecto não tiver código (só design/conteúdo/marketing), sinalizar e
saltar — mesma regra do `/start`.

**No fim, correr também sobre o próprio JOCA_Brain** (conhecimento + código, não só um dos dois):

```bash
node .claude/scripts/joca-graph.mjs                # grafo de conhecimento (skills/agents/commands/projects)
"$PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"   # código do próprio Brain
```

Relatório final desta fase: quantos projectos tinham grafo desactualizado/inexistente e foram
(re)gerados, quantos foram saltados (sem código), e confirmação de que o grafo do próprio
`JOCA_Brain` está fresco.

## Fase 7 — Relatório final do comando

- o que foi arquivado (paths dentro de `Old/`);
- o que foi fundido (memória consolidada, com nota de qualquer conflito resolvido por mtime);
- o que foi optimizado (com estimativa antes/depois de tokens — CLAUDE.md+soul.md, descriptions
  de agentes, MCPs trocados);
- estado do graphify: instalado/actualizado, quantos projectos ganharam grafo novo, JOCA_Brain
  incluído;
- o que ficou pendente para a pessoa decidir à mão (ex.: skills sinalizadas como "possivelmente
  mortas" mas não apagadas automaticamente).

---

## Regras (não negociáveis)

- **Nunca correr este comando de dentro de uma instalação JOCA já existente e madura** (ver Fase
  -1) — só a partir de uma pasta nova, vazia, clonada de fresco no bootstrap. Se detectado o
  cenário errado, parar e redirigir para o bootstrap, não continuar.
- **Esta instalação (cwd) nunca se move** — só as antigas vão para `Old/`. Não há "promover
  movendo", há "arquivar as outras e apontar `~/CLAUDE.md` para aqui".
- Nunca apagar uma instalação antiga — só mover para `Old/`.
- Nunca aplicar uma recomendação sem ela ter passado pela tabela da Fase 2 e pelo gate.
- Nunca copiar `memory/` às cegas — sempre passar pela consolidação por `mtime` da Fase 3.
- `browser-use` e o MCP do Playwright (`@playwright/mcp`) são achados de categoria **APAGAR**
  sempre que encontrados — política vigente desde 2026-08-05 (ver `memory/tools/clis.md`).
- `graphify` é **obrigatório** — instalar se faltar (Fase 3), nunca saltar a Fase 6.
- A Fase 6 nunca corre antes da Fase 4/5 — só faz sentido gerar grafos sobre a instalação já
  verificada, não sobre a antiga que vai para `Old/`.
