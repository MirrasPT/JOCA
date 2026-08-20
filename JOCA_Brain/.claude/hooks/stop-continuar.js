#!/usr/bin/env node
// Stop hook — continuidade do trabalho + verificação cruzada (produtor ≠ verificador).
//
// Só age quando existe um CONTRATO explícito em `.joca/loop.json`, escrito pelo main loop ao
// arrancar trabalho multi-passo (via C/D ou pipeline). Sem contrato não faz nada: steward, não
// initiator (rules/orchestration-patterns.md).
//
// Bloqueia o fim do turno (`decision: block`) quando há passos por fechar OU passos feitos por
// verificar — UMA vez por turno, não em ciclo (ver travão 1). É um empurrão, não um motor de loop:
// levar o contrato até `verificado` é do modelo. Travões, por esta ordem:
//   1. `stop_hook_active` → nunca dois blocks seguidos (guarda obrigatório do contrato de hooks do
//      Claude Code; o limite sobe com a env `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`);
//   2. `.joca/loop-off.flag` → kill-switch manual;
//   3. `aguarda_utilizador: true` → gate humano em curso, o turno termina para o user responder;
//   4. `iteracao > max_iteracoes` (default = loop_max_iterations do soul.md, 4);
//   5. `sem_progresso >= 3` (assinatura dos estados igual 3 vezes seguidas);
//   6. contrato com mais de 6 h → expira.
// Fail-open: qualquer erro → exit 0 silencioso.
const fs = require('fs');
const path = require('path');

const MAX_HORAS = 6;
const SEM_PROGRESSO_MAX = 3;

function nota(msg) { process.stdout.write(msg + '\n'); process.exit(0); }

let payload = {};
try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { /* sem stdin */ }
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

// Expiração — um contrato esquecido não persegue o utilizador na semana seguinte.
const criado = Date.parse(loop.criado || '') || Date.now();
if (Date.now() - criado > MAX_HORAS * 3600 * 1000) {
  try { fs.unlinkSync(loopFile); } catch (_) {}
  nota('[loop] Contrato .joca/loop.json expirado (>6h) — removido. Reporta o estado ao utilizador.');
}

// Violação de verificação cruzada: quem produziu não pode assinar.
const conflito = passos.find((p) => p.estado === 'verificado' && p.produtor && p.verificador && p.produtor === p.verificador);
if (conflito) {
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `[loop] Passo "${conflito.id}" foi verificado pelo próprio produtor (${conflito.produtor}). `
      + `Verificação não conta. Despacha um agente DIFERENTE para a verificação e volta a marcar o passo.`,
  }));
  process.exit(0);
}

const pendentes = passos.filter((p) => p.estado !== 'verificado');
if (!pendentes.length) {
  try { fs.unlinkSync(loopFile); } catch (_) {}
  nota('[loop] Todos os passos verificados — contrato fechado. Fecha com o resumo ao utilizador.');
}

// Progresso: assinatura dos estados. Igual à da iteração anterior = nada avançou.
const assinatura = passos.map((p) => `${p.id}:${p.estado}`).join('|');
loop.sem_progresso = assinatura === loop.assinatura ? (loop.sem_progresso || 0) + 1 : 0;
loop.assinatura = assinatura;
loop.iteracao = (loop.iteracao || 0) + 1;
loop.criado = new Date(criado).toISOString();
try { fs.writeFileSync(loopFile, JSON.stringify(loop, null, 2)); } catch (_) {}

const max = loop.max_iteracoes || 4;
if (loop.iteracao > max) {
  nota(`[loop] Travão: ${loop.iteracao} iterações (máx ${max}). PARA e reporta o que ficou pendente: `
    + pendentes.map((p) => p.id).join(', '));
}
if (loop.sem_progresso >= SEM_PROGRESSO_MAX) {
  nota(`[loop] Travão: ${SEM_PROGRESSO_MAX} iterações sem progresso. PARA e reporta o bloqueio.`);
}

const proximo = pendentes[0];
const porVerificar = pendentes.filter((p) => p.estado === 'feito');
let reason;
if (porVerificar.length) {
  const p = porVerificar[0];
  reason = `[loop] Não termines: o passo "${p.id}" está FEITO mas por VERIFICAR (produtor: ${p.produtor || 'principal'}). `
    + `Despacha um verificador DIFERENTE do produtor (agente de review/teste com brief + Step 0), com evidência `
    + `— gate estático + gate de runtime conforme rules/pipelines.md. Depois marca estado "verificado" e `
    + `preenche "verificador" em .joca/loop.json.`;
} else {
  reason = `[loop] Não termines: passo pendente "${proximo.id}" — ${proximo.desc || ''}. `
    + `Continua (iteração ${loop.iteracao}/${max}). Se estiver bloqueado por decisão do utilizador, `
    + `põe "aguarda_utilizador": true em .joca/loop.json e termina; se já não fizer sentido, apaga o ficheiro.`;
}
process.stdout.write(JSON.stringify({ decision: 'block', reason }));
process.exit(0);
