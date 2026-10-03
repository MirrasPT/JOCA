#!/usr/bin/env node
// Gera agentes de execução a partir de skills — um agente por skill que produz artefactos.
//
// PORQUÊ: uma skill é lida pelo main loop e executada NO contexto principal. Isso serializa o
// trabalho: enquanto o main loop escreve CSS, não faz mais nada. Um agente com a mesma doutrina
// corre em contexto próprio, e vários correm ao mesmo tempo. A skill não é convertida nem copiada —
// continua a ser a fonte de verdade, e o agente lê-a como Step 0. Editar a skill actualiza os dois.
//
// O que o orquestrador ganha: para o mesmo trabalho passa a poder escolher
//   (a) ler a skill e fazer inline    — 1 coisa de cada vez, sem custo de contexto extra
//   (b) despachar <skill>-agent       — paralelo, contexto isolado, ~15x tokens
// A escolha é dele; esta lista é o que torna (b) possível sem inventar um brief de raiz.
//
// NÃO gera para: doutrina/guard-rails (yagni, freeze…) nem routers — essas
// moldam o comportamento da sessão, não produzem trabalho isolável, e como agentes seriam apenas
// ruído na lista de escolha.
//
// Uso:  node .claude/scripts/skill-agents.mjs [--dry] [--force]
//   --dry    mostra o que faria, não escreve
//   --force  reescreve também os agentes gerados que foram editados à mão
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS = path.join(ROOT, '.claude', 'skills');
const AGENTS = path.join(ROOT, '.claude', 'agents');
const MARKER = 'generated-from:';           // marca de agente gerado (permite regenerar em segurança)

const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');

// ── Lista curada ─────────────────────────────────────────────────────────────
// Skills de EXECUÇÃO DIRECTA: produzem código, design, conteúdo ou infraestrutura. Cada uma vira um
// agente despachável. Manter agrupado por categoria — é assim que se decide se uma skill nova entra.
const EXECUTION_SKILLS = {
  'código': [
    'frontend', 'react-composition', 'react-patterns', 'transactional-email', 'tailwind', 'shadcn',
    'mobile', 'laravel-specialist', 'laravel-react', 'filament', 'rest-api',
    'auth', 'caching', 'mysql', 'search', 'webhooks', 'file-storage', 'saas-patterns',
    'browser-automate',
  ],
  'wordpress': [
    'wp-block-development', 'wp-block-themes', 'wp-interactivity-api', 'wp-plugin-development',
    'wp-rest-api', 'wp-wpcli-and-ops', 'woocommerce-elementor',
  ],
  'plataformas': ['shopify-app', 'shopify-theme', 'shopify-store-fixer', 'wix-cli', 'notion'],
  'design': [
    'design-html', 'design-shotgun', 'design-system', 'anima',
    'graphic-design', 'slides', 'landing-page',
  ],
  'conteúdo': [
    'copywriting', 'content-calendar', 'email-sequence', 'social-content', 'social-scheduler',
    'seo', 'seo-local', 'pt-pt-translator', 'stop-slop',
  ],
  'deploy': [
    'deploy-vps', 'deploy-cpanel', 'deploy-docker', 'deploy-ploi', 'cpanel', 'cloudflare-dns',
    'selfhosted-arr',
  ],
  'portugal': ['portugal-payments', 'portugal-invoicing'],
  '3d': ['blender', 'meshy', 'meshy-3d-print'],
};

// ── Código mínimo (F2B.3) ────────────────────────────────────────────────────
// Skills que escrevem código e têm gémeo: o agente lê a referência do código mínimo antes de
// escrever. Mesma lista da F2B.2 (ponteiro nas skills), reduzida às que têm gémeo e sempre à DONA
// actual (component-system → design-system, blender-scripting → blender). Fora de propósito:
// notion (CRUD), design/conteúdo/deploy sem código.
const CODIGO_MINIMO = new Set([
  ...EXECUTION_SKILLS['código'], ...EXECUTION_SKILLS['wordpress'],
  'shopify-app', 'shopify-theme', 'shopify-store-fixer', 'wix-cli',
  'design-html', 'landing-page', 'design-system', 'blender',
  'portugal-payments', 'portugal-invoicing',
]);
const LINHA_CODIGO_MINIMO = 'Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")` — escada + guard-rails.';
const ANCORA_STEP0 = 'Se o brief mencionar outras skills, lê-as também antes de começar.';

