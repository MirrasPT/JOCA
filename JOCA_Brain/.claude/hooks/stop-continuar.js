#!/usr/bin/env node
// Stop hook — continuidade do trabalho + verificação cruzada (produtor ≠ verificador).
//
// Só age quando existe um CONTRATO explícito DESTA sessão em `.joca/loop/<session_id>.json`, escrito
// pelo main loop ao arrancar trabalho multi-passo (via C/D ou pipeline). O `session_id` chega no JSON
// do stdin e é anunciado ao modelo no arranque pelo `session-intake.js` (linha `[sessao] id=…`).
// Sem contrato da própria sessão não faz nada: steward, não initiator (rules/orchestration-patterns.md).
//
// Legado `.joca/loop.json` (um ficheiro por repo, partilhado entre sessões): só conta se tiver
// `"sessao"` igual ao `session_id` desta sessão. Sem `sessao` ou com outro id → não bloqueia, emite
// nota "contrato de outra sessão ou sem dono — não lhe toques". Nunca se apaga nem edita o contrato de
// outra sessão (reference/sessoes-paralelas.md).
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
//   6. contrato sem escrita há mais de 6 h → expira (TTL desde a ÚLTIMA escrita do modelo — mtime do
//      ficheiro ou `actualizado` —, não desde `criado`; as escritas do próprio hook não renovam). Só o
//      da própria sessão, ou o legado sem dono. Contrato com
//      passos `em_curso` NUNCA se apaga por expiração (agente de fundo ainda pode estar vivo) — só se
//      deixa de insistir. Cada remoção fica em `.joca/loop/_apagados.log` (data, sessão, motivo, estados).
//   7. todos os passos por fechar em `estado: "em_curso"` (agente de fundo vivo, id em `agente`) →
//      não bloqueia nem conta iteração: o turno TEM de terminar para o agente trabalhar, e a
//      notificação de conclusão reacorda a sessão. Com passos em curso e outros pendentes, bloqueia
//      só pelos que não estão em curso; se nada mudou desde o último bloqueio e há agente em curso,
//      o turno foi de espera → bloqueia mas NÃO conta iteração (o travão 4 é para voltas reais).
//
// Campos opcionais por passo (dispensam estados fictícios — agentes inventados, `em_curso` falso):
//   `depende_de: ["<id>"]` (ou string) — passo `pendente` à espera de outro: não insiste enquanto algum
//      predecessor não estiver `verificado` (ou `feito` com `verificacao` que o feche — ver abaixo).
//      Id inexistente é ignorado. Se nada estiver em curso nem por fechar, é ciclo → bloqueia.
//   `verificacao` num passo `feito` — dispensa o verificador individual:
//      "<id-passo>" (ou "varredura:<id-passo>") → verificação conjunta nesse passo; não insiste enquanto
//        ele não estiver `feito`/`verificado`; depois pede para marcar este `verificado`;
//      "diferida:<condição>" → só verificável depois (ex.: após o push); aceite e listado;
//      "bloqueada:<motivo>" → impossível verificar; motivo obrigatório, reportado ao utilizador.
//   Sem nada por fechar (só em curso / à espera / diferidos / bloqueados) → nota, sem bloquear nem contar.
// Fecho: todos `verificado` → o hook APAGA o contrato; pedido novo na mesma sessão escreve um de raiz.
// Fail-open: qualquer erro → exit 0 silencioso.
const fs = require('fs');
const path = require('path');

const MAX_HORAS = 6;
const SEM_PROGRESSO_MAX = 3;

