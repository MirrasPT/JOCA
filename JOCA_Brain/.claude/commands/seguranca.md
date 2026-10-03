---
description: Auditoria de segurança de um projeto — âmbito, reconhecimento, frentes em paralelo (código, segredos, dependências, API, RGPD), revisor adversarial que reproduz cada achado, relatório priorizado e uma issue por achado confirmado
argument-hint: "[caminho do projeto | URL do repo]"
---
# /seguranca — auditoria de segurança de um projeto

Ciclo F0 âmbito → F1 reconhecimento → F2 frentes em paralelo → F3 revisor adversarial → F4 relatório
+ issues. **Orquestra, não corrige:** usa só peças do JOCA e três CLIs livres (Semgrep, gitleaks,
osv-scanner). A correção é trabalho seguinte, uma issue de cada vez (decisão de 2026-10-01: nenhum
motor de terceiros instalado — nem o plugin Claude Security nem `cloudflare/security-audit-skill`).

`$ARGUMENTS` = caminho local ou URL do repo. Vazio → a pasta atual, confirmada na F0.

## Regras do pack (valem em todas as fases)

1. **Nada inventado.** Ferramenta que não correu = «não verificado», nunca «0 achados» nem «limpo».
   Cada achado leva ficheiro:linha (ou commit, ou URL) e o comando que o mostra.
2. **As CLIs corre-as o main loop, num passo fixo (F2.0)** — nunca à escolha de um agente: com o
   Semgrep à mão, os agentes do harness da Cloudflare «invoked it zero times in a month of runs» [C1].
3. **Segredos nunca em claro:** gitleaks sempre com `--redact`; do relatório lêem-se só
   `RuleID`, `File`, `StartLine` e `Commit` — nunca `Secret` nem `Match`. Nem no chat, nem no
   relatório, nem na issue. Tratamento: `.claude/skills/credential-handling.md`.
4. **Quem encontra não confirma.** Cada achado passa pelo revisor da F3 (outro agente). Sem
   reprodução = «não confirmado», sem severidade e sem issue.
5. **Testes ativos só com autorização da F0.** Pedidos a um URL de produção são gate próprio.
   Executar o código do alvo (arrancar a app, instalar dependências) só em projeto próprio ou
   confiável, numa cópia, com `--ignore-scripts`.
6. **Instalar uma CLI é gate** (F1.4). O pack propõe, nunca instala sozinho, e segue com as frentes
   que não precisam dela.
7. **Nada corrige código.** Nenhum agente deste ciclo tem ordem de editar o alvo.
8. **Saídas fora do repo do alvo:** `RUN=~/.claude/joca-runs/<AAAA-MM-DD>-seguranca-<slug>/`. Um
   relatório de segurança dentro da árvore acaba commitado.
9. Uma decisão = um `AskUserQuestion`, a opção recomendada primeiro, sempre «Não sei» (= a opção
   mais segura). PT-PT AO90.

## Peças (o que cada uma já faz)

| Peça | Tipo | Entrega |
|---|---|---|
| `security-review` | agente, só leitura | 13 domínios OWASP/IDOR lendo o código; `[SEVERIDADE] domínio · ficheiro:linha · exploração · correção` |
| `tester-api` | agente, Bash | testes HTTP: 401, validação, IDOR, sondas ativas (JWT `alg:none`, SSRF, mass assignment) |
| `tester-ratelimit` | agente, Bash | limites que disparam, bypass por cabeçalhos de IP, caminho/método |
| `dependency-auditor` | agente, Bash | `npm audit`/`composer audit`, desatualizados, não usados, licenças |
| `gdpr-compliance` | skill | checklist de recolha, consentimento, scripts de terceiros, direitos do titular (CNPD) |
| `credential-handling` | skill | segredo encontrado: não o reproduzir, rodar, provar fora do histórico |
| `security` | skill | conhecimento por stack (OWASP Top 10:2025, padrões Laravel/React, processos e allowlists) |
| `cso` | ponteiro | absorvida por este comando (STRIDE na F1, gate de confiança na F3, tendência na F4) |

## Passo 0 — situar (sempre)

1. **Alvo:** caminho → `git -C "<alvo>" rev-parse --show-toplevel` (sem git → a frente de segredos
   só vê a árvore, di-lo). URL → `git clone` completo (sem `--depth`: o histórico é o que a frente
   de segredos varre) para `$RUN/fonte/`.
