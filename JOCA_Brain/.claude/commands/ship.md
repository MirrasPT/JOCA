# /ship — Levar código a PR (sync → testes → review → push → PR)

Adaptado do `ship` do gstack. Pipeline de envio pré-merge: sincroniza a base, corre testes, revê o diff, actualiza versão/CHANGELOG, commita, e **só depois do gate** faz push + abre PR. Nunca faz push/PR às cegas.

⚠ Contém passos **irreversíveis** (push, PR) → gate de confirmação obrigatório (soul.md / Decision Filter).

## Quando usar
- "ship", "ship it", "põe em PR", "push para main", "está pronto, envia".
- Proactivo: o user diz que o código está pronto / quer abrir PR → invocar isto (não fazer push directo).

## Pipeline (auto-runner; pára nos gates)

0. **O merge é possível? (medir antes de o prometer)** — sobretudo em repo de terceiro. Ler as regras do ramo-alvo e as permissões:
   ```bash
   gh api repos/<o>/<r>/rules/branches/<base>          # regras efetivas (rulesets) no ramo
   gh api repos/<o>/<r>/rulesets                        # lista; detalhe em rulesets/<id>
   gh api repos/<o>/<r> --jq .permissions.admin         # posso contornar/fundir?
   gh pr view <N> --json mergeStateStatus,reviewDecision   # se o PR já existir
   ```
   Aprovações exigidas (`required_approving_review_count`) e `required_status_checks.context` vs `name:` dos jobs do CI → o gate do passo 7 diz **se o merge é possível e o que falta**. Caso: «PR, push, merge na main» num repo de terceiro — o ruleset que exigia aprovação só apareceu na hora do merge (2026-09-25).
   **O CI cobre as pastas do diff?** Antes de usar «CI verde» como gate, listar os jobs do workflow (`.github/workflows/*.yml`) e confirmar que cobrem as pastas alteradas (`git diff --name-only origin/<base>...HEAD`). Não cobrem → **gate local obrigatório** para essas pastas (passo 3) + issue para acrescentar o job em falta. Caso real (2026-09-17): o CI só tinha o job da API e o build do web teve de ser provado localmente.
1. **Estado limpo** — `git status`. Working tree com lixo não-relacionado → resolver/avisar antes (não misturar no commit de ship).
2. **Sync da base** — detectar branch base (`main`/`master`), `git fetch`, ver divergência. Se a feature-branch está atrás → integrar a base (merge/rebase conforme convenção do repo). Conflitos → resolver (ou delegar `pr-repair`).
2b. **⛔ Vários PRs a fundir num repo SEM CI** (`ls .github/workflows/` vazio, ou CI sem minutos) — fundir **um de cada vez**: `git fetch` → rebase do PR seguinte sobre a **main actual** (a que já tem o anterior) → **gates completos** (passo 3, suite inteira + estático) sobre essa árvore → merge → a verificação do PR seguinte parte da **main nova**. Verificar cada PR em separado contra a main antiga não prova nada sobre a soma: dois PRs com `git merge-tree` sem conflito textual deixaram o typecheck da main vermelho juntos (import perdido num ficheiro que os dois tocaram). Merge sem CI é push para a main → gate do passo 7 por merge.
3. **Testes + gate estático** — correr a suite do projecto (detectar: `npm test`/`pest`/`vitest`/`pytest`…). **Vermelho → parar** e reportar (não enviar código partido). Sem suite → `tester-code` (review) como rede mínima.
   **Gate estático (mínimo, sempre):** `tsc --noEmit` · `npm run build` · `php -l` · **`eslint`** (script de lint do projecto, ou `npx eslint .` se não houver).
   **Byte NUL nos staged:** `git diff --cached --name-only --diff-filter=ACM | while read f; do file -b "$f" | grep -q '^data$' && echo "BINÁRIO: $f"; done` — um NUL literal num `.ts` passa `tsc`, `eslint`, a suite e o CI, e faz `grep -r` saltar o ficheiro em silêncio. Acusa em ficheiro de código/texto → **parar**; imagens e afins legítimos dão `PNG image data`/…, não `data` (verificado 2026-09-01).
   O eslint não é opcional em projectos JS/TS: `react/jsx-no-undef` e `no-undef` são a única coisa que apanha identificadores de componente indefinidos, que o Vite deixa passar — um `<Check>` (lucide) usado em JSX sem import passou o build verde e só rebentou quando o utilizador abriu o modal. Ver `rules/pipelines.md` §"Gates: estático ≠ runtime" (o gate de runtime aplica-se na mesma às categorias listadas lá).
4. **Review do diff** — `git diff` da base: scope drift? segredos? `console.log`/`dd()` esquecidos? ficheiros a mais? Despachar `tester-code` se o diff for não-trivial. Segredos no diff → **parar** (não commitar segredos).
5. **Versão + CHANGELOG** (se o projecto os tiver) — bump `VERSION`/`package.json`, entrada no `CHANGELOG.md` (o que mudou, em 1-3 linhas).
6. **Commit** — mensagem coesa (convenção do repo). Co-authored trailer conforme regras do ambiente.
   Commit que **acrescenta um teste que protege uma costura** leva na mensagem a linha `parti-o de propósito e confirmei que acusa: <como>` — é o que distingue um teste de uma decoração; sem ela, o passo «um gate que nunca falhou é um gate por testar» fica por hábito, não por processo.
