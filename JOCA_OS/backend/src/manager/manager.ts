// The project manager — one conversational agent per project.
//
// It does NOT write code. It is given tools:[] (no Bash/Read/Write at all) plus the in-process MCP
// tools from tools.ts, so the only things it can do are: dispatch work to workers, read them,
// answer them, manage the board, and talk to the user.
//
// Conversation continuity uses the SDK's own session (options.resume): the history lives in the
// SDK, not in a transcript we paste into every prompt. That was the single most expensive mistake
// of the Master that came before this.
import { claudeProvider } from '../providers/provider';
import { loadProjects, type Project } from '../project-store';
import { buildManagerTools } from './tools';
import { appendMessage, getState, patchState, rotateChat, type ManagerMessage } from './store';

const MODEL = process.env.JOCA_MANAGER_MODEL || 'sonnet';
const MAX_TURNS = 24;             // tool calls within ONE reply
const MAX_BUDGET_USD = 1.5;       // per turn, hard stop

// The manager's entire capability surface. Listed explicitly (not a wildcard) so adding a tool is a
// deliberate act, and so these are auto-approved without needing bypassPermissions.
const MANAGER_TOOLS = [
  'trabalhar', 'ver_workers', 'ler_worker', 'responder_worker', 'fechar_worker',
  'tarefas', 'executar_tarefa', 'avisar_utilizador', 'estado_tarefa',
].map((t) => `mcp__joca__${t}`);

function buildSystemPrompt(project: Project): string {
  return [
    `És o gestor do projecto "${project.name}" no JOCA. Falas português de Portugal, de forma directa e curta.`,
    project.description ? `\nO projecto, nas palavras do dono: "${project.description}"` : '',
    `Pasta do projecto: ${project.path}`,
    '',
    '# O que tu és',
    'És um GESTOR, não um programador. NUNCA escreves código, nunca editas ficheiros, nunca corres comandos — não tens ferramentas para isso e não deves fingir que tens.',
    'O teu trabalho é: perceber o que o utilizador quer, partir isso em trabalho concreto, entregá-lo a workers (terminais com agentes reais), acompanhá-los, desbloqueá-los, e manter o utilizador informado.',
    '',
    '# Como trabalhas',
    '1. Quando o utilizador pede alguma coisa, responde JÁ e curto a dizer o que vais fazer. Não o deixes à espera.',
    '2. Usa `trabalhar` para entregar o trabalho. Escolhe a ÁREA certa (design, backend, frontend, conteúdo, testes, geral) — cada área tem o seu terminal, que é reutilizado.',
    '3. A instrução que dás ao worker tem de ser auto-suficiente: o que fazer, em que ficheiros/páginas, e o que conta como pronto. Ele não vê esta conversa.',
    '4. NUNCA esperes por um worker. Assim que despachas, a ferramenta devolve e tu continuas. Serás acordado quando ele terminar.',
    '5. Podes ter vários workers a trabalhar ao mesmo tempo em áreas diferentes. Mas NUNCA ponhas dois a mexer nos mesmos ficheiros — se o trabalho novo toca no mesmo sítio que um trabalho a decorrer, espera ou usa o mesmo worker.',
    '',
    '# Quando um worker termina ou fica preso',
    'Recebes uma mensagem automática do sistema (não é o utilizador a falar). Aí decides:',
    '- Terminou bem → diz ao utilizador, em uma ou duas frases, o que ficou feito e onde. Se fizer sentido, oferece o passo seguinte.',
    '- Falhou → explica o que falhou e propõe o que fazer. Não repitas o mesmo trabalho sem mudar nada.',
    '- Está preso numa pergunta → se a escolha for reversível e óbvia, decide tu com `responder_worker` e segue. Se for irreversível (apagar, deploy, pagar, publicar) ou se mudar o rumo do projecto, PERGUNTA ao utilizador e espera pela resposta dele.',
    '',
    '# Tarefas',
    'O quadro é partilhado entre ti e o utilizador. As tarefas NUNCA arrancam sozinhas: só correm quando tu usas `executar_tarefa` ou quando o utilizador carrega em correr.',
    'Antes de executar uma tarefa, lê-a com `estado_tarefa`. Deixa uma nota no fim do trabalho relevante.',
    'Podes criar tarefas para o utilizador com `para_humano: true` — coisas que dependem dele (decisões, acessos, conteúdos, validação). É assim que lhe passas trabalho.',
    '',
    '# Regras',
    '- Nunca inventes estado. Se não sabes se algo está feito, usa `ver_workers`, `ler_worker` ou `estado_tarefa` antes de afirmar.',
    '- Nunca digas que uma coisa está pronta só porque despachaste o trabalho.',
    '- Sê curto. O utilizador quer saber o que está a acontecer, não ler relatórios.',
    '- Usa `avisar_utilizador` apenas para o que interessa mesmo (trabalho concluído que ele espera, bloqueios). Progresso normal é só resposta no chat.',
  ].filter(Boolean).join('\n');
}

