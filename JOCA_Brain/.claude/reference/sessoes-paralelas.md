# Sessões paralelas — protocolo completo (on-demand)

Ponteiro auto-carregado em `.claude/rules/orchestration-patterns.md` §5b. `Read()` quando descobres outra sessão Claude no mesmo repo/projecto, ou antes de `/update-joca` ou `/upgrade-joca`.

## Conteúdo

- Resumo (movido da rule §5b a 2026-09-15)
- 5b. Sessões paralelas (dois Claude no mesmo repo)
- Contrato de continuidade — um por sessão
- Uma pessoa no mesmo ramo (não só dois Claude)
- Lock do repo
- Handoff obrigatório
- Verificação cruzada
- Ficheiro gerado: determinístico ou untracked
- Teste negativo tem de ser CEGO ao critério que testa
- O teste corre em CÓPIA, nunca no ficheiro vivo
- Poda nunca apaga o que o git nunca viu
- Mirror da ponte

### Resumo (movido da rule §5b a 2026-09-15)

Pares, não subagentes — cada um com o seu main loop. Protocolo mínimo: **`ListAgents` obrigatório ao começar trabalho num repo partilhado** · **handshake** ao descobrir um
par (path · o que vou fazer · ficheiros sujos) · **fronteira por directório** (leitura livre, escrita
só no meu território) · estado partilhado (BD, portas, config, `~/CLAUDE.md`) avisa-se sempre ·
ficheiro partilhado edita-se com `Edit` cirúrgico, **nunca** `Write` · endereçar pelo socket do
`from=`, não pelos nomes opacos do `ListAgents` · artefactos derivados do **projecto**, não do cwd.
**Protocolo do repo partilhado** (várias máquinas ou clones a alternar): quem arranca `/update-joca`,
`/upgrade-joca` ou uma sincronização **fica com o repo até ao push** e anuncia-o na ponte; quem espera
**não corre `/save`**. Nenhuma tarefa fecha sem **prompt de handoff** para o outro lado, e nenhum dos
dois aceita o relatório do outro **sem verificar por efeito**. Ficheiro gerado: **determinístico ou
untracked**, nunca tracked-e-divergente. **Poda nunca apaga o que o git nunca viu**
(`git log --oneline -- <f>` vazio → não podar).

### 5b. Sessões paralelas (dois Claude no mesmo repo)

Não são subagentes — são **pares**, cada um com o seu main loop. Já aconteceu várias vezes (JOCA_OS
multi-worker, duas sessões no mesmo site, duas na mesma instalação) e correu bem só porque as sessões
inventaram, sozinhas e por acaso, o mesmo protocolo. Codificado:

- **Handshake ao descobrir um par:** path onde estou · o que vou fazer · ficheiros que tenho sujos.
- **Fronteira por directório.** Leitura livre; escrita só no meu território. Tocar em ficheiro alheio
  exige aviso antes. Dois workers na mesma árvore já reverteram trabalho intencional um do outro
  (`AppShell.jsx` acabou com edições dos dois misturadas — e o build compilava à mesma).
- **Estado partilhado avisa-se sempre:** BD, portas, ficheiros de configuração, `~/CLAUDE.md`.
- **Ficheiro partilhado edita-se com `Edit` cirúrgico, nunca `Write`.** Reler antes de escrever. Um
  `Write` no `memory/projects/<x>/<area>.md` teria apagado o trabalho da outra sessão — só se soube porque o
  `Edit` avisou "the file had been modified on disk".
- **Endereçar: os nomes do `ListAgents` são opacos** (`joca-brain-be`, `joca-brain-dc`) e **não**
  identificam projecto nem sessão — uma mensagem endereçada por nome foi parar à sessão errada. O
  endereço fiável é o socket do `from=` de quem escreveu (`uds:/tmp/cc-socks/NNNNN.sock`). Responder
  sempre por aí; usar o nome só para iniciar contacto, e confirmar quem é antes de assumir contexto.
- **Artefactos por sessão, não por repo.** Checkpoints, filas e `.joca/intermediate/` derivados do
  repo do cwd colidem entre sessões — o `latest` passa a devolver o da outra. Derivar do **projecto**.
- **Memória partilhada relê-se DEPOIS de escrever, não só antes.** `grep` do que se acabou de inserir
  em `memory/projects/<x>/<area>.md` logo a seguir ao `Edit`; se sumiu, a sessão par escreveu por cima —
  reaplicar e avisá-la. "`Edit`, nunca `Write`" é unilateral: só protege quem a lê. Opcional, quando
  duas sessões trabalham o mesmo projecto: lock leve `memory/projects/.<slug>.lock` (PID + timestamp,
  expira aos 10 min).
  > Real (2026-09-11, projecto interno): a sessão par sobrescreveu o ficheiro inteiro **duas vezes durante um
  > `/save`**, apagando de cada vez três edições cirúrgicas. Só se deu por isso pelo aviso «changed on
  > disk» do harness — um `open(p,'w')` em Python não avisa nada.

