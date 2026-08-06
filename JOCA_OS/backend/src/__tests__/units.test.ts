// Unit tests for the pure logic added in v3: schedule math and multi-CLI launch lines. Store IO (JSON/JSONL) is exercised indirectly by the app; these
// tests pin the decision logic that is easy to regress silently.
import { describe, it, expect } from 'vitest';
import { computeNextRun } from '../automations/store';
import { chunkText, submitCrDelay } from '../session-manager';
import { loadCliProfiles, getCliProfile, buildLaunchLine } from '../cli-profiles';
import { ecraVisivel, proximaNaFila } from '../tasks/engine';

// ── computeNextRun ────────────────────────────────────────────────────────────
describe('computeNextRun', () => {
  const at = (y: number, mo: number, d: number, h: number, mi: number) =>
    new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

  it('interval: from + everyMinutes', () => {
    const from = at(2026, 7, 20, 10, 0);
    expect(computeNextRun({ kind: 'interval', everyMinutes: 45 }, from)).toBe(from + 45 * 60_000);
  });

  it('interval: clamps to >= 1 minute', () => {
    const from = at(2026, 7, 20, 10, 0);
    expect(computeNextRun({ kind: 'interval', everyMinutes: 0 }, from)).toBe(from + 60_000);
  });

  it('daily: today when the time is still ahead', () => {
    const from = at(2026, 7, 20, 8, 0);
    expect(computeNextRun({ kind: 'daily', time: '09:30' }, from)).toBe(at(2026, 7, 20, 9, 30));
  });

  it('daily: tomorrow when the time already passed', () => {
    const from = at(2026, 7, 20, 10, 0);
    expect(computeNextRun({ kind: 'daily', time: '09:30' }, from)).toBe(at(2026, 7, 21, 9, 30));
  });

  it('weekly: next occurrence of the weekday', () => {
    // 2026-07-20 is a Monday (day 1). Target Friday (5) same week.
    const from = at(2026, 7, 20, 10, 0);
    expect(computeNextRun({ kind: 'weekly', weekday: 5, time: '09:00' }, from)).toBe(at(2026, 7, 24, 9, 0));
  });

  it('weekly: same weekday but time passed → next week', () => {
    const from = at(2026, 7, 20, 10, 0); // Monday 10:00
    expect(computeNextRun({ kind: 'weekly', weekday: 1, time: '09:00' }, from)).toBe(at(2026, 7, 27, 9, 0));
  });

  it('undefined schedule → null', () => {
    expect(computeNextRun(undefined)).toBeNull();
  });
});

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

// ── juiz: o que o terminal MOSTRA vs o que escreveu ───────────────────────────
// Regressão real (2026-08-06): a tarefa "Diz arroz" correu bem — o agente respondeu `⏺arroz` em
// 2s — e foi dada como ERRO. O buffer de um TUI não tem `\n` nenhum: separa TUDO com `\r` e
// repinta o ecrã inteiro a cada frame. Sem isto o juiz via só o rodapé e dizia "só há métricas de
// sistema" (ou lia um frame do spinner e dizia "encalhou").
describe('ecraVisivel', () => {
  // Recorte fiel do buffer que falhou, incluindo a ausência de `\n`.
  const BUFFER_REAL = '⏺arroz\r✻Cogitated for 2s\r'
    + '──────────────────────────────────────\r❯\u00a0\r──────────────────────────────────────\r'
    + 'Opus 5 (1M context)  in:79.5k out:5  ctx █░░░░░░░░░ 8%  5h ░░░░░░░░░░ 0%\r'
    + '⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents';

  it('a resposta do agente sobrevive a um buffer sem uma única mudança de linha', () => {
    const visto = ecraVisivel(BUFFER_REAL);
    expect(visto).toContain('⏺arroz');
  });

  it('o rodapé do CLI não passa por conteúdo', () => {
    const visto = ecraVisivel(BUFFER_REAL);
    expect(visto).not.toContain('bypass permissions');
    expect(visto).not.toContain('ctx █');
    expect(visto).not.toMatch(/^─+$/m);
  });

  it('o mesmo ecrã repintado três vezes conta uma', () => {
    expect(ecraVisivel('⏺arroz\r⏺arroz\r⏺arroz')).toBe('⏺arroz');
  });

  it('frames soltos do spinner saem', () => {
    expect(ecraVisivel('⏺arroz\r✳\r✢\r·\r✶')).toBe('⏺arroz');
  });

  it('linhas verdadeiras diferentes ficam todas', () => {
    expect(ecraVisivel('[Tarefa] Diz arroz\rResponde arroz.\r⏺arroz'))
      .toBe('[Tarefa] Diz arroz\nResponde arroz.\n⏺arroz');
  });
});

// ── fila de tarefas: qual corre a seguir ──────────────────────────────────────
// Regressão apanhada em auditoria: a fila usava `find()` sobre o ficheiro e ignorava o `order` da
// coluna — arrastar uma tarefa para o topo de "a-executar" não a fazia correr primeiro.
describe('proximaNaFila', () => {
  const t = (id: string, order: number, status = 'a-executar', projectId?: string) =>
    ({ id, title: id, status, order, projectId, createdAt: 0, updatedAt: 0 }) as never;

  it('respeita a ordem da coluna, não a do ficheiro', () => {
    const tarefas = [t('B', 2), t('A', 0), t('C', 1)];
    expect(proximaNaFila(tarefas, '')?.id).toBe('A');
  });

  it('só olha para a coluna a-executar', () => {
    const tarefas = [t('espera', 0, 'a-definir'), t('pronta', 5, 'a-executar')];
    expect(proximaNaFila(tarefas, '')?.id).toBe('pronta');
  });

  it('cada projecto tem a sua fila', () => {
    const tarefas = [t('doP1', 0, 'a-executar', 'p1'), t('doP2', 1, 'a-executar', 'p2')];
    expect(proximaNaFila(tarefas, 'p2')?.id).toBe('doP2');
    expect(proximaNaFila(tarefas, 'p1')?.id).toBe('doP1');
  });

  it('tarefas sem projecto partilham a fila genérica', () => {
    const tarefas = [t('solta', 0, 'a-executar'), t('doP1', 0, 'a-executar', 'p1')];
    expect(proximaNaFila(tarefas, '')?.id).toBe('solta');
  });

  it('fila vazia não devolve nada', () => {
    expect(proximaNaFila([t('x', 0, 'concluida')], '')).toBeUndefined();
  });
});
