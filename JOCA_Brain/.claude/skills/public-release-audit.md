---
name: public-release-audit
description: "Preparar e auditar um repo antes de o empurrar para um remote que NÃO é o de trabalho — público, de um cliente, ou de outra organização (mesmo privado/internal). Varre por git e não por disco, apanha espelhos compilados, symlinks, metadados de autor e dependências da montagem pessoal do dono. MUST be invoked when the user says: publicar no repo público, open source release, preparar release público, scrub antes de publicar, auditar o que vai sair, sanitizar repo, push para repo de cliente, entregar código a terceiros, repo da org do cliente. SHOULD also invoke when: um push vai para um remote que não é o repo de trabalho (público, de cliente, de outra organização), ou quando se faz `git remote add` seguido de push para esse remote novo."
triggers: publicar repo público, open source release, release público, scrub PII, sanitizar repo, preparar publicação, o que vai sair no push, auditar release, público vs privado, PII scan, push para repo de cliente, entregar código a terceiros, repo da org do cliente, primeiro push para remote novo, adicionar segundo remote, repo internal, entrega ao cliente
chain: ship
metadata:
  origin: user
---
# public-release-audit — o que sai daqui serve a quem clona?

Auditar um repo antes de o empurrar para um remote que não é o de trabalho. Improvisar isto já custou
caro três vezes: 44 dos 52 achados de uma auditoria eram o mesmo dado a sobreviver num espelho
compilado, incluindo **host, utilizador e nome de chave SSH reais**; o `/sync-brain` foi publicado
sanitizado de PII e inútil na mesma, porque dependia da montagem pessoal do dono; e um `CLAUDE.md`
interno foi parar ao repo **internal** de um cliente, com infra, ponteiro para o repo privado e a
descrição de um token por rotacionar.

> **O scrub acontece antes do PRIMEIRO push. Depois disso não há desfazer limpo** — force-push tira
> a referência, não o objecto (ver "Já publicaste" no fim).

## Passo 0 — para onde é que isto vai?

Antes de qualquer coisa, saber o destino. "Público" não é o critério: o critério é **não é o meu repo
de trabalho**. Um repo `internal` de um cliente é a mesma classe de risco.

```bash
git remote -v                      # que remotes existem, e qual é o alvo do push
git rev-parse --abbrev-ref @{u}    # para onde o branch actual empurra hoje
```

Remote novo, segundo remote, org de terceiros, ou qualquer alvo diferente do de trabalho → correr a
checklist inteira. **Publicar por aviso ≠ publicar por varredura:** um aviso na memória sobre um
ficheiro concreto não delimita o âmbito — o item assinalado foi tratado com rigor e tudo o resto
passou intacto.

## Os dois critérios (o segundo é o que escapa)

1. **Tem PII/segredos?** — nomes, emails, hosts, IPs, chaves, paths `/Users/<user>`, `C:\Users\<user>`.
2. **Depende da montagem pessoal do dono?** — duas máquinas nomeadas, um repo privado específico, uma
   pasta de cloud própria, um cliente real. Passa em qualquer varredura de PII **e continua a não
   servir a quem clona**. É este que falha em silêncio.

## Checklist dura

**1. Ship-list contra o release anterior.** Diff do que vai sair vs o que já saiu — decidir ficheiro a
ficheiro, não por pasta.

**2. Varrer por `git`, nunca por disco.** O que publica é o que está no índice; `find`/`ls` mostram
coisas que não vão e escondem coisas que vão.
```bash
git ls-tree -r HEAD --name-only          # o que existe mesmo no commit
git grep -n '<termo>' -- $(git ls-files)  # grep no tracked, não no working dir
git ls-files | grep -vFxf <(find . -type f | sed 's|^\./||')   # tracked que não está em disco
```

**3. Espelhos compilados.** `.claude/` é canónico; **`.agents/` e `.codex/` são espelhos gerados** e
publicam à mesma. Editar skills/agentes sem correr `compile-bridges.sh` faz os espelhos divergirem em
silêncio — e foi lá que sobreviveram host + utilizador + chave SSH do `cpanel.md`.
```bash
bash .claude/scripts/compile-bridges.sh   # recompilar ANTES de auditar, senão auditas a versão velha
```

