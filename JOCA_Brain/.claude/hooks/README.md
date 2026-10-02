# JOCA Hooks

14 hooks ligados em `.claude/settings.json` (runtime `node`, excepto `check-skill-paths.sh` que é bash e vive em `.claude/scripts/`). Paths absolutos no settings — no Windows o cwd dos hooks não é garantidamente a raiz do repo.

| Hook | Evento (matcher) | Função | Armado por |
|---|---|---|---|
| `check-freeze.js` | PreToolUse (Edit\|Write) | Bloqueia edições fora do scope trancado | flag `.joca/freeze.flag` — skill `freeze`; desarma `unfreeze` |
| `check-tdd.js` | PreToolUse (Edit\|Write) | Guard test-first: código de produção sem teste tocado → `ask` (nunca deny) | flag `.joca/tdd.flag` — skill `tdd`; desarma `unfreeze` |
| `guard-claudemd.js` | PreToolUse (Edit\|Write) | Anti-inchaço dos `CLAUDE.md`: `deny` a linha NOVA >250 chars com caminho de disco/tabela de projecto em **todos** os `CLAUDE.md`; acima do orçamento `deny` a crescimento >200 só no global (aviso nos outros); cópia carimbada em `.joca/backups/claudemd/` antes de deixar passar; aviso quando um `.claude/rules/*.md` cresce. `--auditar <f>` lista linhas gordas antigas | orçamento em `claudemd-budget.json`; fail-open. Memória em 3 níveis: `CLAUDE.md` = nome · `memory/INDEX.md` = resumo · `memory/projects/` = detalhe |
| `check-careful.js` | PreToolUse (Bash) | Avisa/pede confirmação em comandos destrutivos | flag `.joca/careful.flag` — skills `careful`/`guard`; desarma `unfreeze` |
| `guard-git-add.js` | PreToolUse (Bash) | `deny` a `git add -A`/`--all`/`.`/`:/` com agentes vivos (comando vindo de subagente, ou transcript de subagente escrito há < 2 min); `git add <caminho>` passa sempre | sempre ligado; fail-open |
| `session-intake.js` | SessionStart | Injecta contexto de arranque da sessão | sempre ligado |
| `prompt-triage.js` | UserPromptSubmit | Injecta task-intake (4 vias) a cada prompt | sempre ligado |
| `track-changes.js` | PostToolUse (Write\|Edit) | Regista ficheiro tocado + domínio em `.joca/test-queue.jsonl` | sempre ligado |
| `check-skill-paths.sh` | PostToolUse (Write\|Edit) | Valida paths referenciados em skills (bash, em `.claude/scripts/`) | sempre ligado |
| `skill-lint.js` | PostToolUse (Write\|Edit) | Lint de frontmatter quando o ficheiro é uma skill (não-bloqueante) | sempre ligado |
| `auto-checkpoint.js` | PostToolUse (Write\|Edit), async | Rede de segurança entre `/save`: checkpoint `auto-wip` a cada 12 ficheiros ou 45 min | sempre ligado |
| `stop-checkpoint.js` | Stop (1º do array) | Auto-checkpoint se a queue tem código (corre ANTES do dispatch, que limpa a queue) | sempre ligado |
| `auto-test-dispatch.js` | Stop (2º do array) | Cruza a queue com `git status`, recomenda testers **uma vez** por conjunto, limpa a queue; cala-se com `.joca/loop/<session_id>.json` por fechar | sempre ligado |
| `stop-continuar.js` | Stop (3º do array) | Bloqueia o fim do turno enquanto `.joca/loop/<session_id>.json` tiver passos pendentes ou feitos-por-verificar; recusa verificação assinada pelo produtor; passos `em_curso` (agente de fundo, id em `agente`) não bloqueiam nem contam iteração | contrato `.joca/loop/<session_id>.json`; kill-switch `.joca/loop-off.flag` |

## Pipeline de auto-test

1. Write/Edit → `track-changes.js` faz append a `.joca/test-queue.jsonl` (ficheiro + domínio).
2. Stop → `stop-checkpoint.js` grava checkpoint se houver código na queue; depois `auto-test-dispatch.js` lê a queue e recomenda testers.
3. O main loop despacha os testers sem perguntar. Queue limpa a cada Stop.

Quatro travões contra a recomendação-em-loop (medido: 6-9 recusas iguais por sessão):

| Travão | Regra | Efeito na fila |
|---|---|---|
| Trabalho em curso | `.joca/loop/<session_id>.json` (no cwd ou no Brain) com passo ≠ `verificado` | **não** limpa — a recomendação espera |
| O que mudou | ficheiro ausente do disco, ou dentro do repo e ausente de `git status --porcelain --ignored`, não conta. Sem git → conta tudo (fail-open) | limpa |
| Memória de recusa | mesmo conjunto de testers já recomendado nesta `session_id`, ou há < 15 min → silêncio (`.joca/test-dispatch-memo.json`) | limpa |
| Saídas explícitas | a mensagem nomeia as 3 saídas de 1 linha, incluindo "a sessão proíbe despachar agentes" | — |

Ordem no array `Stop` (não trocar): `stop-checkpoint` lê a queue **antes** de o dispatch a limpar;
`stop-continuar` vai a seguir porque é o único que emite `decision: block` — a recomendação do
dispatch tem de estar já escrita quando o turno é bloqueado.

## Contrato de continuidade (`.joca/loop/<session_id>.json`)

Escrito pelo main loop ao arrancar trabalho multi-passo (via C/D ou pipeline). Sem ele o
`stop-continuar.js` é no-op — o loop nunca se auto-inicia.

```json
{
  "objectivo": "uma frase",
  "sessao": "<session_id>",
  "criado": "2026-08-20T10:00:00Z",
  "max_iteracoes": 4,
  "aguarda_utilizador": false,
  "passos": [
    { "id": "1", "desc": "…", "estado": "pendente|em_curso|feito|verificado",
      "produtor": "frontend-agent", "verificador": "", "agente": "<id, só com em_curso>" }
  ]
}
```

`estado` só passa a `verificado` quando `verificador` ≠ `produtor` e há evidência. `em_curso` (+ `agente`)
marca um passo entregue a um agente de fundo: o turno pode terminar, a notificação de conclusão reacorda a
sessão; não esconde `feito` por verificar nem escapa à expiração de 6 h. O hook escreve
`iteracao`, `sem_progresso` e `assinatura`; apaga o ficheiro quando tudo fica verificado ou ao fim
de 6 h. Kill-switch: `touch .joca/loop-off.flag`. Num projecto-alvo, garantir `.joca/` no
`.gitignore` (no Brain já está: `JOCA_Brain/.gitignore:2`).

Hooks flag-file são no-op sem a flag respectiva — custo zero quando desarmados. Wiring completo: `install.md` FASE EXECUCAO 7.
