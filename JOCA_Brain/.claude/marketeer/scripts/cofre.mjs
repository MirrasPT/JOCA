// Cofre de credenciais por cliente, fora do repo: ~/.config/marketeer/<slug>.env (D-006).
// Uso: import { guardar, ler } from './scripts/cofre.mjs'
//
// Nenhum valor sai daqui para stdout/stderr nem para mensagens de erro — os erros nomeiam só o
// slug e a chave (.claude/rules/dados-de-clientes.md).

import { readFileSync, writeFileSync, renameSync, mkdirSync, chmodSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';

// O slug vira nome de ficheiro: sem `..` nem separadores, senão escrevia-se fora da pasta do cofre.
// Só minúsculas: "Cliente" e "cliente" são o mesmo ficheiro em macOS/Windows e dois em Linux (D-013).
const SLUG = /^[a-z0-9][a-z0-9_-]*$/;
// A chave vira o lado esquerdo de uma linha KEY=valor: um `=` ou quebra de linha partia o ficheiro.
const CHAVE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function validar(slug, chave) {
  if (typeof slug !== 'string' || !SLUG.test(slug)) throw new Error(`cofre: slug inválido "${slug}"`);
  if (typeof chave !== 'string' || !CHAVE.test(chave)) throw new Error(`cofre: chave inválida "${chave}" (${slug})`);
}

// `base` existe para os testes não tocarem no ~ real.
function ficheiro(slug, base) {
  return join(base ?? join(homedir(), '.config', 'marketeer'), `${slug}.env`);
}

function lerLinhas(caminho, slug, chave, acao = 'ler') {
  try {
    // Um BOM (editores no Windows) colava-se à primeira chave e tornava-a impossível de encontrar.
    return readFileSync(caminho, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    // Só o código do erro: a mensagem original traz o caminho, e aqui nunca há valor a vazar.
    throw new Error(`cofre: não foi possível ${acao} "${chave}" de ${slug} (${e.code})`);
  }
}

function procurar(linhas, chave) {
  return linhas.findIndex((l) => {
    // Sem `=` o indexOf dá -1 e o slice(0, -1) cortava o último carácter: `TOKENx` passava por `TOKEN`.
    const j = l.indexOf('=');
    return j > 0 && l.slice(0, j) === chave;
  });
}

export function ler(slug, chave, { base } = {}) {
  validar(slug, chave);
  const linhas = lerLinhas(ficheiro(slug, base), slug, chave);
  const i = procurar(linhas, chave);
  return i < 0 ? null : linhas[i].slice(chave.length + 1);
}

export function guardar(slug, chave, valor, { base } = {}) {
  validar(slug, chave);
  // Uma quebra de linha no valor criava uma linha nova — i.e. outra chave. O valor não entra na mensagem.
  if (typeof valor !== 'string' || /[\r\n]/.test(valor)) {
    throw new Error(`cofre: valor de "${chave}" (${slug}) tem de ser texto numa só linha`);
  }
  const caminho = ficheiro(slug, base);
  const linhas = lerLinhas(caminho, slug, chave, 'guardar').filter((l) => l !== '');
  const i = procurar(linhas, chave);
  if (i < 0) linhas.push(`${chave}=${valor}`);
  else linhas[i] = `${chave}=${valor}`;

  // Ficheiro temporário novo (o `mode` só se aplica na criação) + rename: o valor nunca fica
  // num ficheiro com permissões abertas, nem a meio de escrever. Nome aleatório + `wx` (O_EXCL):
  // um symlink plantado no caminho do temporário faz falhar a escrita em vez de ser seguido.
  const tmp = `${caminho}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    mkdirSync(dirname(caminho), { recursive: true, mode: 0o700 });
    // O `mode` do mkdir só vale se for ele a criar a pasta: uma que já existia aberta ficava como estava.
    if (process.platform !== 'win32') chmodSync(dirname(caminho), 0o700);
    writeFileSync(tmp, linhas.join('\n') + '\n', { mode: 0o600, flag: 'wx' });
    chmodSync(tmp, 0o600);
    renameSync(tmp, caminho);
  } catch (e) {
    rmSync(tmp, { force: true }); // não deixar uma cópia do valor para trás
    throw new Error(`cofre: não foi possível guardar "${chave}" de ${slug} (${e.code})`);
  }

  // No Windows o chmod só mexe no bit de leitura: o ficheiro fica com as ACL da pasta do utilizador.
  if (process.platform === 'win32') {
    console.warn(`aviso: no Windows as permissões de ${caminho} não são restringidas (chmod 600 não se aplica)`);
  }
}
