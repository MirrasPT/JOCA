---
name: sync-brain
description: "Sincronização multi-PC do JOCA (2+ máquinas no mesmo repo) — resolver divergência git e os ficheiros de estado JOCA_OS/data/*.json. MUST be invoked when the user says: sync multi-PC, sincronizar máquinas, sync-brain, sincronizar o brain, JOCA_OS/data conflito, merge automacoes/master-chat. SHOULD also invoke when: git diverged entre máquinas, a outra máquina fez push, conflito nos dados do JOCA_OS."
triggers: sync multi-PC, sincronizar máquinas, sync-brain, sincronizar brain, JOCA_OS data conflito, merge automacoes.json, merge master-chat.json, divergência git JOCA, outra máquina fez push
chain: save
---

# Sync Brain — sincronização multi-PC do JOCA

Quem alterna entre 2+ máquinas no mesmo repo JOCA (nunca em simultâneo) regularmente esquece o `pull` antes de começar — daí divergências recorrentes. Esta skill é o conhecimento de **como resolver essa divergência sem perder trabalho de nenhum lado**; o comando `/sync-brain` é quem a executa.

## Porque `git merge` sozinho não chega

Um merge textual de JSON produz chavetas/colchetes duplicados → ficheiro inválido. Recomenda-se marcar os ficheiros de estado do JOCA_OS como `merge=binary` no `.gitattributes`:
```
JOCA_OS/data/*.json merge=binary
```
Isto obriga o git a parar em conflito em vez de tentar (e falhar) um merge de texto — a resolução é sempre **semântica**, feita a ler os 3 blobs (`git show :1:`/`:2:`/`:3:` = base/ours/theirs) e escrever o JSON final por script.

## Regras de resolução por ficheiro

| Ficheiro | Natureza | Regra |
|---|---|---|
| `automacoes.json` | Estado de automações (cron): `lastRunAt`/`lastResult`/`lastStatus` por automação | **Por automação (mesmo `id`):** o lado com `lastRunAt` mais recente E `lastResult` completo (não um placeholder tipo "a inicializar"/"a processar") ganha. Um placeholder é sempre um run interrompido — nunca preservar como se fosse conteúdo novo. |
| `master-chat.json` (se existir — variantes com um chat orquestrador) | Array de mensagens do chat orquestrador | **União por `id`**, preservando ordem por `ts` — MAS antes de unir, verificar se as 2 mensagens novas (uma de cada lado) não são o **mesmo evento** disparado por uma automação em ambas as máquinas (ver abaixo). Se forem, aplica-se a regra do `automacoes.json` (fica só a versão completa), não a união. |
| `projects.json` | Registo de projectos do JOCA_OS | Union por `id`. Se o mesmo projecto foi editado nos dois lados (raro), reportar o conflito em vez de adivinhar — não há timestamp por-item para desempatar com segurança. |
| `project-memory.json` | Estado de UI por projecto (sessions, painel aberto) | Por projecto (chave = `projectId`): o registo com `updatedAt` mais recente ganha o objecto inteiro. |
| Ficheiros `.md` em `memory/` (projects/feedback/learnings/decisions) | Conteúdo de sessão, append-only por natureza | Nunca escolher um lado só — **manter os dois**. Fundir secções, nunca descartar uma sessão inteira. |
| Ficheiros novos de um só lado | — | Entram sem conflito — copiar tal qual. |

### Detectar "mesmo evento, 2 máquinas" (o caso mais comum)

Um automatismo (ex.: resumo matinal por email) corre de forma independente em cada máquina no mesmo horário agendado. Isso produz **um par correlacionado**: uma entrada nova em `automacoes.json` + uma mensagem nova em `master-chat.json`, com `ts`/`lastRunAt` quase idênticos (diferença de segundos) nos dois lados. Sinal: os 2 timestamps novos (um por lado) estão a **menos de ~5 minutos um do outro** E o texto de um dos dois é um placeholder de "a processar"/"a inicializar". Nesse caso não é conteúdo genuinamente diferente — é a mesma automação capturada a meio (máquina onde o processo não chegou a terminar) vs. capturada no fim (máquina onde terminou). Resolver como **substituição** (versão completa vence), nunca como união (senão fica um "fantasma" de mensagem incompleta no histórico do chat).

## Procedimento de resolução manual (quando o comando não está disponível)

```bash
git fetch origin
git merge-base HEAD origin/master   # confirmar ancestral comum
git rev-list --left-right --count HEAD...origin/master   # confirmar divergência real (ambos > 0)
git merge origin/master --no-commit --no-ff   # vai parar em conflito nos .json — esperado
git show :1:<ficheiro>   # base
git show :2:<ficheiro>   # ours (esta máquina)
git show :3:<ficheiro>   # theirs (a outra máquina)
```
Escrever o JSON final por script (Node/Python, nunca editar o conflict-marker à mão — o git não os produz de forma válida em JSON), validar (`JSON.parse`/`json.load`), `git add`, `git commit`.

## Pasta-ponte fora do git (opcional)

Se o utilizador tiver uma pasta sincronizada por um serviço cloud (Dropbox/MEGA/Google Drive) partilhada entre as máquinas, pode servir de **fallback** para quando uma máquina ainda não fez `pull`/`/sync-brain`:
- Um `LEIA-ME`/README com overview do mecanismo + snapshot do último sync.
- Um ficheiro de estado com a narrativa do último evento de sync.
- Um mirror 1:1 de `JOCA_Brain/memory/` — só fallback se o git remoto estiver inacessível.
- Um índice append-only, uma entrada por corrida do `/sync-brain`.

Se essa pasta existir, o comando actualiza-a a cada corrida; se não existir, pergunta ao utilizador o caminho em vez de fabricar um.

⚠ Serviços de sync cloud por vezes criam conflict-copies (`ficheiro(1).md`) quando as 2 máquinas escrevem ao mesmo tempo nesta pasta — não é git, não há merge automático. Ao detectar um `(N)` num destes ficheiros, reconciliar manualmente (o conteúdo mais recente/completo vence).

## Protecções (nunca)

- Nunca `git reset --hard`, `git checkout .`, `git clean -f` para "resolver" o conflito.
- Nunca escolher automaticamente "ours" ou "theirs" nos `.json` sem verificar timestamps — a máquina mais recente por `lastRunAt`/`updatedAt` é que decide, não a ordem do merge.
- Push é sempre gate de confirmação (1 linha) — merge local não.
- Se `JOCA_OS` estiver a correr na máquina local (portas do backend/frontend respondendo), avisar antes de mexer em `JOCA_OS/data/*.json` — a app viva reescreve-os continuamente e pode atropelar a resolução.
