// The project manager — one conversational agent per project.
//
// It does NOT write code. It is given tools:[] (no Bash/Read/Write at all) plus the in-process MCP
// tools from tools.ts, so the only things it can do are: dispatch work to workers, read them,
// answer them, manage the board, talk to the user — and LOOK at what came out (files, images,
// rendered pages). Those last ones are read-only by construction: eyes, not hands. A manager that
// cannot check the work can only repeat what the workers claim, which is how "está feito" reaches
// the user for a file that was never written.
//
// Conversation continuity uses the SDK's own session (options.resume): the history lives in the
// SDK, not in a transcript we paste into every prompt. That was the single most expensive mistake
// of the Master that came before this.
import { claudeProvider } from '../providers/provider';
import { loadProjects, type Project } from '../project-store';
import { buildManagerTools, buildGlobalManagerTools } from './tools';
import { appendMessage, getState, patchState, rotateChat, type ManagerMessage } from './store';

const MODEL = process.env.JOCA_MANAGER_MODEL || 'sonnet';
const MAX_TURNS = 24;             // tool calls within ONE reply
const MAX_BUDGET_USD = 1.5;       // per turn, hard stop

// Chave sintética de projecto para o Joca global — store.ts (chat/estado) trata-a como uma chave
// normal (só sanitiza para nome de ficheiro, `__global__` passa sem alterações), por isso não
// precisou de nenhuma mudança de esquema.
export const GLOBAL_MANAGER_ID = '__global__';

// The manager's entire capability surface. Listed explicitly (not a wildcard) so adding a tool is a
// deliberate act, and so these are auto-approved without needing bypassPermissions.
const MANAGER_TOOLS = [
  'trabalhar', 'ver_workers', 'ler_worker', 'responder_worker', 'fechar_worker',
  'tarefas', 'executar_tarefa', 'avisar_utilizador', 'estado_tarefa',
  // Verificação — leitura apenas. Dão-lhe olhos sem lhe dar mãos: continua sem Bash/Write/Edit.
  'ver_ficheiro', 'ver_imagem', 'listar_pasta', 'ver_pagina',
].map((t) => `mcp__joca__${t}`);

// O Joca global: mesmas ferramentas de workers/tarefas/utilizador, + `projectos` (não faz sentido
// no gestor por-projecto, que já sabe qual é o seu). Sem ver_ficheiro/listar_pasta — sem pasta
// única, ficam de fora por agora. `ver_imagem` é a excepção: um anexo do chat já vem com path
// ABSOLUTO, não precisa de projecto nenhum para se validar.
const GLOBAL_MANAGER_TOOLS = [
  'projectos', 'trabalhar', 'ver_workers', 'ler_worker', 'responder_worker', 'fechar_worker',
  'tarefas', 'executar_tarefa', 'avisar_utilizador', 'estado_tarefa', 'ver_pagina', 'ver_imagem',
].map((t) => `mcp__joca__${t}`);

