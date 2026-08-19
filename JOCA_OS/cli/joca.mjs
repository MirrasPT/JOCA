#!/usr/bin/env node
// joca — CLI de ponte entre um terminal e o JOCA_OS que o abriu.
//
// Todos os terminais abertos pelo JOCA nascem com JOCA_API_URL / JOCA_CLI / JOCA_SESSION_ID no
// ambiente (e JOCA_API_TOKEN quando a auth está ligada), portanto qualquer agente — Claude Code,
// Codex, agy, OpenCode — pode usar isto sem configuração e SEM reiniciar o JOCA:
//
//   node "$JOCA_CLI" sessions                   terminais do teu projecto (área + trabalho actual)
//   node "$JOCA_CLI" send <id> "texto"          fala com outro agente do mesmo projecto
//   node "$JOCA_CLI" read <id> --tail 2000      lê o que outro agente escreveu
//   node "$JOCA_CLI" cat <path>                  lê 1 ficheiro por caminho (sem navegação/listagem)
//
// Os comandos de terminais são LIMITADOS AO PROJECTO de quem os corre: dois agentes do mesmo
// projecto falam e verificam-se um ao outro, mas não vêem os de outro projecto. Quem corre o CLI
// à mão (sem JOCA_SESSION_ID) continua a ver tudo.
//
// Sem dependências. Saída pensada para ser lida por um agente: curta e determinística.
import process from 'node:process';
import path from 'node:path';
import os from 'node:os';

const API = (process.env.JOCA_API_URL || 'http://127.0.0.1:7491').replace(/\/$/, '');
const TOKEN = process.env.JOCA_API_TOKEN || '';
const SESSION_ID = process.env.JOCA_SESSION_ID || '';

function die(msg, code = 1) {
  console.error(`joca: ${msg}`);
  process.exit(code);
}

// Um único ponto de entrada HTTP: `raw` devolve o corpo tal e qual (o /file-content serve o
// ficheiro, não JSON) e `forbiddenHint` explica um 403 — a única resposta cujo texto do backend
// ("Forbidden") não diz ao agente o que fazer a seguir.
async function request(method, route, { body, raw = false, forbiddenHint = '' } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: API };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  // Diz ao JOCA_OS QUEM está a chamar: é assim que o backend limita um agente aos terminais do
  // projecto dele. Quem corre isto à mão (sem JOCA_SESSION_ID) não se identifica e vê tudo.
  if (SESSION_ID) headers['X-Joca-Session'] = SESSION_ID;
  let res;
  try {
    res = await fetch(`${API}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    die(`não consegui falar com o JOCA_OS em ${API} (${e.message}).
  O JOCA_OS pode não estar a correr, ou estar noutra porta. Confirma que a app está aberta e
  que JOCA_API_URL aponta para ela (agora: ${process.env.JOCA_API_URL ? `JOCA_API_URL=${process.env.JOCA_API_URL}` : 'JOCA_API_URL não definida — usei o default'}).`);
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    // 401 é sempre o mesmo problema visto de dois lados: token em falta ou token já morto.
    if (res.status === 401) {
      die(TOKEN
        ? `o JOCA_OS recusou o JOCA_API_TOKEN deste terminal (expirado ou revogado por mudança de password).
  Abre um terminal novo a partir do JOCA_OS — cada PTY nasce com um token fresco.`
        : `o JOCA_OS tem auth ligada e falta JOCA_API_TOKEN neste ambiente.
  Os terminais abertos pelo JOCA_OS recebem-no automaticamente; se estás a correr isto à mão,
  exporta JOCA_API_TOKEN=<token> (o mesmo que a UI usa) antes de repetir.`);
    }
    const hint = res.status === 403 && forbiddenHint ? `\n  ${forbiddenHint}` : '';
    die(`${res.status} — ${(data && data.error) || text || 'erro'}${hint}`);
  }
  return raw ? text : data;
}

const api = (method, route, body) => request(method, route, { body });

// ── args ──────────────────────────────────────────────────────────────────────
// Suporta `--flag valor` e `--flag=valor`; o resto são posicionais.
function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else positional.push(a);
  }
  return { flags, positional };
}

const rel = (ts) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.round(s / 60)}min`;
  if (s < 86400) return `há ${Math.round(s / 3600)}h`;
  return `há ${Math.round(s / 86400)}d`;
};
const short = (id) => (id || '').slice(0, 8);
const oneLine = (s, n = 90) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Aceita um id completo ou um prefixo (os agentes copiam ids curtos da listagem).
function resolveId(items, ref, label, notFoundHint = '') {
  if (!ref) die(`falta o id da ${label}`);
  const exact = items.find((t) => t.id === ref);
  if (exact) return exact;
  const matches = items.filter((t) => t.id.startsWith(ref));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) die(`prefixo "${ref}" é ambíguo (${matches.length} ${label}s)`);
  die(`${label} "${ref}" não encontrada${notFoundHint ? `\n  ${notFoundHint}` : ''}`);
}

