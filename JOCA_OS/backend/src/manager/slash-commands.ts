// Slash commands no chat do gestor — escrever `/save` ou `/ship` no chat passa a valer o mesmo que
// num terminal Claude Code.
//
// Dois universos, deliberadamente separados por `origem`:
//   • 'joca'   — os comandos reais do toolkit (`.claude/commands/*.md`), descobertos em disco. A
//                definição do comando é o próprio ficheiro; injecta-se o conteúdo no turno.
//   • 'claude' — os poucos comandos base do Claude Code que fazem sentido nesta camada e que o
//                backend consegue cumprir de facto (limpar chat, libertar contexto, custo, ajuda).
//                Nada aqui finge capacidades que o gestor não tem.
//
// A regra de encaminhamento é do dono do produto, e é literal: **os pesados são SEMPRE delegados a
// um agente**; os leves o gestor executa, a não ser que o utilizador peça explicitamente um agente.
import fs from 'fs';
import { collectToolkitItems, parseFrontmatter } from '../toolkit-registry';

export type PesoComando = 'leve' | 'pesado';
export type OrigemComando = 'joca' | 'claude';

export interface SlashCommand {
  nome: string;
  descricao: string;
  peso: PesoComando;
  origem: OrigemComando;
}

/** Acções que o backend cumpre sozinho, sem gastar um turno do gestor. */
export type AccaoLocal = 'limpar' | 'libertar-contexto' | 'custo' | 'ajuda';

export type ResolucaoSlash =
  | { tipo: 'nenhum' }
  | { tipo: 'desconhecido'; nome: string; sugestoes: string[] }
  | { tipo: 'local'; nome: string; accao: AccaoLocal }
  | { tipo: 'gestor'; nome: string; peso: PesoComando; prompt: string }
  | { tipo: 'delegar'; nome: string; peso: PesoComando; prompt: string };

// ── Classificação dos comandos do toolkit ────────────────────────────────────
// PESADOS: trabalho longo, multi-ficheiro, multi-passo ou irreversível. Vão SEMPRE para um agente
// terminal — o gestor não tem Bash/Read/Write, e mesmo que tivesse, um destes dentro do turno do
// gestor bloqueava o chat durante minutos.
const COMANDOS_PESADOS = new Set([
  'one-shot',           // desenvolvimento autónomo end-to-end
  'goal',               // auto-orquestração com fan-out de agentes
  'autoplan',           // plano completo auto-revisto (várias passagens)
  'build-plan',         // construção por fases com gates
  'ship',               // testes + review + push + PR (irreversível no fim)
  'create-skill',       // pipeline de research + escrita de ficheiros
  'upgrade-joca',       // self-improvement: audita e reescreve o toolkit
  'update-joca',        // sync com o upstream (mexe no git)
  'install',            // setup de máquina
  'migrate',            // migração de versão
  'init-project',       // cria estrutura de projecto em disco
  'sync-brain',         // resolve divergência git entre máquinas
  'sync-questionnaires',// audita e reescreve os questionários
  'map-joca',           // corre scripts + graphify sobre todo o toolkit
  'plan',               // arquitectura: leitura extensa da codebase
  'debug',              // triage com stack trace + skills do domínio
  'review-code',        // review adversarial (agente dedicado)
  'review-design',      // review de UI/UX + acessibilidade
  'wp-perf',            // varre uma codebase WordPress
  'wp-perf-review',     // review de performance WordPress
]);
// Tudo o resto (`save`, `status`, `learn`, `resume`, `know`, `retro`, `help-joca`, …) é LEVE: o
// gestor trata por omissão. Um comando novo em `.claude/commands/` nasce leve — se for pesado,
// acrescenta-se acima.

// Comandos base do Claude Code que esta camada consegue cumprir mesmo. Deliberadamente curto: só
// entra aqui o que o backend do gestor sabe fazer de facto.
const COMANDOS_CLAUDE: Array<SlashCommand & { accao: AccaoLocal }> = [
  { nome: 'clear', descricao: 'Limpar a conversa e recomeçar do zero', peso: 'leve', origem: 'claude', accao: 'limpar' },
  { nome: 'compact', descricao: 'Libertar o contexto do gestor (o histórico visível mantém-se)', peso: 'leve', origem: 'claude', accao: 'libertar-contexto' },
  { nome: 'cost', descricao: 'Custo acumulado desta conversa', peso: 'leve', origem: 'claude', accao: 'custo' },
  { nome: 'help', descricao: 'Listar os comandos disponíveis', peso: 'leve', origem: 'claude', accao: 'ajuda' },
];

