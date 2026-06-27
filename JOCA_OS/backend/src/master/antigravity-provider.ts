// AntigravityProvider — Master brain via the `agy` CLI (Google Antigravity) on the user's GOOGLE
// SUBSCRIPTION (logged in via browser OAuth → Code Assist / `daily-cloudcode-pa.googleapis.com`;
// NOT the Gemini API, no GEMINI_API_KEY / GOOGLE_API_KEY). Mirrors the ClaudeProvider /
// CodexProvider contract: same MasterProvider interface, same ProviderEvent union. costUsd is
// always 0 here — `agy` reports token usage/quota (`/usage`), never a USD figure (subscription).
//
// ── WHAT IS VERIFIED (real probes, agy.exe build 2026-06-25, on this machine) ─────────────────
//   `agy --help` / `agy help`  → flags: --print/-p (alias --prompt), --model, --continue/-c,
//        --conversation, --add-dir, --dangerously-skip-permissions, --print-timeout (default 5m),
//        --prompt-interactive/-i, --sandbox, --log-file. Subcommands: changelog, help, install,
//        models, plugin/plugins, update. There is NO --json / --output-format / --output-schema flag.
//   `agy plugin --help`        → list | import [gemini|claude] | install <target> (plugin@marketplace)
//        | uninstall | enable | disable | validate | link | help.  `agy plugin list` → "No imported
//        plugins." So agy uses the SAME plugin model as Claude Code (marketplaces, import-from-claude).
//   `agy models`               → exits 0, prints NOTHING to a piped stdout (same empty-stdout issue
//        as print mode below — see the critical finding).
//   LOGIN / SUBSCRIPTION confirmed via `~/.gemini/antigravity-cli/cli.log`: a real `agy -p` run hits
//        `https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent` (the Code Assist
//        subscription endpoint, model "Gemini 3.5 Flash (Medium)") and an "Auth done received" line —
//        i.e. logged-in subscription auth, NOT a metered API key.
//   THE MODEL GENUINELY ANSWERS. `agy -p "What is 2+2? Reply with only the number."` was confirmed to
//        produce the answer "4" — but ONLY inside the conversation store
//        (`~/.gemini/antigravity-cli/conversations/<id>.db`, table `steps`), read back via node:sqlite.
//   MCP SUPPORT EXISTS in agy: the builtin reference (`antigravity_guide/references/cli.md`) documents
//        the `/mcp` TUI command ("Lists active MCP servers and their exposed tools") plus `/skills`,
//        `/hooks`, `/agents`. So agy CAN host external MCP servers — architecturally the same
//        standalone-MCP-over-HTTP bridge that CodexProvider sketches would be possible.
//
// ── THE CRITICAL FINDING (why this provider reports working:false) ────────────────────────────
//   1) PRINT MODE EMITS NOTHING TO A PIPED STDOUT. Every non-interactive `agy -p "<prompt>"` invoked
//      from a child process (tested under Git Bash, PowerShell `& agy`, stdin</dev/null) exits 0 but
//      writes ZERO bytes to stdout/stderr; the response lands only in the conversation `.db`. agy's
//      TUI is alt-screen based and print mode appears to render to a console it does not have when
//      stdout is a pipe. A JOCA backend child process gets a pipe, so `spawn('agy',['-p',...])` would
//      capture an EMPTY string. There is no `--json`/`--output` flag to force machine output, and
//      `--print-timeout` only governs the wait, not the sink. Reading the conversation `.db` back is a
//      fragile, undocumented private-schema hack (protobuf-in-sqlite `steps` blobs) — explicitly NOT
//      something to ship as the text path. => the verified text path is NOT machine-consumable today.
//   2) NO VERIFIED HEADLESS MCP REGISTRATION. agy supports MCP, but only via the TUI (`/mcp`) /
//      plugin import / settings.json — there is NO documented, NO probed non-interactive flag (no
//      `-c mcp_servers.*` equivalent like codex; `--help` shows none). And even if registered, the
//      Master tools target the in-process `sessionManager` singleton in THIS backend, which an
//      agy-spawned MCP child cannot reach (identical gap to CodexProvider) — it would need a standalone
//      HTTP-bridge MCP server + backend control endpoints that do not exist yet.
//
//   Net: neither the text path (stdout empty) nor the tool path (no headless MCP + no bridge) is
//   verifiable end-to-end. Per ANTI-FABRICATION, run() does NOT pretend to work — it implements the
//   real `agy -p` invocation, detects the empty-stdout condition, and reports it loudly. available()
//   honestly reports bin presence (the cheap signal the Settings selector needs).
import { spawn, execFile } from 'child_process';
import type { MasterProvider, MasterRunOptions, ProviderEvent } from './provider';

// Strip Gemini/Google API-key vars so the CLI cannot silently fall back to a metered API key — the
// logged-in subscription (Code Assist OAuth in ~/.gemini/antigravity-cli) is what we want to win.
// (Parallel to provider.ts subscriptionEnv() for Claude and codex-provider.ts for OpenAI.) spawn env
// REPLACES the child env, so copy process.env first (PATH etc. must survive).
function subscriptionEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.GEMINI_API_KEY;
  delete env.GOOGLE_API_KEY;
  delete env.GOOGLE_GENAI_API_KEY;
  delete env.GOOGLE_APPLICATION_CREDENTIALS;
  return env;
}

export class AntigravityProvider implements MasterProvider {
  readonly name = 'antigravity';