// Um projecto é referido por id, prefixo de id ou nome — um agente que leu "Site da Ana" numa
// mensagem não tem o uuid à mão. Ambiguidade nunca adivinha: lista as hipóteses e sai.
async function resolveProject(ref) {
  const all = (await api('GET', '/projects')).filter((p) => !p.archived);
  if (!all.length) die('não há projectos no JOCA_OS. Cria um na UI (barra lateral → Projectos).');
  if (!ref) die('falta o projecto. Vê a lista com: joca projects');
  const lower = String(ref).toLowerCase();
  const exact = all.find((p) => p.id === ref) || all.find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact;
  let matches = all.filter((p) => p.id.startsWith(ref));
  if (!matches.length) matches = all.filter((p) => p.name.toLowerCase().includes(lower));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    console.error(`joca: "${ref}" corresponde a ${matches.length} projectos — escolhe um:`);
    for (const p of matches) console.error(`  ${short(p.id)}  ${p.name}`);
    process.exit(1);
  }
  die(`projecto "${ref}" não encontrado. Vê a lista com: joca projects`);
}

// Caminhos são resolvidos DO LADO DO AGENTE (~ e relativos contam a partir do cwd deste terminal);
// o backend recebe sempre um absoluto, senão resolveria relativamente ao cwd do servidor.
function absPath(p) {
  const raw = String(p).trim();
  if (raw === '~' || raw.startsWith('~/') || raw.startsWith('~\\')) return path.join(os.homedir(), raw.slice(1));
  return path.resolve(raw);
}

const FILES_HINT = 'O JOCA_OS só serve ficheiros dentro da tua home (e nunca pastas sensíveis como .ssh/.aws).';
const SCOPE_HINT = 'Um agente só fala com terminais do MESMO projecto — vê quais com: joca sessions';