function nota(msg) { process.stdout.write(msg + '\n'); process.exit(0); }
// Última escrita: o mais recente de criado / actualizado / mtime (T219: TTL desde a criação matava
// contratos vivos em sessões longas). Sem nenhum → agora (não expira).
function ultimaEscrita(l, ficheiro) {
  let m = NaN;
  try { m = fs.statSync(ficheiro).mtimeMs; } catch (_) {}
  const t = [Date.parse((l && l.criado) || ''), Date.parse((l && l.actualizado) || ''), m].filter(Number.isFinite);
  return t.length ? Math.max(...t) : Date.now();
}
function expirado(l, ficheiro) {
  return Date.now() - ultimaEscrita(l, ficheiro) > MAX_HORAS * 3600 * 1000;
}
const emCursoP = (p) => p && (p.estado === 'em_curso' || p.estado === 'em-curso');
const temEmCurso = (l) => Array.isArray(l && l.passos) && l.passos.some(emCursoP);
// Rasto de cada remoção de contrato (N13: contratos desapareciam sem se saber quem os apagou).
function registarApagado(ficheiro, l, motivo) {
  const estados = Array.isArray(l && l.passos) ? l.passos.map((p) => `${p.id}:${p.estado}`).join('|') : '';
  const linha = `${new Date().toISOString()}\tsessao=${(l && l.sessao) || sid || '-'}\t${path.basename(ficheiro)}\t${motivo}\t${estados}\n`;
  try { fs.mkdirSync(path.join(jocaDir, 'loop'), { recursive: true }); fs.appendFileSync(path.join(jocaDir, 'loop', '_apagados.log'), linha); } catch (_) {}
  try { process.stderr.write(`[loop] apagado ${path.basename(ficheiro)}: ${motivo}\n`); } catch (_) {}
}
function apagar(ficheiro, l, motivo) {
  try { fs.unlinkSync(ficheiro); registarApagado(ficheiro, l, motivo); } catch (_) {}
}

let payload = {};
try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (_) { /* sem stdin */ }
if (payload.stop_hook_active) process.exit(0);

const jocaDir = path.join(process.cwd(), '.joca');
if (fs.existsSync(path.join(jocaDir, 'loop-off.flag'))) process.exit(0);

// session_id entra num nome de ficheiro → só caracteres seguros.
const sid = typeof payload.session_id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(payload.session_id)
  ? payload.session_id : '';
const proprio = sid ? path.join(jocaDir, 'loop', `${sid}.json`) : '';
const legado = path.join(jocaDir, 'loop.json');

let loopFile = '';
let rotulo = '';
if (proprio && fs.existsSync(proprio)) {
  loopFile = proprio;
  rotulo = `.joca/loop/${sid}.json`;
} else if (fs.existsSync(legado)) {
  let l;
  try { l = JSON.parse(fs.readFileSync(legado, 'utf8')); } catch (_) { process.exit(0); }
  if (sid && l && l.sessao === sid) {
    loopFile = legado;
    rotulo = '.joca/loop.json';
  } else {
    // Legado sem dono e expirado → pode sair; com dono (outra sessão) → nunca se lhe toca.
    if (l && !l.sessao && expirado(l, legado) && !temEmCurso(l)) {
      apagar(legado, l, 'legado sem dono expirado (>6h)');
      nota('[loop] .joca/loop.json legado sem dono expirado (>6h sem escrita) — removido (registo em .joca/loop/_apagados.log).');
    }
    nota('[loop] .joca/loop.json é contrato de outra sessão ou sem dono — não lhe toques '
      + '(não o apagues nem edites). O contrato desta sessão é '
      + (sid ? `.joca/loop/${sid}.json` : '.joca/loop/<session_id>.json') + '.');
  }
} else {
  process.exit(0);
}

let loop;
try { loop = JSON.parse(fs.readFileSync(loopFile, 'utf8')); } catch (_) { process.exit(0); }
const passos = Array.isArray(loop.passos) ? loop.passos : [];
if (!passos.length) process.exit(0);
if (loop.aguarda_utilizador) process.exit(0);

// Expiração — um contrato esquecido não persegue o utilizador na semana seguinte.
let mtimeAntes = null;
try { mtimeAntes = fs.statSync(loopFile).mtime; } catch (_) {}
// Sem `criado`, a origem é a última escrita do MODELO (mtime), nunca agora: gravar agora renovava o TTL.
const criado = Date.parse(loop.criado || '') || (mtimeAntes ? mtimeAntes.getTime() : Date.now());
if (expirado(loop, loopFile)) {
  if (temEmCurso(loop)) {
    try { process.stderr.write(`[loop] ${rotulo} expirado mas com passos em_curso — mantido.\n`); } catch (_) {}
    nota(`[loop] Contrato ${rotulo} expirado (>6h sem escrita) mas com passos em_curso — NÃO removido, não insisto. `
      + `Quando o agente acabar, fecha os passos; se já não fizer sentido, apaga-o tu e reporta.`);
  }
  apagar(loopFile, loop, 'expirado (>6h sem escrita)');
  nota(`[loop] Contrato ${rotulo} expirado (>6h) — removido (registo em .joca/loop/_apagados.log). Reporta o estado ao utilizador.`);
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
  apagar(loopFile, loop, 'todos os passos verificados');
  nota('[loop] Todos os passos verificados — contrato fechado. Fecha com o resumo ao utilizador.');
}

