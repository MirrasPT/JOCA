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
// NÃO gera para: doutrina/guard-rails (yagni, karpathy-guidelines, freeze…) nem routers — essas
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
    'frontend', 'react-composition', 'react-patterns', 'react-email', 'tailwind', 'shadcn',
    'component-system', 'mobile', 'laravel-specialist', 'laravel-react', 'filament', 'rest-api',
    'auth', 'caching', 'queues', 'mysql', 'search', 'webhooks', 'file-storage', 'saas-patterns',
    'transactional-email', 'browser-automate', 'automations',
  ],
  'wordpress': [
    'wp-block-development', 'wp-block-themes', 'wp-interactivity-api', 'wp-plugin-development',
    'wp-rest-api', 'wp-wpcli-and-ops', 'wpds', 'woocommerce-elementor',
  ],
  'plataformas': ['shopify-app', 'shopify-theme', 'shopify-store-fixer', 'wix-cli', 'notion'],
  'design': [
    'design-html', 'design-shotgun', 'design-system', 'design-tokens', 'anima', 'lottie-animator',
    'graphic-design', 'img-gen', 'slides', 'remotion', 'landing-page',
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
};

// ── Frontmatter ──────────────────────────────────────────────────────────────
function parseFrontmatter(text) {
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
// recorrente. Sem este aperto, 65 agentes custavam ~9.5k tokens por sessão em vez de ~2k.
const MAX_DESC = 100;

function agentDescription(skillName, fm, category) {
  const first = (fm.description || '')
    .split(/(?:\.\s|MUST be invoked|SHOULD also invoke|Invoke on|Invoke when|Invoke at|Invocar quando|Triggers?:)/)[0]
    .replace(/^["']|["']$/g, '')
    .trim();
  // Corte na fronteira de palavra — 'dark.' a meio de 'dark mode' não ajuda ninguém a decidir.
  let what = first;
  if (what.length > MAX_DESC) {
    what = what.slice(0, MAX_DESC);
    const cut = what.lastIndexOf(' ');
    if (cut > 40) what = what.slice(0, cut);
  }
  what = what.replace(/[,;:\s—-]+$/, '');
  return `${category} · ${what}. Despachar para trabalho isolável deste domínio, em paralelo.`;
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

function agentBody(skillName, fm) {
  const triggers = fm.triggers ? `\n**Gatilhos:** ${fm.triggers}\n` : '\n';
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

Se o brief mencionar outras skills, lê-as também antes de começar.

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
const HASH_LINE = /^content-hash: .*$\n?/m;
const bodyHash = (text) => crypto.createHash('sha256').update(text.replace(HASH_LINE, '')).digest('hex').slice(0, 16);
const storedHash = (text) => (text.match(/^content-hash: (\w+)$/m) || [])[1] || '';

// ── Geração ──────────────────────────────────────────────────────────────────
const written = [], skipped = [], missing = [], manual = [];

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
    if (fs.existsSync(agentFile)) {
      const existing = fs.readFileSync(agentFile, 'utf8');
      if (!existing.includes(MARKER)) { manual.push(agentName); continue; }   // curado à mão
      if (!FORCE && bodyHash(existing) !== storedHash(existing)) { manual.push(agentName); continue; }
    }

    const fm = parseFrontmatter(fs.readFileSync(skillFile, 'utf8'));
    const content = `---
name: ${agentName}
description: "${agentDescription(skillName, fm, category).replace(/"/g, "'")}"
skills: ${skillName}
model: inherit
category: ${category}
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
if (missing.length) console.log(`[skill-agents] AVISO — skills na lista mas sem ficheiro: ${missing.join(', ')}`);
if (skipped.length) console.log(`[skill-agents] ignorados: ${skipped.join(', ')}`);
console.log('[skill-agents] a seguir: python3 .claude/scripts/build-skill-index.py');
