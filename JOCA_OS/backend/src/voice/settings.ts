// As definições do ditado, em `<DATA_DIR>/voice-settings.json`.
//
// O backend lê-as e trata um valor com forma errada como ausente. É o backend que lê, e não o
// pedido de transcrição a dizer qual é o modelo: nada que venha pela rota escolhe o que vai para a
// linha de comando do `claude` nem que ficheiro o motor abre.
import path from 'path';
import { DATA_DIR, readJsonFile, writeJsonFile } from '../project-store';
import { DEFAULT_VOICE_MODEL_ID, VOICE_LANGUAGES, voiceModelById } from './catalog';

export interface VoiceSettings {
  readonly correcaoLigada: boolean;
  readonly modeloCorrecao: string;
  readonly termos: readonly string[];
  readonly modeloVoz: string;
  readonly idioma: string;
}

/** Genérica de propósito (o repo é público): termos técnicos que o modelo de voz ouve mal. */
export const DEFAULT_TERMS: readonly string[] = [
  'Claude', 'Claude Code', 'Haiku', 'Sonnet', 'Opus', 'Codex', 'Gemini', 'Handy',
  'JOCA', 'JOCA OS', 'JOCA_Brain', 'git', 'npm', 'commit', 'push', 'pull request', 'branch',
  'deploy', 'frontend', 'backend', 'prompt', 'skill', 'agent', 'terminal',
];

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  correcaoLigada: true,
  modeloCorrecao: 'haiku',
  termos: DEFAULT_TERMS,
  modeloVoz: DEFAULT_VOICE_MODEL_ID,
  idioma: 'pt',
};

/** Um alias (`haiku`) ou um id de modelo. Nunca começa por `-`: vai para a linha de comando. */
const MODELO_VALIDO = /^[a-zA-Z0-9][a-zA-Z0-9._:[\]-]{0,63}$/;
const MAX_TERMOS = 200;
const MAX_TERMO = 80;

export function voiceSettingsFile(): string {
  return path.join(DATA_DIR, 'voice-settings.json');
}

/** Um valor que não se percebe vale a omissão; o que for lixo fica de fora. */
export function normalizeVoiceSettings(guardado: unknown, base: VoiceSettings = DEFAULT_VOICE_SETTINGS): VoiceSettings {
  const v = typeof guardado === 'object' && guardado !== null && !Array.isArray(guardado)
    ? (guardado as Record<string, unknown>) : {};
  const { modeloCorrecao, modeloVoz, idioma, termos } = v;
  return {
    correcaoLigada: typeof v.correcaoLigada === 'boolean' ? v.correcaoLigada : base.correcaoLigada,
    modeloCorrecao: typeof modeloCorrecao === 'string' && MODELO_VALIDO.test(modeloCorrecao) ? modeloCorrecao : base.modeloCorrecao,
    modeloVoz: typeof modeloVoz === 'string' && voiceModelById(modeloVoz) !== null ? modeloVoz : base.modeloVoz,
    idioma: typeof idioma === 'string' && (idioma === 'auto' || VOICE_LANGUAGES.includes(idioma)) ? idioma : base.idioma,
    termos: Array.isArray(termos)
      ? termos
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.replace(/[\r\n]+/g, ' ').trim())
        .filter((t) => t !== '' && t.length <= MAX_TERMO)
        .slice(0, MAX_TERMOS)
      : base.termos,
  };
}

export function readVoiceSettings(): VoiceSettings {
  return normalizeVoiceSettings(readJsonFile<unknown>(voiceSettingsFile(), {}));
}

/** Junta o que veio às definições actuais (campo a campo) e grava. Devolve o resultado. */
export function updateVoiceSettings(parcial: unknown): VoiceSettings {
  const novas = normalizeVoiceSettings(parcial, readVoiceSettings());
  writeJsonFile(voiceSettingsFile(), novas);
  return novas;
}