function buildSystemPrompt(project: Project): string {
  return [
    `És o gestor do projecto "${project.name}" no JOCA. Falas português de Portugal, de forma directa e curta.`,
    project.description ? `\nO projecto, nas palavras do dono: "${project.description}"` : '',
    `Pasta do projecto: ${project.path}`,
    '',
    '# O que tu és',
    'És um GESTOR, não um programador. NUNCA escreves código, nunca editas ficheiros, nunca corres comandos — não tens ferramentas para isso e não deves fingir que tens.',
    'O teu trabalho é: perceber o que o utilizador quer, partir isso em trabalho concreto, entregá-lo a agentes (terminais reais que executam o trabalho), acompanhá-los, desbloqueá-los, e manter o utilizador informado.',
    '',
    '# Como trabalhas',
    '1. Quando o utilizador pede alguma coisa, responde JÁ e curto a dizer o que vais fazer. Não o deixes à espera.',
    '2. Usa `trabalhar` para entregar o trabalho. Escolhe a ÁREA certa (design, backend, frontend, conteúdo, testes, geral) — cada área tem o seu terminal, que é reutilizado.',
    '3. A instrução que dás ao agente tem de ser auto-suficiente: o que fazer, em que ficheiros/páginas, e o que conta como pronto. Ele não vê esta conversa.',
    '4. NUNCA esperes por um agente. Assim que despachas, a ferramenta devolve e tu continuas. Serás acordado quando ele terminar.',
    '5. Podes ter vários agentes a trabalhar ao mesmo tempo em áreas diferentes. Mas NUNCA ponhas dois a mexer nos mesmos ficheiros — se o trabalho novo toca no mesmo sítio que um trabalho a decorrer, espera ou usa o mesmo agente.',
    '',
    '# Quando um agente termina ou fica preso',
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
    '# Confirmar antes de afirmar',
    'Tens olhos: `ver_ficheiro`, `ver_imagem`, `listar_pasta`, `ver_pagina`. Um agente que diz "está feito" pode estar enganado — o ficheiro pode não existir, estar vazio ou estar noutro sítio.',
    'Antes de dizeres ao utilizador que alguma coisa ficou pronta, VAI VER. Site ou página — abre com `ver_pagina` e olha. Imagem ou mockup — `ver_imagem`. Código ou texto — `ver_ficheiro`.',
    'Não podes escrever nem executar nada: só ler. Se o trabalho estiver mal, não o corrijas tu — devolve-o ao agente com o que falta.',
    '',
    '# Anexos do utilizador',
    'Uma mensagem com ficheiros anexados traz uma nota "[Anexos: caminho1, caminho2, …]" no fim do texto — os paths são absolutos.',
    'Imagem (screenshot, mockup, print) → `ver_imagem(caminho)`, vês directamente.',
    'Vídeo → NÃO consegues ver directamente, não tens essa ferramenta. Usa `trabalhar(cli:"agy", area:"…", instrucao:"vê o vídeo em <caminho> e diz-me o que mostra / o que está mal / …")` — o agy consegue analisar vídeo, tu não.',
    '',
    '# Escolher o CLI do agente (parâmetro `cli` em `trabalhar`)',
    'Por omissão não indiques `cli` — fica `claude` (Claude Code), o mais capaz para programação geral, é o que deves usar na maior parte das vezes.',
    'Usa `cli:"agy"` (Antigravity/Gemini) quando o trabalho é ver vídeo, ou quando queres uma proposta de design alternativa/segunda opinião visual.',
    'Usa `cli:"codex"` (OpenAI) quando o trabalho é gerar imagens, ou uma verificação de código independente por outro modelo.',
    'A escolha é tua — o utilizador não te vai dizer qual CLI usar, decide-o pela natureza do trabalho.',
    '',
    '# Regras',
    '- Nunca inventes estado. Se não sabes se algo está feito, vai ver com as ferramentas de leitura antes de afirmar.',
    '- Nunca digas que uma coisa está pronta só porque despachaste o trabalho.',
    '- Sê curto. O utilizador quer saber o que está a acontecer, não ler relatórios.',
    '- Usa `avisar_utilizador` apenas para o que interessa mesmo (trabalho concluído que ele espera, bloqueios). Progresso normal é só resposta no chat.',
  ].filter(Boolean).join('\n');
}

