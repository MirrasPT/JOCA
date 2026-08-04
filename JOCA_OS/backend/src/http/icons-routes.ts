import express, { Router } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { DATA_DIR, loadProjects, ProjectIcon } from '../project-store';
import { loadProjectGroups } from '../project-groups-store';

// Ícones de projecto e de grupo: upload, entrega e remoção. Segue o padrão do POST /upload
// (express.raw + cabeçalho x-file-ext), mas guarda em data/icons e NUNCA reutiliza o nome do
// cliente — o nome é um UUID gerado aqui, o que fecha path traversal por construção.
//
// SVG é REJEITADO de propósito. Um SVG é um documento com script/foreignObject e este endpoint
// devolve o ficheiro para ser desenhado inline na sidebar; servir SVG carregado pelo utilizador
// seria XSS armazenado. É a mesma decisão já tomada em UPLOAD_ALLOWED_EXTS (helpers.ts), mantida
// coerente. Quem quiser um ícone vectorial exporta PNG/WEBP.
export const ICONS_DIR = path.join(DATA_DIR, 'icons');

const MAX_ICON_BYTES = 2 * 1024 * 1024;

// Extensão canónica → Content-Type. 'jpg' normaliza para 'jpeg' no nome do ficheiro guardado.
const ICON_MIME: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

// Só nomes que ESTE servidor gera. Serve de validação tanto na entrega/remoção como no PATCH
// (um `icon.value` de tipo 'image' tem de casar isto, senão era um path arbitrário).
const ICON_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpeg|webp)$/;

// A extensão declarada mente com frequência (e é o cliente a declará-la). O que decide é o
// conteúdo: sem estes magic bytes o ficheiro não é a imagem que diz ser.
function sniffImageExt(buf: Buffer): 'png' | 'jpeg' | 'webp' | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

export function isGeneratedIconFilename(name: string): boolean {
  return ICON_FILE_RE.test(name);
}

// Um emoji = exactamente um grapheme cluster pictográfico. Contar code points não chega: uma
// família com ZWJ tem 7 e continua a ser um só glifo, e "ab" tem 2 e não é emoji nenhum.
function isSingleEmoji(value: string): boolean {
  if (!value || value.length > 32) return false;
  if ([...value].length > 12) return false;
  const clusters = [...new Intl.Segmenter('pt', { granularity: 'grapheme' }).segment(value)];
  if (clusters.length !== 1) return false;
  return /\p{Extended_Pictographic}/u.test(value);
}

export type IconParseResult =
  | { ok: true; icon: ProjectIcon | undefined }
  | { ok: false; error: string };

// Valida o campo `icon` de um PATCH. `null`/`''` limpa o ícone (→ undefined). Devolve sempre um
// objecto NOVO com só os dois campos conhecidos — nunca o objecto do body, que traria chaves
// arbitrárias para dentro do JSON persistido.
export function parseIconInput(raw: unknown): IconParseResult {
  if (raw === null || raw === '') return { ok: true, icon: undefined };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'icon inválido' };
  const { type, value } = raw as { type?: unknown; value?: unknown };
  if (typeof value !== 'string') return { ok: false, error: 'icon.value tem de ser texto' };
  if (type === 'emoji') {
    if (!isSingleEmoji(value)) return { ok: false, error: 'icon.value tem de ser um único emoji' };
    return { ok: true, icon: { type: 'emoji', value } };
  }
  if (type === 'image') {
    if (!isGeneratedIconFilename(value)) return { ok: false, error: 'icon.value não é um ficheiro de ícone válido' };
    if (!fs.existsSync(path.join(ICONS_DIR, value))) return { ok: false, error: 'Ícone não encontrado' };
    return { ok: true, icon: { type: 'image', value } };
  }
  return { ok: false, error: "icon.type tem de ser 'image' ou 'emoji'" };
}

// Um ficheiro só se apaga quando mais ninguém o aponta: o mesmo upload pode ser reutilizado por
// vários projectos/grupos e apagá-lo deixaria os outros com um ícone morto.
export function isIconReferenced(filename: string): boolean {
  const used = (icon?: ProjectIcon) => icon?.type === 'image' && icon.value === filename;
  return loadProjects().some((p) => used(p.icon)) || loadProjectGroups().some((g) => used(g.icon));
}

// Chamada DEPOIS de gravar a mudança, quando um ícone de imagem foi substituído ou removido: sem
// isto data/icons crescia para sempre com ficheiros que já ninguém aponta.
export function collectIconIfUnused(previous: ProjectIcon | undefined, next: ProjectIcon | undefined): void {
  if (previous?.type !== 'image') return;
  if (next?.type === 'image' && next.value === previous.value) return;
  if (isIconReferenced(previous.value)) return;
  try { fs.unlinkSync(path.join(ICONS_DIR, previous.value)); } catch { /* já não existe — nada a fazer */ }
}

export function iconsRouter(): Router {
  const r = Router();

  // Upload. Corpo = bytes crus da imagem (mesmo padrão do POST /upload), extensão declarada em
  // x-file-ext apenas como pista — quem manda é o sniff do conteúdo.
  r.post('/icons', express.raw({ type: '*/*', limit: MAX_ICON_BYTES }), (req, res) => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: 'Corpo vazio' });
    if (body.length > MAX_ICON_BYTES) return res.status(413).json({ error: 'Ícone demasiado grande (máx. 2 MB)' });

    const rawExt = (req.headers['x-file-ext'] as string) || '';
    if (/[\r\n]/.test(rawExt)) return res.status(400).json({ error: 'Cabeçalho de extensão inválido' });
    const declared = rawExt.replace(/[^\w-]/g, '').toLowerCase();
    if (declared === 'svg') return res.status(400).json({ error: 'SVG não é aceite como ícone (risco de script)' });

    const ext = sniffImageExt(body);
    if (!ext) return res.status(400).json({ error: 'Só PNG, JPEG ou WEBP' });

    const filename = `${randomUUID()}.${ext}`;
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    // Escrita atómica: o GET do ícone pode chegar antes de um write longo terminar e serviria
    // metade do ficheiro.
    const target = path.join(ICONS_DIR, filename);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, target);

    res.json({ filename, url: `/icons/${filename}`, icon: { type: 'image', value: filename } });
  });

  r.get('/icons/:name', (req, res) => {
    const name = req.params.name;
    if (!isGeneratedIconFilename(name)) return res.status(400).json({ error: 'Nome inválido' });
    const file = path.join(ICONS_DIR, name);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Não encontrado' });
    const ext = name.slice(name.lastIndexOf('.') + 1);
    res.setHeader('Content-Type', ICON_MIME[ext] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Defesa em profundidade caso um raster contrabandeie markup: aqui nada é executável.
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    // O nome é um UUID: o conteúdo nunca muda, mudar de ícone gera outro nome.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.sendFile(file);
  });

  r.delete('/icons/:name', (req, res) => {
    const name = req.params.name;
    if (!isGeneratedIconFilename(name)) return res.status(400).json({ error: 'Nome inválido' });
    if (isIconReferenced(name)) return res.status(409).json({ error: 'Ícone ainda em uso' });
    try { fs.unlinkSync(path.join(ICONS_DIR, name)); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return res.status(500).json({ error: 'Falhou a remoção' });
    }
    res.json({ ok: true });
  });

  return r;
}
