// A Sala — chat de grupo entre o utilizador, o Joca e os gestores de projecto.
//
// Não é um chat novo por gestor: é UM stream partilhado (DATA_DIR/room.jsonl). Quando o utilizador
// fala, os gestores endereçados respondem com o SEU cérebro normal (runManagerTurn /
// runGlobalManagerTurn) — a sala entra-lhes como input com uma moldura que lhes diz onde estão e
// com quem falam. As respostas são despachadas em BACKGROUND: um turno de gestor demora dezenas de
// segundos e o POST não pode prender o cliente; o frontend faz poll do GET.
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { DATA_DIR, loadProjects } from '../project-store';
import { runManagerTurn, runGlobalManagerTurn, GLOBAL_MANAGER_ID } from './manager';

export interface RoomAuthor {
  kind: 'user' | 'joca' | 'manager';
  /** Só para kind='manager'. */
  projectId?: string;
  name: string;
}

export interface RoomMessage {
  id: string;
  ts: number;
  author: RoomAuthor;
  text: string;
}

const ROOM_FILE = path.join(DATA_DIR, 'room.jsonl');

export function listRoomMessages(limit = 300): RoomMessage[] {
  try {
    const lines = fs.readFileSync(ROOM_FILE, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l) as RoomMessage);
  } catch { return []; }
}

export function appendRoomMessage(author: RoomAuthor, text: string): RoomMessage {
  const msg: RoomMessage = { id: randomUUID(), ts: Date.now(), author, text };
  fs.mkdirSync(path.dirname(ROOM_FILE), { recursive: true });
  fs.appendFileSync(ROOM_FILE, JSON.stringify(msg) + '\n');
  return msg;
}

/** Quem está na sala, com a etiqueta por que se chamam uns aos outros (`@etiqueta`). */
interface Participant { id: string; handle: string; label: string }

function participants(): Participant[] {
  const out: Participant[] = [{ id: 'joca', handle: 'Joca', label: 'Joca (gestor global)' }];
  for (const p of loadProjects()) {
    if (p.archived) continue;
    // Handle sem espaços: um `@` até ao primeiro espaço é o que qualquer humano escreve, e é o
    // que torna a detecção de menções fiável sem pedir sintaxe estranha ao modelo.
    out.push({ id: p.id, handle: p.name.replace(/\s+/g, '_'), label: `Gestor de ${p.name}` });
  }
  return out;
}

function speakerName(m: RoomMessage): string {
  return m.author.kind === 'manager' ? `Gestor de ${m.author.name}` : m.author.name;
}

/**
 * Moldura de um turno. Diz ao gestor onde está, quem mais lá anda, e — o mais importante — que
 * isto é um DEBATE com várias voltas, não um formulário de resposta única. Sem esta última parte
 * cada um respondia uma vez ao dono e a sala morria.
 */
function roomFrame(who: Participant, recent: RoomMessage[], turnsLeft: number): string {
  const roster = participants()
    .filter((p) => p.id !== who.id)
    .map((p) => `@${p.handle} (${p.label})`)
    .join(' · ');
  const transcript = recent.slice(-24).map((m) => `${speakerName(m)}: ${m.text}`).join('\n');
  return [
    '[SALA — debate de grupo entre o dono, o Joca e os gestores de todos os projectos]',
    `És ${who.label}. Falas NA SALA, à frente de todos — não no teu chat privado.`,
    'Sê curto: 2 a 6 frases. Sem relatórios.',
    'Podes usar as tuas ferramentas para ires VER antes de afirmares seja o que for.',
    '',
    `Também estão na sala: ${roster || '(mais ninguém)'}`,
    '',
    '# Isto é uma discussão, não uma resposta única',
    'A conversa continua enquanto houver alguém endereçado, e podes falar VÁRIAS vezes.',
    'Para passares a palavra a outro, escreve `@etiqueta` — ele recebe e responde a seguir.',
    'Discorda quando discordares. Se outro afirmar algo sobre o TEU projecto que não bate certo,',
    'corrige-o com o que verificaste. É preferível uma volta a mais do que um acordo falso.',
    '',
    '# Como se fecha',
    'Quando o assunto estiver mesmo resolvido, escreve numa linha própria `RESOLVIDO: <o que ficou decidido>`',
    'e NÃO menciones mais ninguém. Isso encerra o debate.',
    'Se não tens nada a acrescentar, não menciones ninguém — o silêncio também fecha.',
    'Nunca menciones alguém só para concordar, agradecer ou dar por encerrado: isso faz a sala girar sem avançar.',
    `(Restam ${turnsLeft} intervenções nesta discussão. Se chegar ao fim sem `
      + 'conclusão, o dono fica sem resposta — converge.)',
    '',
    `Conversa até agora:\n${transcript}`,
    '',
    'Responde agora, só com a tua mensagem para a sala.',
  ].join('\n');
}