// Em curso noutro agente (aceita também a grafia `em-curso`). Só em curso → não insiste nem conta.
const porId = new Map(passos.map((p) => [String(p.id), p]));
// `verificacao` de um passo feito → { tipo: 'passo'|'diferida'|'bloqueada', alvo }; inválida → null.
function verif(p) {
  if (!p || p.estado !== 'feito' || typeof p.verificacao !== 'string') return null;
  const m = p.verificacao.trim().match(/^(diferida|bloqueada|varredura)\s*:\s*(.*)$/i);
  if (m && m[1].toLowerCase() !== 'varredura') return m[2].trim() ? { tipo: m[1].toLowerCase(), alvo: m[2].trim() } : null;
  const alvo = m ? m[2].trim() : p.verificacao.trim();
  return alvo && alvo !== String(p.id) && porId.has(alvo) ? { tipo: 'passo', alvo } : null;
}
const fechadoP = (q) => q && (q.estado === 'feito' || q.estado === 'verificado');
// Predecessor `dep` deixa avançar `p`: verificado, ou feito com verificação diferida/bloqueada, ou feito
// com verificação conjunta que é o próprio `p` (o passo de varredura depende dos que verifica).
function depOk(dep, p) {
  if (!dep || dep.estado === 'verificado') return true;
  const v = verif(dep);
  return Boolean(v && (v.tipo !== 'passo' || v.alvo === String(p.id)));
}
const deps = (p) => (Array.isArray(p.depende_de) ? p.depende_de : (p.depende_de != null ? [p.depende_de] : []))
  .map(String).filter((d) => porId.has(d) && d !== String(p.id));
const aEsperar = (p) => p.estado !== 'feito' && !emCursoP(p) && deps(p).some((d) => !depOk(porId.get(d), p));
const emCurso = pendentes.filter(emCursoP);
const aguardaDep = pendentes.filter(aEsperar);
const aguardaConj = pendentes.filter((p) => { const v = verif(p); return v && v.tipo === 'passo' && !fechadoP(porId.get(v.alvo)); });
const diferidos = pendentes.filter((p) => { const v = verif(p); return v && v.tipo === 'diferida'; });
const bloqueados = pendentes.filter((p) => { const v = verif(p); return v && v.tipo === 'bloqueada'; });
const aceites = new Set([...emCurso, ...aguardaDep, ...aguardaConj, ...diferidos, ...bloqueados]);
let porFechar = pendentes.filter((p) => !aceites.has(p));
// Ciclo/beco: só passos à espera e nada que os destranque (nem em curso, nem por fechar) → insiste neles.
const ciclo = !porFechar.length && !emCurso.length && aguardaDep.length > 0;
if (ciclo) porFechar = aguardaDep;
const listaEmCurso = emCurso.map((p) => `${p.id}${p.agente ? ` (agente ${p.agente})` : ''}`).join(', ');
const partesNota = [
  emCurso.length ? `em curso: ${listaEmCurso}` : '',
  !ciclo && aguardaDep.length ? `à espera (depende_de): ${aguardaDep.map((p) => `${p.id}←${deps(p).join('+')}`).join(', ')}` : '',
  aguardaConj.length ? `verificação conjunta por correr: ${aguardaConj.map((p) => `${p.id}→${verif(p).alvo}`).join(', ')}` : '',
  diferidos.length ? `verificação diferida: ${diferidos.map((p) => `${p.id} (${verif(p).alvo})`).join(', ')}` : '',
  bloqueados.length ? `verificação BLOQUEADA — reporta ao utilizador: ${bloqueados.map((p) => `${p.id} (${verif(p).alvo})`).join(', ')}` : '',
].filter(Boolean);
const notaAceites = partesNota.length ? ` (Não insisto — ${partesNota.join('; ')}.)` : '';
if (!porFechar.length) {
  nota(`[loop] Nada por fechar agora — ${partesNota.join('; ')}. O turno pode terminar; a notificação de `
    + `conclusão de um agente reacorda a sessão — aí marca "feito" e despacha o verificador.`);
}

