// Automation runner — v1. Executes a linear pipeline of nodes, threading each node's output as the
// `input` of the next ({{input}} in templates). Node types:
//   master  → runs the Master loop (spawns/uses workers) with an objective; output = the summary.
//   llm     → prompts the brain directly (no terminal); cheap summarise/transform.
//   shell   → runs a local command; output = stdout.
//   http    → GETs a URL; output = body (truncated).
//   message → OUTPUT: delivers text to the Master chat via the injected `deliver` callback.
//
// Report-style automations are [schedule]→[…source…]→[llm]→[message]. Action automations are
// [schedule]→[master(objective)] (the brain decides, spawns workers, handles selection menus).
import { exec } from 'child_process';
import type { Automation, AutomationNode } from './store';
import { runMaster } from '../master/orchestrator';
import { claudeProvider } from '../master/provider';
import { loadUiSettings, type MasterProvider } from '../project-store';

// Per-automation agent override + action extras applied to the agentic (master) step.
interface AutoCtx { provider?: MasterProvider; model?: string; skills?: string[]; requireConfirm?: boolean }

export interface NodeLog { nodeId: string; type: string; ok: boolean; output: string }
export interface RunResult { ok: boolean; finalOutput: string; log: NodeLog[] }

export interface RunnerDeps {
  // message node output channel — server.ts injects (appendMasterChat + broadcast). Keeps the runner
  // decoupled from express/WS. automationName lets the chat label where the message came from.
  deliver: (text: string, automationName: string) => void;
  onActivity?: (text: string) => void; // optional live progress (broadcast as automation_activity)
}

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
  const ui = loadUiSettings();
  switch (node.type) {
    case 'master': {
      const objective = render(node.objective ?? '', input);
      if (!objective.trim()) throw new Error('master node sem objective');
      // Action directives: which JOCA skills/agents to use, and a confirm-before-irreversible gate.
      const directives: string[] = [];
      if (auto.skills?.length) directives.push(`Usa estas skills/agentes do JOCA (faz Read da skill ANTES de agir): ${auto.skills.join(', ')}.`);
      if (auto.requireConfirm) directives.push('ANTES de qualquer acção IRREVERSÍVEL (enviar email, apagar, deploy, push, gastar dinheiro): NÃO a executes. Prepara tudo, entrega o rascunho/plano e PEDE confirmação explícita ao Renato; só age depois do OK dele.');
      const fullObjective = directives.length ? `${objective}\n\n[Instruções da acção]\n${directives.join('\n')}` : objective;
      const done = await runMaster(fullObjective, {
        provider: auto.provider ?? ui.masterProvider ?? 'claude',
        model: auto.model ?? ui.masterModel,
        onStep: (s) => { if (s.type === 'message' && deps.onActivity) deps.onActivity(s.text.slice(0, 160)); },
      });
      // runMaster always resolves to the 'done' step.
      const summary = done.type === 'done' ? done.summary : '';
      if (done.type === 'done' && done.isError) throw new Error(summary || 'master falhou');
      return summary;
    }
    case 'llm': {
      const prompt = render(node.prompt ?? '', input);
      if (!prompt.trim()) throw new Error('llm node sem prompt');
      // Direct brain call, no tools/terminal — cheap summarise/transform.
      const events = claudeProvider.run(prompt, { model: auto.model ?? ui.masterModel ?? 'sonnet' }) as unknown as AsyncGenerator<{ type: string; text?: string }>;
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
  const auto: AutoCtx = { provider: a.provider, model: a.model, skills: a.skills, requireConfirm: a.requireConfirm };
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