6b. **⛔ Gate de repo público** — `git remote get-url origin`. Se o `origin` for um repo **público**, correr a skill `public-release-audit` como **gate obrigatório antes do push**, sobre o conjunto exacto que vai sair:
   ```bash
   git remote get-url origin
   git diff origin/<base>..HEAD --name-only
   ```
   O `/ship` é quem faz o push e **não conhecia** esta skill — só o `/save` a citava, portanto a auditoria de publicação nunca corria no momento em que o código sai. Achado da auditoria (PII, caminhos reais, clientes, credenciais) → **parar**, não avisar.
6c. **Issues da onda vs `Closes #`** — fundir um PR só fecha os issues que alguém marcou. Listar os da onda (`gh issue list --milestone "<onda>" --state open`) e confrontar com os `Closes #N` dos commits do branch (`git log origin/<base>..HEAD --format=%B | grep -oiE '(close[sd]?|fix(e[sd])?|resolve[sd]?) #[0-9]+'`). Implementado e sem palavra de fecho → ganha `Closes #N` no corpo do PR, ou é reportado como **aberto de propósito**. Caso: 67 commits com `Closes #` em 9 issues; #88-#90 feitos e verificados ficaram abertos.
   **O inverso também falha — fechar um issue que não está inteiro.** Antes de um `Closes #N`, contar os itens da checklist do corpo (`gh issue view <N> --json body --jq .body | grep -cE '^[[:space:]]*- \[[ xX]\]'`). Mais de 1 item → o commit endereça-os todos, ou o issue fecha-se só com comentário parcial (fica aberto). **Issue-chapéu fecha por último, nunca por `Closes`.** Caso real (2026-09-18): um issue-chapéu com 8 pontos fechou por `Closes` com 2 feitos.
7. **⛔ GATE** — mostrar 1 linha: branch, nº de ficheiros, base, destino. Confirmar antes de push. Se o pedido inclui merge, a linha diz também **merge possível sim/não** (do passo 0) e o bloqueio medido — nunca «faço merge» sem o ter lido.
8. **Push + PR** — `git push`; abrir PR via `github` skill / `gh pr create` com título + corpo (resumo + test plan). Devolver o link.

9. **Merge (quando é o `/ship` a fundir)** — o resultado de um comando de **escrita** confirma-se **pelo efeito**, nunca pela saída: `gh pr merge` já devolveu `502 Bad Gateway` com o merge feito (a 2.ª tentativa respondeu «Merge already in progress»), e já saiu **vazio** com o PR fundido (verificado 2026-09-01 e 2026-09-12). Erro de rede ou saída vazia → **não repetir**; verificar:
   ```bash
   git fetch origin <base>
   git merge-base --is-ancestor <head-sha> origin/<base> && echo "merge está na base"
   gh pr view <N> --json state,mergedAt,closingIssuesReferences
   ```
   A **contabilidade** (estado do PR + issues fechados) confirma-se **em separado** da operação de git: o 502 pode deixar o merge feito e o PR `OPEN`, com os `Closes #` por fechar — nesse caso fechar os issues à mão, citando o merge commit.

   **⛔ PRs empilhados (stack):** apagar o ramo base **fecha** os PRs que o têm como base — não os reaponta. Antes de apagar o base (incluindo `--delete-branch` e `gh api -X DELETE .../git/refs/heads/<ramo>`), reapontar **todos** os dependentes:
   ```bash
   gh pr list --base <ramo-a-apagar> --json number --jq '.[].number'   # dependentes
   gh pr edit <n> --base main                                           # um por dependente
   ```
   e só depois apagar. Caso: 3 PRs dependentes fechados por um `DELETE` ao ref; recuperado recriando o ref e reabrindo (2026-09-29).
   **Gate numa cadeia empilhada:** o gate é o CI de cada PR **ou** o da ponta que o contém. Um PR intermédio pode ter de propósito um teste que só fica verde com o seguinte (teste de contrato entre issues) — nesse caso funde-se pela ponta (o GitHub marca o intermédio como fundido) e **comenta-se no PR intermédio** que entra pela ponta e porquê (2026-09-21).

## Regras
- **Nunca** push/PR sem o gate (passo 7), mesmo com autonomy alta — é irreversível/outward-facing.
- **Nunca** commitar segredos ou enviar testes vermelhos.
- Branch protegida (default `main`/`master`) → trabalhar em feature-branch + PR, nunca push directo (salvo instrução explícita).
- Registar a release no Brain se relevante: `node .claude/scripts/joca-brain.mjs decide --text "shipped <feature> em PR #N" --source user`.

## Próximo passo (chain)
- PR merged e há deploy a fazer → agente `deploy-executor` (corre pipeline + health-check; ⛔ gate próprio).
- PR vermelho (CI a falhar / conflitos / reviews de bot) → agente `pr-repair`. Ver `rules/chaining.md`.
  CI a falhar em **<10 s sem steps** → antes de diagnosticar código, ler as anotações do check-run (`gh api repos/<o>/<r>/check-runs/<id>/annotations`): faturação/minutos da organização esgotados falham assim (caso real, 2026-09-24). Não se resolve com commits — ver `agents/pr-repair.md` Step 4.
