#!/usr/bin/env node
// Guarda uma credencial de cliente no cofre (~/.config/marketeer/<slug>.env) sem a pôr no chat,
// no histórico da shell nem em `ps`: o valor lê-se do stdin, nunca dos argumentos.
// Uso (terminal do operador, fora do Claude): node "<MKT>/scripts/guardar-credencial.mjs" <slug> <CHAVE>
// Num terminal o valor não aparece no ecrã enquanto se escreve.

import { readFileSync } from 'node:fs';
import { guardar } from './cofre.mjs';
import { eEntrada } from './validar-dossier.mjs';

// Iguais às de scripts/cofre.mjs: validar antes de ler o valor, para não o pedir em vão.
const SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const CHAVE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const AVISO_STDIN =
  'a ler do stdin — o valor PODE aparecer no ecrã; termina com Ctrl+D (Ctrl+Z Enter no Windows)';

const COLAR_INICIO = '\x1b[200~';
const COLAR_FIM = '\x1b[201~';

export const ERRO_VARIAS_LINHAS =
  'valor com várias linhas não suportado; nada foi guardado ' +
  '(numa service account em JSON, guarda o caminho do ficheiro, não o conteúdo)';
export const ERRO_CONTROLO =
  'valor com caracteres de controlo (setas, Esc, Tab…) não suportado; nada foi guardado';
// C0, DEL e C1 — inclui o \x1b das setas, que entrava no valor sem se ver.
const CONTROLO = /\p{Cc}/u;

// Parser puro das teclas do modo escondido. Recebe o estado anterior e um bloco lido do terminal;
// devolve o estado novo. `fim`: null (continua) · 'ok' · 'cancelado' · 'varias-linhas' · 'controlo'.
// Um bloco com texto depois do Enter é uma colagem com várias linhas: aceitar só a 1.ª linha
// guardava um valor truncado com "✓", e o resto ia parar à shell.
export function lerTeclas(estado, bloco) {
  let { valor, colar } = estado;
  let i = 0;
  while (i < bloco.length) {
    if (bloco.startsWith(COLAR_INICIO, i)) { colar = true; i += COLAR_INICIO.length; continue; }
    if (bloco.startsWith(COLAR_FIM, i)) { colar = false; i += COLAR_FIM.length; continue; }
    const ch = bloco[i];
    if (ch === '\r' || ch === '\n' || ch === '\u0004') {
      // Dentro de uma colagem, uma quebra de linha nunca é o Enter do operador.
      if (colar) return { valor, colar, fim: 'varias-linhas' };
      const resto = bloco.slice(i + 1).replace(/^\n/, '');
      return { valor, colar, fim: resto ? 'varias-linhas' : 'ok' };
    }
    if (ch === '\u0003') return { valor, colar, fim: 'cancelado' };
    if (ch === '\u007f' || ch === '\b') valor = valor.slice(0, -1);
    else if (CONTROLO.test(ch)) return { valor, colar, fim: 'controlo' };
    else valor += ch;
    i += 1;
  }
  return { valor, colar, fim: null };
}

// Consome o que ainda chegar até haver `ms` de silêncio e diz se chegou alguma coisa.
// Depois de uma colagem recusada, o resto ainda pode estar a chegar: sem isto, as linhas
// seguintes eram lidas pela shell como comandos.
function esvaziar(entrada, ms = 300) {
  return new Promise((resolve) => {
    let houve = false;
    let t = setTimeout(parar, ms);
    function continuar() { houve = true; clearTimeout(t); t = setTimeout(parar, ms); }
    function parar() { entrada.off('data', continuar); resolve(houve); }
    entrada.on('data', continuar);
  });
}

// Sem TTY, ou num terminal que não aceita raw mode (ex.: alguns do Windows), não se consegue
// esconder o que se escreve: avisa-se em vez de esperar em silêncio.
function modoEscondido() {
  if (!process.stdin.isTTY) return false;
  try {
    process.stdin.setRawMode(true);
    return true;
  } catch {
    return false;
  }
}

function lerStdin() {
  process.stderr.write(`aviso: ${AVISO_STDIN}\n`);
  return readFileSync(0, 'utf8').replace(/\r?\n$/, '');
}

// Pressupõe o raw mode já activo (modoEscondido).
function lerEscondido(pergunta) {
  return new Promise((resolve, reject) => {
    const entrada = process.stdin;
    const terminal = process.stderr.isTTY;
    process.stderr.write(pergunta);
    // Bracketed paste: o terminal marca as colagens, mesmo quando chegam em vários blocos.
    if (terminal) process.stderr.write('\x1b[?2004h');
    entrada.resume();
    entrada.setEncoding('utf8');
    let estado = { valor: '', colar: false, fim: null };
    const fim = async (erro) => {
      entrada.off('data', aoLer);
      if (erro?.esvaziar) await esvaziar(entrada);
      // Terminal sem bracketed paste: uma colagem pode partir-se num bloco que acaba no Enter.
      // Se chegar mais alguma coisa logo a seguir, não foi o operador a carregar em Enter.
      else if (!erro && (await esvaziar(entrada, 100))) {
        await esvaziar(entrada);
        erro = new Error(ERRO_VARIAS_LINHAS);
      }
      if (terminal) process.stderr.write('\x1b[?2004l');
      entrada.setRawMode(false);
      entrada.pause();
      process.stderr.write('\n');
      erro ? reject(erro) : resolve(estado.valor);
    };
    const aoLer = (bloco) => {
      estado = lerTeclas(estado, bloco);
      if (estado.fim === 'ok') return fim();
      if (estado.fim === 'cancelado') return fim(new Error('cancelado'));
      if (estado.fim === 'varias-linhas') return fim(Object.assign(new Error(ERRO_VARIAS_LINHAS), { esvaziar: true }));
      if (estado.fim === 'controlo') return fim(Object.assign(new Error(ERRO_CONTROLO), { esvaziar: true }));
    };
    entrada.on('data', aoLer);
  });
}

if (eEntrada(import.meta.url)) {
  const [slug, chave] = process.argv.slice(2);
  try {
    if (!slug || !chave) throw new Error('uso: node "<MKT>/scripts/guardar-credencial.mjs" <slug> <CHAVE>');
    if (!SLUG.test(slug)) throw new Error(`slug inválido "${slug}" (minúsculas, algarismos, "-" e "_") — nada foi lido`);
    if (!CHAVE.test(chave)) throw new Error(`chave inválida "${chave}" (letras, algarismos e "_", ex.: META_TOKEN) — nada foi lido`);
    // Nenhuma mensagem de erro daqui para baixo leva o valor.
    const valor = modoEscondido()
      ? await lerEscondido(`Valor de ${chave} para ${slug} (não aparece no ecrã): `)
      : lerStdin();
    if (!valor) throw new Error(`valor de "${chave}" vazio — nada foi guardado`);
    if (/[\r\n]/.test(valor)) throw new Error(ERRO_VARIAS_LINHAS);
    if (CONTROLO.test(valor)) throw new Error(ERRO_CONTROLO);
    guardar(slug, chave, valor);
    // Confirma só o slug e a chave, nunca o valor.
    console.log(`✓ ${chave} guardada no cofre de ${slug}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
