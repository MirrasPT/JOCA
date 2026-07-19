// Shared drag-and-drop file handling for the terminal panes.
//
// Browser sandboxes hide the real on-disk path of files dragged from the OS file manager —
// Windows Explorer exposes only File.name (no path). To still hand a worker a usable absolute
// path we, in order of preference:
//   1) use a real path when the drag source provides one — JOCA's own FileBrowser sets text/plain,
//      macOS Finder sets text/uri-list with file:// URIs. That is the ORIGINAL path (best case).
//   2) otherwise UPLOAD the file content to the local backend (same machine, local-first), which
//      writes it to disk and returns the absolute path of the saved copy.
// Folders dragged from Explorer have no readable path either; their contents are uploaded
// recursively (a copy under the drop dir) and the copied folder path is returned.
//
// dataTransfer gotcha: items/files become unreadable after the drop handler returns OR after the
// first `await`. Callers MUST call captureDrop(e) SYNCHRONOUSLY first, then await resolveDrop(cap).

const UPLOAD_MAX_FILES = 200; // safety cap for recursive folder uploads

export function quotePath(p: string): string {
  return /\s/.test(p) ? `"${p}"` : p;
}

function extOf(name: string, mime?: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  if (m) return m[1].toLowerCase();
  // Clipboard images often have a generic/empty name — fall back to the MIME subtype (image/png → png).
  if (mime && mime.startsWith('image/')) return mime.split('/')[1].split('+')[0].toLowerCase();
  return 'bin';
}

// ── synchronous capture (must run inside the drop handler, before any await) ──
export interface DropCapture {
  real: string[];                 // real paths from text/uri-list or text/plain
  files: File[];                  // dataTransfer.files snapshot
  entries: FileSystemEntry[];     // webkitGetAsEntry snapshot (covers folders)
}

function realPathsFrom(dt: DataTransfer): string[] {
  const paths: string[] = [];
  // macOS Finder / file managers: file:// URIs in text/uri-list
  const uriList = dt.getData('text/uri-list') || '';
  for (const line of uriList.split(/\r?\n/)) {
    const uri = line.trim();
    if (!uri || uri.startsWith('#')) continue;
    if (uri.startsWith('file://')) {
      try {
        let p = decodeURIComponent(new URL(uri).pathname);
        if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1); // /C:/... → C:/...
        paths.push(p);
      } catch { /* ignore malformed URI */ }
    }
  }
  // JOCA FileBrowser (and plain text-path drags) set text/plain to the absolute path
  if (paths.length === 0) {
    const text = dt.getData('text/plain') || '';
    // Only treat it as a path if it looks absolute; otherwise it may be unrelated dragged text.
    if (text.trim() && /^([a-zA-Z]:[\\/]|\/)/.test(text.trim().replace(/^"|"$/g, ''))) {
      paths.push(text.trim().replace(/^"|"$/g, ''));
    }
  }
  return paths;
}

export function captureDrop(e: DragEvent): DropCapture {
  const dt = e.dataTransfer;
  if (!dt) return { real: [], files: [], entries: [] };
  const entries = Array.from(dt.items ?? [])
    .map((i) => (i.kind === 'file' && i.webkitGetAsEntry ? i.webkitGetAsEntry() : null))
    .filter((en): en is FileSystemEntry => en !== null);
  return {
    real: realPathsFrom(dt),
    files: Array.from(dt.files ?? []),
    entries,
  };
}

// ── upload ──
interface UploadOpts { relPath?: string; name?: string }

async function uploadFile(file: File, opts: UploadOpts = {}): Promise<{ path: string; root?: string } | null> {
  try {
    const name = opts.name || file.name || '';
    const buf = await file.arrayBuffer();
    const res = await fetch('/upload', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-file-ext': extOf(name, file.type),
        'x-file-name': name,
        ...(opts.relPath ? { 'x-rel-path': opts.relPath } : {}),
      },
      body: buf,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { path?: string; root?: string };
    return data.path ? { path: data.path, root: data.root } : null;
  } catch {
    return null;
  }
}

// Upload pasted/clipboard images (Ctrl+V). They carry a generic or empty name, so we mint a unique,
// recognizable one per item to avoid collisions/overwrites in the drop dir. Returns saved paths.
export async function uploadPastedImages(files: File[], stamp: number): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = extOf(f.name, f.type);
    const r = await uploadFile(f, { name: `colado-${stamp}-${i + 1}.${ext}` });
    if (r?.path) out.push(r.path);
  }
  return out;
}