// Gerado que não se regenera (hash não bate) recebe só a linha do código mínimo, a seguir à âncora
// do Step 0 — o resto fica como está e o hash não se re-sela (mesma regra de actualizarSugestao).
function actualizarCodigoMinimo(agentFile) {
  const raw = fs.readFileSync(agentFile, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const t = raw.replace(/\r\n/g, '\n');
  if (t.includes('reference/codigo-minimo.md') || !t.includes(ANCORA_STEP0)) return false;
  const out = t.replace(ANCORA_STEP0, `${ANCORA_STEP0}\n${LINHA_CODIGO_MINIMO}`);
  if (!DRY) fs.writeFileSync(agentFile, eol === '\r\n' ? out.replace(/\n/g, '\r\n') : out);
  return true;
}

// ── Sugestão de modelo + effort (F2.9) ───────────────────────────────────────
// Escrita em campos que o Claude Code ignora (`modelo-sugerido`/`effort-sugerido`/`porque-modelo`):
// NÃO activa nada. Quem a aplica é `modelos-agentes.mjs`, e só com o sim do utilizador (passo do
// /install e do /update-joca). Critério: mecânico/determinístico → sonnet + low/medium; juízo de
// código, segurança, design ou orquestração → opus + medium/high.
// Por categoria, com excepções por skill a seguir.
const SUGESTAO_CATEGORIA = {
  'código': ['opus', 'medium', 'escreve código de produção (juízo de código)'],
  'wordpress': ['opus', 'medium', 'escreve código WordPress/WooCommerce'],
  'plataformas': ['opus', 'medium', 'código e configuração de plataforma'],
  'design': ['opus', 'medium', 'juízo de design'],
  'conteúdo': ['sonnet', 'medium', 'escrita guiada pela skill, sem código'],
  'deploy': ['opus', 'medium', 'infraestrutura com passos irreversíveis'],
  'portugal': ['opus', 'high', 'dinheiro e faturação com regras legais'],
  '3d': ['opus', 'medium', 'modelação e scripting 3D'],
};
const SUGESTAO_SKILL = {
  'notion': ['sonnet', 'low', 'operações CRUD no Notion por CLI'],
  'copywriting': ['opus', 'medium', 'copy de conversão pede juízo'],
  'social-scheduler': ['sonnet', 'low', 'agenda posts já escritos'],
  'stop-slop': ['sonnet', 'low', 'limpeza por regras fixas'],
  'selfhosted-arr': ['sonnet', 'medium', 'stack Docker com receitas fixas'],
  'meshy': ['sonnet', 'low', 'chamada à API do Meshy'],
  'meshy-3d-print': ['sonnet', 'medium', 'preparação de impressão por checklist'],
};

// Escolhas do utilizador (gravadas por modelos-agentes.mjs --aplicar). O gerador respeita-as, para
// regenerar não desfazer a escolha. Sem escolha → `model: inherit` e sem `effort:` (o agente herda o
// modelo e o effort da sessão). A sugestão acima fica escrita mas inactiva: só passa a `model:`/`effort:`
// quando o utilizador a confirmar (modelos-agentes.mjs --aplicar, passo do /install e do /update-joca).
const ESCOLHAS_FILE = path.join(ROOT, '.claude', 'modelos-agentes.local.json');
const ESCOLHAS = fs.existsSync(ESCOLHAS_FILE) ? (JSON.parse(fs.readFileSync(ESCOLHAS_FILE, 'utf8')).agentes || {}) : {};

function linhasSugestao(skillName, category) {
  const [sm, se, sp] = SUGESTAO_SKILL[skillName] || SUGESTAO_CATEGORIA[category] || ['inherit', null, 'sem sugestão'];
  return `modelo-sugerido: ${sm}\n${se ? `effort-sugerido: ${se}\n` : ''}porque-modelo: "${sp}"\n`;
}

function linhasModelo(agentName, skillName, category, existente) {
  // Sem escolha guardada, regenerar mantém o model/effort que o ficheiro já tem: o effort por
  // tier não volta a medium só porque o hash foi re-selado.
  const fm = existente ? (existente.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/) || [])[1] : null;
  const actual = fm && fm.match(/^model: *(\S+)/m);
  const e = ESCOLHAS[agentName] || (actual && { model: actual[1], effort: (fm.match(/^effort: *(\S+)/m) || [])[1] });
  const model = e ? e.model : 'inherit';
  const effort = e ? (e.effort ?? null) : null;
  return `model: ${model}\n${effort ? `effort: ${effort}\n` : ''}${linhasSugestao(skillName, category)}`;
}