export interface TurnResult {
  message: ManagerMessage | null;
  error?: string;
}

// Run ONE turn. `kind` distinguishes a real user message from a system wake, which the manager is
// told explicitly so it never mistakes an automatic event for the user talking.
export async function runManagerTurn(
  projectId: string,
  input: string,
  kind: 'user' | 'system' = 'user',
): Promise<TurnResult> {
  const project = loadProjects().find((p) => p.id === projectId);
  if (!project) return { message: null, error: 'projecto não encontrado' };

  const state = getState(projectId);
  patchState(projectId, { busy: true });

  const actions: string[] = [];
  const prompt = kind === 'system'
    ? `[EVENTO AUTOMÁTICO DO SISTEMA — não é o utilizador a falar]\n${input}`
    : input;

  let text = '';
  let acc = '';
  let costUsd = 0;
  let sessionId: string | undefined;
  let error: string | undefined;

  try {
    for await (const ev of claudeProvider.run(prompt, {
      systemPrompt: buildSystemPrompt(project),
      model: MODEL,
      cwd: project.path,
      resume: state.sdkSessionId,
      mcpServers: { joca: buildManagerTools(projectId, actions) },
      disallowedTools: ['Bash', 'Write', 'Edit', 'Read', 'NotebookEdit', 'WebFetch'],
      allowedTools: MANAGER_TOOLS,
      // No filesystem tools → no need for bypassPermissions (which the CLI also refuses under root).
      permissionMode: 'default',
      maxTurns: MAX_TURNS,
      maxBudgetUsd: MAX_BUDGET_USD,
    })) {
      if (ev.type === 'text' && ev.text) acc += ev.text;
      else if (ev.type === 'result') {
        text = ev.text;
        costUsd = ev.costUsd;
        if (ev.sessionId) sessionId = ev.sessionId;
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error('[manager] turno falhou:', error);
  }

  const finalText = (text || acc).trim();
  patchState(projectId, {
    busy: false,
    lastTurnAt: Date.now(),
    ...(sessionId ? { sdkSessionId: sessionId } : {}),
    totalCostUsd: Math.round(((state.totalCostUsd ?? 0) + costUsd) * 10000) / 10000,
  });

  if (error && !finalText) {
    const msg = appendMessage(projectId, {
      role: 'system',
      text: `Não consegui completar este pedido: ${error}`,
    });
    return { message: msg, error };
  }
  if (!finalText) {
    // The manager chose to stay silent (e.g. a wake that needed no user-facing update). Actions
    // still happened, so they are worth recording — but not as a chat message.
    if (actions.length) console.log(`[manager] ${project.name}: ${actions.join(', ')} (sem resposta)`);
    return { message: null };
  }

  rotateChat(projectId);
  const msg = appendMessage(projectId, {
    role: 'manager',
    text: finalText,
    costUsd,
    actions,
  });
  return { message: msg };
}
