// Orchestrator — Fase 1a. Turns a natural-language user message into orchestration: the Master
// brain (ClaudeProvider) runs with the MasterTools MCP server and drives N visible workers via
// spawn_worker / send_to_worker / read_worker. Streams normalized steps to the caller (the WS
// layer forwards them as master_message / orchestration_step / worker_summary).
//
// Constraint (verified, rules/orchestration-patterns.md): sub-agents do NOT spawn sub-agents.
// The brain is the main loop here; workers are PTYs, not nested SDK agents.
import { claudeProvider } from './provider';
import { ollamaProvider } from './ollama-provider';
import { codexProvider } from './codex-provider';
import { antigravityProvider } from './antigravity-provider';
import type { ProviderEvent } from './provider';
import type { MasterProvider } from '../project-store';
import { createMasterToolsServer } from './master-tools';
import { sessionManager } from '../session-manager';
import { loadProjects } from '../project-store';
import { JOCA_LOGIC_ROOT } from '../toolkit-registry';
import { buildMemoryContext, refreshShortMemory } from './master-memory';

export type MasterStep =
  | { type: 'message'; text: string }              // brain text to show the user
  | { type: 'step'; tool: string; input: unknown } // orchestration action (tool call)
  | { type: 'done'; summary: string; isError: boolean; costUsd: number; continued: boolean };
  // `continued`: this turn dispatched/continued worker work (spawn_worker / send_to_worker /
  // select_in_worker). The WS layer uses it to decide when to notify the user.