// Agente gerado que NÃO se regenera (hash não bate: edição manual ou hash velho) recebe só as 3
// linhas de sugestão no frontmatter — corpo, model/effort e o resto ficam como estão, e o hash não
// se re-sela (re-selar entregava as edições manuais a um próximo regenerar). Devolve true se mudou.
function actualizarSugestao(agentFile, skillName, category) {
  const raw = fs.readFileSync(agentFile, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const t = raw.replace(/\r\n/g, '\n');
  const end = t.indexOf('\n---\n', 4);
  if (!t.startsWith('---\n') || end < 0) return false;
  const fm = t.slice(0, end).replace(/^(modelo-sugerido|effort-sugerido|porque-modelo):.*\n?/gm, '').replace(/\n$/, '');
  const ancora = /^effort:.*$/m.test(fm) ? /^effort:.*$/m : /^model:.*$/m;
  if (!ancora.test(fm)) return false;
  const out = fm.replace(ancora, (l) => `${l}\n${linhasSugestao(skillName, category).replace(/\n$/, '')}`) + t.slice(end);
  if (out === t) return false;
  if (!DRY) fs.writeFileSync(agentFile, eol === '\r\n' ? out.replace(/\n/g, '\r\n') : out);
  return true;
}

// ── Frontmatter ──────────────────────────────────────────────────────────────
function parseFrontmatter(rawText) {
  // ⚠ Normalizar CRLF ANTES de parsear. Em Windows com `core.autocrlf=true` as skills chegam do
  // checkout com `\r\n`; o `\r` sobra no fim de cada linha e `(.*)$` nunca casa, porque em JS o
  // `.` não casa terminadores de linha — e `\r` é um deles. Resultado silencioso: frontmatter vazio,
  // agentes gerados sem description nem triggers.
  const text = rawText.replace(/\r\n/g, '\n');
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return {};
  const fm = {};
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim();
    if (['|', '>', '|-', '>-'].includes(val)) {          // block scalar
      const block = [];
      while (++i < lines.length && (!lines[i].trim() || /^[ \t]/.test(lines[i]))) block.push(lines[i].trim());
      i--;
      fm[key] = block.filter(Boolean).join(val.startsWith('>') ? ' ' : '\n');
    } else if (val === '') {
      // Chave sem valor na própria linha → pode ser uma lista YAML nas linhas seguintes
      // (`triggers:` seguido de `  - cpanel`). Sem isto, skills que declaram os gatilhos em lista
      // pareciam não ter nenhum, e o agente saía do gerador sem triggers.
      const items = [];
      while (++i < lines.length && /^\s+-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''));
      }
      i--;
      fm[key] = items.join(', ');
    } else {
      fm[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return fm;
}

// A description do agente diz QUANDO despachá-lo, não repete a skill: name+description de TODOS os
// agentes entram no system prompt de TODAS as sessões, portanto cada caracter aqui é custo
// recorrente. Orçamento total dos 110 agentes: <2k tokens. Daí `MAX_DESC` em caracteres e nada de
// boilerplate — a frase "Despachar para trabalho isolável deste domínio, em paralelo." custava
// sozinha ~1.1k tokens por sessão (repetida em 70 agentes) e não ajudava a escolher nenhum.
//
// O que fica: 2-4 PALAVRAS-GATILHO do domínio. É por elas que o main loop escolhe o agente; uma
// frase de prosa truncada matcha pior e custa mais. A categoria também saiu: os nomes já a dizem
// (`wp-*`, `deploy-*`, `shopify-*`, `unity-*`, `blender-*`) e continua no campo `category:`.
const MAX_DESC = 34;

// Gatilhos primários declarados em prosa na description da skill ("MUST be invoked when the user
// says: a, b, c"). São curados, ao contrário do `triggers:`, cuja cauda começa por vezes em casos
// de nicho — daí a prosa vir primeiro.
// ⚠ Capturar até ao fim da LINHA, não até ao primeiro ponto: `block.json`, `next.js` e
// `components.json` são gatilhos com ponto lá dentro, e um `[^\n.]+` decapitava-os ("block").
// A cauda de prosa que entra por causa disso cai nos filtros por item (palavras a mais, ':').
const MUST_LIST = /(?:MUST (?:be )?invoke(?:d)? when(?:ever)? the user (?:says|mentions)|SHOULD also invoke when|Invocar quando o utilizador disser|Invocar quando|Invoke on|Invoke when|Triggers?):\s*([^\n]+)/i;

// Descartar entradas ruidosas: frases longas, sinónimos com palavras a mais, duplicados por caixa.
// `relaxed` é a 2ª passagem, para skills cujo único gatilho é comprido ("WordPress Interactivity
// API"): mais vale um gatilho longo do que uma oração de prosa cortada a meio.
function keywordPool(fm, relaxed = false) {
  const maxLen = relaxed ? 30 : 22;
  const maxWords = relaxed ? 4 : 3;
  const raw = [];
  const m = (fm.description || '').match(MUST_LIST);
  if (m) raw.push(...m[1].split(','));
  if (fm.triggers) raw.push(...fm.triggers.split(','));
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const clean = item.trim().replace(/^["'`]+|["'`.]+$/g, '').trim();
    if (!clean || clean.includes(':')) continue;
    if (clean.length > maxLen || clean.split(/\s+/).length > maxWords) continue;
    // Chave sem artigos/preposições: "codificar o design" e "codificar design" são o mesmo gatilho,
    // e pagar as duas variantes em todas as sessões não compra matching nenhum.
    const key = clean.toLowerCase().replace(/\b(o|a|os|as|um|uma|de|do|da|em|the|for|to)\b/g, '').replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

// Primeira oração da skill, cortada na fronteira de palavra. Só entra quando não há gatilhos.
function firstClause(fm, budget) {
  let what = (fm.description || '')
    .split(/(?:\.\s|MUST be invoked|MUST invoke|SHOULD also invoke|SHOULD invoke|Invoke on|Invoke when|Invoke at|Invocar quando|Triggers?:)/)[0]
    .replace(/^["']|["']$/g, '')
    .trim();
  if (what.length > budget) {
    what = what.slice(0, budget);
    const cut = what.lastIndexOf(' ');
    if (cut > 8) what = what.slice(0, cut);
  }
  return what.replace(/[,;:\s—-]+$/, '');
}

function pick(pool, budget) {
  const picked = [];
  for (const kw of pool) {
    // Gatilho contido noutro já escolhido ("admin" depois de "admin panel", "deploy to ploi"
    // depois de "ploi") não acrescenta matching e ocupa o lugar de um termo diferente.
    const low = kw.toLowerCase();
    if (picked.some((p) => p.toLowerCase().includes(low) || low.includes(p.toLowerCase()))) continue;
    // Um gatilho que não cabe não trava os seguintes — o próximo pode ser curto.
    if (picked.concat(kw).join(', ').length > budget) continue;
    picked.push(kw);
    if (picked.length === 4) break;
  }
  return picked;
}

function agentDescription(skillName, fm, category) {
  for (const relaxed of [false, true]) {
    const pool = keywordPool(fm, relaxed);
    let picked = pick(pool, MAX_DESC);
    // Um gatilho só é pouco para escolher entre 110 agentes: esticar o orçamento uma vez, para
    // caber um segundo termo. Só paga onde faz falta (4 skills), não nos 66 que já têm 3-4.
    if (picked.length < 2) picked = pick(pool, MAX_DESC + 10);
    if (picked.length >= 2) return picked.join(', ');
    if (relaxed && picked.length === 1) {
      // Um gatilho só: juntar a oração da skill SÓ se couber inteira. Meia oração ("Building or")
      // não ajuda a escolher agente nenhum e paga-se em todas as sessões.
      const rest = firstClause(fm, 999);
      const joined = `${picked[0]}, ${rest}`;
      return rest && joined.length <= MAX_DESC + 6 ? joined : picked[0];
    }
  }
  return firstClause(fm, MAX_DESC);
}

// Os triggers herdados chegam a ter 22 entradas (tailwind). Servem descoberta no SKILL_INDEX, não
// activação fina — 6 chegam, e a skill mantém a lista completa.
//
// Nem toda a skill tem `triggers:` no frontmatter: em muitas os gatilhos vivem em prosa dentro da
// description ("Invoke on: a, b, c"). Sem os extrair daqui também, o agente entrava no índice sem
// gatilho nenhum — inalcançável por palavra-chave, que é exactamente o problema que acabámos de
// corrigir nas skills. Mesmos padrões que build-skill-index.py.
const PROSE_TRIGGERS = /(?:MUST be invoked when(?:ever)? the user (?:says|mentions)|SHOULD also invoke when|Invocar quando o utilizador disser|Invocar quando|Invoke on|Invoke when|Triggers?):\s*([^\n]+?)(?:\.\s|\.$|$)/gi;

function agentTriggers(fm) {
  let list = [];
  if (fm.triggers) {
    list = fm.triggers.split(',').map((t) => t.trim()).filter(Boolean);
  } else {
    for (const m of (fm.description || '').matchAll(PROSE_TRIGGERS)) {
      for (const item of m[1].split(',')) {
        const clean = item.trim().replace(/^["'`]|["'`]$/g, '').replace(/\.$/, '').trim();
        if (clean && clean.length <= 60 && clean.split(' ').length <= 7) list.push(clean);
      }
    }
  }
  const seen = new Set();
  const unique = list.filter((t) => !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
  return unique.length ? `triggers: ${unique.slice(0, 6).join(', ')}\n` : '';
}

// ── Bloco de segurança de base de dados ──────────────────────────────────────
// A regra nasceu escrita À MÃO nos dois agentes abaixo. Escrita à mão, ela vive só até alguém
// correr este script com `--force`: o `content-hash` protege edições manuais na corrida normal,
// mas o `--force` existe exactamente para as ignorar. Por isso a regra entra no CORPO GERADO —
// um `--force` reescreve-a em vez de a apagar.
//
// Só entra nos agentes cujo domínio corre Artisan/migrations contra uma base de dados real.
// Acrescentar uma skill aqui é a única coisa precisa para lhe dar o bloco.
const SKILLS_COM_BASE_DE_DADOS = new Set(['laravel-specialist', 'filament']);

const BLOCO_BASE_DE_DADOS = `
### ⚠ Antes de correr testes ou migrations

\`RefreshDatabase\`/\`migrate:fresh\` sem \`.env.testing\` apontam o comando à base de dados de
desenvolvimento e apagam-na: sem o ficheiro de teste o Artisan cai no \`.env\`. Provar a ligação de
teste na raiz da app Laravel **antes** de correr:

\`\`\`bash
test -f .env.testing || echo 'SEM .env.testing — PARAR e reportar'
php artisan db:show --env=testing    # ler o nome da BD antes de escrever nela
\`\`\`

Ficheiro em falta, **ou** nome de BD igual ao de desenvolvimento → **parar e reportar**, não correr.
\`migrate:fresh\` é irreversível: devolve-se ao caller como proposta, nunca se executa.
`;

// Skills cujo trabalho sobrepoe uma arvore (ou uma BD) a outra: restauro, rsync --delete, deploy
// por pacote completo. Acrescentar uma skill aqui e a unica coisa precisa para lhe dar o bloco.
const SKILLS_COM_SYNC_DESTRUTIVO = new Set(['deploy-cpanel']);

const BLOCO_SYNC_DESTRUTIVO = `
### ⚠ Antes de um restauro ou de um sync destrutivo

Antes de **qualquer** restauro (AIO, backup completo, dump de BD), \`rsync --delete\`, ou sobreposicao
de uma arvore por outra: **produz e mostra o inventario do que existe SO NO DESTINO** — a lista do
que vai desaparecer. Corre **antes** de escrever, nao depois.

\`\`\`bash
rsync -avn --delete --itemize-changes <origem>/ <destino>/ | grep -i deleting
diff <(ssh <destino> 'ls -1 <dir>') <(ls -1 <dir>)   # quando o rsync nao existe no alojamento
\`\`\`

Ensaia com um ficheiro plantado so no destino: se a corrida a seco nao o nomear, o inventario esta
cego e nao avancas. Um \`--dry-run\`/\`--itemize-changes\` conta; «a pasta parece igual», o total de
ficheiros bater e o «concluido» da ferramenta **nao contam**.

Inventario vazio e resultado e diz-se. Inventario **nao vazio** → paras e devolves a lista ao caller
como proposta (e irreversivel); nunca a resumas nem a filtres. Doutrina completa:
\`.claude/reference/gates-runtime.md\`, categoria «Restauro · \`rsync --delete\`».
`;

function agentBody(skillName, fm) {
  const triggers = fm.triggers ? `\n**Gatilhos:** ${fm.triggers}\n` : '\n';
  const baseDeDados = SKILLS_COM_BASE_DE_DADOS.has(skillName) ? BLOCO_BASE_DE_DADOS : '';
  const syncDestrutivo = SKILLS_COM_SYNC_DESTRUTIVO.has(skillName) ? BLOCO_SYNC_DESTRUTIVO : '';
  const codigoMinimo = CODIGO_MINIMO.has(skillName) ? `${LINHA_CODIGO_MINIMO}\n` : '';
  return `# ${skillName} — agente de execução

Especialista em ${skillName}. Corre em contexto próprio para que o orquestrador possa despachar
vários trabalhos ao mesmo tempo sem bloquear a conversa principal.
${triggers}
## Step 0 — obrigatório, antes de qualquer acção

\`\`\`
Read(".claude/skills/${skillName}.md")
\`\`\`

Essa skill é a fonte de verdade deste agente. **Não** foi copiada para aqui de propósito: quando a
skill é editada, este agente passa a seguir a versão nova sem regeneração. Não age antes de a ler —
o campo \`skills:\` do frontmatter não a carrega sozinho.

${ANCORA_STEP0}
${codigoMinimo}${baseDeDados}${syncDestrutivo}
## Como trabalhar

1. Lê a skill (Step 0) e o brief que recebeste.
2. Confirma o estado real antes de mudar: lê os ficheiros que vais tocar. Não assumas estrutura.
3. Executa **só** o que o brief pede. Não "melhores" código adjacente, não acrescentes features
   que ninguém pediu.
4. Segue as convenções do projecto onde estás (CLAUDE.md do projecto, padrões do código à volta)
   acima dos defaults da skill.
5. Valida o que fizeste (build, testes, ou o critério de pronto que o brief definir).

## Limites

- **Não despachas outros agentes.** A árvore tem um nível: main loop → workers. Se o trabalho
  precisa de fan-out, devolve isso como recomendação e o caller decide.
- **Não inventas** paths, APIs, chaves ou endpoints. Falta uma credencial ou não encontras um
  ficheiro → deixa \`TODO: <o que falta>\` e reporta. Um valor plausível inventado passa no build e
  só rebenta em produção.
- **Irreversível** (deploy, push, migration, delete, pagamento) → não executas; devolve como
  proposta para o caller confirmar.
- Output volumoso (relatórios, listagens longas) → escreve em ficheiro e devolve o path, não
  despejes tudo no relatório.

## Relatório final

Curto e accionável:
- o que ficou feito, em uma ou duas frases;
- ficheiros tocados (paths);
- o que validaste e como;
- o que ficou por fazer (com o motivo) e o próximo passo que recomendas.
`;
}

// ── Detecção de edições manuais ──────────────────────────────────────────────
// O hash cobre tudo menos a própria linha do hash.
// Normalizado a LF: com `core.autocrlf=true` o checkout reescreve o ficheiro em CRLF e o hash deixava
// de bater — os 70 gerados passavam a ler-se como "editados à mão" noutra máquina.
const HASH_LINE = /^content-hash: .*$\n?/m;
const bodyHash = (text) =>
  crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n').replace(HASH_LINE, '')).digest('hex').slice(0, 16);
const storedHash = (text) => (text.match(/^content-hash: (\w+)$/m) || [])[1] || '';

// ── Geração ──────────────────────────────────────────────────────────────────
const written = [], skipped = [], missing = [], manual = [], sugestaoSo = [], codigoMinimoSo = [];

for (const [category, skills] of Object.entries(EXECUTION_SKILLS)) {
  for (const skillName of skills) {
    const skillFile = path.join(SKILLS, `${skillName}.md`);
    if (!fs.existsSync(skillFile)) { missing.push(skillName); continue; }

    const agentName = `${skillName}-agent`;
    const agentFile = path.join(AGENTS, `${agentName}.md`);

    // Nunca pisar um agente curado à mão nem uma edição manual num gerado.
    //
    // Um agente gerado leva o hash do que foi gerado. Se o ficheiro em disco já não corresponde ao
    // seu próprio hash, alguém o editou — e regenerar apagaria esse trabalho em silêncio. Sem isto,
    // correr o script uma segunda vez destrói qualquer personalização.
    const existing = fs.existsSync(agentFile) ? fs.readFileSync(agentFile, 'utf8') : null;
    if (existing) {
      if (!existing.includes(MARKER)) { manual.push(agentName); continue; }   // curado à mão
      if (!FORCE && bodyHash(existing) !== storedHash(existing)) {
        manual.push(agentName);
        if (actualizarSugestao(agentFile, skillName, category)) sugestaoSo.push(agentName);
        if (CODIGO_MINIMO.has(skillName) && actualizarCodigoMinimo(agentFile)) codigoMinimoSo.push(agentName);
        continue;
      }
    }

    const fm = parseFrontmatter(fs.readFileSync(skillFile, 'utf8'));
    const content = `---
name: ${agentName}
description: "${agentDescription(skillName, fm, category).replace(/"/g, "'")}"
skills: ${skillName}
${linhasModelo(agentName, skillName, category, existing)}category: ${category}
${agentTriggers(fm)}${MARKER} .claude/skills/${skillName}.md
generated-by: skill-agents.mjs
---

${agentBody(skillName, fm)}`;

    if (DRY) { written.push(agentName); continue; }
    // Selar com o hash do próprio conteúdo, para a próxima corrida saber se foi tocado.
    const sealed = content.replace(/^generated-by: skill-agents\.mjs$/m,
      `generated-by: skill-agents.mjs\ncontent-hash: ${bodyHash(content)}`);
    fs.writeFileSync(agentFile, sealed);
    written.push(agentName);
  }
}

const total = Object.values(EXECUTION_SKILLS).flat().length;
console.log(`[skill-agents] ${DRY ? '(dry) ' : ''}${written.length}/${total} agentes gerados em .claude/agents/`);
for (const [cat, list] of Object.entries(EXECUTION_SKILLS)) {
  console.log(`  ${cat}: ${list.length}`);
}
if (manual.length) console.log(`[skill-agents] preservados (editados à mão ou curados): ${manual.join(', ')}`);
if (sugestaoSo.length) console.log(`[skill-agents] ${DRY ? '(dry) ' : ''}só sugestão de modelo actualizada (corpo intacto): ${sugestaoSo.length}`);
if (codigoMinimoSo.length) console.log(`[skill-agents] ${DRY ? '(dry) ' : ''}só linha do código mínimo acrescentada (corpo intacto): ${codigoMinimoSo.length}`);
if (missing.length) console.log(`[skill-agents] AVISO — skills na lista mas sem ficheiro: ${missing.join(', ')}`);
if (skipped.length) console.log(`[skill-agents] ignorados: ${skipped.join(', ')}`);
console.log('[skill-agents] a seguir: python3 .claude/scripts/build-skill-index.py');
