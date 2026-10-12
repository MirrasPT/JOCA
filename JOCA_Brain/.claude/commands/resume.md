# /resume — Carregar contexto da sessão

Corre no início de cada sessão de trabalho num projecto. **Princípio: ler o mínimo que dá o ponto de situação** (onde estamos,
o que falta, o que pode correr mal) e só abrir o resto quando um sinal o pedir. Detalhe e porquês de cada regra:
`.claude/reference/resume/diagnostico.md` (e os ficheiros ao lado) — nunca carregados por omissão.

## Passos

### 1. Base — uma chamada só
**Path-alvo** = 1.º argumento, senão o CWD. Placeholder (`<…>`, `"<por definir>"`) não é caminho → cai para o CWD e o resumo lista `⚠ caminho por definir`.

```bash
node .claude/scripts/resume-base.mjs "<path-alvo>"      # offline: --sem-fetch
```
Devolve já tudo o que antes eram ~15 comandos: resolução da memória (caminho primeiro, nome só por igualdade), git
(branch, atrás/à frente, `origin/main|master`, últimos commits, sujos, PR), working tree viva, contratos `.joca/loop`,
ficheiros de retoma, caminhos mortos e `⏳` velhos da memória, último checkpoint **deliberado** e as 6 decisões activas mais recentes.
Secção vazia não aparece; cada `⚠` é um sinal (passo 3).

Resolução (linha `via=… slug=…`):
- `⚠ AMBÍGUO` ou `⚠ QUASE-IGUAIS` → `AskUserQuestion` com `description` + `directorio` de cada («É o <a>» · «É o <b>» · «Projecto novo» · «Área nova de <x>»). Nunca desempatar por ordem alfabética nem por `mtime`; prefixo ou palavra comum não é critério.
- `⚠ SEM MEMÓRIA` → projecto novo, sugerir `/start`.
- `area` preenchida → a sessão é dessa área: ler também `<slug>/<area>.md`.
- 2.º argumento `<git-remote-url>` → `diagnostico.md` §1b.

### 2. Ler — só o necessário
1. `memory/projects/<slug>/index.md` (o ficheiro que o script indica). **Nunca** as áreas, fixos nem `arquivo.md` por omissão.
2. Tarefa de uma área → + `<area>.md` (igualdade com o nome ou com «ler:» do index; 0 ou ≥2 → `AskUserQuestion` com as áreas + «área nova»). Peça/código → + `normas.md` · disco/caminhos → + `pastas.md` · entrar num sistema → + `acessos.md` · arrancar/deploy → + `config.md`.
3. `arquivo.md` só quando nada acima responde: `grep -n "<termo>"` e `Read` do intervalo.
4. Na pasta do projecto, **pela ordem que o script lista**: `RETOMAR.md`/`HANDOFF.md` (mais fresco que a memória) → `PROGRESSO.md` (só o topo, ~60 linhas; **ganha ao Brain** em fases/estado, divergência = drift) → só as secções de gotchas do `CLAUDE.md`/`AGENTS.md` que o script apontou — listá-las no resumo **antes** de qualquer diagnóstico.
5. Caminho que a memória cita e o script marca `NAO EXISTE` → não o usar como facto.
6. Memória × realidade, assinalar sem resolver em silêncio: `## Pendente` que o corpo dá por feito → `⚠ PENDENTE CONTRADITÓRIO`; pendente que depende de terceiro → `⏳ à espera de X` (não é trabalho nosso); termo do pedido que a memória nunca usa → `AskUserQuestion` antes de produzir.

Checkpoint e decisões **vêm do script** (com `--slug` do projecto resolvido; o recall do hook de arranque é do projecto do cwd, não deste). Só checkpoints automáticos = sem «próxima acção»: dizê-lo. Mais decisões: `node .claude/scripts/joca-brain.mjs search "<termo>" --slug <slug>` — nunca `active` inteiro (chega a >100 KB).

