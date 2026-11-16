// O ditado por voz (speech-to-text local). Autenticação: a de todas as outras rotas (`server.ts`).
//
//   GET    /voice/status      → modelos e onde estão, descarga em curso, definições (e as instruções
//                                originais da limpeza), falha do motor
//   PUT    /voice/settings    → grava as definições (campo a campo; lixo vale a omissão)
//   POST   /voice/prepare     → carrega o motor, para o 1.º ditado não esperar por ele
//   POST   /voice/download    → descarrega um modelo do catálogo (202; progresso no /voice/status)
//   DELETE /voice/download    → desiste da descarga
//   POST   /voice/transcribe  → corpo = PCM float32 LE mono a 16 kHz (application/octet-stream)
//   POST   /voice/correct     → {texto, imagem?, contexto?} → texto limpo, ou o bruto e o motivo
//
// ⚠ Áudio, imagem, contexto e texto vivem na memória deste pedido: nunca vão para o disco nem
// para os logs (os logs dizem só tempos e tamanhos).
import express, { Router } from 'express';
import { locateModel, VOICE_LANGUAGES, VOICE_MODELS, voiceModelById } from '../voice/catalog';
import { corrigirTexto, INSTRUCOES, type CorredorDoClaude, type ImagemDeContexto } from '../voice/correct';
import { descarregarModelo, type EstadoDescarga } from '../voice/download';
import { VoiceEngine } from '../voice/engine';
import { readVoiceSettings, updateVoiceSettings } from '../voice/settings';

export const SAMPLE_RATE = 16_000;
/** O tecto de um ditado. O cliente pára sozinho aqui; a rota confirma-o. */
export const MAX_DICTATION_SECONDS = 300;
const MIN_DICTATION_SECONDS = 0.1;
const MAX_PCM_BYTES = MAX_DICTATION_SECONDS * SAMPLE_RATE * 4;
const MAX_TEXT_CHARS = 40_000;
const MAX_CONTEXT_CHARS = 20_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const TIPOS_DE_IMAGEM = new Set(['image/png', 'image/jpeg', 'image/webp']);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

class PedidoInvalido extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export interface VoiceRouterDeps {
  engine?: VoiceEngine;
  correr?: CorredorDoClaude;
  fetchImpl?: typeof fetch;
}

const motorPorOmissao = new VoiceEngine();
// O filho também sai sozinho quando o canal IPC fecha; isto só o despacha mais cedo.
process.once('exit', () => motorPorOmissao.parar());

function pcmDoCorpo(corpo: unknown, sampleRate: unknown): Float32Array {
  if (Number(sampleRate) !== SAMPLE_RATE) throw new PedidoInvalido(`o áudio tem de vir a ${SAMPLE_RATE} Hz`);
  if (!Buffer.isBuffer(corpo) || corpo.length === 0) throw new PedidoInvalido('o pedido não trazia áudio');
  if (corpo.length % 4 !== 0) throw new PedidoInvalido('o áudio não é PCM float32');
  const pcm = new Float32Array(corpo.length / 4);
  for (let i = 0; i < pcm.length; i++) pcm[i] = corpo.readFloatLE(i * 4);
  const segundos = pcm.length / SAMPLE_RATE;
  if (segundos < MIN_DICTATION_SECONDS) throw new PedidoInvalido('o áudio é demasiado curto');
  if (segundos > MAX_DICTATION_SECONDS) throw new PedidoInvalido(`o áudio passa de ${MAX_DICTATION_SECONDS} segundos`, 413);
  return pcm;
}

function imagemDoPedido(imagem: unknown): ImagemDeContexto | null {
  if (imagem === null || imagem === undefined) return null;
  const c = imagem as { mediaType?: unknown; dados?: unknown };
  if (typeof c.mediaType !== 'string' || !TIPOS_DE_IMAGEM.has(c.mediaType)) {
    throw new PedidoInvalido('a imagem do terminal não é png, jpeg ou webp');
  }
  if (typeof c.dados !== 'string' || c.dados === '' || !BASE64.test(c.dados)) {
    throw new PedidoInvalido('a imagem do terminal não vem em base64');
  }
  if (c.dados.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3)) {
    throw new PedidoInvalido(`a imagem do terminal passa de ${MAX_IMAGE_BYTES / 1024 / 1024} MB`, 413);
  }
  return { mediaType: c.mediaType, dados: c.dados };
}

function responderErro(res: express.Response, e: unknown) {
  if (e instanceof PedidoInvalido) return res.status(e.status).json({ error: e.message });
  throw e;
}