// ── comandos ──────────────────────────────────────────────────────────────────
const commands = {
  // Dentro de um agente esta lista já vem limitada ao projecto dele (o backend filtra pelo
  // X-Joca-Session). Mostra a ÁREA e o trabalho actual: é o que decide com quem vale a pena falar.
  async sessions() {
    const list = await api('GET', '/sessions');
    if (!list.length) return console.log('(sem terminais abertos)');
    const self = list.find((s) => s.id === SESSION_ID);
    if (self?.projectName) console.log(`# terminais de "${self.projectName}" (só vês os do teu projecto)\n`);
    for (const s of list) {
      const me = s.id === SESSION_ID ? '  ← este terminal' : '';
      const area = s.area ? `${s.area}${s.busy ? '*' : ''}` : '—';
      const job = s.currentJob ? `  · ${oneLine(s.currentJob, 60)}` : '';
      console.log(`${short(s.id)}  [${s.cli}] ${s.status.padEnd(7)} ${oneLine(s.name, 28).padEnd(30)} ${area.padEnd(16)}${job}${me}`);
    }
    console.log('\n(área com * = ocupado a trabalhar · lê o que faz com: joca read <id>)');
  },

  async 'new-session'(flags, [...nameParts]) {
    const s = await api('POST', '/sessions', {
      name: nameParts.join(' ') || flags.name,
      cli: flags.cli,
      model: flags.model,
      project: flags.project,
      cwd: flags.cwd,
      prompt: flags.prompt,
    });
    console.log(`terminal aberto: ${short(s.id)}  [${s.cli}] ${s.name}`);
  },

  async send(flags, [ref, ...rest]) {
    const text = rest.join(' ') || flags.text;
    if (!text) die('falta o texto: joca send <id-sessão> "mensagem"');
    const list = await api('GET', '/sessions');
    const s = resolveId(list, ref, 'sessão', SCOPE_HINT);
    if (s.id === SESSION_ID) die('não podes enviar uma mensagem para ti próprio');
    await request('POST', `/sessions/${s.id}/input`, { body: { text }, forbiddenHint: SCOPE_HINT });
    console.log(`enviado para "${s.name}" (${short(s.id)})`);
  },

  async read(flags, [ref]) {
    const list = await api('GET', '/sessions');
    const s = resolveId(list, ref, 'sessão', SCOPE_HINT);
    const out = await request('GET', `/sessions/${s.id}/buffer?tail=${Number(flags.tail) || 4000}`, { forbiddenHint: SCOPE_HINT });
    console.log(out.text);
  },

  async automations() {
    const list = await api('GET', '/automations');
    if (!list.length) return console.log('(sem automações)');
    for (const a of list) {
      const next = a.nextRunAt ? new Date(a.nextRunAt).toLocaleString('pt-PT') : '—';
      console.log(`${short(a.id)}  ${a.enabled ? 'on ' : 'off'}  ${oneLine(a.name, 40).padEnd(42)} próxima: ${next}${a.lastStatus ? `  último: ${a.lastStatus}` : ''}`);
    }
  },

  async projects() {
    const list = await api('GET', '/projects');
    for (const p of list.filter((x) => !x.archived)) console.log(`${short(p.id)}  ${p.name}  ${p.path}`);
  },


  async cat(flags, [target]) {
    if (!target) die('falta o caminho: joca cat <path> [--tail N]');
    const file = absPath(target);
    // O backend serve o ficheiro inteiro; o corte por linhas é feito aqui (não há rota de tail).
    const body = await request('GET', `/file-content?path=${encodeURIComponent(file)}`, { raw: true, forbiddenHint: FILES_HINT });
    const tail = Number(flags.tail);
    if (tail > 0) {
      const lines = body.split('\n');
      // O \n final não é uma linha — sem isto, `--tail 2` devolvia a última linha e um vazio.
      if (lines.length && lines[lines.length - 1] === '') lines.pop();
      console.log(lines.slice(Math.max(0, lines.length - tail)).join('\n'));
    } else process.stdout.write(body);   // sem \n extra: o ficheiro sai byte a byte como está
  },

  async notify(flags, [...parts]) {
    const text = parts.join(' ') || flags.text;
    if (!text) die('falta o texto: joca notify "mensagem"');
    await api('POST', '/notifications', { title: flags.title || 'Terminal', text, kind: 'system' });
    console.log('notificação enviada');
  },

  async runs(flags) {
    const list = await api('GET', `/runs?limit=${Number(flags.limit) || 20}`);
    if (!list.length) return console.log('(sem execuções registadas)');
    for (const r of list) {
      console.log(`${new Date(r.endedAt).toLocaleString('pt-PT')}  ${r.kind.padEnd(10)} ${r.status.padEnd(6)} ${Math.round(r.ms / 1000)}s  ${oneLine(r.name, 40)}`);
    }
  },

  help() {
    console.log(`joca — ponte entre este terminal e o JOCA_OS (${API})

TERMINAIS (agentes falam entre si — só dentro do MESMO projecto)
  sessions                                     terminais do teu projecto, com área e trabalho actual
  new-session "<nome>" [--cli claude|codex|agy|opencode] [--project <id>] [--prompt "..."]
  send <id> "<texto>"                          fala com outro agente (verifica-lhe o trabalho, pede algo)
  read <id> [--tail 4000]                      lê o output de outro agente
  (dentro de um agente vês SÓ os terminais do projecto dele; falar com um de outro projecto é
   recusado pelo JOCA_OS.)


FICHEIROS (leitura pontual — sem navegação/listagem, ver skill)
  cat <path> [--tail N]                        lê um ficheiro (--tail N = últimas N linhas)

OUTROS
  automations · projects · runs [--limit N] · notify "<texto>"

Contexto deste terminal: sessão ${SESSION_ID ? short(SESSION_ID) : '(desconhecida)'}`);
  },
};

const [, , cmd = 'help', ...rest] = process.argv;
const { flags, positional } = parseArgs(rest);
// Object.hasOwn: `joca toString` não pode cair no Object.prototype.
const isCommand = (name) => Object.hasOwn(commands, name);
const handler = isCommand(cmd) ? commands[cmd] : (cmd === '--help' || cmd === '-h' ? commands.help : null);
if (!handler) die(`comando desconhecido "${cmd}". Corre: joca help`);
// Promise.resolve: `help` é síncrono e devolve undefined — chamar .catch() nele rebentava.
Promise.resolve(handler(flags, positional)).catch((e) => die(e.message));
