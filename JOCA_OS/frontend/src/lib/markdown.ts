// Shared markdown → safe HTML renderer for chat surfaces (Master view).
// Mirrors the sanitize approach used in FilePreview: marked for parsing,
// highlight.js for fenced code, then a DOM-based scrub of dangerous tags/attrs.
import hljs from 'highlight.js/lib/common';
import { marked } from 'marked';

marked.setOptions({ async: false });

// Highlight fenced code blocks. marked v18 renderer.code receives { text, lang }.
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }): string {
      let body = text;
      if (lang && hljs.getLanguage(lang)) {
        try { body = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value; }
        catch { body = escapeHtml(text); }
      } else {
        try { body = hljs.highlightAuto(text).value; }
        catch { body = escapeHtml(text); }
      }
      const cls = lang ? ` class="language-${lang}"` : '';
      return `<pre class="md-code"><code${cls}>${body}</code></pre>`;
    },
  },
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const ALLOWED_URL_ATTRS = new Set(['href', 'src']);
const BLOCKED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button']);

function sanitizeHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('*').forEach((el) => {
    if (BLOCKED_TAGS.has(el.tagName.toLowerCase())) { el.remove(); return; }
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

export function renderMarkdown(text: string): string {
  return sanitizeHtml(marked.parse(text) as string);
}
