#!/usr/bin/env node
// Valida os dossiers e as auditorias de clientes: formato e ausência de segredos.
// Uso: node "<MKT>/scripts/validar-dossier.mjs" [pasta-ou-ficheiro ...]   (default: $MARKETEER_RAIZ/clientes, ou ./clientes)
// Sai com código 1 se algum dossier falhar.

import { readFileSync, readdirSync, statSync, existsSync, realpathSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { validarAuditoria } from './auditoria/formato.mjs';
import { validarContentor } from './tracking/gtm.mjs';
import { raizDados } from './raiz.mjs';
import { validarEstado } from './estado.mjs';

export const SEM_FONTE = '<sem fonte>';

export const TIPOS_DE_CANAL = [
  'ga4', 'gtm', 'gbp', 'search-console', 'meta', 'google-ads', 'linkedin',
  'instagram', 'facebook', 'tiktok', 'youtube', 'x', 'trypost', 'email', 'outro',
];

// Padrões de credenciais conhecidas. Falso positivo custa uma frase; falso negativo põe um
// segredo de cliente num repo partilhado (docs/DECISIONS.md D-006).
const PADROES_DE_SEGREDO = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'chave de API (sk-)'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'chave Google API'],
  [/\bya29\.[0-9A-Za-z_-]{20,}/, 'token OAuth Google'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'token GitHub'],
  [/\bEAA[A-Za-z0-9]{30,}/, 'token Meta'],
  [/\bxox[abpr]-[A-Za-z0-9-]{10,}/, 'token Slack'],
  [/hooks\.slack\.com\/services\//, 'webhook Slack'],
  [/\bGOCSPX-[A-Za-z0-9_-]{20,}/, 'client secret OAuth Google'],
  [/\b1\/\/0[A-Za-z0-9_-]{30,}/, 'refresh token Google'],
  [/\beyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/, 'JWT'],
  [/\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i, 'URL com credenciais'],
  [/\b(sk|rk)_live_[A-Za-z0-9]{10,}/, 'chave Stripe'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, 'token GitHub'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'chave AWS'],
  [/\b(password|passwd|pwd|senha|palavra[- ]passe)\b[^\n:=]{0,30}[:=]\s*\S+/i, 'palavra-passe em texto'],
];
const CHAVES_PROIBIDAS = /(pass(word|wd)?|senha|palavra[-_]?passe|secret|segredo|token|api[-_]?key|private[-_]?key|credential)/i;

// Os módulos de auditoria fazem `new URL(site)`: o site é um URL http(s) absoluto com domínio
// (hostname com ponto) ou <sem fonte>. `padaria.pt` sem esquema partia a 1.ª auditoria (#25).
const MSG_SITE = '"cliente.site" tem de ser um URL http(s) absoluto (ex.: https://padaria.pt/) ou <sem fonte>';

function urlDeSite(texto) {
  try {
    const u = new URL(texto);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.') ? u : null;
  } catch {
    return null;
  }
}

// Sem esquema → https:// ; devolve o `.href`. Um esquema explícito (ftp:, javascript:, mailto:) não
// se prefixa — é recusado. `dominio.pt:8080` é porta, não esquema. Erro sem ecoar a entrada.
export function normalizarSite(texto) {
  const t = String(texto ?? '').trim();
  if (t === SEM_FONTE) return t;
  const temEsquema = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(t);
  const u = urlDeSite(temEsquema ? t : `https://${t}`);
  if (!u) throw new Error(MSG_SITE);
  return u.href;
}

function separarFrontmatter(texto) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { yaml: m[1], corpo: m[2] } : null;
}

function procurarChavesProibidas(valor, caminho, erros) {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => procurarChavesProibidas(v, `${caminho}[${i}].`, erros));
  } else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      if (CHAVES_PROIBIDAS.test(k)) erros.push(`campo proibido "${caminho}${k}" — credenciais vão para ~/.config/marketeer/, não para o dossier`);
      procurarChavesProibidas(v, `${caminho}${k}.`, erros);
    }
  }
}

export function procurarSegredos(texto) {
  return PADROES_DE_SEGREDO.filter(([re]) => re.test(texto))
    .map(([, nome]) => `parece conter um segredo (${nome}) — remover e guardar no cofre local`);
}

export function validarDossier(texto, slugEsperado) {
  texto = texto.replace(/^\uFEFF/, '');
  const erros = procurarSegredos(texto);

  const partes = separarFrontmatter(texto);
  if (!partes) return [...erros, 'sem frontmatter YAML (--- ... ---) no início'];

  let d;
  try {
    d = parse(partes.yaml);
  } catch (e) {
    return [...erros, `YAML inválido: ${e.message.split('\n')[0]}`];
  }
  if (!d || typeof d !== 'object') return [...erros, 'frontmatter vazio'];

  procurarChavesProibidas(d, '', erros);

  const c = d.cliente;
  if (!c || typeof c !== 'object') {
    erros.push('falta o bloco "cliente"');
  } else {
    for (const campo of ['nome', 'slug', 'site']) {
      if (typeof c[campo] !== 'string' || !c[campo].trim()) erros.push(`falta "cliente.${campo}"`);
    }
    if (typeof c.site === 'string' && c.site.trim() && c.site !== SEM_FONTE && !urlDeSite(c.site)) {
      erros.push(MSG_SITE);
    }
    if (typeof c.slug === 'string' && !/^[a-z0-9_][a-z0-9_-]*$/.test(c.slug)) {
      erros.push(`"cliente.slug" (${c.slug}) só pode ter minúsculas, algarismos, "-" e "_" (D-013)`);
    }
    if (slugEsperado && c.slug && c.slug !== slugEsperado) {
      erros.push(`"cliente.slug" (${c.slug}) não bate com a pasta (${slugEsperado})`);
    }
  }

  if (!Array.isArray(d.canais)) {
    erros.push('"canais" tem de ser uma lista (pode ser vazia)');
  } else {
    d.canais.forEach((canal, i) => {
      if (!TIPOS_DE_CANAL.includes(canal?.tipo)) erros.push(`canais[${i}].tipo inválido: ${canal?.tipo}`);
      if (typeof canal?.acesso !== 'boolean') erros.push(`canais[${i}].acesso tem de ser true/false`);
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.actualizado ?? ''))) {
    erros.push('"actualizado" tem de ser uma data AAAA-MM-DD');
  }

  return erros;
}