/** Menções `@etiqueta` no texto → ids de participantes. Case-insensitive, sem o próprio autor. */
function mentionedIds(text: string, selfId: string): string[] {
  const all = participants();
  const found: string[] = [];
  for (const p of all) {
    if (p.id === selfId) continue;
    const re = new RegExp(`@${p.handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text) && !found.includes(p.id)) found.push(p.id);
  }
  return found;
}

/**
 * Thread SDK da SALA, por participante. Separada da conversa privada de cada gestor: sem isto, um
 * turno da sala fazia `resume` do chat a dois com o dono e gravava-lhe o id de volta — o debate
 * inteiro passava a fazer parte do histórico desse chat, e o dono via lá coisas que nunca disse.
 *
 * Em memória de propósito: a sala é uma conversa de trabalho, não um registo. Reiniciar o backend
 * limpa o contexto SDK e a discussão seguinte recomeça do transcrito em `room.jsonl`, que é
 * persistente e é o que interessa manter.
 */
const roomSessions = new Map<string, string>();

/** Corre UM turno de um participante e devolve o que ele disse (já anexado à sala). */
async function speak(who: Participant, turnsLeft: number): Promise<string> {
  const framed = roomFrame(who, listRoomMessages(32), turnsLeft);
  const detached = {
    resume: roomSessions.get(who.id),
    onSession: (id: string) => roomSessions.set(who.id, id),
  };

  if (who.id === 'joca') {
    const r = await runGlobalManagerTurn(framed, 'system', { detached });
    const reply = r.text.trim();
    if (reply) appendRoomMessage({ kind: 'joca', name: 'Joca' }, reply);
    return reply;
  }
  const project = loadProjects().find((p) => p.id === who.id);
  if (!project) return '';
  const r = await runManagerTurn(project.id, framed, 'system', { detached });
  const reply = r.text.trim();
  if (reply) appendRoomMessage({ kind: 'manager', projectId: project.id, name: project.name }, reply);
  return reply;
}

/**
 * Orçamento de uma discussão. Generoso o suficiente para haver debate a sério (cada um pode
 * intervir várias vezes), apertado o suficiente para não queimar a subscrição num fim-de-semana.
 */
const MAX_TURNS = 16;              // intervenções no total
const MAX_TURNS_PER_SPEAKER = 5;   // por participante — impede o monólogo de um só
const IDLE_ROUNDS_TO_STOP = 1;     // rondas seguidas sem ninguém endereçado → fim

/** `RESOLVIDO:` numa linha própria = alguém deu o assunto por fechado. */
function declaresResolved(text: string): boolean {
  return /^\s*RESOLVIDO\s*:/im.test(text);
}

/** Estado vivo de uma discussão, para a UI poder mostrar "a discutir…" enquanto corre. */
let running = false;
export function isRoomBusy(): boolean { return running; }

/**
 * Corre a discussão até ela se fechar sozinha.
 *
 * Ronda 1 = quem o dono endereçou. Depois é a própria conversa que decide quem fala: cada resposta
 * é lida à procura de `@menções`, e quem for chamado responde a seguir — podendo responder outra
 * vez mais à frente, que é o que distingue um debate de uma ronda de respostas.
 *
 * Sequencial de propósito: N gestores em paralelo a abrir workers pisavam-se nos terminais, e cada
 * um precisa de ver o que o anterior disse.
 *
 * Termina por uma de quatro vias — a primeira é a boa, as outras três são travões:
 *  1. alguém escreve `RESOLVIDO:` e não passa a palavra;
 *  2. ninguém é endereçado (a conversa esgotou-se);
 *  3. o orçamento de turnos acaba;
 *  4. um participante esgotou as intervenções dele.
 * Sem travões, dois gestores educados a agradecer-se um ao outro nunca mais paravam.
 */
export async function dispatchToRoom(targets: string[], _userName: string, _text: string): Promise<void> {
  const roster = participants();
  const spokenCount = new Map<string, number>();
  let queue = targets
    .map((t) => roster.find((p) => p.id === t || (t === GLOBAL_MANAGER_ID && p.id === 'joca')))
    .filter((p): p is Participant => Boolean(p));
  let turns = 0;
  let idleRounds = 0;

  running = true;
  try {
    while (queue.length > 0 && turns < MAX_TURNS) {
      const next: Participant[] = [];
      for (const who of queue) {
        if (turns >= MAX_TURNS) break;
        const used = spokenCount.get(who.id) ?? 0;
        if (used >= MAX_TURNS_PER_SPEAKER) continue;
        spokenCount.set(who.id, used + 1);
        turns++;
        try {
          const reply = await speak(who, MAX_TURNS - turns);
          if (!reply) continue;
          // Conclusão declarada sem passar a palavra = fim do debate, não mais uma ronda.
          const mentions = mentionedIds(reply, who.id);
          if (declaresResolved(reply) && mentions.length === 0) return;
          for (const id of mentions) {
            const p = roster.find((x) => x.id === id);
            if (!p) continue;
            if ((spokenCount.get(p.id) ?? 0) >= MAX_TURNS_PER_SPEAKER) continue;
            if (!next.some((n) => n.id === p.id)) next.push(p);
          }
        } catch {
          // Um gestor que rebenta não pode calar a sala inteira — segue para o próximo.
        }
      }
      // Uma ronda inteira sem ninguém endereçado: a conversa acabou de morte natural.
      idleRounds = next.length === 0 ? idleRounds + 1 : 0;
      if (idleRounds >= IDLE_ROUNDS_TO_STOP) break;
      queue = next;
    }
  } finally {
    running = false;
  }
}
