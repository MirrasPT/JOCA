// Os modelos de voz que o ditado conhece, e onde estão nesta máquina.
//
// ⚠ Nada aqui é de memória: tamanho e sha-256 lidos na API do Hugging Face
// (`/api/models/handy-computer/parakeet-tdt-0.6b-v3-gguf/tree/main`, campo `lfs.oid`), verificados
// a 2026-11-16. São eles que validam um ficheiro descarregado. O `Q8_0` é o que o Handy usa; o
// `Q4_K_M` é a alternativa mais leve do mesmo repositório.
//
// Os modelos (centenas de MB) vivem FORA do repo: `~/.joca-os/modelos/` (Windows:
// `%USERPROFILE%\.joca-os\modelos`). `JOCA_VOICE_MODELS_DIR` sobrepõe-na (testes).
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface VoiceModel {
  readonly id: string;
  readonly nome: string;
  readonly repo: string;
  readonly ficheiro: string;
  readonly bytes: number;
  readonly sha256: string;
}

const REPO_PARAKEET = 'handy-computer/parakeet-tdt-0.6b-v3-gguf';

export const VOICE_MODELS: readonly VoiceModel[] = [
  {
    id: 'parakeet-tdt-0.6b-v3-Q8_0',
    nome: 'Parakeet TDT 0.6b v3 (Q8, o do Handy)',
    repo: REPO_PARAKEET,
    ficheiro: 'parakeet-tdt-0.6b-v3-Q8_0.gguf',
    bytes: 739_508_576,
    sha256: '5859f77944efcd8eafa23a6350731960b2b55b2203df51f319665c807d802cc7',
  },
  {
    id: 'parakeet-tdt-0.6b-v3-Q4_K_M',
    nome: 'Parakeet TDT 0.6b v3 (Q4, mais leve)',
    repo: REPO_PARAKEET,
    ficheiro: 'parakeet-tdt-0.6b-v3-Q4_K_M.gguf',
    bytes: 485_425_504,
    sha256: 'b68557be1e3c40207fd7c4bd9d63f1d3316b963f15325bfb0cc16a8bb0ffd181',
  },
];

export const DEFAULT_VOICE_MODEL_ID = 'parakeet-tdt-0.6b-v3-Q8_0';

/** Os idiomas que o Parakeet v3 anuncia (`model.capabilities.languages`). */
export const VOICE_LANGUAGES: readonly string[] = [
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'hr', 'hu', 'it',
  'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'uk',
];

export function voiceModelById(id: string): VoiceModel | null {
  return VOICE_MODELS.find((m) => m.id === id) ?? null;
}

/** A pasta dos modelos que o JOCA OS descarrega. Lida a cada chamada (os testes mudam-na). */
export function voiceModelsDir(): string {
  return process.env.JOCA_VOICE_MODELS_DIR || path.join(os.homedir(), '.joca-os', 'modelos');
}

/** A raiz da cache do Hugging Face: as variáveis dele, e senão a omissão dele. */
function huggingFaceHub(): string {
  if (process.env.HF_HUB_CACHE) return process.env.HF_HUB_CACHE;
  if (process.env.HF_HOME) return path.join(process.env.HF_HOME, 'hub');
  return path.join(os.homedir(), '.cache', 'huggingface', 'hub');
}

export type ModelOrigin = 'huggingface' | 'joca';

export interface LocatedModel {
  readonly caminho: string;
  readonly origem: ModelOrigin;
}

function comTamanhoCerto(caminho: string, bytes: number): boolean {
  try { return fs.statSync(caminho).size === bytes; } catch { return false; }
}

/**
 * Onde está o ficheiro deste modelo, ou `null`. Primeiro a cache do Hugging Face (só se lê, nunca
 * se escreve lá), depois a pasta do JOCA OS. O tamanho tem de bater: um ficheiro a meio não é modelo.
 */
export function locateModel(modelo: VoiceModel): LocatedModel | null {
  const snapshots = path.join(huggingFaceHub(), `models--${modelo.repo.replace('/', '--')}`, 'snapshots');
  try {
    for (const revisao of fs.readdirSync(snapshots)) {
      const caminho = path.join(snapshots, revisao, modelo.ficheiro);
      if (comTamanhoCerto(caminho, modelo.bytes)) return { caminho, origem: 'huggingface' };
    }
  } catch { /* sem cache do Hugging Face: normal */ }
  const proprio = path.join(voiceModelsDir(), modelo.ficheiro);
  return comTamanhoCerto(proprio, modelo.bytes) ? { caminho: proprio, origem: 'joca' } : null;
}