### 3. Sinal → ler (só quando o `⚠` aparece ou a situação se aplica)
| Sinal | Ler |
|---|---|
| `⚠ AMBÍGUO` · `⚠ directorio quebrado` · irmãs · README da pasta-mãe ≠ remotes · `directorio` em lista/realpath | `reference/resume/diagnostico.md` §1 · `resolucao.md` |
| `⚠ CLONE ATRÁS` · `origin/…` · `⚠ Existe branch de backup` · branches sem upstream · branch ou PR ≠ memória · issues de outro repo · memória >14 dias · pendente que nomeia ficheiros (**2b**) | `diagnostico.md` §2b |
| `CONTRATOS` com `EXPIRADO` (>6 h sem escrita) ou passos `pendente`/`feito` (**2a-bis**) | `diagnostico.md` §2a-bis |
| Decisão activa que nomeia um caminho · checkpoint de umbrella/sub-entrada (**2a**) | `diagnostico.md` §2a |
| `⚠ WORKING TREE VIVA` (**2a-ter**: `ps`/`lsof` à pasta, só aqui) | `diagnostico.md` §2a-ter · `reference/sessoes-paralelas.md` |
| `⚠ PROGRESSO.md INCOERENTE` (**2b-bis**) | `diagnostico.md` §2b-bis |
| Vais **escrever em produção** a partir da memória · vais dizer «não dá / não existe» · a memória afirma contagens, IDs, credenciais, cron, inventário · `⏳ VELHO` · receita `validado 1×` · vais usar CLIs nos pendentes (`gh auth status` e `memory/tools/clis.md`, já no plano) (**2c**) | `diagnostico.md` §2c |
| `⚠ PROJECTO NÃO EXISTE` · `⚠ REPO EM DRIVE DE NUVEM` · varrimento por data em cloud (**2e**) | `reference/resume/nuvem.md` |
| `⚠ PASTA VAZIA` (**2d**) | `reference/resume/pasta-vazia.md` |
| `⚠ SEM GIT` | `reference/resume/sem-git.md` |
| Memória com URL live, domínios ou `**Repo:**` (**2f**) | `reference/resume/live.md` |
| Projecto de design sem repo (**2h**) | `reference/resume/design-sem-codigo.md` |
| Memória nomeia canal de entrega ou `fonte:` caixa de correio (**2i**) | `reference/resume/canal-entrega.md` |
| Duas entradas para o mesmo trabalho (**2g**) | avisar em 1 linha, com os dois ficheiros (`diagnostico.md` §2d-2i) |
| `composer.json` em Windows · projecto móvel (**3c**) | `diagnostico.md` §3c |
| O projecto É o toolkit JOCA (contém `JOCA_Brain/CLAUDE.md`) | surgir `/upgrade-joca` (feedback acumulado em `memory/feedback/`) |

Regras duras que valem sem abrir nada: **antes de escrever em produção a partir da memória, revalidar contra a fonte** · **antes de declarar trabalho «perdido/nunca committado»: `git log --all` + `git branch -a`** (branches `backup/*`/`stash/*`) · **afirmação de inexistência herdada é perecível** (`test -e` ao caminho).

### 4. Projectos com código — flow em 1 linha
Se há `package.json`, `composer.json`, `src/` ou `app/`: não apresentar só o contexto, propor o flow no resumo (o utilizador redirige).

| Estado detectado | Flow |
|---|---|
| Pendentes de bug/fix | `/debug` ou fix directo |
| Pendentes de feature | `/plan` → implementar |
| «Completo» sem deploy | `/deploy-executor` ou checklist |
| Sem pendentes claros | «O que queres fazer? (review, feature, fix, deploy)» |

### 5. Apresentar resumo
```
[⚠ avisos de ambiente à cabeça, os que o script deu: NÃO EXISTE NESTA MÁQUINA · NUVEM · TREE VIVA · CLONE ATRÁS · BRANCH/PR ≠ MEMÓRIA]
Projecto: <nome> · Stack: <stack> · Fase: <de PROGRESSO.md, se existir>

Estado: <estado actual>
Última sessão: <o que foi feito>
Próxima acção: <do checkpoint deliberado; ou «só checkpoints automáticos»>
Decisões activas: <até 3 que tocam no que vem a seguir>
Gotchas do projecto: <as do CLAUDE.md/AGENTS.md>

Bloqueantes: <item> — há N dias
Pendente: <item> · ⏳ <item à espera de X> — há N dias · Contratos por fechar: <n> (expirados: <n>)
Flow sugerido: <passo 4>
```
**Bloqueantes e `⏳` levam a idade** («há N dias»): um bloqueante de 40 dias pede outra conversa que um de ontem.
Contratos de outra sessão **não se apagam nem editam** (pode estar viva); só se propõe apagar os expirados.
