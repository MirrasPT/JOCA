# JOCA Hooks

11 hooks ligados em `.claude/settings.json` (runtime `node`, excepto `check-skill-paths.sh` que é bash e vive em `.claude/scripts/`). Paths absolutos no settings — no Windows o cwd dos hooks não é garantidamente a raiz do repo.

| Hook | Evento (matcher) | Função | Armado por |
|---|---|---|---|
| `check-freeze.js` | PreToolUse (Edit\|Write) | Bloqueia edições fora do scope trancado | flag `.joca/freeze.flag` — skill `freeze`; desarma `unfreeze` |
| `check-tdd.js` | PreToolUse (Edit\|Write) | Guard test-first: código de produção sem teste tocado → `ask` (nunca deny) | flag `.joca/tdd.flag` — skill `tdd`; desarma `unfreeze` |
| `check-careful.js` | PreToolUse (Bash) | Avisa/pede confirmação em comandos destrutivos | flag `.joca/careful.flag` — skills `careful`/`guard`; desarma `unfreeze` |
| `session-intake.js` | SessionStart | Injecta contexto de arranque da sessão | sempre ligado |
| `prompt-triage.js` | UserPromptSubmit | Injecta task-intake (4 vias) a cada prompt | sempre ligado |
| `track-changes.js` | PostToolUse (Write\|Edit) | Regista ficheiro tocado + domínio em `.joca/test-queue.jsonl` | sempre ligado |
| `check-skill-paths.sh` | PostToolUse (Write\|Edit) | Valida paths referenciados em skills (bash, em `.claude/scripts/`) | sempre ligado |
| `skill-lint.js` | PostToolUse (Write\|Edit) | Lint de frontmatter quando o ficheiro é uma skill (não-bloqueante) | sempre ligado |
| `stop-checkpoint.js` | Stop (1º do array) | Auto-checkpoint se a queue tem código (corre ANTES do dispatch, que limpa a queue) | sempre ligado |
| `auto-test-dispatch.js` | Stop (2º do array) | Lê a queue e recomenda testers; limpa a queue | sempre ligado |
| `stop-continuar.js` | Stop (3º do array) | Bloqueia o fim do turno enquanto `.joca/loop.json` tiver passos pendentes ou feitos-por-verificar; recusa verificação assinada pelo produtor | contrato `.joca/loop.json`; kill-switch `.joca/loop-off.flag` |

## Pipeline de auto-test

1. Write/Edit → `track-changes.js` faz append a `.joca/test-queue.jsonl` (ficheiro + domínio).
2. Stop → `stop-checkpoint.js` grava checkpoint se houver código na queue; depois `auto-test-dispatch.js` lê a queue e recomenda testers.
3. O main loop despacha os testers sem perguntar. Queue limpa a cada Stop.

## Contrato de continuidade (`.joca/loop.json`)

Escrito pelo main loop ao arrancar trabalho multi-passo (via C/D ou pipeline). Sem ele o
`stop-continuar.js` é no-op — o loop nunca se auto-inicia.

```json
{
  "objectivo": "uma frase",
  "criado": "2026-08-20T10:00:00Z",
  "max_iteracoes": 4,
  "aguarda_utilizador": false,
  "passos": [
    { "id": "1", "desc": "…", "estado": "pendente|feito|verificado",
      "produtor": "frontend-agent", "verificador": "" }
  ]
}
```

`estado` só passa a `verificado` quando `verificador` ≠ `produtor` e há evidência. O hook escreve
`iteracao`, `sem_progresso` e `assinatura`; apaga o ficheiro quando tudo fica verificado ou ao fim
de 6 h. Kill-switch: `touch .joca/loop-off.flag`. Num projecto-alvo, garantir `.joca/` no
`.gitignore` (no Brain já está: `JOCA_Brain/.gitignore:2`).

Hooks flag-file são no-op sem a flag respectiva — custo zero quando desarmados. Wiring completo: `install.md` FASE EXECUCAO 7.