2. **Slug** = nome da pasta do repo em kebab-case. `mkdir -p "$RUN"`.
3. **Retoma:** existe `$RUN` com artefactos → entra na 1.ª fase cujo artefacto falta: F0
   `ambito.md` · F1 `recon.md` · F2 `frente-*.md` de cada frente ativa no `recon.md` · F3
   `revisao.md` · F4 `relatorio.html`. Fase em curso numa corrida anterior de outro dia → pergunta
   se continua essa ou começa outra.
4. **No JOCA** (há `.joca/` no cwd): contrato de continuidade de `rules/chaining.md` com os passos
   F0-F4, `produtor` ≠ `verificador` e `aguarda_utilizador: true` em cada gate.

## F0 — âmbito (gate)

Pergunta só o que falta, um `AskUserQuestion` por decisão:

1. **Alvo e commit** — confirma o caminho e regista `git rev-parse HEAD` e o ramo.
2. **Projeto próprio?** «Sim, é meu/do cliente com autorização» / «Não — repo de terceiro» /
   «Não sei» (= terceiro). Terceiro → não se executa o código dele (F3 só lê) e as issues são gate (F4).
3. **Há uma instância a correr?** «Só código, sem testes ativos (recomendado)» / «URL local ou de
   staging (escreve-o)» / «URL de produção (escreve-o)» / «Não sei» (= só código).
4. **Autorização para testes ativos** (só com URL): «Tenho autorização do dono para testes ativos
   neste URL?» — Sim/Não. **Produção** → segunda pergunta, explícita: os testes de rate limit podem
   bloquear utilizadores reais e as sondas criam dados — «Sim, autorizo contra produção» / «Não — só
   staging/local (recomendado)» / «Não sei» (= não).
5. **Contas de teste** (só com testes ativos autorizados): o IDOR precisa de dois utilizadores. Os
   tokens nunca passam pelo chat: o utilizador grava-os num ficheiro fora do repo (ex.:
   `$RUN/tokens.env`, `chmod 600`) e diz o caminho. Sem eles → `TODO: credencial em falta` e a frente
   de API corre só os testes sem autenticação.

Grava `$RUN/ambito.md`: alvo, commit, ramo, próprio/terceiro, URL e ambiente, autorização (quem, data,
âmbito), caminho do ficheiro de tokens (nunca o conteúdo). Segue para a F1 sem perguntar.

## F1 — reconhecimento (sem gate, exceto a instalação)

1. **Stack** pelos manifestos (`ls`/`find -maxdepth 3`, sem `node_modules`/`vendor`):
   `artisan`+`composer.json` → Laravel · dependência `next` → Next.js · `express`/`fastify`/`hono` →
   Node API · `pubspec.yaml` → Flutter · só HTML/CSS/JS → site estático · `.github/workflows/` → CI ·
   `Dockerfile`/`compose*` → infra. **Lockfiles** presentes (`package-lock.json`, `pnpm-lock.yaml`,
   `yarn.lock`, `bun.lock`, `composer.lock`, `pubspec.lock`) — `package.json` sozinho não é lockfile.
2. **Superfícies:** rotas e endpoints (com o ficheiro), autenticação, autorização, uploads, formulários
   ou tabelas com dados pessoais, analytics/cookies, config e `.env*` versionados, CI.
3. **STRIDE** (vem da `cso`) só nas superfícies críticas: por fluxo, a ameaça S/T/R/I/D/E → mitigação
   «existe (ficheiro:linha)» ou «em falta». É o mapa que orienta as frentes, não um achado.