**4. Symlinks.** O `git grep` não os segue.
```bash
git ls-tree -r HEAD | awk '$1=="120000" {print $4}'
```

**5. Metadados de autor.** Viajam com os commits.
```bash
git log --format='%an <%ae>' | sort -u     # esperar só o noreply do GitHub
```

**6. Paths absolutos expandidos em runtime.** Alguns ficheiros são reescritos pela própria app com o
path da máquina. **Nomear explicitamente `JOCA_Brain/.claude/settings.json`** — expande `<JOCA_ROOT>`
para `/Users/<user>/...` quando a app corre, e já esteve pronto a ser publicado com o nome do dono
lá dentro (apanhado por sorte, e era a segunda vez). Melhor do que varrer: manter a expansão em
runtime e não persistir o path expandido no ficheiro versionado.

**7. Varredura de PII do diff staged** (não do repo inteiro — o que interessa é o que vai sair).
**A varredura cobre código e testes, não só documentação** — fixtures, seeders, snapshots e ficheiros
de teste carregam paths pessoais e nomes de clientes reais, e ninguém os lê antes de publicar:
```bash
git diff --cached | grep -nE '/Users/[a-z]|C:\\\\Users\\\\|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|sk-[A-Za-z0-9]|ghp_[A-Za-z0-9]|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY'
```

**8. História nova, não `--orphan`.** O `--orphan` **preserva o index** — o que se pensava ter ficado
para trás vai no primeiro commit. Fazer `rm -rf .git && git init`.

**9. Verificar por clone fresco, nunca pelo local.** Clonar o público para uma pasta temporária e
correr os passos 2, 4, 5 e 7 lá. O local tem ficheiros gitignored que mascaram o resultado.

## Já publicaste — o que ainda dá para fazer

Chegar aqui já é a falha. O que resta é contenção, e a primeira coisa é não reportar como resolvido o
que não está.

1. **Force-push tira a referência, não o objecto.** O commit antigo fica pendurado no GitHub e é
   servido **por SHA** até haver garbage-collect. O branch dá 404 e parece resolvido — não está.
2. **Verificar pelo SHA antigo, nunca pelo branch:**
   ```bash
   gh api "repos/<org>/<repo>/contents/<ficheiro>?ref=<sha-antigo>"   # 200 = ainda é servido
   ```
3. **As duas únicas saídas reais:** apagar e recriar o repo (exige o scope `delete_repo`, que o token
   normal do `gh` **não** tem — confirmar antes de prometer: `gh auth status`), ou pedir
   garbage-collect ao GitHub Support.
4. **Limpar também o local:** o `filter-branch` deixa `refs/original/` a segurar a história antiga.

Receita que funcionou (⚠ `git filter-branch` **recusa correr com árvore suja** — `Cannot rewrite
branches: You have unstaged changes` — mesmo que as alterações não tenham nada a ver com o alvo):
```bash
git stash            # ou commit — a árvore TEM de estar limpa
git filter-branch --index-filter 'git rm -r --cached --ignore-unmatch <alvo>' <branch>
git rev-list <branch> | head          # confirmar que a história mudou
git push --force-with-lease <remote> <branch>
# e só então: verificar o SHA antigo pela API (ponto 2)
```

## Relatório

```
RELEASE AUDIT — <repo> → <remote alvo> (público | cliente | outra org)
Ship-list: N ficheiros (+X novos, −Y removidos vs release anterior)
PII: N achados  [ficheiro:linha — tipo]
Dependências da montagem pessoal: N  [ficheiro — o que assume]
Espelhos: .agents/.codex recompilados ✓ | DIVERGENTES ✗
Symlinks: N | Autores: <lista>
Verificado por clone fresco: ✓ | ✗
VEREDICTO: pronto a publicar | NÃO publicar — <razão>
```

## Próximo passo (chain)
- Auditoria limpa → `/ship` (gate de push).
- Achados de dependência pessoal → corrigir o componente para ser genérico, ou tirá-lo da ship-list.
