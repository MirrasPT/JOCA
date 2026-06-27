export function shortPath(p: string): string {
  return p
    .replace(/^\/Users\/[^/]+/, '~')
    .replace(/^[a-zA-Z]:[/\\]Users[/\\][^/\\]+/, '~');
}

export function basename(p: string): string {
  const parts = p.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

export function splitPath(p: string): string[] {
  return p.split(/[/\\]/).filter(Boolean);
}

export function joinPath(segments: string[], upTo: number): string {
  const slice = segments.slice(0, upTo);
  if (slice.length > 0 && /^[a-zA-Z]:$/i.test(slice[0])) {
    return slice.length === 1 ? slice[0] + '\\' : slice.join('\\');
  }
  return '/' + slice.join('/');
}