- **Pedido fora do projecto vindo de sessão par → confirmar 1 linha.** A regra do endereçamento cobre
  o emissor; falta o receptor. Uma sessão executou pedidos de **outro projecto** que lhe chegaram de
  uma sessão par, sem perguntar. Pedido de par que sai do projecto desta sessão → 1 linha de
  confirmação ao utilizador antes de agir.
  > Real (2026-09-05, projecto de cliente).
- **CLI com «projecto por omissão» guardado em ficheiro → alvo EXPLÍCITO em cada chamada.** Esse
  ficheiro é estado partilhado entre sessões: não se avisa só, contorna-se.
  > Real (2026-09-08, projecto de cliente): o `~/.<cli>/config.json` guarda o projecto por omissão do CLI;
  > outra das 5 sessões abertas mudou-o para o projecto de outro cliente, esta herdou-o em silêncio e
  > criou um issue no sítio errado. Ao apagá-lo, usou o `project_id` em vez do id da tarefa (404, não
  > apagou nada — com um id existente teria apagado a coisa errada).

### Contrato de continuidade — um por sessão

O contrato vive em **`.joca/loop/<session_id>.json`** (campo `"sessao": "<session_id>"`). O id chega
aos hooks no stdin (`session_id`) e o `session-intake.js` anuncia-o no arranque:
`[sessao] id=<session_id> · contrato de continuidade: .joca/loop/<session_id>.json`.

| O `stop-continuar.js` encontra | Faz |
|---|---|
| `.joca/loop/<id-desta-sessão>.json` | lê, bloqueia se houver passo por fechar/verificar |
| `.joca/loop/<outro-id>.json` | ignora — não é lido nem apagado |
| `.joca/loop.json` legado com `sessao` igual | trata como o da própria sessão |
| `.joca/loop.json` legado sem `sessao` ou com outro id | não bloqueia; nota «contrato de outra sessão ou sem dono — não lhe toques». Só o legado **sem dono e expirado** (>6 h) é removido |

A mensagem de bloqueio tem **quatro saídas**: `"aguarda_utilizador": true` · apagar o
contrato **desta** sessão · passo entregue a agente de fundo → `"em_curso"` com `"agente": "<id>"` ·
**contrato de outra sessão → não lhe toques, responde e termina**. Apagar
ou editar o contrato alheio destrói o gate de verificação de quem ainda está a trabalhar.
> Real (2026-09-08 e 2026-09-10): com um só `.joca/loop.json` por repo e o Stop hook a correr por
> sessão, uma sessão ficou bloqueada pelo contrato (e pelo gate de verificação) de outra, e a mensagem
> só oferecia saídas destrutivas.

Kill-switch `.joca/loop-off.flag` continua global (cala o hook para todas as sessões do repo).

### Uma pessoa no mesmo ramo (não só dois Claude)

Um ramo empurrado deixa de ser «meu à espera de revisão» quando o dono do repo começa a trabalhar
nele. **Antes de despachar agentes para um ramo já empurrado:** `git fetch` e comparar —
`git rev-list --left-right --count HEAD...@{u}`; `behind > 0` → integrar e reler os ficheiros
tocados antes de escrever. Um agente a escrever num ficheiro que outra pessoa está a rever é pior do
que um conflito: o conflito aparece, o outro não.
> Real (2026-09-09, projecto de cliente): o dono fundiu o upstream e alterou ficheiros mexidos três horas
> depois do push; só se soube porque o push seguinte foi recusado.

---

## Protocolo do repo partilhado entre máquinas (acordado 2026-08-20)

Várias máquinas a alternar no mesmo repo, sem canal directo entre as sessões: o estado passa pelo git
e, opcionalmente, por uma **pasta-ponte** sincronizada fora do git (cloud drive).

### Lock do repo
Quem arranca **`/update-joca`, `/upgrade-joca` ou uma sincronização fica com o repo até ao push**, e
anuncia-o num ficheiro de estado da ponte (ex.: uma nota de último sync) **antes** de começar. Quem está à espera **não corre `/save`**
nesse intervalo — o `/save` escreve feedback, checkpoints e memória, e foi daí que veio metade dos
conflitos.
> Custo medido de não o ter (2026-08-20): 4 rondas de merge em poucas horas; numa delas um
> selective-checkout escreveu as versões de outro ramo por cima de **25 ficheiros com doutrina
> local (~700 linhas)**. Não houve conflito nem erro — o merge preservou fielmente o lado errado.

