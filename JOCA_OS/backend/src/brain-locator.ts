// Onde está o JOCA Brain — se estiver. O JOCA OS já não precisa de viver ao lado da pasta
// `JOCA_Brain`: o Brain v2 instala-se globalmente e deixa o caminho em `env.JOCA_BRAIN` no
// `~/.claude/settings.json` (instalar-global.mjs). Sem Brain o JOCA OS funciona na mesma — só não
// tem toolkit para listar.
//
// Ordem (a primeira via VÁLIDA ganha):
//   1. variável JOCA_BRAIN                      — a do Brain v2
//   2. variável JOCA_LOGIC_PATH                 — legado (start.sh / start.bat ainda a definem)
//   3. env.JOCA_BRAIN em ~/.claude/settings.json — o backend arrancado fora de uma sessão do Claude
//   4. pasta irmã ../JOCA_Brain                  — legado (instalação antiga, lado a lado)
//   5. nenhuma                                   — sem Brain
//
// Uma via que aponta para uma pasta que não é um Brain não ganha: fica um aviso e passa-se à
// seguinte. Função pura — env, homedir e fs são injectados, para os testes não lerem a máquina.
import path from 'path';
import fs from 'fs';

export type ViaDoBrain = 'env-joca-brain' | 'env-joca-logic-path' | 'settings-claude' | 'pasta-irma';

export interface BrainEncontrado {
  root: string;
  via: ViaDoBrain;
}

export interface ResultadoDoBrain {
  brain: BrainEncontrado | null;
  /** Vias que apontavam para algo que não é um Brain (o caminho e porquê; nunca conteúdo). */
  avisos: string[];
}

export type FsDoBrain = Pick<typeof fs, 'existsSync' | 'readFileSync' | 'statSync'>;

export interface DepsDoLocalizador {
  env: NodeJS.ProcessEnv;
  homedir: string;
  /** Pasta `JOCA_OS/` — a irmã `../JOCA_Brain` procura-se a partir dela. */
  jocaOsDir: string;
  fs?: FsDoBrain;
}

export const DESCRICAO_DA_VIA: Record<ViaDoBrain, string> = {
  'env-joca-brain': 'variável JOCA_BRAIN',
  'env-joca-logic-path': 'variável JOCA_LOGIC_PATH (legado)',
  'settings-claude': 'env.JOCA_BRAIN em ~/.claude/settings.json',
  'pasta-irma': 'pasta irmã ../JOCA_Brain (legado)',
};

function eDirectorio(f: FsDoBrain, p: string): boolean {
  try { return f.statSync(p).isDirectory(); } catch { return false; }
}

/** Um Brain tem na raiz `AGENTS.md` ou `CLAUDE.md`, e `.claude/` ou `skills/`. */
export function eBrain(dir: string, f: FsDoBrain = fs): boolean {
  if (!eDirectorio(f, dir)) return false;
  const temInstrucoes = f.existsSync(path.join(dir, 'AGENTS.md')) || f.existsSync(path.join(dir, 'CLAUDE.md'));
  const temToolkit = eDirectorio(f, path.join(dir, '.claude')) || eDirectorio(f, path.join(dir, 'skills'));
  return temInstrucoes && temToolkit;
}

function expandir(valor: string, homedir: string): string {
  const v = valor.trim();
  if (v === '~') return homedir;
  if (v.startsWith('~/') || v.startsWith('~\\')) return path.join(homedir, v.slice(2));
  return path.resolve(v);
}

/**
 * Lê SÓ a chave `env.JOCA_BRAIN` do settings do Claude Code. O resto do ficheiro (que pode ter
 * chaves e tokens) nunca sai daqui — nem para o log, nem para o aviso.
 */
export function jocaBrainDoSettings(homedir: string, f: FsDoBrain = fs): string | null {
  const ficheiro = path.join(homedir, '.claude', 'settings.json');
  try {
    if (!f.existsSync(ficheiro)) return null;
    const dados = JSON.parse(String(f.readFileSync(ficheiro, 'utf8'))) as { env?: Record<string, unknown> };
    const valor = dados?.env?.JOCA_BRAIN;
    return typeof valor === 'string' && valor.trim() ? valor : null;
  } catch {
    return null;
  }
}

export function localizarBrain(deps: DepsDoLocalizador): ResultadoDoBrain {
  const f = deps.fs ?? fs;
  const avisos: string[] = [];
  const candidatos: Array<{ via: ViaDoBrain; valor: () => string | null | undefined }> = [
    { via: 'env-joca-brain', valor: () => deps.env.JOCA_BRAIN },
    { via: 'env-joca-logic-path', valor: () => deps.env.JOCA_LOGIC_PATH },
    { via: 'settings-claude', valor: () => jocaBrainDoSettings(deps.homedir, f) },
    { via: 'pasta-irma', valor: () => path.join(path.dirname(path.resolve(deps.jocaOsDir)), 'JOCA_Brain') },
  ];
  for (const c of candidatos) {
    const bruto = c.valor();
    if (!bruto || !bruto.trim()) continue;
    const root = expandir(bruto, deps.homedir);
    if (eBrain(root, f)) return { brain: { root, via: c.via }, avisos };
    // A irmã é só um palpite: não estar lá é o caso normal, não merece aviso.
    if (c.via !== 'pasta-irma') avisos.push(`${DESCRICAO_DA_VIA[c.via]} aponta para ${root}, que não é um JOCA Brain`);
  }
  return { brain: null, avisos };
}
