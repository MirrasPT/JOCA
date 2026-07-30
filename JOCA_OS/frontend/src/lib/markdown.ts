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

/** Remove tags perigosas, handlers `on*` e URLs `javascript:`/`data:text/html` do HTML dado. */
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
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if (ALLOWED_URL_ATTRS.has(name) && (value.startsWith('javascript:') || value.startsWith('data:text/html'))) {
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
