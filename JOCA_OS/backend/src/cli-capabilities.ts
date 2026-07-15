// CLI capability probe: detects whether claude/codex/agy are installed, their version, and
// auth status. Self-contained — derives HOME/IS_WINDOWS/SHELL from os/process so it has no
// dependency on server wiring.
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

const HOME = os.homedir();
const IS_WINDOWS = process.platform === 'win32';
const SHELL = IS_WINDOWS
  ? 'powershell.exe'
  : (process.env.SHELL || '/bin/zsh');

export interface CliToolStatus {
  id: 'claude' | 'codex' | 'agy';
  name: string;
  provider: string;
  binary: string;
  installed: boolean;
  path?: string;
  version?: string;
  authStatus: 'logged-in' | 'not-logged-in' | 'unknown';
  authDetail?: string;
  installCommand: string;
  loginCommand: string;
  updateCommand?: string;
}

function runShell(command: string) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
      shell: SHELL,
    }).trim();
  } catch (error) {
    const err = error as { stdout?: Buffer | string; stderr?: Buffer | string };
    const stdout = err.stdout ? String(err.stdout).trim() : '';
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    return (stdout || stderr).trim();
  }
}

function commandPath(binary: string) {
  const cmd = IS_WINDOWS ? `where.exe ${binary}` : `command -v ${binary}`;
  const result = runShell(cmd);
  return (result && !result.toLowerCase().includes('not found') && !result.toLowerCase().includes('could not find'))
    ? result.split(/\r?\n/)[0]
    : undefined;
}

export function getCliTools(): CliToolStatus[] {
  const definitions: Omit<CliToolStatus, 'installed' | 'path' | 'version' | 'authStatus' | 'authDetail'>[] = [
    {
      id: 'claude',
      name: 'Claude Code',
      provider: 'Anthropic',
      binary: 'claude',
      installCommand: 'npm install -g @anthropic-ai/claude-code',
      loginCommand: 'claude auth login',
      updateCommand: 'claude update',
    },
    {
      id: 'codex',
      name: 'Codex CLI',
      provider: 'OpenAI',
      binary: 'codex',
      installCommand: 'npm install -g @openai/codex',
      loginCommand: 'codex login',
      updateCommand: 'codex update',
    },
    {
      id: 'agy',
      name: 'Antigravity CLI',
      provider: 'Google',
      binary: 'agy',
      installCommand: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
      loginCommand: 'agy',
      updateCommand: 'agy update',
    },
  ];

  return definitions.map((tool) => {
    const foundPath = commandPath(tool.binary);
    const installed = Boolean(foundPath);
    const version = installed ? runShell(`${tool.binary} --version`).split(/\r?\n/)[0] : undefined;
    let authStatus: CliToolStatus['authStatus'] = installed ? 'unknown' : 'not-logged-in';
    let authDetail = installed ? 'Installed. Authentication status not checked.' : 'CLI not installed.';

    if (installed && tool.id === 'claude') {
      const output = runShell('claude auth status');
      try {
        const parsed = JSON.parse(output);
        authStatus = parsed.loggedIn ? 'logged-in' : 'not-logged-in';
        authDetail = parsed.email || parsed.authMethod || output;
      } catch {
        authStatus = output.toLowerCase().includes('logged') ? 'logged-in' : 'unknown';
        authDetail = output || authDetail;
      }
    }

    if (installed && tool.id === 'codex') {
      const output = runShell('codex login status');
      authStatus = output.toLowerCase().includes('logged in') ? 'logged-in' : 'not-logged-in';
      authDetail = output || authDetail;
    }

    if (installed && tool.id === 'agy') {
      const settingsPath = path.join(HOME, '.gemini', 'antigravity-cli', 'settings.json');
      const hasSettings = fs.existsSync(settingsPath);
      authStatus = 'unknown';
      authDetail = hasSettings
        ? `Settings found at ${settingsPath}. Run agy to verify browser sign-in if needed.`
        : 'Run agy. If no saved session exists, it opens Google Sign-In.';
    }

    return { ...tool, installed, path: foundPath, version, authStatus, authDetail };
  });
}
