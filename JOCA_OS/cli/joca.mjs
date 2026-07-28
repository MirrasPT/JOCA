#!/usr/bin/env node
// joca — CLI de ponte entre um terminal e o JOCA_OS que o abriu.
//
// Todos os terminais abertos pelo JOCA nascem com JOCA_API_URL / JOCA_CLI / JOCA_SESSION_ID no
// ambiente (e JOCA_API_TOKEN quando a auth está ligada), portanto qualquer agente — Claude Code,
// Codex, agy, OpenCode — pode usar isto sem configuração e SEM reiniciar o JOCA:
//
//   node "$JOCA_CLI" tasks                      lista as tarefas do quadro
//   node "$JOCA_CLI" task <id>                  vê uma tarefa (com a thread de notas)
//   node "$JOCA_CLI" comment <id> "texto"       escreve uma nota na tarefa
//   node "$JOCA_CLI" done [<id>] --note "..."   comenta, conclui e move para 'concluida'
//   node "$JOCA_CLI" sessions                   lista os terminais abertos
//   node "$JOCA_CLI" send <id> "texto"          fala com outro terminal
//   node "$JOCA_CLI" read <id> --tail 2000      lê o que outro terminal escreveu
//
// Sem dependências. Saída pensada para ser lida por um agente: curta e determinística.
import process from 'node:process';

const API = (process.env.JOCA_API_URL || 'http://127.0.0.1:7491').replace(/\/$/, '');
const TOKEN = process.env.JOCA_API_TOKEN || '';
const SESSION_ID = process.env.JOCA_SESSION_ID || '';
const TASK_ID = process.env.JOCA_TASK_ID || '';

const COLUMNS = ['a-definir', 'a-executar', 'em-execucao', 'concluida', 'arquivada'];

function die(msg, code = 1) {
  console.error(`joca: ${msg}`);
  process.exit(code);
}

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json', Origin: API };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  let res;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    die(`não consegui falar com o JOCA_OS em ${API} (${e.message}). O JOCA está a correr?`);
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) die(`${res.status} — ${(data && data.error) || text || 'erro'}`);
  return data;
}

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
function resolveId(items, ref, label) {
  if (!ref) die(`falta o id da ${label}`);
  const exact = items.find((t) => t.id === ref);
  if (exact) return exact;
  const matches = items.filter((t) => t.id.startsWith(ref));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) die(`prefixo "${ref}" é ambíguo (${matches.length} ${label}s)`);
  die(`${label} "${ref}" não encontrada`);
}

