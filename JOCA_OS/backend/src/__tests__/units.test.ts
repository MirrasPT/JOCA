// Unit tests for the pure logic added in v3: multi-CLI launch lines. Store IO (JSON/JSONL) is exercised indirectly by the app; these
// tests pin the decision logic that is easy to regress silently.
import { describe, it, expect } from 'vitest';
import { chunkText, submitCrDelay } from '../session-manager';
import { loadCliProfiles, getCliProfile, buildLaunchLine } from '../cli-profiles';
import { folderPickerCommand, WINDOWS_PICKER_PS } from '../http/system-routes';
import { PATH_SAFE } from '../security-fs';

// ── paced PTY writes (the "long message gets truncated" fix) ─────────────────
describe('chunkText', () => {
  it('short text stays a single write', () => {
    expect(chunkText('olá', 800)).toEqual(['olá']);
  });

  it('splits long text and loses nothing', () => {
    const text = 'x'.repeat(5000);
    const chunks = chunkText(text, 800);
    expect(chunks.length).toBe(7);
    expect(chunks.join('')).toBe(text);
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(800);
  });

  it('never splits a surrogate pair (emoji survives chunking)', () => {
    // Boundary lands exactly between the two halves of the emoji unless we back off.
    const text = 'a'.repeat(9) + '😀' + 'b'.repeat(20);
    const chunks = chunkText(text, 10);
    expect(chunks.join('')).toBe(text);
    for (const c of chunks) {
      const last = c.charCodeAt(c.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false); // no orphan high surrogate
    }
  });

  it('handles a payload with newlines (bracketed-paste body)', () => {
    const body = Array.from({ length: 200 }, (_, i) => `linha ${i}`).join('\n');
    expect(chunkText(body, 100).join('')).toBe(body);
  });
});

describe('submitCrDelay', () => {
  it('short messages keep the original 200ms floor', () => {
    expect(submitCrDelay(50)).toBe(200);
    expect(submitCrDelay(1023)).toBe(200);
  });

  it('scales with size so a big paste is fully absorbed before the CR', () => {
    expect(submitCrDelay(10 * 1024)).toBeGreaterThan(submitCrDelay(1024));
    expect(submitCrDelay(200 * 1024)).toBe(4000); // capped
  });
});

// ── multi-CLI profiles ────────────────────────────────────────────────────────
describe('cli-profiles', () => {
  it('defaults cover the 4 CLIs; unknown/absent cli falls back to claude', () => {
    const profiles = loadCliProfiles();
    expect(Object.keys(profiles).sort()).toEqual(['agy', 'claude', 'codex', 'opencode']);
    expect(getCliProfile(undefined).id).toBe('claude');
    expect(getCliProfile('nope').id).toBe('claude');
    expect(getCliProfile('codex').id).toBe('codex');
  });

  it('every CLI runs the startup choreography; only claude uses the /resume slash form', () => {
    const profiles = loadCliProfiles();
    expect(profiles.claude.startupSequence).toBe(true);
    expect(profiles.codex.startupSequence).toBe(true);
    expect(profiles.agy.startupSequence).toBe(true);
    expect(profiles.opencode.startupSequence).toBe(true);
    expect(profiles.claude.resumeCmd).toBe('/resume');
    // codex/agy não reconhecem comandos custom com `/` — recebem `resume` em texto simples.
    expect(profiles.codex.resumeCmd).toBe('resume');
    expect(profiles.agy.resumeCmd).toBe('resume');
    expect(profiles.opencode.resumeCmd).toBe('resume');
  });

  it('buildLaunchLine: model flag + autonomous flags', () => {
    const claude = getCliProfile('claude');
    expect(buildLaunchLine(claude, '/usr/local/bin/claude', { model: 'opus', autonomous: true }))
      .toBe('/usr/local/bin/claude --model opus --dangerously-skip-permissions');
    expect(buildLaunchLine(claude, 'claude', {})).toBe('claude');
    const codex = getCliProfile('codex');
    // codex ≥0.146 removeu o --full-auto; o equivalente ao skip-permissions é este.
    expect(buildLaunchLine(codex, 'codex', { autonomous: true })).toBe('codex --dangerously-bypass-approvals-and-sandbox');
  });

  it('buildLaunchLine: rejects shell-unsafe model values', () => {
    const claude = getCliProfile('claude');
    expect(buildLaunchLine(claude, 'claude', { model: 'opus; rm -rf ~' })).toBe('claude');
    expect(buildLaunchLine(claude, 'claude', { model: 'a b' })).toBe('claude');
    // provider/model style ids stay allowed
    expect(buildLaunchLine(claude, 'claude', { model: 'anthropic/claude-sonnet-5' }))
      .toBe('claude --model anthropic/claude-sonnet-5');
  });
});