4. **CLIs:**
   ```bash
   for c in semgrep gitleaks osv-scanner; do command -v "$c" >/dev/null && echo "$c: ok" || echo "$c: em falta"; done
   for g in winget scoop brew pipx uv go docker; do command -v "$g" >/dev/null && echo "gestor $g: ok"; done
   ```
   Em falta → **gate de instalação**: um `AskUserQuestion` com a lista e o comando oficial de cada,
   escolhido pelos gestores presentes — «Sim, instalar as N agora» / «Não — seguir sem elas
   (recomendado se tens pressa)» / «Não sei» (= não). «Sim» → corre os comandos, abre um shell novo
   (o PATH do winget só muda aí) e repete a deteção; falhou → «em falta» com o erro exato.
   Comandos (verificado 2026-10-02 nas fontes indicadas):

   | CLI | Windows | macOS / Linux | Fonte |
   |---|---|---|---|
   | osv-scanner | `winget install Google.OSVScanner` · `scoop install osv-scanner` | `brew install osv-scanner` | google.github.io/osv-scanner/installation |
   | gitleaks | binário da página de releases (github.com/gitleaks/gitleaks/releases) ou Docker `ghcr.io/gitleaks/gitleaks:latest` | `brew install gitleaks` | github.com/gitleaks/gitleaks (README) |
   | semgrep | (beta) Python no PATH, `[System.Environment]::SetEnvironmentVariable('PYTHONUTF8', '1', 'User')` no PowerShell, depois `pipx install semgrep` ou `uv tool install semgrep` | `pipx install semgrep` · `uv tool install semgrep` (`brew` é «best-effort») | docs.semgrep.dev/getting-started/quickstart |

   Não há comando winget/scoop do gitleaks no README oficial — não se propõe um.
5. **Frentes ativas** — decide aqui, com o motivo, e grava em `$RUN/recon.md` (stack, superfícies,
   STRIDE, CLIs, frentes ON/OFF, pastas fora de âmbito com o motivo):

   | Frente | Ativa quando |
   |---|---|
   | código | sempre |
   | segredos | sempre (sem gitleaks → reporta «CLI em falta») |
   | dependências | há manifesto de pacotes |
   | API + rate limit | URL **e** autorização na F0 |
   | RGPD | há formulário, dados pessoais em BD, cookies ou analytics; senão «não aplicável» com o motivo |

## F2 — frentes em paralelo (sem gate)

### F2.0 — determinístico (main loop, antes do fan-out)

Corre só as CLIs presentes. Saída ≠ 0 não é erro por si — cada uma tem o seu código:
```bash
# gitleaks (github.com/gitleaks/gitleaks, verificado 2026-10-02): git = histórico (git log -p), dir = árvore.
# Exit 1 = «leaks or error encountered» (README): só conta como fugas se o relatório JSON foi escrito; sem relatório = erro → «não verificado».
rm -f "$RUN/gitleaks-git.json" "$RUN/gitleaks-dir.json"   # relatório velho de uma retoma não passa por novo
gitleaks git --redact --no-banner --log-opts="--all" --report-format json --report-path "$RUN/gitleaks-git.json" "$ALVO"
gitleaks dir --redact --no-banner --report-format json --report-path "$RUN/gitleaks-dir.json" "$ALVO"
# osv-scanner (google.github.io/osv-scanner/usage/scan-source e /output, verificado 2026-10-02):
# exit 0 = sem vulnerabilidades · 1 = há vulnerabilidades · 128 = nenhum pacote (sem lockfile).
osv-scanner scan source -r --format json "$ALVO" > "$RUN/osv.json"
# semgrep (docs.semgrep.dev/cli-reference e /customize-semgrep-ce, verificado 2026-10-02):
# p/default = ruleset do Registry; --metrics=off desliga as métricas. Exit 2+ = erro.
semgrep scan --config p/default --metrics=off --json --output "$RUN/semgrep.json" "$ALVO"
```
- osv-scanner com exit 128 → «não verificado: sem lockfile». **Não** se gera um lockfile no alvo.
- Ler os JSON do gitleaks só com os campos da regra 3:
  ```bash
  node -e "for (const f of (JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))||[])) console.log(f.RuleID, f.File, f.StartLine, (f.Commit||'').slice(0,8))" "$RUN/gitleaks-git.json"
  ```

### F2.1 — fan-out (um `Agent()` por frente ativa, no mesmo turno)

| Frente | Quem | Entrada | Grava |
|---|---|---|---|
| código | `security-review` | alvo, `recon.md` (stack, superfícies, STRIDE), `semgrep.json` se existir | `$RUN/frente-codigo.md` |
| segredos | main loop (sem agente) | `gitleaks-*.json` | `$RUN/frente-segredos.md` |
| dependências | main loop lê `osv.json`; `dependency-auditor` só se houver lockfile **e** o gestor (`npm`/`composer`) instalado | lockfiles | `$RUN/frente-dependencias.md` |
| API | `tester-api` | URL, ambiente, autorização, caminho dos tokens | `$RUN/frente-api.md` |
| rate limit | `tester-ratelimit` | idem; produção só com a 2.ª autorização da F0 | `$RUN/frente-ratelimit.md` |
| RGPD | `general-purpose` com Step 0 `.claude/skills/gdpr-compliance.md` | alvo, superfícies de dados pessoais | `$RUN/frente-rgpd.md` |