// Auditoria: segredos e campos de credenciais como no dossier, mais o formato (auditoria/formato.mjs).
export function validarFicheiroAuditoria(texto, slugEsperado, nomeDoFicheiro) {
  const erros = procurarSegredos(texto);
  try {
    procurarChavesProibidas(JSON.parse(texto.replace(/^\uFEFF/, '')), '', erros);
  } catch {
    // JSON inválido: validarAuditoria reporta.
  }
  return [...erros, ...validarAuditoria(texto, slugEsperado, nomeDoFicheiro)];
}

// clientes/<slug>/estado.json (CONTRATO §3): segredos no texto e a forma do estadoPadrao
// (estado.mjs → validarEstado). As chaves validam-se por lista branca — chave fora dela é erro, logo
// um campo de credencial também; a lista negra CHAVES_PROIBIDAS não serve aqui ("passos" ⊃ "pass").
export function validarFicheiroEstado(texto, slugEsperado) {
  const erros = procurarSegredos(texto);
  let e;
  try {
    e = JSON.parse(texto.replace(/^\uFEFF/, ''));
  } catch {
    return [...erros, 'estado.json não é JSON válido'];
  }
  return [...erros, ...validarEstado(e, slugEsperado)];
}

// Todos os ficheiros de texto: os segredos procuram-se em tudo (auditorias, notas), o formato só
// nos dossier.md e em auditorias/*.json.
function listarFicheiros(alvo) {
  if (!existsSync(alvo)) return [];
  if (statSync(alvo).isFile()) return [alvo];
  return readdirSync(alvo).flatMap((nome) => listarFicheiros(join(alvo, nome)));
}

const TEXTO = /\.(md|json|txt|ya?ml|csv|env|html?)$/i;

// Comparar caminhos reais: via symlink (macOS /tmp, pastas ligadas) o argv[1] e o import.meta.url
// divergem e o script sairia com 0 sem ter feito nada.
export function eEntrada(metaUrl) {
  try {
    const a = realpathSync(process.argv[1] ?? '');
    const b = realpathSync(fileURLToPath(metaUrl));
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch {
    return false;
  }
}

if (eEntrada(import.meta.url)) {
  const alvos = process.argv.slice(2);
  const ficheiros = (alvos.length ? alvos : [join(raizDados(), 'clientes')]).flatMap(listarFicheiros).filter((f) => TEXTO.test(f));
  let falhas = 0;
  let dossiers = 0;
  for (const f of ficheiros) {
    const texto = readFileSync(f, 'utf8');
    const eDossier = basename(f) === 'dossier.md';
    const eJson = /\.json$/i.test(f);
    // Caminho a partir de clientes/: [<slug>, 'auditorias', '<nome>.json'] é a única forma válida
    // de um .json dentro de um cliente — noutro sítio escaparia à validação do formato.
    const partes = f.split(/[\\/]/);
    const i = partes.lastIndexOf('clientes');
    const rel = i >= 0 ? partes.slice(i + 1) : null;
    const eAuditoria = eJson && (rel ? rel.length === 3 && rel[1] === 'auditorias' : basename(dirname(f)) === 'auditorias');
    // Contentor GTM gerado pelo `tracking/gtm.mjs` (D-021): clientes/<slug>/tracking/contentor-GTM-….json.
    const eContentor = eJson && rel && rel.length === 3 && rel[1] === 'tracking' && /^contentor-GTM-[A-Z0-9]+(-\d+)?\.json$/.test(rel[2]);
    // Estado do ciclo (CONTRATO §3): clientes/<slug>/estado.json, escrito pelo estado.mjs.
    const eEstado = eJson && rel && rel.length === 2 && rel[1] === 'estado.json';
    const jsonFora = eJson && !eAuditoria && !eContentor && !eEstado && rel && rel.length >= 2;
    if (eDossier) dossiers++;
    const erros = eDossier
      ? validarDossier(texto, basename(dirname(f)))
      : eAuditoria
        ? validarFicheiroAuditoria(texto, basename(dirname(dirname(f))), basename(f).replace(/\.json$/i, ''))
        : eContentor
          ? [...procurarSegredos(texto), ...validarContentor(texto)]
          : eEstado
          ? validarFicheiroEstado(texto, rel[0])
          : jsonFora
          ? [...procurarSegredos(texto), 'JSON fora de auditorias/ — as auditorias vivem em clientes/<slug>/auditorias/<nome>.json']
          : procurarSegredos(texto);
    if (erros.length) {
      falhas++;
      console.error(`✗ ${f}`);
      for (const e of erros) console.error(`  - ${e}`);
    } else {
      console.log(`✓ ${f}`);
    }
  }
  // Zero dossiers é erro: o _exemplo existe sempre, logo 0 significa que a validação não correu.
  if (!dossiers) {
    console.error('✗ nenhum dossier encontrado — nada foi validado');
    process.exit(1);
  }
  process.exit(falhas ? 1 : 0);
}