// Upload files chosen via a native picker (<input type="file">). Keeps their original names
// (unlike uploadPastedImages, which mints names for nameless clipboard blobs). Returns saved paths.
export async function uploadPickedFiles(files: File[]): Promise<string[]> {
  const out: string[] = [];
  for (const f of files) {
    const r = await uploadFile(f, { name: f.name });
    if (r?.path) out.push(r.path);
  }
  return out;
}

// ── recursive folder walk (FileSystemEntry API) ──
function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const all: FileSystemEntry[] = [];
    const pump = () =>
      reader.readEntries(
        (batch) => {
          if (!batch.length) return resolve(all);
          all.push(...batch);
          pump(); // readEntries is paginated — keep reading until empty
        },
        () => resolve(all),
      );
    pump();
  });
}

function entryToFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => entry.file((f) => resolve(f), () => resolve(null)));
}

async function walkEntry(
  entry: FileSystemEntry,
  prefix: string,
  out: { file: File; rel: string }[],
  cap: { n: number },
): Promise<void> {
  if (cap.n >= UPLOAD_MAX_FILES) return;
  if (entry.isFile) {
    const f = await entryToFile(entry as FileSystemFileEntry);
    if (f) {
      out.push({ file: f, rel: prefix + entry.name });
      cap.n++;
    }
  } else if (entry.isDirectory) {
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    for (const child of children) {
      if (cap.n >= UPLOAD_MAX_FILES) break;
      await walkEntry(child, `${prefix}${entry.name}/`, out, cap);
    }
  }
}

// Drag semantics (distinct from Ctrl+V): a DRAG references the file where it ALREADY lives — return
// the real on-disk path when the drag source provides one (JOCA's own FileBrowser sets text/plain;
// macOS Finder sets text/uri-list). It NEVER uploads a copy to JOCA_Drops — only Ctrl+V does that.
// Browsers sandbox OS-file-manager drags (Windows Explorer exposes no path) → those yield [], and the
// caller simply inserts nothing (the user can Ctrl+V instead, which intentionally saves a copy).
// Synchronous: safe to call without the dataTransfer-expiry dance (no await, no upload).
export function dragRealPaths(cap: DropCapture): string[] {
  return cap.real;
}

// A DRAG carried file(s)/folder(s) but the browser exposed NO real on-disk path (Windows Explorer
// sandbox) → dragRealPaths() is []. Lets the caller show a non-blocking hint (use the JOCA file
// panel, which sets a real path, or Ctrl+V, which uploads a copy) instead of the drop looking dead.
export function dropHadFilesWithoutPath(cap: DropCapture): boolean {
  return cap.real.length === 0 && (cap.files.length > 0 || cap.entries.length > 0);
}

// ── resolve a captured drop to a list of absolute paths ──
export async function resolveDrop(cap: DropCapture): Promise<{ paths: string[]; truncated: boolean }> {
  // 1) real paths win — original on-disk location, no copy needed
  if (cap.real.length) return { paths: cap.real, truncated: false };

  const paths: string[] = [];
  const roots = new Set<string>();
  let truncated = false;

  const dirEntries = cap.entries.filter((e) => e.isDirectory);
  const fileEntries = cap.entries.filter((e) => e.isFile);

  // 2) folders → upload contents recursively, return the copied folder root
  for (const dir of dirEntries) {
    const collected: { file: File; rel: string }[] = [];
    const counter = { n: 0 };
    await walkEntry(dir, '', collected, counter);
    if (counter.n >= UPLOAD_MAX_FILES) truncated = true;
    let root: string | undefined;
    for (const { file, rel } of collected) {
      const r = await uploadFile(file, { relPath: rel });
      if (r?.root) root = r.root;
    }
    if (root) roots.add(root);
  }

  // 3) loose files → upload each, return saved-copy path. Prefer entries (give real File);
  //    fall back to dataTransfer.files when the entry API is unavailable.
  const looseFiles: File[] = [];
  if (fileEntries.length) {
    for (const fe of fileEntries) {
      const f = await entryToFile(fe as FileSystemFileEntry);
      if (f) looseFiles.push(f);
    }
  } else if (dirEntries.length === 0) {
    looseFiles.push(...cap.files);
  }
  for (const f of looseFiles) {
    const r = await uploadFile(f);
    if (r?.path) paths.push(r.path);
  }

  return { paths: [...roots, ...paths], truncated };
}