- **CLI em falta** → a frente grava na mesma o seu ficheiro, com a linha
  `CLI em falta: <cli> — gate de instalação na F1 (<recusado|não perguntado>); cobertura: não verificado`
  e o que ficou por ver (ex.: «histórico git não varrido»). Nunca um resultado de substituição
  apresentado como se fosse da CLI. Um `grep` à árvore não substitui o gitleaks no histórico.
- **Achado de segredo:** regista commit, ficheiro, linha e regra; a correção sugerida é a da
  `credential-handling` §4-5 (assumir comprometido → rodar). Reescrever histórico é irreversível e
  fica fora deste ciclo (issue própria).
- **Recolha:** `ls` a cada ficheiro anunciado. Agente que falhou → frente «não verificada» com o
  motivo. Cada achado leva o formato de candidato:
  `C<n> · frente · título · ficheiro:linha | commit | URL · evidência (comando + saída curta) · impacto alegado`.

## F3 — revisor adversarial (sem gate, salvo execução de código)

1. **Quem:** um `Agent(subagent_type="general-purpose")` novo — nunca o agente que produziu o achado
   nem o main loop. Step 0: `.claude/skills/security.md` e `.claude/agents/tester-api.md` (§IDOR,
   técnica de reprodução). Recebe **todos** os candidatos `C<n>` numa lista congelada (cópia em
   `$RUN/candidatos.md`).
2. **Missão:** tentar refutar cada candidato e, se não conseguir, reproduzi-lo:
   - código → caminho real do input ao sink (sem middleware/policy pelo meio) e, se o alvo for próprio
     (F0), reprodução local: cópia em `$RUN/repro/`, `npm install --ignore-scripts` (ou equivalente),
     app numa porta livre (nunca 7491/7492, as do JOCA OS), `curl` que mostra o efeito, app parada no fim;
   - segredo → `git show --stat <commit>` + a linha do gitleaks (só a regra) — o valor nunca;
   - dependência → ID OSV/CVE + versão instalada no lockfile dentro do intervalo afetado;
   - API/rate limit → repetir o pedido da prova, só contra o ambiente autorizado na F0.
3. **Veredicto por candidato:** `confirmado` (comando + saída que o mostra) · `não confirmado` (o
   facto exato que falta para decidir) · `rejeitado` (a refutação, com ficheiro:linha).
4. **Severidade só para `confirmado`, e exige impacto demonstrado:**

   | Severidade | Quando |
   |---|---|
   | CRITICAL | explorável remotamente sem autenticação, ou fuga de dados / escalada de privilégio |
   | HIGH | explorável com conta comum, impacto significativo; segredo válido de produção |
   | MEDIUM | precisa de condições específicas; CVE alcançável mas sem exploit no caminho real |
   | LOW | defesa em profundidade — uma lacuna sem exploração não é vulnerabilidade |

5. Grava `$RUN/revisao.md` (o revisor escreve só este ficheiro) e devolve ≤ 20 linhas. Achado que o
   caller conteste → `SendMessage` ao **mesmo** revisor com o contra-argumento; só um `confirmado`
   dele fecha. Máximo 3 voltas.

## F4 — relatório + issues (gate: issues em repo de terceiro ou público)

1. **Relatório** `$RUN/relatorio.html` (autocontido, aberto com `start` no Windows / `open` no macOS):
   - cabeçalho: alvo, commit, data, âmbito e autorização da F0;
   - **cobertura** por frente — corrida / CLI em falta / não aplicável / não verificada, com o motivo;
   - **confirmados** por severidade: título, prova (comando + saída curta), impacto, correção sugerida
     (do agente da frente; Laravel-nativa quando a stack o é), ficheiro:linha;
   - **não confirmados** com o facto em falta; **rejeitados** numa linha cada;
   - **tendência:** havendo `relatorio.html` de uma corrida anterior do mesmo slug → novos / resolvidos
     / persistentes por título;
   - **próximo passo:** o que fazer com cada CLI em falta.
