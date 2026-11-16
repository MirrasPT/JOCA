// Definições do ditado: modelo de voz (e a descarga dele), idioma, limpeza por Claude e termos.
import { useCallback, useEffect, useState } from 'react';
import {
  descarregarModeloDeVoz,
  desistirDaDescarga,
  emMegabytes,
  gravarDefinicoes,
  lerEstadoDeVoz,
  type DefinicoesDeVoz,
  type EstadoDeVoz,
} from './voice-client';
import './dictation.css';

// Aliases do `claude --model`. «Sem limpeza» desliga a limpeza e fica a transcrição em bruto.
const LIMPEZAS: { valor: string; label: string }[] = [
  { valor: 'off', label: 'Sem limpeza (texto em bruto)' },
  { valor: 'haiku', label: 'Haiku (rápido, por omissão)' },
  { valor: 'sonnet', label: 'Sonnet' },
  { valor: 'opus', label: 'Opus' },
];

export default function VoiceSettings() {
  const [estado, setEstado] = useState<EstadoDeVoz | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  // `null` = não se está a editar: mostra-se o que está guardado.
  const [termos, setTermos] = useState<string | null>(null);

  const ler = useCallback(() => {
    lerEstadoDeVoz()
      .then((e) => { setEstado(e); setErro(null); })
      .catch((e: unknown) => setErro((e as Error).message));
  }, []);

  useEffect(() => { ler(); }, [ler]);

  // Durante a descarga, o progresso pergunta-se a cada segundo.
  const aDescarregar = estado?.descarga?.fase === 'a-descarregar';
  useEffect(() => {
    if (!aDescarregar) return;
    const t = window.setInterval(ler, 1000);
    return () => window.clearInterval(t);
  }, [aDescarregar, ler]);

  const gravar = useCallback((parcial: Partial<DefinicoesDeVoz>) => {
    gravarDefinicoes(parcial)
      .then((definicoes) => {
        setEstado((e) => (e ? { ...e, definicoes } : e));
        setGuardado(true);
        window.setTimeout(() => setGuardado(false), 1800);
      })
      .catch((e: unknown) => setErro((e as Error).message));
  }, []);

  if (!estado) {
    return (
      <div className="settings-service-card">
        <div className="settings-service-head">
          <span className="status-pill status-pill--connected">voz</span>
          <span>Ditado</span>
        </div>
        <p>{erro ? `Não consegui ler o estado do ditado: ${erro}` : 'A carregar…'}</p>
      </div>
    );
  }

  const { definicoes, modelos, idiomas, descarga } = estado;
  const escolhido = modelos.find((m) => m.id === definicoes.modeloVoz);
  const limpeza = definicoes.correcaoLigada ? definicoes.modeloCorrecao : 'off';
  const limpezas = LIMPEZAS.some((l) => l.valor === limpeza) ? LIMPEZAS : [...LIMPEZAS, { valor: limpeza, label: limpeza }];

  return (
    <div className="settings-service-card">
      <div className="settings-service-head">
        <span className={`status-pill status-pill--${escolhido?.origem ? 'connected' : 'offline'}`}>
          {escolhido?.origem ? 'pronto' : 'falta o modelo'}
        </span>
        <span>Ditado</span>
      </div>
      <p>
        O microfone na barra de cada terminal transcreve nesta máquina (Parakeet, o motor do Handy) e
        põe o texto na caixa, por enviar. A limpeza opcional usa o teu <code>claude</code> com as
        últimas linhas do terminal como contexto.
      </p>
      <div className="voz-definicoes">
        <div className="settings-default-cli-row">
          <label className="settings-default-cli-label" htmlFor="voz-modelo">Modelo de voz</label>
          <select
            id="voz-modelo"
            className="settings-default-cli-select"
            value={definicoes.modeloVoz}
            onChange={(e) => gravar({ modeloVoz: e.target.value })}
          >
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome} · {m.origem ? 'no disco' : `${emMegabytes(m.bytes)} por descarregar`}
              </option>
            ))}
          </select>
          {guardado && <span className="settings-save-flag settings-save-flag--saved" role="status">guardado ✓</span>}
        </div>
        {escolhido && !escolhido.origem && !aDescarregar && (
          <div>
            <button type="button" className="db-project-card-btn" onClick={() => { void descarregarModeloDeVoz(escolhido.id).then(ler).catch((e: unknown) => setErro((e as Error).message)); }}>
              Descarregar ({emMegabytes(escolhido.bytes)})
            </button>
          </div>
        )}
        {descarga?.fase === 'a-descarregar' && (
          <p className="settings-default-cli-hint" role="status">
            A descarregar: {Math.floor((descarga.recebidos / descarga.total) * 100)}% ({emMegabytes(descarga.recebidos)} de {emMegabytes(descarga.total)}).{' '}
            <button type="button" className="ditado-accao" onClick={() => { void desistirDaDescarga().then(ler); }}>Cancelar</button>
          </p>
        )}
        {descarga?.fase === 'falhou' && <p className="settings-default-cli-hint">A última descarga falhou: {descarga.porque}.</p>}

        <div className="settings-default-cli-row">
          <label className="settings-default-cli-label" htmlFor="voz-idioma">Idioma</label>
          <select id="voz-idioma" className="settings-default-cli-select" value={definicoes.idioma} onChange={(e) => gravar({ idioma: e.target.value })}>
            <option value="auto">Detectar sozinho</option>
            {idiomas.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div className="settings-default-cli-row">
          <label className="settings-default-cli-label" htmlFor="voz-limpeza">Limpeza</label>
          <select
            id="voz-limpeza"
            className="settings-default-cli-select"
            value={limpeza}
            onChange={(e) => gravar(e.target.value === 'off' ? { correcaoLigada: false } : { correcaoLigada: true, modeloCorrecao: e.target.value })}
          >
            {limpezas.map((l) => <option key={l.valor} value={l.valor}>{l.label}</option>)}
          </select>
        </div>

        <label className="settings-default-cli-label" htmlFor="voz-termos">Termos que o modelo de voz ouve mal (separados por vírgulas)</label>
        <textarea
          id="voz-termos"
          className="voz-definicoes-termos"
          value={termos ?? definicoes.termos.join(', ')}
          onChange={(e) => setTermos(e.target.value)}
          onBlur={() => {
            if (termos === null) return;
            gravar({ termos: termos.split(/[,\n]/).map((t) => t.trim()).filter(Boolean) });
            setTermos(null);
          }}
        />
        <p className="settings-default-cli-hint">
          O áudio, o texto e o contexto nunca são gravados em disco nem nos logs. Se a limpeza falhar,
          fica a transcrição em bruto.
        </p>
        {estado.falhaDoMotor && <p className="settings-default-cli-hint">Última falha do motor: {estado.falhaDoMotor}</p>}
        {erro && <p className="settings-default-cli-hint">{erro}</p>}
      </div>
    </div>
  );
}
