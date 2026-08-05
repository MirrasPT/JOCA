# Correções pendentes

Bugs encontrados na instalação de produção **depois** desta versão ter sido publicada, com a
correcção exacta de cada um. Existe para que o `/update-joca` os aplique sozinho enquanto o código
publicado ainda não os traz.

> **Este ficheiro é temporário.** Quando o release seguinte já incluir estas correções, apaga-o —
> e apaga também o passo que lhe chama em `update.md`. Cada correção traz uma linha de verificação
> que diz se já está aplicada; se **todas** disserem que sim, o ficheiro cumpriu o seu papel.

## Como aplicar (instruções para o agente)

Trabalha a partir da raiz do JOCA (a pasta que contém `JOCA_Brain/` e `JOCA_OS/`).

1. Para cada correção, corre primeiro o **Já está aplicada?**. Se der `aplicada`, salta-a.
2. Substitui o bloco **Antes** pelo bloco **Depois**, à letra. Os blocos são únicos no ficheiro.
   Há **dois** blocos marcados **Inserir** que não têm par: esses acrescentam-se, não substituem.
3. No fim, corre o **Verificar tudo** lá em baixo.
4. Se um bloco **Antes** não existir tal e qual, **não adivinhes**: salta a correção e diz ao dono
   qual falhou. Quer dizer que o ficheiro já mudou por outra via.

---

## 1. O gestor fica à espera de um agente que já terminou

**Sintoma:** despachas trabalho, o agente acaba, e o gestor nunca responde — fica à espera para
sempre, sem sequer avisar na inbox.

**Causa:** o `'done'` que acorda o gestor é emitido por um `idleTimer` com debounce, e só conta se a
rajada durou mais de 2 s (`DONE_MIN_WORK_MS`). Quando o processo termina, o `onExit` **cancela esse
timer** — o `'done'` nunca sai. E o `'closed'` só fazia `forgetSession()`: o worker desaparecia do
pool em silêncio. As três redes de segurança falhavam no mesmo caso, porque a varredura de
encalhados também desiste quando a sessão já não existe (`estaEncalhado` devolve `false` sem
sessão).

### 1a. O evento `closed` tem de levar o output final

`JOCA_OS/backend/src/session-manager.ts`

O `sessions.delete()` acontece **antes** do `emit`, portanto quem ouve o evento já não consegue ir
buscar o buffer. Tem de viajar no próprio evento.

**Antes**
```ts
    ptyProcess.onExit(() => {
      if (session.idleTimer) clearTimeout(session.idleTimer);
      if (session.writeTimer) clearTimeout(session.writeTimer);
      session.writeQueue.length = 0;
      this.sessions.delete(id);
      this.emit('closed', { sessionId: id });
    });
```

**Depois**
```ts
    ptyProcess.onExit(() => {
      // Atenção: isto cancela um `idleTimer` pendente, logo o 'done' desta rajada NUNCA sai. Um
      // processo que acaba depressa (ou que morre) fecha sem nunca ter dito "terminei" — quem
      // estivesse à espera do 'done' ficava à espera para sempre. Por isso o 'closed' leva o
      // output final: é o único sítio onde ainda existe (o `sessions.delete` abaixo torna-o
      // inalcançável), e é o que permite a quem ouve reportar o fecho em vez de o engolir.
      if (session.idleTimer) clearTimeout(session.idleTimer);
      if (session.writeTimer) clearTimeout(session.writeTimer);
      session.writeQueue.length = 0;
      const finalOutput = session.buffer.replace(ANSI_RE, '');
      this.sessions.delete(id);
      this.emit('closed', { sessionId: id, finalOutput });
    });
```

No mesmo ficheiro, o fecho cooperativo (`kill`) tem de fazer o mesmo:

**Antes**
```ts
    try { session.pty.kill(); } catch {}
    this.sessions.delete(sessionId);
    this.emit('closed', { sessionId });
```

