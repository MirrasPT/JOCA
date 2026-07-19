// Automation runner — v2. Executes a linear pipeline of nodes, threading each node's output as the
// `input` of the next ({{input}} in templates). Node types:
//   worker  → agentic step: opens a DEDICATED Claude Code worker (no project), hands it the
//             objective, waits for it to finish and captures the terminal output. The worker STAYS
//             OPEN so the user can inspect the result; completion fires the normal done
//             notification (toast/unread) in the UI.
//   llm     → prompts the brain directly (no terminal); cheap summarise/transform.
//   shell   → runs a local command; output = stdout.
//   http    → GETs a URL; output = body (truncated).
//   message → OUTPUT: delivers text as a notification via the injected `deliver` callback.
//
// Report-style automations are [schedule]→[…source…]→[llm]→[message]. Action automations are
// [schedule]→[worker(objective)] (the worker executes autonomously in its own terminal).
import { exec } from 'child_process';
import type { Automation, AutomationNode } from './store';
import { claudeProvider } from '../providers/provider';
import { sessionManager, MAX_SESSIONS } from '../session-manager';

// Per-automation extras applied to the agentic (worker) step.
interface AutoCtx { model?: string; skills?: string[]; requireConfirm?: boolean }

export interface NodeLog { nodeId: string; type: string; ok: boolean; output: string }
export interface RunResult { ok: boolean; finalOutput: string; log: NodeLog[] }

export interface RunnerDeps {
  // message node output channel — server.ts injects (WS broadcast → UI notification). Keeps the
  // runner decoupled from express/WS. automationName lets the UI label where the message came from.
  deliver: (text: string, automationName: string) => void;
}

const WORKER_TIMEOUT_MS = 60 * 60_000; // hard cap for one worker step (1h)
const TRUNC = 8000;
const tr = (s: string) => (s.length > TRUNC ? s.slice(0, TRUNC) + `\n…[truncado ${s.length - TRUNC} chars]` : s);
const render = (tpl: string, input: string) => (tpl ?? '').replace(/\{\{\s*input\s*\}\}/g, input);

function collectProviderText(events: AsyncGenerator<{ type: string; text?: string }>): Promise<string> {
  return (async () => {
    let result = '';
    let acc = '';
    for await (const ev of events as AsyncGenerator<{ type: string; text?: string }>) {
      if (ev.type === 'text' && ev.text) acc += ev.text;
      else if (ev.type === 'result') result = ev.text ?? '';
    }
    return (result || acc).trim();
  })();
}

function runShell(command: string, cwd?: string): Promise<string> {
  return new Promise((resolve) => {
    exec(command, { cwd, timeout: 120_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err) resolve(`erro shell: ${err.message}\n${(stderr || stdout || '').toString()}`.trim());
      else resolve((stdout || stderr || '').toString().trim());
    });
  });
}

async function runNode(node: AutomationNode, input: string, automationName: string, deps: RunnerDeps, auto: AutoCtx): Promise<string> {
  switch (node.type) {
    case 'worker': {
      const objective = render(node.objective ?? '', input);
      if (!objective.trim()) throw new Error('worker node sem objective');
      if (sessionManager.size >= MAX_SESSIONS) throw new Error(`limite de ${MAX_SESSIONS} sessões atingido — fecha terminais e volta a correr`);
      const directives: string[] = [];
      directives.push('Isto é uma AUTOMAÇÃO a correr num worker dedicado (sem projecto). Executa a ordem acima de forma autónoma e termina com um resumo claro do resultado.');
      if (auto.skills?.length) directives.push(`Usa estas skills/agentes do JOCA (faz Read da skill ANTES de agir): ${auto.skills.join(', ')}.`);
      if (auto.requireConfirm) directives.push('ANTES de qualquer acção IRREVERSÍVEL (enviar email, apagar, deploy, push, gastar dinheiro): NÃO a executes. Prepara tudo, entrega o rascunho/plano e PEDE confirmação explícita ao utilizador; só age depois do OK dele.');
      const brief = `${objective}\n\n[Instruções da automação]\n${directives.join('\n')}`;
      // Dedicated worker, NO project (cwd defaults to the Brain). It shows up in the UI like any
      // session; when the run finishes the normal done-notification fires and the worker stays open
      // so the user can inspect (or continue) the result in the terminal.
      const session = sessionManager.spawn({
        sessionName: `Automação: ${automationName}`.slice(0, 80),
        origin: 'auto',
        initialInput: brief,
      });
      const outcome = await sessionManager.waitForDone(session.id, WORKER_TIMEOUT_MS);
      const tail = (sessionManager.readBuffer(session.id, { strip: true }) ?? '').slice(-6000);
      if (outcome === 'closed') throw new Error(`worker da automação foi fechado antes de terminar\n\n${tail}`);
      if (outcome === 'timeout') return tr(`⚠ worker ainda a executar após ${WORKER_TIMEOUT_MS / 60000} min — vê o terminal "${session.name}".\n\n${tail}`);
      return tr(tail);
    }
    case 'llm': {
      const prompt = render(node.prompt ?? '', input);
      if (!prompt.trim()) throw new Error('llm node sem prompt');
      // Direct brain call, no tools/terminal — cheap summarise/transform.
      const events = claudeProvider.run(prompt, { model: auto.model ?? 'sonnet' }) as unknown as AsyncGenerator<{ type: string; text?: string }>;
      return await collectProviderText(events);
    }
    case 'shell': {
      const cmd = render(node.command ?? '', input);
      if (!cmd.trim()) throw new Error('shell node sem command');
      return tr(await runShell(cmd, node.cwd));
    }
    case 'http': {
      const url = render(node.url ?? '', input);
      if (!/^https?:\/\//i.test(url)) throw new Error('http node sem url valido (http/https)');
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 30_000);
      try {
        const r = await fetch(url, { signal: c.signal });
        const body = await r.text();
        return tr(`HTTP ${r.status}\n${body}`);
      } finally { clearTimeout(t); }
    }
    case 'message': {
      const text = render(node.text ?? '{{input}}', input);
      const heading = node.title ? `**${node.title}**\n\n` : '';
      deps.deliver(heading + text, automationName);
      return text;
    }
    default:
      throw new Error(`tipo de no desconhecido: ${(node as AutomationNode).type}`);
  }
}

// seedInput = the runtime input for a manual action (fills {{input}} in the first node). '' for
// scheduled automations / actions without input.
export async function runAutomation(a: Automation, deps: RunnerDeps, seedInput = ''): Promise<RunResult> {
  const log: NodeLog[] = [];
  const auto: AutoCtx = { model: a.model, skills: a.skills, requireConfirm: a.requireConfirm };
  let input = seedInput;
  for (const node of a.nodes) {
    try {
      const out = await runNode(node, input, a.name, deps, auto);
      log.push({ nodeId: node.id, type: node.type, ok: true, output: out });
      input = out;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.push({ nodeId: node.id, type: node.type, ok: false, output: msg });
      return { ok: false, finalOutput: msg, log };
    }
  }
  return { ok: true, finalOutput: input, log };
}