  // available() = the `agy` CLI is present on PATH. (Login state is heavier; bin presence is the cheap
  // signal the Settings selector needs — mirrors getProviderAvailability()'s `where agy` in provider.ts
  // and CodexProvider.available().) NOTE: returning true here does NOT imply run() can orchestrate —
  // wired=false stays in provider.ts until the gaps in the file header are closed.
  async available(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const cmd = process.platform === 'win32' ? 'where' : 'which';
      execFile(cmd, ['agy'], (err) => resolve(!err));
    });
  }

  // run() — both paths are GATED because nothing is verifiable end-to-end (see file header).
  //
  // TOOL-ORCHESTRATION PATH (opts.mcpServers present): refused loudly. agy supports MCP via TUI/plugins
  // only; there is no probed headless registration, and the in-process SessionManager bridge is missing
  // (same as codex). TODO below.
  //
  // TEXT PATH (no mcpServers): we DO invoke the real `agy -p`, but because print mode emits nothing to a
  // piped stdout on this build, the captured text is empty — we detect that and report it as an error
  // rather than returning a silent empty success. If a future agy build prints to stdout, this path
  // starts working with no code change.
  async *run(prompt: string, opts: MasterRunOptions = {}): AsyncGenerator<ProviderEvent, void> {
    // TODO: agy não expõe tools externas por via headless verificável — não verificado.
    // To enable tool orchestration (mirrors the CodexProvider plan):
    //   (1) backend adds REST control endpoints: POST /master/spawn, POST /master/send,
    //       GET /master/read/:id, GET /master/workers (same set codex needs), each operating on the
    //       in-process sessionManager singleton;
    //   (2) ship a standalone stdio MCP server `agy-master-bridge.mjs` whose 7 tools (built from
    //       buildMasterToolDefs' jsonSchema) forward each call to those endpoints over HTTP;
    //   (3) register that MCP server with agy — UNVERIFIED how to do this non-interactively: agy
    //       documents `/mcp` (TUI) + `plugin import|install` only; there is NO probed `-c mcp_servers.*`
    //       flag. This MUST be confirmed against the real CLI before wiring (do NOT fabricate a flag);
    //   (4) map agy's tool-call stream to {type:'tool_use'} events — BLOCKED until (1') below is solved.
    if (opts.mcpServers) {
      const msg =
        'AntigravityProvider: orquestração por ferramentas (workers) ainda não está ligada. ' +
        'O `agy` suporta MCP (comando /mcp, plugins), mas não há forma verificada de registar um ' +
        'servidor MCP em modo não-interactivo, e as ferramentas Master operam no SessionManager ' +
        'in-process — falta o bridge HTTP + endpoints de controlo no backend (POST /master/spawn, ' +
        'POST /master/send, GET /master/read/:id, GET /master/workers). Para orquestrar agora, usa ' +
        'o provider Claude.';
      yield { type: 'result', text: msg, isError: true, costUsd: 0 };
      return;
    }

    yield* this.runPrintText(prompt, opts);
  }

  // Real `agy -p` driver. Invokes the CLI exactly as probed; captures stdout. On this build stdout is
  // EMPTY for piped print mode (the critical finding) — we surface that as an explicit error so the
  // caller never mistakes silence for an empty-but-successful answer. Self-corrects if a future build
  // starts printing to stdout.
  private async *runPrintText(prompt: string, opts: MasterRunOptions): AsyncGenerator<ProviderEvent, void> {
    // agy has no dedicated --system-prompt flag (verified: --help exposes none). Fold the system
    // framing into the prompt, exactly as CodexProvider does for `codex exec`.
    const fullPrompt = opts.systemPrompt ? `${opts.systemPrompt}\n\n---\n\n${prompt}` : prompt;

    const args = ['--print'];
    if (opts.model) args.push('--model', opts.model); // verified flag: --model <id>
    if (opts.cwd) args.push('--add-dir', opts.cwd);   // verified flag: --add-dir adds workspace dir
    args.push(fullPrompt);

    const child = spawn('agy', args, {
      env: subscriptionEnv(),
      cwd: opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32', // resolve agy.exe on Windows PATH
    });
    child.stdin?.end(); // print mode is single-shot; don't block waiting for stdin

    let stdout = '';
    let stderr = '';
    await new Promise<void>((resolve) => {
      child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      child.on('close', () => resolve());
      child.on('error', (e) => { stderr += `\n[spawn error] ${e instanceof Error ? e.message : String(e)}`; resolve(); });
    });

    const text = stdout.trim();
    if (text) {
      // If a future agy build DOES print the answer to stdout, this is the working text path.
      yield { type: 'text', text };
      yield { type: 'result', text, isError: false, costUsd: 0 };
      return;
    }

    // VERIFIED-EMPTY case on this build: real call ran (response persisted only to the conversation
    // .db, unreadable here), but stdout carried nothing. Report honestly — do not fake success.
    const detail = stderr.trim() ? ` (stderr: ${stderr.trim().slice(-300)})` : '';
    yield {
      type: 'result',
      text:
        'AntigravityProvider: `agy -p` correu mas não devolveu texto no stdout (este build do agy ' +
        'só persiste a resposta na conversa local, não a imprime quando o stdout é um pipe). ' +
        'Sem stdout legível não há caminho de texto utilizável; o caminho de ferramentas também não ' +
        'está ligado. Para orquestrar/responder agora, usa o provider Claude.' + detail,
      isError: true,
      costUsd: 0,
    };
  }
}

export const antigravityProvider = new AntigravityProvider();
