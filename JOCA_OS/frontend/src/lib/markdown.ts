// Markdown → HTML seguro, partilhado por quem precisa de mostrar texto escrito por agentes
// (preview de ficheiros .md, chat do gestor de projecto).
//
// O sanitizador vive AQUI e só aqui: duplicá-lo seria a forma mais fácil de um dos sítios ficar
// para trás e passar a aceitar `<script>`. Sem dependências novas — `marked` já estava instalado.
import { marked } from 'marked';

// `marked` em modo síncrono: devolve string, não Promise (usamos o resultado directamente).
marked.setOptions({ async: false });

const ALLOWED_URL_ATTRS = new Set(['href', 'src']);
const BLOCKED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button']);

// Tudo o que o browser descarta dentro de um URL antes de o resolver: controlo C0, espaco e DEL.
// Comparacao por code point em vez de classe de regex: uma classe com estes caracteres obrigaria
// a mete-los literalmente no ficheiro, e um ficheiro-fonte com bytes de controlo e exactamente o
// tipo de coisa que a ferramenta seguinte estraga sem ninguem dar por ela.
function stripUrlIgnored(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c > 0x20 && c !== 0x7f) out += ch;
  }
  return out;
}

/**
 * URL seguro? **Allowlist de esquemas**, não denylist.
 *
 * A versão anterior fazia `value.trim().startsWith('javascript:')`. O `trim()` só corta as pontas,
 * mas o browser ignora tabs/newlines/CR **dentro** do esquema ao resolver o URL — por isso
 * `java&#9;script:alert(1)` passava o filtro e voltava a ser executável no clique. Confirmado a
 * correr: tab (U+0009), LF (U+000A) e CR (U+000D) contornavam-no todos.
 *
 * Aqui limpa-se primeiro exactamente o que o browser também descarta, e só depois se decide — e
 * decide-se pelo que é PERMITIDO (lista curta e fechada), em vez de tentar adivinhar todas as
 * maneiras de escrever "javascript".
 */
export function isSafeUrl(raw: string): boolean {
  const v = stripUrlIgnored(raw).toLowerCase();
  if (!v) return true;
  // Relativo, âncora ou query — nunca executa nada.
  if (v.startsWith('#') || v.startsWith('/') || v.startsWith('.') || v.startsWith('?')) return true;
  // Sem esquema explícito → é relativo.
  if (!/^[a-z][a-z0-9+.-]*:/.test(v)) return true;
  return /^(https?|mailto|tel):/.test(v) || /^data:image\/(png|jpeg|gif|webp);/.test(v);
}

/** Remove tags perigosas, handlers `on*` e URLs de esquema não permitido do HTML dado. */
export function sanitizeHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('*').forEach((el) => {
    if (BLOCKED_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
      return;
    }

    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if (ALLOWED_URL_ATTRS.has(name) && !isSafeUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return template.innerHTML;
}

/** Markdown → HTML já sanitizado, pronto para `dangerouslySetInnerHTML`. */
export function renderMarkdown(text: string): string {
  return sanitizeHtml(marked(text) as string);
}