// ── selector de pasta nativo (cross-platform) ─────────────────────────────────
// O bug era só do Windows e esta máquina é macOS: não há como o reproduzir ao vivo.
// O que se trava aqui é a FORMA do comando — as três propriedades cuja ausência o matava.
describe('folderPickerCommand', () => {
  it('macOS: osascript (comportamento de referência, intacto)', () => {
    const spec = folderPickerCommand('darwin');
    expect(spec.cmd).toBe('osascript');
    expect(spec.args[0]).toBe('-e');
    expect(spec.args[1]).toContain('choose folder');
    expect(spec.trimTrailingSlash).toBe(true); // `/Users/x/` → `/Users/x`
  });

  it('Linux: zenity em modo directório', () => {
    const spec = folderPickerCommand('linux');
    expect(spec.cmd).toBe('zenity');
    expect(spec.args).toContain('--directory');
  });

  it('Windows: powershell.exe -NoProfile -STA -Command <script>', () => {
    const spec = folderPickerCommand('win32');
    expect(spec.cmd).toBe('powershell.exe');
    expect(spec.args.slice(0, 3)).toEqual(['-NoProfile', '-STA', '-Command']);
    expect(spec.args[3]).toBe(WINDOWS_PICKER_PS);
    // `C:\` é um caminho válido; cortar a barra final dava `C:` (relativo à unidade).
    expect(spec.trimTrailingSlash).toBe(false);
  });

  it('Windows: script sem UMA aspa dupla (o escape \\" na linha de comando é o risco)', () => {
    expect(WINDOWS_PICKER_PS).not.toContain('"');
  });

  it('Windows: diálogo com janela dona TopMost activada — senão abre atrás do browser', () => {
    expect(WINDOWS_PICKER_PS).toContain('$owner.TopMost=$true');
    expect(WINDOWS_PICKER_PS).toContain('$owner.Activate()');
    expect(WINDOWS_PICKER_PS).toContain('$d.ShowDialog($owner)'); // nunca ShowDialog() sem dono
    expect(WINDOWS_PICKER_PS).not.toContain('$d.ShowDialog()');
  });

  it('Windows: nível de topo = as unidades (não há raiz única como em POSIX)', () => {
    expect(WINDOWS_PICKER_PS).toContain('[System.Environment+SpecialFolder]::MyComputer');
  });

  it('Windows: cancelar (1) distingue-se de rebentar (2)', () => {
    expect(WINDOWS_PICKER_PS).toContain('exit 0');
    expect(WINDOWS_PICKER_PS).toContain('exit 1');
    expect(WINDOWS_PICKER_PS).toContain('exit 2');
    expect(WINDOWS_PICKER_PS).toContain('[Console]::Error.Write');
  });
});

// ── forma de caminho do Windows ───────────────────────────────────────────────
// PATH_SAFE guarda tudo o que é escrito na linha do PTY. Um caminho vindo do selector
// do Windows (`C:\Users\...`, com espaços) tem de passar; metacaracteres de shell não.
describe('PATH_SAFE com caminhos Windows', () => {
  it('aceita caminhos absolutos com letra de unidade', () => {
    expect(PATH_SAFE.test('C:\\Users\\dev\\Desktop\\projecto')).toBe(true);
    // Espaços, acentos e parênteses são correntes em pastas do Drive/OneDrive.
    expect(PATH_SAFE.test('D:\\Dados\\Meu Projecto\\2026_Nova Plataforma')).toBe(true);
    expect(PATH_SAFE.test('G:\\O meu disco\\Clientes\\Acme Lda (Norte)')).toBe(true);
    expect(PATH_SAFE.test('C:\\')).toBe(true);
  });

  it('continua a aceitar caminhos POSIX', () => {
    expect(PATH_SAFE.test('/Users/dev/Projetos/o-meu-projecto')).toBe(true);
  });

  it('continua a recusar metacaracteres de shell', () => {
    expect(PATH_SAFE.test('C:\\Users\\dev"; calc')).toBe(false);
    expect(PATH_SAFE.test('C:\\Users\\dev | del')).toBe(false);
    expect(PATH_SAFE.test('C:\\Users\\$env:TEMP')).toBe(false);
    expect(PATH_SAFE.test('C:\\Users\\dev\nnew')).toBe(false);
  });
});
