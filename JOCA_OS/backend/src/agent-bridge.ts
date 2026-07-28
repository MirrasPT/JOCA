// Agent bridge — what makes every terminal a first-class citizen of JOCA.
//
// Each PTY spawned by JOCA_OS is born with the environment below, so the agent running inside it
// (Claude Code, Codex, agy, OpenCode — any of them) can call back into the running JOCA_OS over
// its local HTTP API, WITHOUT restarting anything: read and comment on tasks, move them across the
// board, open new terminals, message another terminal, list automations, send notifications.
//
// Transport is the same HTTP API the browser uses, so there is exactly one implementation of every
// action. When auth is on, a session-scoped token is minted per PTY (see auth.mintAgentToken) —
// the terminal already has full shell access to the machine, so this grants no new privilege; it
// just avoids putting the user's password anywhere.
import path from 'path';
import { mintAgentToken, authEnabled } from './auth';

export const JOCA_CLI_PATH = path.resolve(__dirname, '../../cli/joca.mjs');

// Port the HTTP server actually bound to; server.ts sets this once it is listening.
let apiPort = Number(process.env.PORT || 7491);
export function setApiPort(port: number): void { apiPort = port; }

export function jocaAgentEnv(sessionId: string): Record<string, string> {
  const env: Record<string, string> = {
    JOCA_API_URL: `http://127.0.0.1:${apiPort}`,
    JOCA_CLI: JOCA_CLI_PATH,
    JOCA_SESSION_ID: sessionId,
  };
  if (authEnabled()) env.JOCA_API_TOKEN = mintAgentToken();
  return env;
}
