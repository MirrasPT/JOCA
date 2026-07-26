// Unit tests for the pure logic added in v3: schedule math, heartbeat window/protocol,
// multi-CLI launch lines. Store IO (JSON/JSONL) is exercised indirectly by the app; these
// tests pin the decision logic that is easy to regress silently.
import { describe, it, expect } from 'vitest';
import { computeNextRun } from '../automations/store';
import { withinActiveHours, isOkResponse, DEFAULT_HEARTBEAT, type HeartbeatConfig } from '../heartbeat';
import { loadCliProfiles, getCliProfile, buildLaunchLine } from '../cli-profiles';

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

// ── heartbeat: active hours ───────────────────────────────────────────────────
describe('withinActiveHours', () => {
  const cfg = (start: string, end: string): HeartbeatConfig => ({ ...DEFAULT_HEARTBEAT, activeHours: { start, end } });
  const clock = (h: number, m: number) => new Date(2026, 6, 20, h, m);

  it('inside a normal window', () => {
    expect(withinActiveHours(cfg('09:00', '22:00'), clock(12, 0))).toBe(true);
  });

  it('outside a normal window', () => {
    expect(withinActiveHours(cfg('09:00', '22:00'), clock(23, 30))).toBe(false);
    expect(withinActiveHours(cfg('09:00', '22:00'), clock(8, 59))).toBe(false);
  });

  it('overnight window wraps midnight', () => {
    expect(withinActiveHours(cfg('22:00', '07:00'), clock(23, 30))).toBe(true);
    expect(withinActiveHours(cfg('22:00', '07:00'), clock(3, 0))).toBe(true);
    expect(withinActiveHours(cfg('22:00', '07:00'), clock(12, 0))).toBe(false);
  });

  it('no activeHours → always active', () => {
    expect(withinActiveHours({ ...DEFAULT_HEARTBEAT, activeHours: null }, clock(3, 0))).toBe(true);
  });

  it('malformed times → fail-open (active)', () => {
    expect(withinActiveHours(cfg('9h', '22:00'), clock(3, 0))).toBe(true);
  });
});

// ── heartbeat: HEARTBEAT_OK protocol ─────────────────────────────────────────
describe('isOkResponse', () => {
  it('exact token → suppressed', () => {
    expect(isOkResponse('HEARTBEAT_OK')).toBe(true);
  });

  it('token with small padding (OpenClaw slack) → suppressed', () => {
    expect(isOkResponse('HEARTBEAT_OK — tudo calmo por aqui.')).toBe(true);
    expect(isOkResponse('Nada a assinalar. HEARTBEAT_OK')).toBe(true);
  });

  it('token buried in a long alert → NOT suppressed', () => {
    expect(isOkResponse(`HEARTBEAT_OK ${'x'.repeat(400)}`)).toBe(false);
  });

  it('real alert without token → NOT suppressed', () => {
    expect(isOkResponse('Tens 2 tarefas bloqueadas à espera de resposta.')).toBe(false);
  });

  it('empty → suppressed (nothing to deliver)', () => {
    expect(isOkResponse('  ')).toBe(true);
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

  it('only claude runs the /resume startup choreography by default', () => {
    const profiles = loadCliProfiles();
    expect(profiles.claude.startupSequence).toBe(true);
    expect(profiles.codex.startupSequence).toBe(false);
    expect(profiles.agy.startupSequence).toBe(false);
    expect(profiles.opencode.startupSequence).toBe(false);
  });

  it('buildLaunchLine: model flag + autonomous flags', () => {
    const claude = getCliProfile('claude');
    expect(buildLaunchLine(claude, '/usr/local/bin/claude', { model: 'opus', autonomous: true }))
      .toBe('/usr/local/bin/claude --model opus --dangerously-skip-permissions');
    expect(buildLaunchLine(claude, 'claude', {})).toBe('claude');
    const codex = getCliProfile('codex');
    expect(buildLaunchLine(codex, 'codex', { autonomous: true })).toBe('codex --full-auto');
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