// Progresso: assinatura dos estados. Igual à da iteração anterior = nada avançou.
const assinatura = passos.map((p) => `${p.id}:${p.estado}`).join('|');
// Turno de espera (N35): há agente de fundo em curso e nada mudou desde o último bloqueio → o modelo só
// esperou pela notificação; bloqueia na mesma pelos passos por fechar, mas a iteração não sobe.
const espera = assinatura === loop.assinatura && emCurso.some((p) => p.agente);
loop.sem_progresso = assinatura === loop.assinatura ? (loop.sem_progresso || 0) + 1 : 0;
loop.assinatura = assinatura;
if (!espera) loop.iteracao = (loop.iteracao || 0) + 1;
loop.criado = new Date(criado).toISOString();
if (!loop.sessao && sid) loop.sessao = sid;
try {
  fs.writeFileSync(loopFile, JSON.stringify(loop, null, 2));
  // A escrita do hook não renova o TTL (T219): repõe o mtime da última escrita do modelo.
  if (mtimeAntes) fs.utimesSync(loopFile, mtimeAntes, mtimeAntes);
} catch (_) {}

const max = loop.max_iteracoes || 4;
if (loop.iteracao > max) {
  nota(`[loop] Travão: ${loop.iteracao} iterações (máx ${max}). PARA e reporta o que ficou pendente: `
    + pendentes.map((p) => p.id).join(', '));
}
if (loop.sem_progresso >= SEM_PROGRESSO_MAX) {
  nota(`[loop] Travão: ${SEM_PROGRESSO_MAX} iterações sem progresso. PARA e reporta o bloqueio.`);
}

const proximo = porFechar[0];
const porVerificar = porFechar.filter((p) => p.estado === 'feito');
const notaEmCurso = notaAceites;
let reason;
const conjFeita = porVerificar.find((p) => { const v = verif(p); return v && v.tipo === 'passo'; });
if (ciclo) {
  reason = `[loop] Não termines: os passos ${aguardaDep.map((p) => `"${p.id}"`).join(', ')} esperam (depende_de) uns `
    + `pelos outros e nada está em curso — ciclo ou dependência por arrancar. Corrige "depende_de" em ${rotulo} `
    + `ou avança o primeiro.`;
} else if (conjFeita) {
  const v = verif(conjFeita);
  reason = `[loop] Não termines: a verificação conjunta "${v.alvo}" já correu — marca o passo "${conjFeita.id}" `
    + `"verificado" com "verificador" = o do passo "${v.alvo}" (diferente do produtor) em ${rotulo}, ou volta a `
    + `"pendente" se a verificação o reprovou.${notaEmCurso}`;
} else if (porVerificar.length) {
  const p = porVerificar[0];
  reason = `[loop] Não termines: o passo "${p.id}" está FEITO mas por VERIFICAR (produtor: ${p.produtor || 'principal'}). `
    + `Despacha um verificador DIFERENTE do produtor (agente de review/teste com brief + Step 0), com evidência `
    + `— gate estático + gate de runtime conforme rules/pipelines.md. Depois marca estado "verificado" e `
    + `preenche "verificador" em ${rotulo}. Se o verificador já corre em fundo, marca o passo `
    + `"em_curso" com "agente": "<id>". Verificação conjunta noutro passo → "verificacao": "<id-passo>"; `
    + `só possível depois (ex.: push) → "verificacao": "diferida:<condição>"; impossível → `
    + `"verificacao": "bloqueada:<motivo>" (reporta ao utilizador).${notaEmCurso}`;
} else {
  reason = `[loop] Não termines: passo pendente "${proximo.id}" — ${proximo.desc || ''}. `
    + `Continua (iteração ${loop.iteracao}/${max}). Se estiver bloqueado por decisão do utilizador, `
    + `põe "aguarda_utilizador": true em ${rotulo} e termina; se despachaste agentes de fundo para ele, `
    + `marca-o "em_curso" com "agente": "<id>" (a notificação de conclusão reacorda a sessão); se espera por `
    + `outro passo, põe "depende_de": ["<id>"]; se já não `
    + `fizer sentido, apaga esse ficheiro (só o desta sessão). Contrato de outra sessão → não lhe toques, `
    + `responde e termina.${notaEmCurso}`;
}
process.stdout.write(JSON.stringify({ decision: 'block', reason }));
process.exit(0);
