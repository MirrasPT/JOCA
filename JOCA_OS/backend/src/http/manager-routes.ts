// Project manager chat routes.
//
// POST answers 202 immediately: the manager's reply arrives over the WebSocket as `manager_message`,
// possibly followed by more messages minutes later as workers finish. Holding the HTTP request open
// would recreate exactly the blocking behaviour this feature exists to remove.
import { appendRoomMessage, dispatchToRoom, isRoomBusy, listRoomMessages } from '../manager/room';
import express, { Router, Response } from 'express';
import { loadProjects } from '../project-store';
import { loadChat, clearChat, getState, patchState, appendMessage } from '../manager/store';
import { handleUserMessage, isManagerBusy } from '../manager/wake';
import { listWorkers } from '../manager/worker-pool';
import { sessionManager } from '../session-manager';
import { GLOBAL_MANAGER_ID } from '../manager/manager';
import {
  listSlashCommands, resolveSlashCommand, mensagemComandoDesconhecido, textoAjuda,
} from '../manager/slash-commands';

export function managerRouter(): Router {
  const r = Router();

  const projectExists = (id: string) => loadProjects().some((p) => p.id === id);

  // Uma mensagem começada por `/` é um comando, não conversa. Devolve `true` quando já respondeu —
  // o caller pára aí. Partilhado pelo chat por-projecto e pelo Joca global: a chave é a única
  // diferença entre os dois.
  function tratarComando(chave: string, texto: string, res: Response): boolean {
    const resolucao = resolveSlashCommand(texto);
    if (resolucao.tipo === 'nenhum') return false;

    if (resolucao.tipo === 'desconhecido') {
      // Erro do utilizador, não do servidor: 400 com o que ele pode escrever a seguir.
      res.status(400).json({ error: mensagemComandoDesconhecido(resolucao.nome, resolucao.sugestoes) });
      return true;
    }

    if (resolucao.tipo === 'local') {
      switch (resolucao.accao) {
        case 'limpar':
          clearChat(chave);
          appendMessage(chave, { role: 'system', text: 'Conversa limpa. Recomeçamos daqui.' });
          break;
        case 'libertar-contexto':
          // Largar o id da sessão do SDK faz o próximo turno começar de novo; o histórico visível
          // (o .jsonl) fica intacto — é essa a diferença para o /clear.
          patchState(chave, { sdkSessionId: undefined });
          appendMessage(chave, { role: 'user', text: texto });
          appendMessage(chave, {
            role: 'system',
            text: 'Contexto libertado. O histórico acima mantém-se visível, mas o gestor recomeça a conversa a partir daqui.',
          });
          break;
        case 'custo': {
          const total = getState(chave).totalCostUsd ?? 0;
          appendMessage(chave, { role: 'user', text: texto });
          appendMessage(chave, { role: 'system', text: `Custo acumulado desta conversa: ${total.toFixed(4)} USD.` });
          break;
        }
        case 'ajuda':
          appendMessage(chave, { role: 'user', text: texto });
          appendMessage(chave, { role: 'system', text: textoAjuda() });
          break;
      }
      res.status(202).json({ ok: true, comando: resolucao.nome, modo: 'local' });
      return true;
    }

    // 'gestor' | 'delegar': o chat mostra o que o utilizador escreveu; o turno recebe a instrução
    // expandida (conteúdo do comando, ou a ordem de despachar um agente).
    const message = appendMessage(chave, { role: 'user', text: texto });
    handleUserMessage(chave, resolucao.prompt)
      .catch((e) => console.error(`[manager] erro no comando /${resolucao.nome}:`, e));
    res.status(202).json({ ok: true, message, comando: resolucao.nome, modo: resolucao.tipo });
    return true;
  }

  // Catálogo para o autocomplete do composer.
  r.get('/manager/slash-commands', (_req, res) => {
    res.json({ commands: listSlashCommands() });
  });

  r.get('/projects/:id/chat', (req, res) => {
    if (!projectExists(req.params.id)) return res.status(404).json({ error: 'projecto não encontrado' });
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 200, 1000));
    const state = getState(req.params.id);
    res.json({
      messages: loadChat(req.params.id, limit),
      busy: isManagerBusy(req.params.id) || Boolean(state.busy),
      totalCostUsd: state.totalCostUsd ?? 0,
      workers: listWorkers(req.params.id).map((w) => ({
        ...w,
        status: sessionManager.get(w.sessionId)?.status ?? 'closed',
      })),
    });
  });

  r.post('/projects/:id/chat', express.json({ limit: '1mb' }), (req, res) => {
    const id = req.params.id;
    if (!projectExists(id)) return res.status(404).json({ error: 'projecto não encontrado' });
    const body = req.body as { text?: unknown; attachments?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter((x): x is string => typeof x === 'string').slice(0, 20)
      : [];
    if (!text && attachments.length === 0) return res.status(400).json({ error: 'text obrigatorio' });

    // Comando sem anexos → fluxo de comando. Com anexos, os ficheiros mandam: segue como conversa.
    if (attachments.length === 0 && tratarComando(id, text, res)) return;

    // Persist + broadcast the user's own message first, so it appears in the chat instantly. The
    // SDK turn gets a note listing the attached paths appended — plain text today, no native
    // multimodal injection at this layer (o gestor decide se quer chamar ver_imagem sobre eles).
    const message = appendMessage(id, { role: 'user', text, attachments: attachments.length ? attachments : undefined });
    const prompt = attachments.length
      ? `${text || '(sem texto, só anexos)'}\n\n[Anexos: ${attachments.join(', ')}]`
      : text;
    handleUserMessage(id, prompt).catch((e) => console.error('[manager] erro no turno:', e));
    res.status(202).json({ ok: true, message });
  });

  // Pool de TODOS os projectos, num pedido. A vista global de Agentes precisa de saber o que cada
  // agente está a fazer (área + trabalho actual), e isso só existe na pool do gestor — a lista de
  // sessões só sabe nomes e caminhos. Sem isto seria um GET do chat por projecto.
  r.get('/manager/workers', (_req, res) => {
    const workers = loadProjects()
      .filter((p) => !p.archived)
      .flatMap((p) => listWorkers(p.id).map((w) => ({
        ...w,
        status: sessionManager.get(w.sessionId)?.status ?? 'closed',
      })));
    res.json({ workers });
  });

  r.delete('/projects/:id/chat', (req, res) => {
    if (!projectExists(req.params.id)) return res.status(404).json({ error: 'projecto não encontrado' });
    clearChat(req.params.id);
    res.json({ ok: true });
  });

  // ── Joca global — mesmo formato de resposta, sem `:id` (chave = GLOBAL_MANAGER_ID). Sem
  // "workers": o painel de workers do canal Chat por-projecto não faz sentido aqui (são de
  // projectos diferentes) — a lista fica ao alcance do próprio chat via a ferramenta `ver_workers`.
  r.get('/manager/global/chat', (_req, res) => {
    const limit = Math.max(1, Math.min(Number(_req.query.limit) || 200, 1000));
    const state = getState(GLOBAL_MANAGER_ID);
    res.json({
      messages: loadChat(GLOBAL_MANAGER_ID, limit),
      busy: isManagerBusy(GLOBAL_MANAGER_ID) || Boolean(state.busy),
      totalCostUsd: state.totalCostUsd ?? 0,
      workers: [],
    });
  });

  r.post('/manager/global/chat', express.json({ limit: '1mb' }), (req, res) => {
    const body = req.body as { text?: unknown; attachments?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter((x): x is string => typeof x === 'string').slice(0, 20)
      : [];
    if (!text && attachments.length === 0) return res.status(400).json({ error: 'text obrigatorio' });
    if (attachments.length === 0 && tratarComando(GLOBAL_MANAGER_ID, text, res)) return;
    const message = appendMessage(GLOBAL_MANAGER_ID, { role: 'user', text, attachments: attachments.length ? attachments : undefined });
    const prompt = attachments.length
      ? `${text || '(sem texto, só anexos)'}\n\n[Anexos: ${attachments.join(', ')}]`
      : text;
    handleUserMessage(GLOBAL_MANAGER_ID, prompt).catch((e) => console.error('[manager] erro no turno global:', e));
    res.status(202).json({ ok: true, message });
  });

  r.delete('/manager/global/chat', (_req, res) => {
    clearChat(GLOBAL_MANAGER_ID);
    res.json({ ok: true });
  });

  // ── A Sala (chat de grupo dono + Joca + gestores) ──────────────────────────
  // `busy` viaja com as mensagens: a UI precisa de saber que a discussão AINDA corre, senão
  // apagava o indicador na primeira resposta e o utilizador julgava que tinha acabado.
  r.get('/room/messages', (_req, res) => {
    res.json({ messages: listRoomMessages(), busy: isRoomBusy() });
  });

  r.post('/room/messages', express.json(), (req, res) => {
    const body = (req.body ?? {}) as { text?: string; name?: string; targets?: string[] };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) { res.status(400).json({ error: 'texto vazio' }); return; }
    const name = (typeof body.name === 'string' && body.name.trim()) ? body.name.trim().slice(0, 40) : 'Dono';
    const targets = Array.isArray(body.targets) ? body.targets.filter((t): t is string => typeof t === 'string').slice(0, 12) : [];
    const msg = appendRoomMessage({ kind: 'user', name }, text);
    // 202: a mensagem entrou; as respostas dos gestores chegam ao GET à medida que os turnos acabam.
    if (targets.length > 0) {
      dispatchToRoom(targets, name, text).catch((e) => console.error('[room] erro no despacho:', e));
    }
    res.status(202).json({ ok: true, message: msg, dispatched: targets });
  });

  return r;
}