export function voiceRouter(deps: VoiceRouterDeps = {}): Router {
  const r = Router();
  const motor = deps.engine ?? motorPorOmissao;
  let descarga: EstadoDescarga | null = null;
  let aDesistir: AbortController | null = null;

  /** O caminho e o idioma do modelo escolhido, ou `null` depois de responder 409 a dizer o que falta. */
  const modeloPronto = (res: express.Response): { caminho: string; idioma: string } | null => {
    const def = readVoiceSettings();
    const modelo = voiceModelById(def.modeloVoz);
    const achado = modelo === null ? null : locateModel(modelo);
    if (achado === null) {
      res.status(409).json({ error: 'falta o modelo de voz', codigo: 'modelo-em-falta', modelo: def.modeloVoz });
      return null;
    }
    return { caminho: achado.caminho, idioma: def.idioma };
  };

  r.get('/voice/status', (_req, res) => {
    res.json({
      modelos: VOICE_MODELS.map((m) => ({ id: m.id, nome: m.nome, bytes: m.bytes, origem: locateModel(m)?.origem ?? null })),
      idiomas: VOICE_LANGUAGES,
      descarga,
      definicoes: readVoiceSettings(),
      instrucoesOriginais: INSTRUCOES,
      falhaDoMotor: motor.ultimaFalha,
      motorCarregado: motor.carregado,
      maxSegundos: MAX_DICTATION_SECONDS,
    });
  });

  r.put('/voice/settings', express.json({ limit: '64kb' }), (req, res) => {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'o corpo do pedido tem de ser um objeto JSON' });
    }
    const antes = readVoiceSettings().modeloVoz;
    const novas = updateVoiceSettings(req.body);
    // Trocar de modelo larga o carregado: o seguinte carrega no próximo ditado.
    if (novas.modeloVoz !== antes) motor.parar();
    res.json(novas);
  });

  r.post('/voice/prepare', async (_req, res) => {
    const pronto = modeloPronto(res);
    if (pronto === null) return;
    try {
      await motor.preparar(pronto.caminho);
      res.json({ ok: true });
    } catch (e) {
      res.status(502).json({ error: 'o motor de voz não carregou', detail: (e as Error).message });
    }
  });

  r.post('/voice/download', express.json({ limit: '4kb' }), (req, res) => {
    if (descarga?.fase === 'a-descarregar') {
      return res.status(409).json({ error: 'já há uma descarga a decorrer', modelo: descarga.modelo });
    }
    const pedido = (req.body ?? {}) as { modelo?: unknown };
    const id = typeof pedido.modelo === 'string' ? pedido.modelo : readVoiceSettings().modeloVoz;
    const modelo = voiceModelById(id);
    if (modelo === null) return res.status(400).json({ error: `não conheço o modelo de voz ${JSON.stringify(id)}` });
    if (locateModel(modelo) !== null) return res.json({ ok: true, jaExistia: true });

    const desistir = new AbortController();
    aDesistir = desistir;
    descarga = { fase: 'a-descarregar', modelo: modelo.id, recebidos: 0, total: modelo.bytes };
    void descarregarModelo(modelo, desistir.signal, (recebidos) => {
      descarga = { fase: 'a-descarregar', modelo: modelo.id, recebidos, total: modelo.bytes };
    }, deps.fetchImpl)
      .then(() => {
        console.log(`[voz] modelo descarregado: ${modelo.id}`);
        descarga = { fase: 'pronto', modelo: modelo.id };
      })
      .catch((e: unknown) => {
        const porque = desistir.signal.aborted ? 'cancelaste a descarga' : (e as Error).message;
        console.warn(`[voz] descarga de ${modelo.id} falhou: ${porque}`);
        descarga = { fase: 'falhou', modelo: modelo.id, porque };
      })
      .finally(() => { if (aDesistir === desistir) aDesistir = null; });
    res.status(202).json({ ok: true });
  });

  r.delete('/voice/download', (_req, res) => {
    aDesistir?.abort();
    res.json({ ok: true });
  });

  r.post(
    '/voice/transcribe',
    express.raw({ type: 'application/octet-stream', limit: MAX_PCM_BYTES + 4 }),
    async (req, res) => {
      let pcm: Float32Array;
      try { pcm = pcmDoCorpo(req.body, req.get('x-sample-rate')); } catch (e) { return responderErro(res, e); }
      const pronto = modeloPronto(res);
      if (pronto === null) return;
      const inicio = Date.now();
      try {
        const r2 = await motor.transcrever(pronto.caminho, pcm, pronto.idioma);
        const ms = Date.now() - inicio;
        console.log(`[voz] ditado transcrito: ${Math.round(pcm.length / SAMPLE_RATE)} s de áudio em ${ms} ms`);
        res.json({ texto: r2.texto, truncado: r2.truncado, ms });
      } catch (e) {
        res.status(502).json({ error: 'o motor de voz falhou', detail: (e as Error).message });
      }
    },
  );

  r.post('/voice/correct', express.json({ limit: '15mb' }), async (req, res) => {
    const corpo = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as { texto?: unknown; imagem?: unknown; contexto?: unknown };
    let imagem: ImagemDeContexto | null;
    let contexto: string | null;
    try {
      if (typeof corpo.texto !== 'string' || corpo.texto.trim() === '') throw new PedidoInvalido('o pedido não trazia texto');
      if (corpo.texto.length > MAX_TEXT_CHARS) throw new PedidoInvalido(`o texto passa de ${MAX_TEXT_CHARS} caracteres`, 413);
      imagem = imagemDoPedido(corpo.imagem);
      if (corpo.contexto !== undefined && corpo.contexto !== null && typeof corpo.contexto !== 'string') {
        throw new PedidoInvalido('o contexto do terminal tem de ser texto');
      }
      contexto = typeof corpo.contexto === 'string' ? corpo.contexto.slice(-MAX_CONTEXT_CHARS) : null;
    } catch (e) { return responderErro(res, e); }
    const texto = corpo.texto as string;
    const def = readVoiceSettings();
    if (!def.correcaoLigada) {
      return res.json({ corrigido: false, texto, aviso: 'a limpeza está desligada nas Definições', ms: 0 });
    }
    res.json(await corrigirTexto({ texto, imagem, contexto, modelo: def.modeloCorrecao, termos: def.termos, instrucoes: def.instrucoes }, { correr: deps.correr }));
  });

  return r;
}