// Nome de comando aceite. O input é do utilizador e acaba a indexar ficheiros — validar a forma
// antes de qualquer lookup, e resolver SEMPRE pela allowlist descoberta em disco (nunca concatenar
// o input a um caminho).
const NOME_VALIDO = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

const CACHE_TTL_MS = 5000;
const CONTEUDO_MAX = 12_000;

interface ComandoJoca extends SlashCommand { origem: 'joca'; path: string }
let cache: { at: number; comandos: ComandoJoca[] } | null = null;

function descricaoDe(conteudo: string, nome: string): string {
  const meta = parseFrontmatter(conteudo);
  if (meta.description) return meta.description;
  // Os comandos do toolkit não têm frontmatter — a descrição vive no H1 (`# /save — texto`).
  for (const linha of conteudo.split(/\r?\n/)) {
    const t = linha.trim();
    if (!t.startsWith('#')) continue;
    const titulo = t.replace(/^#+\s*/, '').replace(new RegExp(`^/?${nome}\\s*[—–-]\\s*`), '').trim();
    if (titulo) return titulo;
    break;
  }
  return '';
}

function comandosJoca(): ComandoJoca[] {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.comandos;
  const comandos: ComandoJoca[] = [];
  for (const item of collectToolkitItems().commands) {
    if (!NOME_VALIDO.test(item.name)) continue;
    let descricao = item.description ?? '';
    if (!descricao) {
      try { descricao = descricaoDe(fs.readFileSync(item.path, 'utf8'), item.name); } catch { /* fica vazia */ }
    }
    comandos.push({
      nome: item.name,
      descricao,
      peso: COMANDOS_PESADOS.has(item.name) ? 'pesado' : 'leve',
      origem: 'joca',
      path: item.path,
    });
  }
  cache = { at: Date.now(), comandos };
  return comandos;
}

/** Lista para o autocomplete do composer. Os do JOCA primeiro, depois os base do Claude Code. */
export function listSlashCommands(): SlashCommand[] {
  const joca = comandosJoca().map(({ nome, descricao, peso, origem }) => ({ nome, descricao, peso, origem }));
  const jaExiste = new Set(joca.map((c) => c.nome));
  // Colisão de nome (ex.: `/status` existe nos dois) → ganha o do JOCA, que é o que este toolkit define.
  const claude = COMANDOS_CLAUDE.filter((c) => !jaExiste.has(c.nome))
    .map(({ nome, descricao, peso, origem }) => ({ nome, descricao, peso, origem }));
  return [...joca, ...claude];
}

// O utilizador pode forçar a delegação de um comando leve. Cobre as formas naturais em PT-PT
// ("manda um agente", "num worker", "com um terminal") sem apanhar frases onde a palavra aparece
// por outro motivo — daí exigir uma preposição/verbo antes.
const PEDE_AGENTE = /\b(?:num?|com|por|manda(?:r)?|usa(?:r)?|através de|atraves de)\s+(?:um\s+|uma\s+|o\s+|a\s+)?(agente|worker|terminal)\b/i;

function sugestoesPara(nome: string, disponiveis: string[]): string[] {
  const alvo = nome.toLowerCase();
  return disponiveis
    .filter((n) => n.toLowerCase().startsWith(alvo.slice(0, 3)) || n.toLowerCase().includes(alvo))
    .slice(0, 5);
}

/**
 * Resolve uma mensagem de chat que comece por `/`.
 * Devolve a instrução a injectar no turno do gestor, ou a decisão de delegar/tratar localmente.
 */
export function resolveSlashCommand(texto: string): ResolucaoSlash {
  const bruto = (texto ?? '').trim();
  if (!bruto.startsWith('/')) return { tipo: 'nenhum' };

  const match = /^\/([^\s]*)\s*([\s\S]*)$/.exec(bruto);
  const nome = (match?.[1] ?? '').trim();
  const args = (match?.[2] ?? '').trim();

  const joca = comandosJoca();
  const nomesConhecidos = [...joca.map((c) => c.nome), ...COMANDOS_CLAUDE.map((c) => c.nome)];
  if (!nome || !NOME_VALIDO.test(nome)) {
    return { tipo: 'desconhecido', nome, sugestoes: nomesConhecidos.slice(0, 5) };
  }

  const alvo = joca.find((c) => c.nome.toLowerCase() === nome.toLowerCase());
  if (!alvo) {
    const base = COMANDOS_CLAUDE.find((c) => c.nome.toLowerCase() === nome.toLowerCase());
    if (base) return { tipo: 'local', nome: base.nome, accao: base.accao };
    return { tipo: 'desconhecido', nome, sugestoes: sugestoesPara(nome, nomesConhecidos) };
  }

  // `alvo.path` vem da allowlist descoberta em disco, não do input — o nome do utilizador só serviu
  // para escolher uma entrada da lista.
  let conteudo = '';
  try { conteudo = fs.readFileSync(alvo.path, 'utf8').slice(0, CONTEUDO_MAX); } catch { conteudo = ''; }
  if (!conteudo) {
    return { tipo: 'desconhecido', nome: alvo.nome, sugestoes: sugestoesPara(alvo.nome, nomesConhecidos) };
  }

  const cabecalho = [
    `[COMANDO /${alvo.nome}] O utilizador escreveu o comando /${alvo.nome} no chat.`,
    args ? `Argumentos que ele deu: ${args}` : '',
  ].filter(Boolean).join('\n');

  const delegar = alvo.peso === 'pesado' || PEDE_AGENTE.test(args);
  if (delegar) {
    return {
      tipo: 'delegar',
      nome: alvo.nome,
      peso: alvo.peso,
      prompt: [
        cabecalho,
        alvo.peso === 'pesado'
          ? 'Este comando é PESADO: não o executes tu.'
          : 'O utilizador pediu explicitamente que fosse um agente a tratar disto.',
        `Despacha um agente com \`trabalhar\`, escolhendo a área adequada. A instrução tem de ser auto-suficiente e dizer-lhe para correr o comando /${alvo.nome} do JOCA — a definição está em ${alvo.path}.`,
        args ? `Passa-lhe também o que o utilizador pediu: ${args}` : '',
        'Responde ao utilizador em uma ou duas frases a dizer o que despachaste. Não esperes pelo agente.',
      ].filter(Boolean).join('\n'),
    };
  }

  return {
    tipo: 'gestor',
    nome: alvo.nome,
    peso: alvo.peso,
    prompt: [
      cabecalho,
      'Este comando é leve: segue-o tu agora, com as ferramentas que tens.',
      'Se algum passo exigir escrever ficheiros ou correr comandos (tu não tens Bash/Write), despacha essa parte a um agente com `trabalhar` e diz que o fizeste.',
      '',
      `--- definição de /${alvo.nome} (${alvo.path}) ---`,
      conteudo,
      '--- fim da definição ---',
    ].join('\n'),
  };
}

/** Texto de erro para um comando desconhecido — claro, em PT-PT, nunca um 500. */
export function mensagemComandoDesconhecido(nome: string, sugestoes: string[]): string {
  const base = nome ? `Não conheço o comando /${nome}.` : 'Falta o nome do comando depois da barra.';
  return sugestoes.length
    ? `${base} Talvez quisesses: ${sugestoes.map((s) => `/${s}`).join(', ')}. Escreve /help para veres a lista.`
    : `${base} Escreve /help para veres a lista.`;
}

/** Lista formatada para o `/help` local. */
export function textoAjuda(): string {
  const linhas = listSlashCommands().map(
    (c) => `/${c.nome}${c.peso === 'pesado' ? ' (agente)' : ''}${c.descricao ? ` — ${c.descricao}` : ''}`,
  );
  return ['Comandos disponíveis:', ...linhas, '', 'Os marcados com (agente) são sempre entregues a um terminal.'].join('\n');
}