2. **Issues — uma por achado `confirmado`**, no formato da skill `novo-issue` (problema, prova, «feito
   quando» = a reprodução da F3 deixa de reproduzir, ficheiros prováveis). Antes:
   ```bash
   git -C "$ALVO" remote get-url origin
   gh repo view --json nameWithOwner,owner,visibility,viewerPermission
   gh api user --jq .login ; gh api user/orgs --jq '.[].login'
   gh issue list --search "<título>" --state all --limit 10   # sem duplicados
   ```
   - sem remote GitHub → `$RUN/issues-rascunho.md` com o texto de cada uma, e di-lo;
   - dono ≠ o utilizador e ≠ uma org dele (**repo de terceiro**) → gate «Abrir N issues no repo de
     <dono>?» — «Não — só o relatório (recomendado)» / «Sim, abrir» / «Não sei» (= não);
   - repo **público** → gate: uma issue pública divulga a falha antes da correção — «Não — guardar em
     `issues-rascunho.md` (recomendado)» / «Sim, abrir pública» / «Não sei» (= não);
   - `--label security` só se a label existir (`gh label list`); severidade no título `[HIGH] …`.
   - Nunca o valor de um segredo nem um token na issue.
3. **Fecho** no chat (≤ 10 linhas): contagem por severidade, frentes não verificadas e porquê, links das
   issues (ou o rascunho), caminho do relatório. A correção começa por issue, noutra volta.

## Brief-modelo dos agentes

Todo o `Agent()` deste ciclo leva, por esta ordem:
```
Objetivo: <2 frases: a frente e o que entrega>.
Step 0: lê <caminhos absolutos: o ficheiro do agente/skill + .claude/skills/security.md> (ls antes; não
  existe → pára e reporta). Confirma os caminhos lidos na 1.ª linha do relatório. Se isto contradisser o
  que encontrares, pára e reporta.
Contexto: ALVO=<abs> · commit=<sha> · RUN=<abs> · stack=<recon> · próprio/terceiro · URL=<url|nenhum> ·
  autorização=<sim/não, âmbito> · tokens=<caminho|TODO: credencial em falta>.
Lê primeiro: $RUN/ambito.md, $RUN/recon.md <e as saídas de CLI da frente>.
Ficheiro teu (só este): $RUN/frente-<x>.md (revisor: $RUN/revisao.md).
Regras: nada inventado (ficheiro:linha + comando); CLI ausente = «não verificado»; nunca imprimir o
  ambiente (env, printenv) nem ficheiros de credenciais, tokens ou cookies; segredos só por RuleID/ficheiro/
  linha/commit; PT-PT AO90; credencial em falta → TODO, nunca um valor plausível.
Não faças: editar o alvo (este ciclo não corrige); instalar CLIs; correr pedidos fora do URL autorizado;
  git checkout/branch/stash/commit no alvo; despachar outros agentes; abrir issues.
Devolve: ≤ 20 linhas — Step 0 lido, candidatos C<n> no formato da F2.1, cobertura (o que não viste e
  porquê), caminho gravado.
```

## Sem `Agent`

As frentes correm em série, inline, com os mesmos ficheiros. A F3 **não** se faz inline (quem produz
não revê): grava `$RUN/revisao-brief.md` com o brief do revisor para outra sessão, o relatório marca
todos os candidatos «não confirmado — revisão independente por fazer», e não se abrem issues.

## Próximo passo (chain)
- Cada issue `confirmado` → correção numa onda própria (`laravel-specialist-agent` · `frontend-agent` ·
  `tester-code`, com a issue no brief), depois `/seguranca` de novo para fechar a tendência.
- CLI recusada no gate → fica no relatório como próximo passo; nada a encadear.

## Créditos
- Método por fases, «the agent that checks a finding is never the agent that found it», veredictos e
  «severity requires impact»: `cloudflare/security-audit-skill` (MIT) e o artigo «Build your own
  vulnerability harness» [C1] — desenho adaptado, sem código copiado.
- STRIDE, gate de confiança e tendência: skill `cso` do JOCA (adaptada do `cso` do gstack).
- [C1] https://blog.cloudflare.com/build-your-own-vulnerability-harness/ (lido via pesquisa de
  2026-10-01).
