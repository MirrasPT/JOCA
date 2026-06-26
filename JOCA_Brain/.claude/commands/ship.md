# /ship — Levar código a PR (sync → testes → review → push → PR)

Adaptado do `ship` do gstack. Pipeline de envio pré-merge: sincroniza a base, corre testes, revê o diff, actualiza versão/CHANGELOG, commita, e **só depois do gate** faz push + abre PR. Nunca faz push/PR às cegas.

⚠ Contém passos **irreversíveis** (push, PR) → gate de confirmação obrigatório (soul.md / Decision Filter).

## Quando usar
- "ship", "ship it", "põe em PR", "push para main", "está pronto, envia".
- Proactivo: o user diz que o código está pronto / quer abrir PR → invocar isto (não fazer push directo).

## Pipeline (auto-runner; pára nos gates)

1. **Estado limpo** — `git status`. Working tree com lixo não-relacionado → resolver/avisar antes (não misturar no commit de ship).
2. **Sync da base** — detectar branch base (`main`/`master`), `git fetch`, ver divergência. Se a feature-branch está atrás → integrar a base (merge/rebase conforme convenção do repo). Conflitos → resolver (ou delegar `pr-repair`).
3. **Testes** — correr a suite do projecto (detectar: `npm test`/`pest`/`vitest`/`pytest`…). **Vermelho → parar** e reportar (não enviar código partido). Sem suite → `tester-code` (review) como rede mínima.
4. **Review do diff** — `git diff` da base: scope drift? segredos? `console.log`/`dd()` esquecidos? ficheiros a mais? Despachar `tester-code` se o diff for não-trivial. Segredos no diff → **parar** (não commitar segredos).
5. **Versão + CHANGELOG** (se o projecto os tiver) — bump `VERSION`/`package.json`, entrada no `CHANGELOG.md` (o que mudou, em 1-3 linhas).
6. **Commit** — mensagem coesa (convenção do repo). Co-authored trailer conforme regras do ambiente.
7. **⛔ GATE** — mostrar 1 linha: branch, nº de ficheiros, base, destino. Confirmar antes de push.
8. **Push + PR** — `git push`; abrir PR via `github` skill / `gh pr create` com título + corpo (resumo + test plan). Devolver o link.

## Regras
- **Nunca** push/PR sem o gate (passo 7), mesmo com autonomy alta — é irreversível/outward-facing.
- **Nunca** commitar segredos ou enviar testes vermelhos.
- Branch protegida (default `main`/`master`) → trabalhar em feature-branch + PR, nunca push directo (salvo instrução explícita).
- Registar a release no Brain se relevante: `node .claude/scripts/joca-brain.mjs decide --text "shipped <feature> em PR #N" --source user`.

## Próximo passo (chain)
- PR aberto → `/canary`-equivalente: monitorizar pós-merge (ou `deploy-executor` se o merge dispara deploy). CI vermelho / reviews de bot → `pr-repair`. Ver `rules/chaining.md`.
