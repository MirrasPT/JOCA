# /joca-doctor — diagnóstico da instalação

Atalho para o script `.claude/scripts/joca-doctor.mjs`. Node ESM, zero dependências, só leitura
(excepto com `--fix`). É o mesmo check que o `/save`, o `/update-joca` e o `/clean-install` usam
como gate.

## Correr

```bash
node .claude/scripts/joca-doctor.mjs          # só diagnóstico
node .claude/scripts/joca-doctor.mjs --fix    # aplica as correcções seguras
```

Exit code: `0` = sem erros (⚠ não contam) · `1` = pelo menos um ✗.

## O que verifica

| # | Secção | Apanha |
|---|---|---|
| 1 | Runtimes | Node ≥ 18 · python3 |
| 2 | CLIs | `claude` · `codex` · `agy` no PATH (informativo) |
| 3 | `settings.json` + hooks | JSON válido · placeholders `<JOCA_ROOT>` por substituir · ficheiros de hook que não existem no disco |
| 4 | Inventário vs índices | disco × `memory/SKILL_INDEX.json` × contagens do `README.md` |
| 5 | Bridges cross-CLI | `.agents/` e `.codex/` stale face ao `.claude/` · descriptions malformadas nos `.toml` |
| 6 | `GEMINI.md` / `AGENTS.md` | existem e estão em sincronia com o canónico |
| 7 | `memory/` | `soul.md` ainda em template · `projects/` e `feedback/` existem |
| 8 | `JOCA_OS` | JSON de `data/` válido · `node_modules` instalado (só leitura) |
| 9 | Integridade de conteúdo | ponteiros citados em skills/agents/commands/rules que não resolvem · skills sem entrada no trigger map (existem mas nada as dispara) · skills de execução sem agente gémeo · `.bat`/`.cmd` com LF (não arrancam no Windows) |

## Ler o resultado

- **Clone acabado de fazer → 1 ✗ nos placeholders `<JOCA_ROOT>` é o estado CORRECTO.** O repositório
  publica-se com os placeholders; quem os substitui é o `/install`. Não "corrigir" o `settings.json`
  à mão — é exactamente o que não deve ir para o repositório.
- Pelo mesmo motivo, o `soul.md` em template dá ⚠ num clone novo. Ambos desaparecem depois do `/install`.
- `.agents/` stale → `bash .claude/scripts/compile-bridges.sh`.
- Índices fora de sincronia → `python3 .claude/scripts/build-skill-index.py` (Windows: `python`).

## Quando correr

- Depois de adicionar/mudar skills, agentes, comandos ou hooks.
- Antes de publicar (junto com `public-release-audit`).
- Como gate de `/save` PASSO 6, `/update-joca` e `/clean-install` — comparar o resumo com o baseline
  do início da corrida: um ⚠ novo é defeito da corrida, não ruído.
