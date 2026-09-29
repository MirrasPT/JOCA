// Nome do terminal pelo Claude Haiku (#12, 2.º passo).
//
// O 1.º pedido dá logo um nome pela heurística (`nomeDoPedido`); a seguir, sem bloquear nada, o
// mesmo pedido vai ao Haiku pelo próprio `claude` CLI — com a subscrição de quem usa o JOCA, sem
// chave de API nem SDK — e volta um nome de 1-2 palavras. Se não voltar nada que preste, fica o
// da heurística, em silêncio.
//
// Flags medidas no claude 2.1.284 (~7 s): `-p` sem sessão guardada, sem settings do utilizador
// nem hooks (o filho nunca chama `joca hook`), sem MCP e sem ferramentas. NÃO usar `--bare`: força
// a autenticação por ANTHROPIC_API_KEY e deixa de fora a subscrição.
import { execFile } from 'child_process';
import os from 'os';

const IS_WINDOWS = process.platform === 'win32';
export const NOME_MODELO_MAX = 24;
const TIMEOUT_MS = 20_000;
const PEDIDO_MAX = 500;

const SYSTEM_PROMPT = [
  'Dás nome a uma conversa a partir do primeiro pedido do utilizador.',
  'Responde APENAS com o nome: no máximo 2 palavras, em português de Portugal (Acordo Ortográfico de 1990),',
  'curto e que se perceba do que trata. Sem aspas, sem pontuação final, sem explicações.',
].join(' ');

export type Nomeador = (prompt: string) => Promise<string | null>;

/**
 * Limpa a resposta do modelo até um nome de terminal, ou null se não há nome ali.
 * 1.ª linha com texto · sem aspas, crases, markdown nem rótulo «Nome:» · sem pontuação final ·
 * espaços colapsados · no máximo 2 palavras e NOME_MODELO_MAX caracteres. Uma frase comprida
 * (>6 palavras) é conversa, não nome — descarta-se. Exportada para ser testável.
 */
export function higienizarNome(resposta: string): string | null {
  const linha = resposta.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ')
    .split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  const limpo = linha
    .replace(/^(?:#{1,6}\s+|>\s*|[-*+]\s+)+/, '')              // título, citação, lista
    .replace(/^nome\s*:\s*/i, '')                               // «Nome: …»
    .replace(/[`*_~"'“”‘’«»]/g, '')                             // aspas, crases, ênfase
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.,;:!?…-]+$/, '');
  if (!/\p{L}/u.test(limpo)) return null;
  const palavras = limpo.split(' ');
  if (palavras.length > 6) return null;
  let nome = palavras.slice(0, 2).join(' ');
  if (nome.length > NOME_MODELO_MAX) nome = palavras[0];
  if (nome.length > NOME_MODELO_MAX) nome = nome.slice(0, NOME_MODELO_MAX);
  return nome || null;
}

// Ambiente do filho: o do backend, sem o que faz dele um terminal do JOCA (o PTY recebe estas de
// `jocaAgentEnv`) nem o que o Claude Code põe nos filhos (CLAUDECODE/CLAUDE_CODE_*) — senão o
// filho achava-se aninhado. CLAUDE_CODE_OAUTH_TOKEN fica: é autenticação, não aninhamento.
const JOCA_VARS = new Set(['JOCA_API_URL', 'JOCA_CLI', 'JOCA_SESSION_ID', 'JOCA_API_TOKEN']);
function ambienteDoFilho(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (JOCA_VARS.has(k) || k === 'CLAUDECODE') continue;
    if (k.startsWith('CLAUDE_CODE_') && k !== 'CLAUDE_CODE_OAUTH_TOKEN') continue;
    env[k] = v;
  }
  return env;
}

/** Nomeador real: `claude -p --model haiku` com o pedido no stdin. Nunca rejeita — falha = null. */
export function criarNomeadorHaiku(claudeBin: string): Nomeador {
  return (prompt) => new Promise((resolve) => {
    // Um `claude.cmd` no Windows só corre com shell, e aí o system prompt teria de ser escapado à
    // mão — não vale o risco: fica a heurística.
    if (IS_WINDOWS && /\.(cmd|bat)$/i.test(claudeBin)) { resolve(null); return; }
    const falhou = (motivo: string) => {
      console.warn(`[nome-auto] Haiku sem nome (${motivo}); fica o nome da heurística`);
      resolve(null);
    };
    const args = [
      '-p', '--model', 'haiku', '--no-session-persistence',
      '--setting-sources', '', '--settings', '{"disableAllHooks":true}',
      '--strict-mcp-config', '--tools', '', '--system-prompt', SYSTEM_PROMPT,
    ];
    let filho;
    try {
      filho = execFile(claudeBin, args, {
        cwd: os.tmpdir(), env: ambienteDoFilho(), timeout: TIMEOUT_MS, killSignal: 'SIGKILL',
        maxBuffer: 4096, windowsHide: true, encoding: 'utf8',
      }, (err, stdout) => {
        if (err) {
          const e = err as NodeJS.ErrnoException & { killed?: boolean; code?: number | string };
          falhou(e.killed ? 'timeout' : `erro ${e.code ?? 'desconhecido'}`);
          return;
        }
        const nome = higienizarNome(stdout);
        if (nome) resolve(nome); else falhou('resposta vazia');
      });
    } catch (e) {
      falhou(`não arrancou: ${(e as Error).message}`);
      return;
    }
    filho.stdin?.on('error', () => { /* filho morreu antes de ler — o callback trata */ });
    filho.stdin?.end(prompt.slice(0, PEDIDO_MAX));
  });
}

// JOCA_AUTO_NAME_MODEL=off desliga o passo do Haiku (testes, CI, quem não quer gastar quota):
// fica só o nome da heurística. Lido a cada pedido, para os testes o poderem ligar.
export function modeloDeNomeLigado(): boolean {
  return (process.env.JOCA_AUTO_NAME_MODEL ?? '').toLowerCase() !== 'off';
}