function buildSystemPrompt(): string {
  const projects = loadProjects();
  const projectLines = projects.length
    ? projects.map((p) => `  - ${p.name}: projectId=${p.id}`).join('\n')
    : '  (sem projectos registados)';
  return [
    'Es o Master do JOCA: um orquestrador que COMANDA terminais Claude Code (workers) por linguagem natural.',
    'NAO executas tu o trabalho de codigo/ficheiros. Em vez disso usas as ferramentas master:',
    '- spawn_worker(objective, projectId?/cwd?, ...) abre 1 worker e da-lhe o objectivo.',
    '- send_to_worker(workerId, text) envia seguimento.',
    '- read_worker(workerId) le o output e diz se done=true (sentinela detectada) e awaitingChoice=true (menu de seleccao a prender o worker).',
    '- select_in_worker(workerId, keys) responde a um menu que esta a prender um worker (keys="2 enter", "down enter", "y", ...).',
    '- list_workers() lista TODOS os terminais abertos (workers do Master E os que o utilizador abriu na UI), com estado/projecto/cwd.',
    '- close_worker(workerId) fecha um terminal/worker (arruma um que já não precisas). close_project_workers(projectId, includeWorking?) fecha todos os terminais de um projecto — usa quando o Renato diz "fecha o projecto X por hoje". NUNCA feches um terminal do utilizador que esteja [working] sem ele pedir.',
    '- create_project(name, path, createDir?) cria/regista um projecto no JOCA UI e devolve o projectId (depois usa-o em spawn_worker). createDir=true cria a pasta se nao existir. Path so dentro das raizes permitidas — se o utilizador nao der path, pergunta; nao inventes.',
    '- search_memory(query) procura na memoria longa (janelas antigas da conversa) por palavras-chave; read_diary(id) le a conversa completa de uma janela.',
    '- create_automation(name, objective, frequency?, time?, ..., provider?, model?, skills?, requireConfirm?, input?) cria automação/acção no painel Automações. frequency="manual" = ACÇÃO (corre à mão com um input; o objective pode ter {{input}}). skills = skills/agentes do JOCA a usar. requireConfirm=true para acções que enviam/apagam (pára e pede OK). Usa quando o Renato pede "cria uma automação/acção que...".',
    '- run_automation(ref, input?) corre AGORA uma automação/acção existente (por id ou nome); para acções passa o input. list_automations() lista as existentes (verifica antes para não duplicar). Confirma sempre ao Renato o que criaste/correste.',
    'OPTIMIZA TERMINAIS — NAO abras um terminal novo por tarefa. Antes de spawn_worker chama SEMPRE list_workers. Se existir um terminal idle adequado (mesmo projecto/cwd, sem tarefa a decorrer), REUTILIZA-O com send_to_worker(armDone=true) em vez de abrir novo. So abre worker novo se: nenhum esta idle, OU precisas de projecto/cwd diferente, OU todos os adequados estao [working]. Nunca abras 2 workers para a mesma tarefa.',
    'TERMINAIS DO UTILIZADOR: os marcados "terminal-do-utilizador" foram abertos pelo Renato. Podes reutiliza-los se estiverem [idle] e fizerem sentido para a tarefa, mas NUNCA interrompas um que esteja [working] (trabalho dele em curso).',
    `JOCA_BRAIN + MEMORIA: o toolkit (skills, agentes, memoria/conhecimento) esta em ${JOCA_LOGIC_ROOT}. Um worker aberto SEM projecto corre la e tem acesso a toda a memoria e skills do JOCA. Para consultar memoria/conhecimento/skills, abre (ou reutiliza) um worker sem projectId e pede-lhe para ler o que precisas.`,
    'PROJECTOS: para trabalhar num projecto JOCA, passa projectId ao spawn_worker — o worker corre NA pasta do projecto e faz /resume do contexto. Projectos disponiveis:',
    projectLines,
    'Se o utilizador nomear um projecto, escolhe o projectId correspondente da lista. Se nenhum corresponder ou for ambiguo, pergunta antes (nao inventes projectId nem path). Sem projecto, usa cwd explicito ou nenhum (corre no JOCA_Brain, com acesso a memoria/skills).',
    'FLUXO: decompoe o pedido -> list_workers (reutiliza idle ou abre novo) -> da o objectivo -> confirma com read_worker que arrancou -> termina o teu turno.',
    'CONTINUACAO AUTOMATICA: NAO precisas de ficar em loop a fazer read_worker a espera que o worker acabe. Quando um worker teu passa a idle, o sistema RE-INVOCA-TE automaticamente com um evento "[EVENTO AUTOMATICO DO SISTEMA]" que te diz qual worker terminou. Nessa altura le o output, e OU continuas (proximo passo/send_to_worker) OU respondes ao Renato com o resultado final. Ou seja: dispara o trabalho, confirma que arrancou, e sai; voltas a ser chamado quando houver novidade.',
    'CONFIRMA SEMPRE O ENVIO: depois de CADA spawn_worker e send_to_worker, chama read_worker para confirmar que o worker recebeu a mensagem e comecou a agir (ha resposta/accao, o input nao ficou preenchido por enviar). Se ficou por submeter, reenvia. Nunca assumas que a mensagem foi enviada sem confirmar.',
    'Acompanhamento: chama read_worker periodicamente; nao desistas enquanto done=false e houver progresso. Cap ~4 ciclos por worker sem progresso, depois reporta o que falta.',
    'MENUS DE SELECCAO: um worker pode ficar preso num menu interactivo (opcoes numeradas, (y/n), prompt de permissao do Claude Code). read_worker marca awaitingChoice=true. NUNCA deixes um worker preso a espera — resolve sempre: (a) escolha REVERSIVEL e clara -> escolhe a melhor opcao com select_in_worker (ex.: keys="1 enter"); (b) escolha IRREVERSIVEL (apagar, deploy, push, sobrescrever, gastar dinheiro) ou AMBIGUA -> NAO escolhas; descreve ao Renato as opcoes e o workerId, pergunta qual, termina o turno e espera. Quando o Renato responder, chama select_in_worker com a escolha dele. Depois de seleccionar, confirma com read_worker que o menu fechou.',
    'Seguranca: accoes reversiveis -> avanca; irreversiveis (deploy/push/migrations/deletes) -> pede 1 linha de confirmacao ao utilizador antes.',
    'Steward, nao initiator: faz so o que o pedido pede; nao inventes scope.',
    'MEMORIA: a mensagem pode vir precedida de um bloco "MEMORIA DA CONVERSA" (resumo + turnos recentes). Usa-o para continuidade — quando o Renato refere "o que falamos", uma decisao anterior, ou um worker/projecto ja mencionado, baseia-te nessa memoria em vez de pedir para repetir. Para algo antigo que NAO esteja nesse bloco (ex.: "o que decidimos ha semanas sobre X"), chama search_memory(query) e, se precisares do detalhe exacto, read_diary(id). So depois disso digas que nao te lembras.',
    'Comunicacao terse (caveman-lite), pt-pt. No fim, resume em 2-4 linhas: o que cada worker fez e o estado.',
  ].join('\n');
}