// ── comandos ──────────────────────────────────────────────────────────────────
const commands = {
  async tasks(flags) {
    const tasks = await api('GET', '/tasks');
    const filtered = tasks.filter((t) => (
      (!flags.status || t.status === flags.status)
      && (!flags.project || t.projectId === flags.project)
    ));
    if (!filtered.length) return console.log('(sem tarefas)');
    for (const col of COLUMNS) {
      const inCol = filtered.filter((t) => t.status === col).sort((a, b) => a.order - b.order);
      if (!inCol.length) continue;
      console.log(`\n## ${col} (${inCol.length})`);
      for (const t of inCol) {
        const marks = [
          t.lastStatus === 'error' ? '✗' : '',
          t.comments?.length ? `💬${t.comments.length}` : '',
        ].filter(Boolean).join(' ');
        console.log(`  ${short(t.id)}  ${oneLine(t.title, 70)}${marks ? '  ' + marks : ''}`);
      }
    }
  },

  async task(flags, [ref]) {
    const tasks = await api('GET', '/tasks');
    const t = resolveId(tasks, ref || TASK_ID, 'tarefa');
    console.log(`# ${t.title}`);
    console.log(`id: ${t.id}\ncoluna: ${t.status}${t.lastStatus ? `  ·  último estado: ${t.lastStatus}` : ''}`);
    if (t.skills?.length) console.log(`skills: ${t.skills.join(', ')}`);
    if (t.description) console.log(`\n${t.description}`);
    if (t.result) console.log(`\n[resultado] ${t.result}`);
    if (t.comments?.length) {
      console.log(`\n## Notas (${t.comments.length})`);
      for (const c of t.comments) {
        console.log(`- [${c.author}${c.authorName ? `/${c.authorName}` : ''} ${rel(c.ts)}] ${c.text}`);
      }
    }
  },

  async comment(flags, [ref, ...rest]) {
    const text = rest.join(' ') || flags.text;
    const id = (ref && !ref.startsWith('-')) ? ref : TASK_ID;
    if (!text) die('falta o texto: joca comment <id> "a tua nota"');
    const tasks = await api('GET', '/tasks');
    const t = resolveId(tasks, id, 'tarefa');
    await api('POST', `/tasks/${t.id}/comments`, { text, author: 'worker', sessionId: SESSION_ID });
    console.log(`nota adicionada a "${t.title}"`);
  },

  // O caso de uso central: o worker acaba, explica o que fez e fecha a tarefa.
  async done(flags, [ref]) {
    const tasks = await api('GET', '/tasks');
    const t = resolveId(tasks, ref || TASK_ID, 'tarefa');
    const note = flags.note || flags.summary;
    if (note) await api('POST', `/tasks/${t.id}/comments`, { text: note, author: 'worker', sessionId: SESSION_ID });
    await api('POST', `/tasks/${t.id}/move`, { status: 'concluida' });
    console.log(`"${t.title}" → concluida${note ? ' (com nota)' : ''}`);
  },

  async move(flags, [ref, status]) {
    if (!COLUMNS.includes(status)) die(`coluna inválida. Usa: ${COLUMNS.join(' | ')}`);
    const tasks = await api('GET', '/tasks');
    const t = resolveId(tasks, ref, 'tarefa');
    await api('POST', `/tasks/${t.id}/move`, { status });
    console.log(`"${t.title}" → ${status}`);
  },

  async advance(flags, [ref]) {
    const tasks = await api('GET', '/tasks');
    const t = resolveId(tasks, ref || TASK_ID, 'tarefa');
    const out = await api('POST', `/tasks/${t.id}/advance`);
    console.log(`"${out.title}" → ${out.status}`);
  },

  async 'new-task'(flags, [...titleParts]) {
    const title = titleParts.join(' ') || flags.title;
    if (!title) die('falta o título: joca new-task "o que é preciso fazer"');
    const t = await api('POST', '/tasks', {
      title,
      description: flags.desc || flags.description,
      status: COLUMNS.includes(flags.status) ? flags.status : undefined,
      projectId: flags.project,
    });
    console.log(`tarefa criada: ${short(t.id)}  ${t.title}  (${t.status})`);
  },

  async merge(flags, ids) {
    if (ids.length < 2) die('preciso de pelo menos 2 ids: joca merge <id1> <id2> [...]');
    const tasks = await api('GET', '/tasks');
    const resolved = ids.map((r) => resolveId(tasks, r, 'tarefa').id);
    const out = await api('POST', '/tasks/merge', { ids: resolved, title: flags.title });
    console.log(`fundidas ${ids.length} tarefas em "${out.title}" (${short(out.id)})`);
  },

  async sessions() {
    const list = await api('GET', '/sessions');
    if (!list.length) return console.log('(sem terminais abertos)');
    for (const s of list) {
      const me = s.id === SESSION_ID ? '  ← este terminal' : '';
      console.log(`${short(s.id)}  [${s.cli}] ${s.status.padEnd(7)} ${oneLine(s.name, 40)}${me}`);
    }
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
    const s = resolveId(list, ref, 'sessão');
    if (s.id === SESSION_ID) die('não podes enviar uma mensagem para ti próprio');
    await api('POST', `/sessions/${s.id}/input`, { text });
    console.log(`enviado para "${s.name}" (${short(s.id)})`);
  },

  async read(flags, [ref]) {
    const list = await api('GET', '/sessions');
    const s = resolveId(list, ref, 'sessão');
    const out = await api('GET', `/sessions/${s.id}/buffer?tail=${Number(flags.tail) || 4000}`);
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

  async notify(flags, [...parts]) {
    const text = parts.join(' ') || flags.text;
    if (!text) die('falta o texto: joca notify "mensagem"');
    await api('POST', '/notifications', { title: flags.title || '🖥 Terminal', text, kind: 'system' });
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

TAREFAS
  tasks [--status <coluna>] [--project <id>]   lista o quadro
  task [<id>]                                  detalhe + notas (sem id: a tarefa deste worker)
  new-task "<título>" [--desc "..."] [--status <coluna>] [--project <id>]
  comment [<id>] "<texto>"                     escreve uma nota na tarefa
  done [<id>] [--note "o que fiz"]             comenta e move para 'concluida'
  move <id> <coluna>                           ${COLUMNS.join(' | ')}
  advance [<id>]                               empurra para a coluna seguinte
  merge <id1> <id2> [...] [--title "..."]      funde tarefas numa só

TERMINAIS
  sessions                                     lista os terminais abertos
  new-session "<nome>" [--cli claude|codex|agy|opencode] [--project <id>] [--prompt "..."]
  send <id> "<texto>"                          fala com outro terminal
  read <id> [--tail 4000]                      lê o output de outro terminal

OUTROS
  automations · projects · runs [--limit N] · notify "<texto>"

Contexto deste terminal: sessão ${SESSION_ID ? short(SESSION_ID) : '(desconhecida)'}${TASK_ID ? `, tarefa ${short(TASK_ID)}` : ''}`);
  },
};

const [, , cmd = 'help', ...rest] = process.argv;
const { flags, positional } = parseArgs(rest);
const handler = commands[cmd] ?? (cmd === '--help' || cmd === '-h' ? commands.help : null);
if (!handler) die(`comando desconhecido "${cmd}". Corre: joca help`);
handler(flags, positional).catch((e) => die(e.message));
