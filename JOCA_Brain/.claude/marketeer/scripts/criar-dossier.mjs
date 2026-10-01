#!/usr/bin/env node
// Cria clientes/<slug>/dossier.md a partir das respostas da entrevista da F0 do `/marketeer <marca>`.
// Uso: echo '<json>' | node "<MKT>/scripts/criar-dossier.mjs" [raiz]   (default: MARKETEER_RAIZ ou a pasta atual)
//      node "<MKT>/scripts/criar-dossier.mjs" --slug "<nome>" | --slug - (nome no stdin)  → imprime só o slug (gerarSlug); 1 se vazio.
// Sai com 0 e imprime o caminho; 2 se o dossier já existe (a skill oferece retomar); 1 noutro erro.
//
// Credenciais nunca entram aqui: vão para o cofre (scripts/guardar-credencial.mjs) e o dossier
// regista só `acesso: true` (D-006).

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { validarDossier, eEntrada, normalizarSite, SEM_FONTE } from './validar-dossier.mjs';
import { raizDados } from './raiz.mjs';

export { SEM_FONTE };
// Igual à de scripts/cofre.mjs: o slug é também o nome do ficheiro do cofre (D-013).
const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

// Minúsculas, sem acentos, kebab, até 60 caracteres (D-013): "Café Pão & Cia." → "cafe-pao-cia".
// ø, ł e ß não se decompõem em NFD: translitera-se antes de retirar o resto.
export function gerarSlug(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

// Texto em falta ou vazio → <sem fonte>. Nunca se preenche com um valor plausível.
function texto(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : SEM_FONTE;
}

// Lista: ausente → <sem fonte> (não se sabe); [] → o operador disse que não há nenhum.
function lista(v) {
  if (!Array.isArray(v)) return SEM_FONTE;
  return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
}

export function dataLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export class DossierJaExiste extends Error {
  constructor(caminho) {
    super(`o dossier já existe: ${caminho} — não se sobrescreve; retomar em vez de criar`);
    this.code = 'EEXIST';
    this.caminho = caminho;
  }
}

// dados: { nome, slug?, sector?, site?, responsavel?, marca?, publico?, objectivos?, concorrentes?,
//          canais?: [{ tipo, id?, acesso }], notas? }
// Só estes campos passam para o dossier — qualquer outro (ex.: uma credencial) é descartado.
export function criarDossier(raiz, dados, { hoje = new Date() } = {}) {
  // Espaços normalizados: uma quebra de linha no nome partia o título `# <nome>` do dossier.
  const nome = typeof dados?.nome === 'string' ? dados.nome.trim().replace(/\s+/g, ' ') : '';
  if (!nome) throw new Error('falta o nome do cliente');
  // `slug` explícito: o nome não gera nenhum (ex.: só símbolos) ou o gerado já é de outro cliente.
  let slug;
  if (dados.slug === undefined) {
    slug = gerarSlug(nome);
    if (!slug) throw new Error('o nome não gera um slug válido — passa "slug" no JSON (minúsculas, algarismos, "-" e "_")');
  } else if (typeof dados.slug === 'string' && SLUG.test(dados.slug)) {
    slug = dados.slug;
  } else {
    throw new Error('"slug" inválido — minúsculas, algarismos, "-" e "_", a começar por letra ou algarismo (D-013)');
  }

  // Antes de tocar no disco: sem esquema → https://; ftp:, javascript: ou texto livre → erro.
  const site = normalizarSite(texto(dados.site));

  const pasta = join(raiz, 'clientes', slug);
  const caminho = join(pasta, 'dossier.md');
  if (existsSync(caminho)) throw new DossierJaExiste(caminho);

  const frontmatter = {
    cliente: {
      nome,
      slug,
      sector: texto(dados.sector),
      site,
      responsavel: texto(dados.responsavel),
    },
    marca: texto(dados.marca),
    publico: texto(dados.publico),
    objectivos: lista(dados.objectivos),
    concorrentes: lista(dados.concorrentes),
    canais: (Array.isArray(dados.canais) ? dados.canais : []).map((c) => ({
      tipo: c?.tipo,
      id: texto(c?.id),
      acesso: c?.acesso === true,
    })),
    estado: 'dossier criado',
    actualizado: dataLocal(hoje),
  };

  const notas = typeof dados.notas === 'string' && dados.notas.trim() ? dados.notas.trim() : SEM_FONTE;
  const conteudo = `---\n${stringify(frontmatter)}---\n\n# ${nome}\n\n${notas}\n`;

  // Validar antes de escrever: um dossier inválido (ou com um segredo) nunca chega ao disco.
  const erros = validarDossier(conteudo, slug);
  if (erros.length) throw new Error(`dossier inválido, nada foi escrito:\n  - ${erros.join('\n  - ')}`);

  mkdirSync(pasta, { recursive: true });
  // `wx`: se outro processo o criou entretanto, falha em vez de sobrescrever.
  try {
    writeFileSync(caminho, conteudo, { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') throw new DossierJaExiste(caminho);
    throw e;
  }
  return { slug, caminho };
}

if (eEntrada(import.meta.url)) {
  try {
    if (process.argv[2] === '--slug') {
      // Subcomando para a skill: evita `node -e` com import de path absoluto (C:/… no Windows).
      // `--slug -` lê o nome do stdin: `--slug - <<'NOME'` não passa por `"$(cat <<'NOME' …)"`, que o
      // bash 3.2 do macOS parte com um número ímpar de apóstrofos no nome (#28: D'Ouro).
      const nome = process.argv[3] === '-' ? readFileSync(0, 'utf8').replace(/\r?\n$/, '') : process.argv[3];
      const slug = gerarSlug(nome);
      if (!slug) throw new Error('--slug: falta o nome, ou o nome não gera um slug válido');
      console.log(slug);
      process.exit(0);
    }
    let dados;
    try {
      dados = JSON.parse(readFileSync(0, 'utf8'));
    } catch {
      // Sem a mensagem original: o Node cita um excerto da entrada.
      throw new Error('a entrada (stdin) não é JSON válido');
    }
    const { caminho } = criarDossier(process.argv[2] ?? raizDados(), dados);
    console.log(caminho);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(e instanceof DossierJaExiste ? 2 : 1);
  }
}
