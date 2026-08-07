---
name: public-release-audit
description: "Preparar e auditar um repo privado antes de o publicar (ou de publicar um diff) num repo público. Varre por git e não por disco, apanha espelhos compilados, symlinks, metadados de autor e dependências da montagem pessoal do dono. MUST be invoked when the user says: publicar no repo público, open source release, preparar release público, scrub antes de publicar, auditar o que vai sair, sanitizar repo. SHOULD also invoke when: um push vai para um remote público e o repo de trabalho é privado."
triggers: publicar repo público, open source release, release público, scrub PII, sanitizar repo, preparar publicação, o que vai sair no push, auditar release, público vs privado, PII scan
chain: ship
metadata:
  origin: user
---
# public-release-audit — o que sai daqui serve a quem clona?

Auditar um repo privado antes de o publicar. Improvisar isto já custou caro duas vezes: 44 dos 52
achados de uma auditoria eram o mesmo dado a sobreviver num espelho compilado, incluindo **host,
utilizador e nome de chave SSH reais**; e o `/sync-brain` foi publicado sanitizado de PII e inútil na
mesma, porque dependia da montagem pessoal do dono.

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

**7. Varredura de PII do diff staged** (não do repo inteiro — o que interessa é o que vai sair):
```bash
git diff --cached | grep -nE '/Users/[a-z]|C:\\\\Users\\\\|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|sk-[A-Za-z0-9]|ghp_[A-Za-z0-9]|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY'
```

**8. História nova, não `--orphan`.** O `--orphan` **preserva o index** — o que se pensava ter ficado
para trás vai no primeiro commit. Fazer `rm -rf .git && git init`.

**9. Verificar por clone fresco, nunca pelo local.** Clonar o público para uma pasta temporária e
correr os passos 2, 4, 5 e 7 lá. O local tem ficheiros gitignored que mascaram o resultado.

## Relatório

```
RELEASE AUDIT — <repo> → <público>
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