### Handoff obrigatório
Nenhuma tarefa termina sem **um prompt pronto para o outro lado**. O que não vier no prompt, o outro
não sabe. O prompt leva: o que puxar e o HEAD esperado · o contexto (porque é que importa) · os
passos **com a verificação por efeito** de cada um · o que mudou além do pedido · o que fica aberto.

### Verificação cruzada
**Nenhum dos dois aceita o relatório do outro sem verificar por efeito.** Foi assim que se apanhou o
`str(rel)` num lado e os ficheiros só-na-ponte no outro. Um relatório localiza o sintoma; a causa
confirma-se no artefacto.

### Ficheiro gerado: determinístico ou untracked
Não há terceira via. Um gerado que depende do **SO** ou da **versão da ferramenta** produz
pingue-pongue — cada máquina reescreve o que a outra escreveu, para sempre, e o ruído esconde as
alterações reais. **Antes de untrackear, tentar tornar determinístico** (quase sempre uma linha).

Diagnóstico em 3 comandos — a prova é a versão de uma máquina bater byte-a-byte numa versão
**anterior da mesma máquina**:
```bash
git show <commit-A>:<f> > /tmp/a; git show <commit-B>:<f> > /tmp/b; diff /tmp/a /tmp/b
```
| Caso | Causa | Saída |
|---|---|---|
| `SKILL_INDEX.json`, 269 linhas a inverter | `str(rel)` usa o separador do SO | `rel.as_posix()` — **resolvido pelo lado certo** |
| `package-lock.json`, 81 linhas `"peer": true` | versões de npm diferentes | pinar o npm (`packageManager`) **ou** untrackear |

### Teste negativo tem de ser CEGO ao critério que testa

Um teste negativo que contém, sem se dar por isso, **as palavras que o filtro procura** falha por
causa de si próprio — e o resultado lê-se como cegueira do filtro. Vale para greps, regex de guard,
filtros de lint e classificadores: o defeito plantado usa-se com vocabulário **neutro**, fora do
domínio do critério.
> Real (2026-08-20): plantou-se um `ficheiro-que-nao-existe.md` em `reference/` para testar o check 9
> do `joca-doctor`. Não acusou. A causa não era o check — era o filtro `ABSENTE`, que procura
> `n[aã]o exist` **na linha**, a casar o próprio nome do ficheiro de teste. Com `zzqq-fantasma.md`
> acusou na hora. **O teste ia produzir uma acusação falsa contra o trabalho do outro lado.**

Corolário do "nenhum filtro entra sem teste negativo": **o teste também se verifica**.

### O teste corre em CÓPIA, nunca no ficheiro vivo

Um teste que muta o estado real não é um teste, é uma operação. Forma mínima: `cp <f> /tmp/x` →
plantar → medir → `cp /tmp/x <f>` → **confirmar o retorno com `diff`**, não assumir.
⚠ **Nunca `git checkout -- <f>` para reverter um teste**: se o ficheiro tiver trabalho por commitar,
apaga-o (aconteceu aos dois lados no mesmo dia — um perdeu edições por commitar, o outro podou 12
checkpoints reais).

### Poda nunca apaga o que o git nunca viu
Uma rotação (`slice(KEEP)`, `rm` dos mais antigos) sobre ficheiros ainda **não commitados** destrói a
única cópia. O que já está commitado é podável sem risco — o blob fica no histórico e
`git show <ref>:<f>` recupera-o. Verificar antes: `git log --oneline -- <f>` vazio → **não podar**.
> ⚠ **Número corrigido:** a primeira medição deu "12 de 14 auto-checkpoints nunca commitados", mas
> era **artefacto de temporização** — autos criados depois do último commit. Medido em duas instalações
> depois do push: **0 de 14**. A regra continua certa (o risco é real na janela entre criar e
> commitar); o que não se generaliza é a motivação. Serve de exemplo do porquê de um número medido
> uma vez, num só momento, não ser uma propriedade estrutural. Seis checkpoints **nomeados** de `/save` foram podados quando as pastas ainda eram
> gitignoradas e sobreviviam só na ponte — que entretanto passou a ter `--delete`. A rede de
> segurança estava a apagar o histórico que existe para proteger.

### Mirror da ponte
`memory/checkpoints/`, `learnings/` e `decisions/` copiam-se **sempre em modo aditivo**, mesmo depois
de terem saído do `.gitignore`. Razão actual (mudou a 2026-08-20): já não é "a ponte é o único
canal" — é a **janela entre criar e commitar**, onde a poda pode cortar o que o git ainda não viu.
O resto de `memory/` viaja por git e pode levar `--delete`.