export interface RunMasterOptions {
  provider?: MasterProvider;       // which brain drives the Master (default 'claude')
  model?: string;
  onStep: (step: MasterStep) => void;
  onProjectsChanged?: () => void; // forwarded to create_project so the UI refreshes its project list
}

// Count of Master brain turns currently running (user-initiated OR auto follow-ups). The worker-done
// watcher reads this to defer a follow-up while another turn is live, so two brains never read/drive
// the same worker at once. See master/worker-watch.ts.
let activeRuns = 0;
export function masterRunsActive(): number { return activeRuns; }

export async function runMaster(userText: string, opts: RunMasterOptions): Promise<MasterStep> {
  const provider = opts.provider ?? 'claude';
  activeRuns++;
  try {
    return await runMasterInner(userText, opts, provider);
  } finally {
    activeRuns--;
  }
}

async function runMasterInner(userText: string, opts: RunMasterOptions, provider: MasterProvider): Promise<MasterStep> {

  let finalText = '';
  let isError = false;
  let costUsd = 0;
  // Did this turn actually dispatch or continue worker work? (drives the "notify only on
  // dispatch/finish" contract — see MasterStep.continued.)
  let continued = false;
  const CONTINUING_TOOLS = new Set(['spawn_worker', 'send_to_worker', 'select_in_worker']);

  // Conversational memory: prepend the rolling summary + recent verbatim turns so the brain has
  // continuity across messages (each runMaster is otherwise stateless). See master-memory.ts.
  const memory = buildMemoryContext();
  const prompt = memory ? `${memory}\n\n---\nNOVA MENSAGEM DO RENATO:\n${userText}` : userText;

  // Provider dispatch. Claude drives workers via the Agent SDK + in-process MCP server. Ollama
  // drives them via an in-process function-calling loop (it builds its own tools). Codex/Antigravity
  // run on their CLIs (subscription); their full worker-orchestration needs the MCP bridge, so they
  // report the limitation themselves (fail loud, never silent) until that bridge ships.
  const systemPrompt = buildSystemPrompt();
  let events: AsyncGenerator<ProviderEvent, void>;
  if (provider === 'ollama') {
    events = ollamaProvider.run(prompt, { systemPrompt, model: opts.model, onProjectsChanged: opts.onProjectsChanged });
  } else if (provider === 'codex') {
    events = codexProvider.run(prompt, { systemPrompt, model: opts.model, onProjectsChanged: opts.onProjectsChanged });
  } else if (provider === 'antigravity') {
    events = antigravityProvider.run(prompt, { systemPrompt, model: opts.model, onProjectsChanged: opts.onProjectsChanged });
  } else {
    const { server } = createMasterToolsServer(sessionManager, { onProjectsChanged: opts.onProjectsChanged });
    events = claudeProvider.run(prompt, {
      systemPrompt,
      model: opts.model ?? 'sonnet', // default Claude brain = Sonnet (not Opus); overridable per-run
      mcpServers: { master: server },
    });
  }

  for await (const ev of events) {
    if (ev.type === 'text') {
      if (ev.text.trim()) opts.onStep({ type: 'message', text: ev.text });
    } else if (ev.type === 'tool_use') {
      if (CONTINUING_TOOLS.has(ev.name)) continued = true;
      opts.onStep({ type: 'step', tool: ev.name, input: ev.input });
    } else if (ev.type === 'result') {
      finalText = ev.text;
      isError = ev.isError;
      costUsd = ev.costUsd;
    }
  }

  const done: MasterStep = { type: 'done', summary: finalText, isError, costUsd, continued };
  opts.onStep(done); // server persists this turn to master-chat before we read it back below
  // Fold older turns into the rolling summary if the window overflowed (no-op until then).
  await refreshShortMemory();
  return done;
}
