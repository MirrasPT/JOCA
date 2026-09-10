// Markdown → safe HTML, shared by whoever needs to show text written by agents
// (.md file preview).
//
// The sanitizer lives HERE and only here: duplicating it would be the easiest way for one of
// the places to fall behind and start accepting `<script>`. No new dependencies — `marked` was
// already installed.
import { marked } from 'marked';

// `marked` in synchronous mode: returns a string, not a Promise (we use the result directly).
marked.setOptions({ async: false });

const ALLOWED_URL_ATTRS = new Set(['href', 'src']);
const BLOCKED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button']);

// Everything the browser discards inside a URL before resolving it: C0 controls, space and DEL.
// Comparison by code point instead of a regex class: a class with these characters would force
// putting them literally in the file, and a source file with control bytes is exactly the kind of
// thing the next tool ruins without anyone noticing.
function stripUrlIgnored(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c > 0x20 && c !== 0x7f) out += ch;
  }
  return out;
}

/**
 * Safe URL? **Scheme allowlist**, not a denylist.
 *
 * The previous version did `value.trim().startsWith('javascript:')`. `trim()` only cuts the ends,
 * but the browser ignores tabs/newlines/CR **inside** the scheme when resolving the URL — which is why
 * `java&#9;script:alert(1)` got through the filter and was executable again on click. Confirmed
 * running: tab (U+0009), LF (U+000A) and CR (U+000D) all bypassed it.
 *
 * Here exactly what the browser also discards is stripped first, and only then is the decision made —
 * and it is decided by what is ALLOWED (a short, closed list), instead of trying to guess every
 * way of writing "javascript".
 */
export function isSafeUrl(raw: string): boolean {
  const v = stripUrlIgnored(raw).toLowerCase();
  if (!v) return true;
  // Relative, anchor or query — never executes anything.
  if (v.startsWith('#') || v.startsWith('/') || v.startsWith('.') || v.startsWith('?')) return true;
  // With no explicit scheme → it is relative.
  if (!/^[a-z][a-z0-9+.-]*:/.test(v)) return true;
  return /^(https?|mailto|tel):/.test(v) || /^data:image\/(png|jpeg|gif|webp);/.test(v);
}

/** Removes dangerous tags, `on*` handlers and URLs with a disallowed scheme from the given HTML. */
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

/** Markdown → already sanitized HTML, ready for `dangerouslySetInnerHTML`. */
export function renderMarkdown(text: string): string {
  return sanitizeHtml(marked(text) as string);
}
