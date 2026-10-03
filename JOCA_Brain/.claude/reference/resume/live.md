# /resume — estado live (2c e 2f)

## Paridade live ↔ repo

**"Está deployado" é perecível — medir paridade live ↔ repo.** Um health-check só prova que o
endereço responde; um live um mês atrasado responde 200 na mesma. Se a memória declarar um **URL
live** *e* um **repo**, correr o check barato:
```bash
git log -1 --format=%H                                  # sha local
curl -s <url-do-bundle-js-ou-css> | shasum -a 256              # hash servido
shasum -a 256 <ficheiro-correspondente-no-build-local>         # hash local
curl -s <url-do-bundle> | grep -c "<símbolo-do-último-commit>" # o commit chegou ao ar?
curl -s -o /dev/null -w '%{http_code}\n' https://<dominio>/<rota-que-só-existe-no-último-commit>  # 404 = atrasado
```
Hash diferente, símbolo ausente, ou rota exclusiva do lado novo a 404 → `⚠ LIVE ATRASADO face a <sha>`
no resumo, como pendente. ⚠ **Comparar `content-length` não serve:** uma alteração de igual tamanho
passa como paridade — o hash ou o símbolo é que provam.
> Caso real: o live servia tudo e faltavam duas features. Uma delas era *esconder rascunhos* — o
> efeito visível ("aparece tudo") é indistinguível de não estar deployada. Só a comparação do
> ficheiro estático dos dois lados o revelou.

## Endereços live

Um "**LIVE** em X" na memória é **afirmação a verificar**, não facto (caso particular do 2c). Meia
sessão foi trabalhada a assumir que o live de um portfólio era a VPS porque era o que a memória
dizia: o site real estava noutro alojamento, a correr código de 4 meses antes — e a VPS continuava
no ar com uma **segunda cópia pública** que ninguém tinha em conta.

Para projectos cuja memória cita domínios/subdomínios ou `**Repo:**`, sondar **todos** os endereços
conhecidos (produção, staging, host antigo):
```bash
curl -sI https://<dominio> | head -20     # status, redirects, server, last-modified
curl -s  https://<dominio> | head -40     # marcador de versão/build no HTML servido
```
- Comparar `last-modified`/conteúdo com o repo local (data do último commit que toca o output).
- **Live mais antigo que o repo**, ou HTML que não bate com o build actual → pendente explícito no
  resumo, não nota de rodapé.
- **Vários endereços a servir o mesmo projecto** → listá-los todos e sinalizar as cópias esquecidas;
  continuam públicas (e com o que lá estiver: analytics, versões antigas, dados).
- Endereço na memória que já não responde (DNS/404/host morto) → corrigir a memória no `/save`.
- **API com CORS: sondar COM `Origin`.** Um `curl -sI` sem `Origin` devolve 200 e dá «resolvido» a um
  defeito que só o browser vê. Comparar as duas respostas:
  ```bash
  curl -sI https://<api>/<rota> | grep -i access-control-allow-origin
  curl -sI -H "Origin: https://<dominio-do-frontend>" https://<api>/<rota> | grep -i access-control-allow-origin
  ```
- **Destino de publicação** (outro projecto, loja, canal onde o projecto publica) → sondá-lo também, não só
  os endereços próprios, e comparar por hash (`md5`/`shasum -a 256`) com os originais locais:
  `curl -s <url-do-ficheiro-no-destino> | shasum -a 256` vs `shasum -a 256 <original>`. Diferente → o
  destino tem outra versão; ausente → não foi publicado.
- **CI configurado ≠ CI corrido.** Havendo `.github/workflows/`, ver se correu e com que resultado:
  `ls .github/workflows 2>/dev/null && gh run list --limit 3`. Zero runs → `⚠ CI NUNCA CORREU`, não «CI configurado».
  Run falhado em <10 s sem steps → ler as anotações (`gh api repos/<o>/<r>/check-runs/<id>/annotations`) antes de diagnosticar código: costuma ser faturação/limite de gasto da organização (ver `.claude/agents/pr-repair.md`, «Every job failed in 2-5 s?»).