**Depois**
```ts
    try { session.pty.kill(); } catch {}
    const finalOutput = session.buffer.replace(ANSI_RE, '');
    this.sessions.delete(sessionId);
    this.emit('closed', { sessionId, finalOutput });
```

E o cabeçalho do ficheiro, que documenta os eventos:

**Antes**
```ts
//   'closed' { sessionId }                   — PTY exit (forwarded as 'session_closed')
```

**Depois**
```ts
//   'closed' { sessionId, finalOutput }      — PTY exit (forwarded as 'session_closed'). `finalOutput`
//                                              é o buffer final já sem ANSI: quem ouvir isto não o
//                                              consegue ir buscar depois, porque a sessão já saiu do mapa.
```

### 1b. O fecho tem de acordar o gestor

`JOCA_OS/backend/src/manager/wake.ts`

Primeiro, `reportarWorker` passa a saber **porque** está a reportar. Substitui a assinatura e o
início da função:

**Antes**
```ts
/**
 * Reporta ao gestor o que aconteceu num worker. Duas entradas chamam isto: o evento 'done' e a
 * varredura de encalhados (ver `varrerEncalhados`).
 */
function reportarWorker(sessionId: string, encalhado = false): void {
  const worker = findBySession(sessionId);
  if (!worker) return;                          // not a manager-owned worker (task worker / user session)
  markIdle(sessionId);

  const session = sessionManager.get(sessionId);
  const project = loadProjects().find((p) => p.id === worker.projectId);
  if (!session || !project) return;

  const job = worker.currentJob ?? '';
```

**Depois**
```ts
/** Porque é que estamos a reportar este worker — muda o texto e o passo seguinte, não o caminho. */
type MotivoReporte = 'done' | 'encalhado' | 'fechado';

/**
 * Reporta ao gestor o que aconteceu num worker. TRÊS entradas chamam isto: o evento 'done', a
 * varredura de encalhados (`varrerEncalhados`) e o fecho do terminal (`startManagerWatch`).
 *
 * No caso 'fechado' a sessão JÁ NÃO EXISTE (o `onExit` tira-a do mapa antes de emitir), por isso o
 * output final vem no próprio evento em vez de ser lido aqui.
 */
function reportarWorker(sessionId: string, motivo: MotivoReporte = 'done', outputFinal?: string): void {
  const worker = findBySession(sessionId);
  if (!worker) return;                          // not a manager-owned worker (task worker / user session)

  // Um terminal fechado só interessa ao gestor se ele estava à espera dele. Fechar um worker
  // parado (o dono a arrumar a casa, ou o próprio gestor com `fechar_worker`) não é um evento.
  if (motivo === 'fechado' && !worker.busy) return;

  // ANTES do markIdle: ele limpa o `currentJob` no mesmo objecto do pool que `findBySession`
  // devolveu, portanto lê-lo a seguir dava sempre string vazia e o gestor nunca soube que trabalho
  // é que o worker estava a fazer.
  const job = worker.currentJob ?? '';
  markIdle(sessionId);

  const session = sessionManager.get(sessionId);
  const project = loadProjects().find((p) => p.id === worker.projectId);
  if (!project) return;
  if (motivo !== 'fechado' && !session) return;  // sessão desapareceu a meio: o 'closed' trata dela
```

> Repara que este bloco arruma **de caminho** a correção 2 (o `job` lido cedo demais). Se aplicares
> este, a correção 2 já fica feita.

Ainda no mesmo ficheiro, a construção da mensagem. A cauda passa a poder vir do evento, e o
cabeçalho ganha o caso do fecho:

