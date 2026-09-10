#!/usr/bin/env node
// Stop hook — work continuity + cross-verification (producer ≠ verifier).
//
// Only acts when an explicit CONTRACT exists in `.joca/loop.json`, written by the main loop when
// starting multi-step work (route C/D or a pipeline). With no contract it does nothing: steward, not
// initiator (rules/orchestration-patterns.md).
//
// Blocks the end of the turn (`decision: block`) when there are steps still open OR steps done but
// unverified — ONCE per turn, not in a cycle (see brake 1). It is a nudge, not a loop engine:
// taking the contract through to `verificado` is the model's job. Brakes, in this order:
//   1. `stop_hook_active` → never two blocks in a row (mandatory guard of the Claude Code hook
//      contract; the limit is raised with the env var `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`);
//   2. `.joca/loop-off.flag` → manual kill-switch;
//   3. `aguarda_utilizador: true` → human gate in progress, the turn ends so the user can answer;
//   4. `iteracao > max_iteracoes` (default = loop_max_iterations from soul.md, 4);
//   5. `sem_progresso >= 3` (state signature identical 3 times in a row);
//   6. contract older than 6 h → expires.
// Fail-open: any error → silent exit 0.
const fs = require('fs');
const path = require('path');

const MAX_HORAS = 6;
const SEM_PROGRESSO_MAX = 3;

function nota(msg) { process.stdout.write(msg + '\n'); process.exit(0); }

let payload = {};
try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { /* no stdin */ }
if (payload.stop_hook_active) process.exit(0);

const jocaDir = path.join(process.cwd(), '.joca');
const loopFile = path.join(jocaDir, 'loop.json');
if (fs.existsSync(path.join(jocaDir, 'loop-off.flag'))) process.exit(0);
if (!fs.existsSync(loopFile)) process.exit(0);

let loop;
try { loop = JSON.parse(fs.readFileSync(loopFile, 'utf8')); } catch (_) { process.exit(0); }
const passos = Array.isArray(loop.passos) ? loop.passos : [];
if (!passos.length) process.exit(0);
if (loop.aguarda_utilizador) process.exit(0);

// Expiry — a forgotten contract does not chase the user the following week.
const criado = Date.parse(loop.criado || '') || Date.now();
if (Date.now() - criado > MAX_HORAS * 3600 * 1000) {
  try { fs.unlinkSync(loopFile); } catch (_) {}
  nota('[loop] Contract .joca/loop.json expired (>6h) — removed. Report the state to the user.');
}

// Cross-verification violation: whoever produced cannot sign off.
const conflito = passos.find((p) => p.estado === 'verificado' && p.produtor && p.verificador && p.produtor === p.verificador);
if (conflito) {
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `[loop] Step "${conflito.id}" was verified by its own producer (${conflito.produtor}). `
      + `The verification does not count. Dispatch a DIFFERENT agent for the verification and mark the step again.`,
  }));
  process.exit(0);
}

const pendentes = passos.filter((p) => p.estado !== 'verificado');
if (!pendentes.length) {
  try { fs.unlinkSync(loopFile); } catch (_) {}
  nota('[loop] All steps verified — contract closed. Close with the summary to the user.');
}

// Progress: signature of the states. Identical to the previous iteration = nothing moved.
const assinatura = passos.map((p) => `${p.id}:${p.estado}`).join('|');
loop.sem_progresso = assinatura === loop.assinatura ? (loop.sem_progresso || 0) + 1 : 0;
loop.assinatura = assinatura;
loop.iteracao = (loop.iteracao || 0) + 1;
loop.criado = new Date(criado).toISOString();
try { fs.writeFileSync(loopFile, JSON.stringify(loop, null, 2)); } catch (_) {}

const max = loop.max_iteracoes || 4;
if (loop.iteracao > max) {
  nota(`[loop] Brake: ${loop.iteracao} iterations (max ${max}). STOP and report what is left open: `
    + pendentes.map((p) => p.id).join(', '));
}
if (loop.sem_progresso >= SEM_PROGRESSO_MAX) {
  nota(`[loop] Brake: ${SEM_PROGRESSO_MAX} iterations with no progress. STOP and report the blocker.`);
}

const proximo = pendentes[0];
const porVerificar = pendentes.filter((p) => p.estado === 'feito');
let reason;
if (porVerificar.length) {
  const p = porVerificar[0];
  reason = `[loop] Do not finish: step "${p.id}" is DONE but UNVERIFIED (producer: ${p.produtor || 'main loop'}). `
    + `Dispatch a verifier DIFFERENT from the producer (a review/test agent with a brief + Step 0), with evidence `
    + `— static gate + runtime gate per rules/pipelines.md. Then mark estado "verificado" and `
    + `fill in "verificador" in .joca/loop.json.`;
} else {
  reason = `[loop] Do not finish: step "${proximo.id}" still open — ${proximo.desc || ''}. `
    + `Carry on (iteration ${loop.iteracao}/${max}). If it is blocked by a user decision, `
    + `put "aguarda_utilizador": true in .joca/loop.json and finish; if it no longer makes sense, delete the file.`;
}
process.stdout.write(JSON.stringify({ decision: 'block', reason }));
process.exit(0);