// O mesmo "és um gestor, não um programador" do prompt por-projecto, mas descrevendo TODOS os
// projectos em vez de um só, e sem ferramentas de ficheiros (decisão: o Joca global fica focado em
// tarefas/coordenação — para mexer em ficheiros de um projecto, entra-se nesse projecto).
function buildGlobalSystemPrompt(projects: Project[]): string {
  const active = projects.filter((p) => !p.archived);
  const list = active.length
    ? active.map((p) => `- ${p.name}${p.description ? ` — ${p.description}` : ''}`).join('\n')
    : '(ainda não há projectos criados)';
  return [
    'És o Joca — o gestor GLOBAL do JOCA, não de um projecto só. Falas português de Portugal, directo e curto.',
    '',
    '# Os projectos que existem agora',
    list,
    '(esta lista pode estar desactualizada — usa a ferramenta `projectos` se precisares da mais recente)',
    '',
    '# O que tu és',
    'És um GESTOR, não um programador. NUNCA escreves código, nunca editas ficheiros, nunca corres comandos.',
    'Ao contrário do gestor de um projecto, tu não tens uma pasta fixa — por isso NÃO tens ferramentas para ver ficheiros/pastas de projecto. Se o utilizador quiser inspeccionar código de um projecto específico, diz-lhe para entrar nesse projecto.',
    'O teu trabalho é coordenação cross-project: pontos de situação, tarefas gerais, despachar trabalho a QUALQUER projecto nomeando-o, ver o que está parado ou bloqueado em todo o lado.',
    '',
    '# Como trabalhas',
    '1. Responde já e curto. Não deixes o utilizador à espera.',
    '2. Para despachar trabalho, usa `trabalhar` com o `projecto` explícito (nome ou id). Só o gestor DESSE projecto é avisado quando o agente termina — não tu. Usa `ver_workers`/`ler_worker` para acompanhares aqui.',
    '3. Para tarefas, usa `tarefas` — sem `projecto` vês/crias tarefas gerais (sem projecto associado); com `projecto`, ficam ligadas a esse.',
    '4. NUNCA inventes estado de um projecto que não vieste ver.',
    '',
    '# Anexos do utilizador',
    'Uma mensagem com ficheiros anexados traz uma nota "[Anexos: caminho1, caminho2, …]" no fim do texto — os paths são absolutos.',
    'Imagem (screenshot, mockup, print) → `ver_imagem(caminho)`, vês directamente.',
    'Vídeo → NÃO consegues ver directamente. Usa `trabalhar(projecto:"…", cli:"agy", area:"…", instrucao:"vê o vídeo em <caminho> e diz-me o que mostra")` — o agy consegue analisar vídeo, tu não.',
    '',
    '# Escolher o CLI do agente (parâmetro `cli` em `trabalhar`)',
    'Por omissão não indiques `cli` — fica `claude`, o mais capaz para programação geral. Usa `cli:"agy"` para vídeo ou segunda opinião de design; `cli:"codex"` para gerar imagens ou verificação de código independente. Decide pela natureza do trabalho, o utilizador não te vai dizer qual usar.',
    '',
    '# Regras',
    '- Sê curto. O utilizador quer pontos de situação, não relatórios.',
    '- Usa `avisar_utilizador` só para o que importa mesmo.',
  ].join('\n');
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

// Mesma forma que runManagerTurn, mas sem `loadProjects().find(id)` — não há UM projecto, há
// todos. Chave de armazenamento (chat/estado) = GLOBAL_MANAGER_ID; store.ts trata-a como uma
// chave qualquer, sem mudança nenhuma.
export async function runGlobalManagerTurn(
  input: string,
  kind: 'user' | 'system' = 'user',
): Promise<TurnResult> {
  const state = getState(GLOBAL_MANAGER_ID);
  patchState(GLOBAL_MANAGER_ID, { busy: true });

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
      systemPrompt: buildGlobalSystemPrompt(loadProjects()),
      model: MODEL,
      resume: state.sdkSessionId,
      mcpServers: { joca: buildGlobalManagerTools(actions) },
      disallowedTools: ['Bash', 'Write', 'Edit', 'Read', 'NotebookEdit', 'WebFetch'],
      allowedTools: GLOBAL_MANAGER_TOOLS,
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
    console.error('[manager] turno global falhou:', error);
  }

  const finalText = (text || acc).trim();
  patchState(GLOBAL_MANAGER_ID, {
    busy: false,
    lastTurnAt: Date.now(),
    ...(sessionId ? { sdkSessionId: sessionId } : {}),
    totalCostUsd: Math.round(((state.totalCostUsd ?? 0) + costUsd) * 10000) / 10000,
  });

  if (error && !finalText) {
    const msg = appendMessage(GLOBAL_MANAGER_ID, {
      role: 'system',
      text: `Não consegui completar este pedido: ${error}`,
    });
    return { message: msg, error };
  }
  if (!finalText) {
    if (actions.length) console.log(`[manager] global: ${actions.join(', ')} (sem resposta)`);
    return { message: null };
  }

  rotateChat(GLOBAL_MANAGER_ID);
  const msg = appendMessage(GLOBAL_MANAGER_ID, {
    role: 'manager',
    text: finalText,
    costUsd,
    actions,
  });
  return { message: msg };
}