**Antes**
```ts
      const tail = (sessionManager.readBuffer(sessionId, { strip: true }) ?? '').slice(-4000);
      const verdict = await judgeWorkerOutput(`worker de ${worker.area}`, tail);
      const head = verdict.state === 'question'
        ? `O worker de "${worker.area}" está À ESPERA DE RESPOSTA.`
        : verdict.state === 'error'
          ? `O worker de "${worker.area}" terminou COM PROBLEMAS.`
          : `O worker de "${worker.area}" terminou o trabalho.`;
      enqueue(worker.projectId, [
        head,
        encalhado
          ? `(Ninguém tinha reportado isto: o terminal está calado há mais de ${Math.round(ENCALHADO_MS / 1000)}s`
            + ' e continuava marcado como a trabalhar. Vê o que ele tem no ecrã antes de assumir que acabou.)'
          : '',
```

**Depois**
```ts
      const bruto = motivo === 'fechado'
        ? (outputFinal ?? '')
        : (sessionManager.readBuffer(sessionId, { strip: true }) ?? '');
      const tail = bruto.slice(-4000);
      const verdict = await judgeWorkerOutput(`worker de ${worker.area}`, tail);
      const head = motivo === 'fechado'
        ? `O terminal do worker de "${worker.area}" FECHOU (o processo acabou ou foi abaixo).`
        : verdict.state === 'question'
          ? `O worker de "${worker.area}" está À ESPERA DE RESPOSTA.`
          : verdict.state === 'error'
            ? `O worker de "${worker.area}" terminou COM PROBLEMAS.`
            : `O worker de "${worker.area}" terminou o trabalho.`;
      enqueue(worker.projectId, [
        head,
        motivo === 'encalhado'
          ? `(Ninguém tinha reportado isto: o terminal está calado há mais de ${Math.round(ENCALHADO_MS / 1000)}s`
            + ' e continuava marcado como a trabalhar. Vê o que ele tem no ecrã antes de assumir que acabou.)'
          : '',
        motivo === 'fechado'
          ? '(Estavas à espera deste worker. Ele fechou sem chegar a dizer que tinha acabado, por isso'
            + ' o que está aqui em baixo é o último ecrã dele — pode estar a meio.)'
          : '',
```

A instrução final não pode mandá-lo responder a um terminal que já não existe:

**Antes**
```ts
        verdict.state === 'question'
          ? 'Decide: se a escolha for reversível e óbvia, responde-lhe com responder_worker; se for importante ou irreversível, pergunta ao utilizador.'
          : 'Diz ao utilizador o que ficou feito (curto). Se houver passo seguinte natural, propõe-o.',
```

**Depois**
```ts
        motivo === 'fechado'
          // O terminal já não existe: mandá-lo usar `responder_worker` seria mandá-lo falar com um
          // morto. O que resta é verificar o que ficou em disco e decidir se repete o trabalho.
          ? 'O terminal já não existe — não podes responder-lhe. Confirma no disco o que ficou feito'
            + ' (ver_ficheiro/listar_pasta) e decide: se ficou a meio, despacha outra vez para essa'
            + ' área; se ficou feito, diz ao utilizador. Não fiques à espera dele.'
          : verdict.state === 'question'
            ? 'Decide: se a escolha for reversível e óbvia, responde-lhe com responder_worker; se for importante ou irreversível, pergunta ao utilizador.'
            : 'Diz ao utilizador o que ficou feito (curto). Se houver passo seguinte natural, propõe-o.',
```

A varredura de encalhados passa o motivo pelo nome novo:

**Antes**
```ts
    reportarWorker(w.sessionId, true);
```

**Depois**
```ts
    reportarWorker(w.sessionId, 'encalhado');
```

E, finalmente, o ouvinte do fecho:

**Antes**
```ts
  sessionManager.on('closed', ({ sessionId }: { sessionId: string }) => {
    forgetSession(sessionId);
  });
```

**Depois**
```ts
  // O fecho tem de acordar o gestor ANTES de esquecer o worker — e não é redundante com o 'done':
  // o `onExit` cancela o `idleTimer`, portanto um processo que acaba (ou morre) sem chegar aos
  // DONE_MIN_WORK_MS de rajada não chega a emitir 'done'. Era este o caminho pelo qual um agente
  // terminava e o gestor ficava à espera para sempre: a varredura de encalhados também não o
  // apanha, porque `estaEncalhado` desiste quando a sessão já não existe.
  // A ordem importa: `reportarWorker` precisa do worker ainda no pool para o encontrar.
  sessionManager.on('closed', ({ sessionId, finalOutput }: { sessionId: string; finalOutput?: string }) => {
    reportarWorker(sessionId, 'fechado', finalOutput);
    forgetSession(sessionId);
  });
```

**Já está aplicada?**
```bash
grep -q "motivo === 'fechado'" JOCA_OS/backend/src/manager/wake.ts && echo aplicada || echo "por aplicar"
```

---

## 2. O gestor nunca sabe que trabalho tinha dado ao worker

**Sintoma:** a linha `Trabalho que lhe tinhas dado: …` chega sempre vazia ao gestor, em todos os
caminhos — incluindo os que já funcionavam.

**Causa:** em `reportarWorker`, o `job` era lido **depois** do `markIdle(sessionId)`, e o `markIdle`
limpa o `currentJob` no mesmo objecto do pool que o `findBySession` tinha devolvido.

**Correção:** já vai incluída no bloco da 1b (o `const job` passa para antes do `markIdle`). Se
aplicaste a 1b, esta está feita.

**Já está aplicada?**
```bash
grep -B 2 "markIdle(sessionId);" JOCA_OS/backend/src/manager/wake.ts | grep -q "const job" && echo aplicada || echo "por aplicar"
```

---

## 3. Renomear um agente não funciona — e tira-lhe a identidade

**Sintoma:** duplo-clique no nome de um agente no painel do projecto, escreves outro nome, e nada
muda no ecrã.

**Causa:** são três problemas sobrepostos, e o pior não é o visual.

1. **Identidade.** A área de um worker era **inferida do nome da sessão** (`adopt()` fazia
   `s.name.startsWith('Worker ')` e tirava a área do resto). Renomear um agente tirava-lhe a área:
   o gestor deixava de o reconhecer e perdia-o de vista.
2. **Ecrã.** A linha mostrava sempre `w.area`, mas o renome escreve em `session.name` — campo que
   aquela linha nunca lia.
3. **Actualização.** A lista de agentes vem do GET do chat do gestor, que só refazia com
   `manager_message`. Mesmo com tudo certo, o nome novo só apareceria quando o gestor falasse.

### 3a. A área passa a viver na sessão, não no nome

`JOCA_OS/backend/src/session-manager.ts` — quatro sítios.

Na interface `Session`:

**Antes**
```ts
  cli: CliId;                // which coding CLI runs inside the PTY (claude | codex | agy | opencode)
  pty: pty.IPty;
```

**Depois**
```ts
  cli: CliId;                // which coding CLI runs inside the PTY (claude | codex | agy | opencode)
  // Área do gestor a que este terminal pertence, quando foi ele que o abriu. É a IDENTIDADE do
  // worker (é por aqui que o gestor lhe fala), e vive à parte do `name` de propósito: o `name` é o
  // rótulo que o dono edita na interface, e renomear não pode mudar com quem o gestor está a falar.
  area?: string;
  pty: pty.IPty;
```

Na interface `SessionInfo`:

**Antes**
```ts
  origin: 'user' | 'auto';
  cli: CliId;
  status: 'working' | 'idle';
```

**Depois**
```ts
  origin: 'user' | 'auto';
  cli: CliId;
  area?: string;
  status: 'working' | 'idle';
```

Na interface `SpawnOptions`:

**Antes**
```ts
  model?: string;             // passed to the CLI's model flag when the profile has one
}
```

**Depois**
```ts
  model?: string;             // passed to the CLI's model flag when the profile has one
  area?: string;              // preenchido pelo pool do gestor — ver `Session.area`
}
```

Na o mapeador para `SessionInfo`:

**Antes**
```ts
    return { id: s.id, name: s.name, cwd: s.cwd, projectId: s.projectId, origin: s.origin, cli: s.cli, status: s.status };
```

**Depois**
```ts
    return { id: s.id, name: s.name, cwd: s.cwd, projectId: s.projectId, origin: s.origin, cli: s.cli, area: s.area, status: s.status };
```

Na construção da sessão no `spawn`:

**Antes**
```ts
    const session: Session = {
      id, name, cwd, projectId, origin,
      cli: profile.id,
      pty: ptyProcess,
```

**Depois**
```ts
    const session: Session = {
      id, name, cwd, projectId, origin,
      cli: profile.id,
      area: opts.area,
      pty: ptyProcess,
```

### 3b. O pool deixa de inferir a área do nome

`JOCA_OS/backend/src/manager/worker-pool.ts`

**Antes**
```ts
// Session name carries the area so the pool can be rebuilt after a backend restart.
```

**Depois**
```ts
// A área viaja em `session.area` (ver `Session.area`). O nome já NÃO é identidade: o dono pode
// renomear um agente na interface, e antes disto renomeá-lo tirava-lhe a área — o `adopt` deixava
// de o reconhecer e o gestor perdia-o de vista. O prefixo no nome é só o rótulo por defeito.
```

**Antes**
```ts
// reopened one). Matches on the "Worker <area>" naming convention.
```

**Depois**
```ts
// reopened one). Casa pela `area` da sessão — não pelo nome, que o dono pode ter mudado.
```

**Antes**
```ts
    if (!s.name.startsWith(`${NAME_PREFIX} `)) continue;
    const area = s.name.slice(NAME_PREFIX.length + 1).trim();
    if (!area || m.has(area)) continue;
```

**Depois**
```ts
    // `s.area` é a fonte; o nome fica como recurso para sessões nascidas antes deste campo.
    const area = s.area?.trim()
      || (s.name.startsWith(`${NAME_PREFIX} `) ? s.name.slice(NAME_PREFIX.length + 1).trim() : '');
    if (!area || m.has(area)) continue;
```

**Antes**
```ts
    sessionName: workerName(cleanArea),
    origin: 'auto',
```

**Depois**
```ts
    sessionName: workerName(cleanArea),
    area: cleanArea,
    origin: 'auto',
```

### 3c. A API manda o rótulo a mostrar

`JOCA_OS/backend/src/http/manager-routes.ts`

**Antes**
```ts
import { listWorkers } from '../manager/worker-pool';
import { sessionManager } from '../session-manager';
```

**Depois**
```ts
import { listWorkers, workerName } from '../manager/worker-pool';
import { sessionManager } from '../session-manager';
```

**Inserir** (não é substituição) logo a seguir à linha `const projectExists = …`:

```ts

  // Um worker como a interface precisa dele: estado da sessão + o rótulo a mostrar.
  //
  // `area` é identidade (é por ela que o gestor lhe fala) e NÃO muda com um renome; `displayName` é
  // o que o dono escreveu. Só vem preenchido quando difere do nome por defeito, para a lista
  // continuar a mostrar a área — que é o que se quer ver — em tudo o que nunca foi renomeado.
  const paraUI = (w: ReturnType<typeof listWorkers>[number]) => {
    const s = sessionManager.get(w.sessionId);
    const nome = s?.name?.trim();
    return {
      ...w,
      status: s?.status ?? 'closed',
      displayName: nome && nome !== workerName(w.area) ? nome : undefined,
    };
  };
```

E as duas listagens passam a usá-lo:

**Antes**
```ts
      workers: listWorkers(req.params.id).map((w) => ({
        ...w,
        status: sessionManager.get(w.sessionId)?.status ?? 'closed',
      })),
```

**Depois**
```ts
      workers: listWorkers(req.params.id).map(paraUI),
```

**Antes**
```ts
      .flatMap((p) => listWorkers(p.id).map((w) => ({
        ...w,
        status: sessionManager.get(w.sessionId)?.status ?? 'closed',
      })));
```

**Depois**
```ts
      .flatMap((p) => listWorkers(p.id).map(paraUI));
```

### 3d. A interface lê o rótulo

`JOCA_OS/frontend/src/types.ts`

**Antes**
```ts
export interface PooledWorker {
  sessionId: string;
  projectId: string;
  area: string;
  busy: boolean;
```

**Depois**
```ts
export interface PooledWorker {
  sessionId: string;
  projectId: string;
  /** Identidade do worker: é por aqui que o gestor lhe fala. Um renome NÃO mexe nisto. */
  area: string;
  /** Rótulo escrito pelo dono. Só vem quando difere do nome por defeito — senão mostra-se a `area`. */
  displayName?: string;
  busy: boolean;
```

`JOCA_OS/frontend/src/components/project-workspace/WorkersChannel.tsx`

**Antes**
```tsx
      {liveWorkers.map((w) => row(
        w.sessionId, w.sessionId, w.area,
```

**Depois**
```tsx
      {/* `displayName` só existe depois de o dono renomear; sem ele mostra-se a área. Antes lia-se
          sempre `w.area`, e por isso renomear um agente do gestor não mudava nada no ecrã. */}
      {liveWorkers.map((w) => row(
        w.sessionId, w.sessionId, w.displayName || w.area,
```

### 3e. O renome refresca a lista

`JOCA_OS/frontend/src/hooks/useSessionSocket.ts`

**Antes**
```ts
        case 'session_renamed':
          d.setSessions((prev) => prev.map((s) =>
            s.id === msg.sessionId ? { ...s, name: msg.name } : s
          ));
          break;
```

**Depois**
```ts
        case 'session_renamed':
          d.setSessions((prev) => prev.map((s) =>
            s.id === msg.sessionId ? { ...s, name: msg.name } : s
          ));
          // A lista de agentes do projecto não sai daqui — vem do GET do chat do gestor, que só
          // refazia com `manager_message`. Sem este empurrão, renomear um agente do gestor não
          // mudava nada no ecrã até o gestor falar outra vez.
          d.setManagerRefresh((n) => n + 1);
          break;
```

**Já está aplicada?**
```bash
grep -q "area?: string" JOCA_OS/backend/src/session-manager.ts \
  && grep -q "displayName" JOCA_OS/frontend/src/types.ts \
  && echo aplicada || echo "por aplicar"
```

---

## 4. O gestor não sabe que o quadro de tarefas mexeu

**Sintoma:** crias, moves ou comentas uma tarefa e o gestor do projecto não dá por nada. Ele só
reage a workers que acabam, nunca pega em trabalho sozinho.

**Causa:** nada ligava as mutações de tarefas à fila de despertares do gestor.

**Cuidado que a correção tem de ter:** o gestor também mexe em tarefas. Se for acordado pelo que
ele próprio faz, entra em ciclo. A solução não é uma heurística — é **onde** o aviso é disparado: só
na camada HTTP (`http/tasks-routes.ts`), por onde passam o dono (browser) e os agentes (ponte
`joca`). As ferramentas do próprio gestor (`manager/tools.ts`) e o motor de tarefas escrevem
directamente no store, logo nunca o acordam a ele mesmo.

### 4a. A função que acorda

`JOCA_OS/backend/src/manager/wake.ts` — a seguir ao `resetWakeBudget`:

**Antes**
```ts
export function resetWakeBudget(projectId: string): void {
  patchState(projectId, { autoWakeCount: 0 });
  progresso.delete(projectId);
}
```

**Depois**
```ts
export function resetWakeBudget(projectId: string): void {
  patchState(projectId, { autoWakeCount: 0 });
  progresso.delete(projectId);
}

/**
 * Acorda o gestor porque o QUADRO DE TAREFAS do projecto mexeu — é assim que ele trabalha sozinho
 * em vez de só reagir a workers que acabam.
 *
 * Quem chama isto é a camada HTTP das tarefas (`http/tasks-routes.ts`), e só ela. É de propósito, e
 * é o que impede o ciclo: o dono (browser) e os agentes (ponte `joca` → mesma API HTTP) passam por
 * lá, mas as ferramentas do PRÓPRIO gestor (`manager/tools.ts`) e o motor de tarefas escrevem
 * directamente no store. Ou seja, o gestor nunca é acordado pelo que ele mesmo acabou de fazer.
 *
 * Passa pela fila normal, portanto herda tudo o que já protege os wakes: o debounce (arrastar um
 * cartão dispara vários pedidos e dá UM turno), o orçamento de wakes automáticos e o travão de
 * progresso.
 */
export function acordarPorTarefas(projectId: string, mudanca: string): void {
  enqueue(projectId, [
    `[QUADRO DE TAREFAS] ${mudanca}`,
    'Vê o quadro e decide se há alguma coisa para fazer agora: se houver trabalho pronto e o caminho'
    + ' for claro, despacha-o; se faltar informação ou for irreversível, pergunta ao dono.',
    'Se não houver nada a fazer, não respondas — um turno sem resposta é um resultado válido e evita'
    + ' encher o chat de acusações de recepção.',
  ].join('\n'));
}
```

### 4b. As rotas disparam o aviso

`JOCA_OS/backend/src/http/tasks-routes.ts`

**Antes**
```ts
import { runTaskNow } from '../tasks/engine';
import { sessionManager } from '../session-manager';
import { broadcast } from '../ws/broadcast';
```

**Depois**
```ts
import { runTaskNow } from '../tasks/engine';
import { sessionManager } from '../session-manager';
import { broadcast } from '../ws/broadcast';
import { acordarPorTarefas } from '../manager/wake';
```

**Inserir** (não é substituição) logo a seguir à linha `const isStatus = …`:

```ts

// Uma mudança no quadro: refresca quem está a ver E avisa o gestor do projecto, para ele poder
// pegar no trabalho sozinho. Vão juntos de propósito — eram duas coisas que não podiam divergir, e
// antes disto só existia a primeira: o gestor nunca sabia que o quadro tinha mexido.
//
// Só aqui, na camada HTTP. As ferramentas do próprio gestor escrevem directamente no store, logo
// não se acorda a si mesmo (ver `acordarPorTarefas`).
function mudou(descricao: string, task?: Task | null): void {
  broadcast({ type: 'tasks_changed' });
  if (task?.projectId) acordarPorTarefas(task.projectId, descricao);
}

const resumo = (t: Task) => `"${t.title.slice(0, 120)}"`;
```

Agora as rotas, uma a uma.

**Criar**

**Antes**
```ts
    upsertTask(t);
    broadcast({ type: 'tasks_changed' });
    res.json(t);
```
**Depois**
```ts
    upsertTask(t);
    mudou(`Tarefa NOVA na coluna "${t.status}": ${resumo(t)}.`, t);
    res.json(t);
```

**Editar**

**Antes**
```ts
    upsertTask(updated);
    broadcast({ type: 'tasks_changed' });
    res.json(updated);
```
**Depois**
```ts
    upsertTask(updated);
    mudou(`Tarefa EDITADA: ${resumo(updated)}.`, updated);
    res.json(updated);
```

**Apagar**

**Antes**
```ts
  r.delete('/tasks/:id', (req, res) => {
    const ok = deleteTask(req.params.id);
    if (ok) broadcast({ type: 'tasks_changed' });
    res.json({ ok });
  });
```
**Depois**
```ts
  r.delete('/tasks/:id', (req, res) => {
    // Lida ANTES de apagar: depois já não há de onde tirar o projecto a avisar.
    const antes = getTask(req.params.id);
    const ok = deleteTask(req.params.id);
    if (ok) mudou(`Tarefa APAGADA: ${antes ? resumo(antes) : req.params.id}.`, antes);
    res.json({ ok });
  });
```

**Mover**

**Antes**
```ts
    const task = moveTask(req.params.id, b.status, order);
    if (!task) return res.status(404).json({ error: 'not found' });
    broadcast({ type: 'tasks_changed' });
    res.json(task);
```
**Depois**
```ts
    const task = moveTask(req.params.id, b.status, order);
    if (!task) return res.status(404).json({ error: 'not found' });
    mudou(`Tarefa MOVIDA para "${b.status}": ${resumo(task)}.`, task);
    res.json(task);
```

**Comentar**

**Antes**
```ts
    const comment = addTaskComment(req.params.id, { text: b.text, author, authorName });
    if (!comment) return res.status(404).json({ error: 'not found' });
    broadcast({ type: 'tasks_changed' });
    res.json(comment);
```
**Depois**
```ts
    const comment = addTaskComment(req.params.id, { text: b.text, author, authorName });
    if (!comment) return res.status(404).json({ error: 'not found' });
    mudou(
      `Comentário NOVO (${authorName ?? author}) em ${resumo(getTask(req.params.id)!)}: ${b.text.slice(0, 300)}`,
      getTask(req.params.id),
    );
    res.json(comment);
```

**Fundir**

**Antes**
```ts
    if (!merged) return res.status(409).json({ error: 'não foi possível fundir (tarefas inexistentes ou uma delas está em execução)' });
    broadcast({ type: 'tasks_changed' });
    res.json(merged);
```
**Depois**
```ts
    if (!merged) return res.status(409).json({ error: 'não foi possível fundir (tarefas inexistentes ou uma delas está em execução)' });
    mudou(`${b.ids.length} tarefas FUNDIDAS numa só: ${resumo(merged)}.`, merged);
    res.json(merged);
```

**Avançar**

**Antes**
```ts
    const task = advanceTask(req.params.id);
    if (!task) return res.status(409).json({ error: 'tarefa inexistente ou já na última coluna' });
    broadcast({ type: 'tasks_changed' });
    res.json(task);
```
**Depois**
```ts
    const task = advanceTask(req.params.id);
    if (!task) return res.status(409).json({ error: 'tarefa inexistente ou já na última coluna' });
    mudou(`Tarefa AVANÇADA para "${task.status}": ${resumo(task)}.`, task);
    res.json(task);
```

**Avançar a coluna inteira**

**Antes**
```ts
    const moved = advanceColumn(b.status);
    if (moved > 0) broadcast({ type: 'tasks_changed' });
    res.json({ ok: true, moved });
```
**Depois**
```ts
    // Quais eram, ANTES de moverem — é a única altura em que dá para saber que projectos avisar.
    // Um aviso por projecto, não um por tarefa: mover a coluna é UM gesto do dono.
    const antes = loadTasks().filter((t) => t.status === b.status);
    const moved = advanceColumn(b.status);
    if (moved > 0) {
      broadcast({ type: 'tasks_changed' });
      const porProjecto = new Map<string, number>();
      for (const t of antes) {
        if (t.projectId) porProjecto.set(t.projectId, (porProjecto.get(t.projectId) ?? 0) + 1);
      }
      for (const [projectId, quantas] of porProjecto) {
        acordarPorTarefas(projectId, `A coluna "${b.status}" avançou inteira — ${quantas} tarefa(s) deste projecto mudaram de estado.`);
      }
    }
    res.json({ ok: true, moved });
```

**Ficam de fora, de propósito** — não mexer: reordenar dentro da coluna (é ordenação, e queimaria o
orçamento de wakes à conta de arrastos), `run`/`retry` (a conclusão já chega pelo caminho do worker)
e apagar um comentário. Tarefas **sem projecto** também não acordam ninguém: não têm gestor a quem
falar.

**Já está aplicada?**
```bash
grep -q "acordarPorTarefas" JOCA_OS/backend/src/http/tasks-routes.ts && echo aplicada || echo "por aplicar"
```

---

## Verificar tudo

```bash
cd JOCA_OS/backend && npx tsc --noEmit && npm test
cd ../frontend && npx tsc --noEmit && npx vite build
```

Espera-se: `tsc` sem output nos dois, testes todos verdes, build do frontend a terminar em `✓ built`.

Depois disto o backend **tem de ser reiniciado** — ele corre o build compilado, não o código-fonte:

```bash
bash JOCA_OS/stop.sh && bash JOCA_OS/start.sh     # Windows: JOCA_OS\stop.bat && JOCA_OS\start.bat
```

⚠ O reinício **fecha os terminais dos agentes abertos**. Se houver algum a trabalhar, espera que
acabe antes de reiniciar.
