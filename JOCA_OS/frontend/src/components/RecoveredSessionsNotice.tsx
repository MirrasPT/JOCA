// O aviso de que o JOCA reiniciou e levou conversas à frente.
//
// O problema que resolve: o backend reinicia, os PTYs morrem, e o `sessions_list` seguinte — que é
// o retrato autoritativo do servidor — poda tudo. A lista esvazia-se em silêncio e quem estava a
// meio de uma conversa fica sem perceber para onde ela foi. A poda está certa; o que faltava era a
// explicação e a única saída honesta: ler o que a conversa tinha escrito. Reabrir não existe de
// propósito — arrancava um CLI NOVO, sem memória nenhuma do que ali se tinha passado.
//
// Não é um modal: não rouba o foco nem tranca a app. Um reinício não é uma decisão a tomar, é uma
// coisa a saber — fica no topo, à espera, até alguém lhe tocar. Só a leitura do output (que é uma
// coisa que se vai LER, e ocupa o ecrã) abre em diálogo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import type { RecoveredSession, RecoveredSnapshot } from '../types';
import './recovered-sessions.css';

interface Props {
  snapshot: RecoveredSnapshot | null;
  onDismiss: () => void;
  onLoadTail: (sessionId: string) => Promise<string>;
}

// Selector do que é alcançável por Tab — o mesmo que o App usa no modal de Definições.
const FOCUSAVEIS = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Geometria de recurso: retrato de um backend anterior aos campos `cols`/`rows`. O valor é o
 *  tamanho com que o backend cria cada PTY — ver `sessions-snapshot.ts`, que normaliza o mesmo. */
const GEOMETRIA_FALLBACK = { cols: 120, rows: 30 };

/** Linhas guardadas acima do ecrã. Uma cauda são <= 256 KB, logo isto nunca é o que a corta. */
const SCROLLBACK = 10_000;

function RestartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Quando o retrato foi guardado. Formato absoluto de propósito: um "há 4 min" calculado no render
 *  envelhece no ecrã sem ninguém o actualizar, e mente a quem deixou o separador aberto. */
function quando(savedAt?: number): string | null {
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt) || savedAt <= 0) return null;
  try {
    return new Date(savedAt).toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return null; }
}

function tamanho(bytes?: number): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function RecoveredSessionsNotice({ snapshot, onDismiss, onLoadTail }: Props) {
  const [aLer, setALer] = useState<RecoveredSession | null>(null);

  const fecharLeitura = useCallback(() => setALer(null), []);

  if (!snapshot || snapshot.sessions.length === 0) return null;

  const total = snapshot.sessions.length;
  const data = quando(snapshot.savedAt);

  return (
    <>
      {/* `role="status"` (aria-live polite) — anuncia-se a quem usa leitor de ecrã sem interromper
          o que estiver a ser lido. Um reinício não é uma emergência. */}
      <section className="rec-notice" role="status" aria-label="Conversas fechadas por reinício">
        <header className="rec-notice-head">
          <span className="rec-notice-icon" aria-hidden><RestartIcon /></span>
          <div className="rec-notice-titles">
            <h2 className="rec-notice-title">O JOCA reiniciou</h2>
            <p className="rec-notice-sub">
              {total === 1 ? 'Uma conversa foi fechada' : `${total} conversas foram fechadas`}
              {data ? ` · ${data}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="rec-notice-x"
            onClick={onDismiss}
            aria-label="Dispensar aviso e apagar o registo das conversas fechadas"
          >
            <CloseIcon />
          </button>
        </header>

        <p className="rec-notice-explain">
          Os terminais não sobrevivem a um reinício do servidor. O output de cada conversa ficou
          guardado e podes lê-lo aqui.
        </p>

        <ul className="rec-notice-list">
          {snapshot.sessions.map((s) => {
            const peso = tamanho(s.tailBytes);
            return (
              <li key={s.id} className="rec-row">
                <div className="rec-row-info">
                  <span className="rec-row-name">{s.name}</span>
                  <span className="rec-row-meta">
                    {s.cli && s.cli !== 'claude' ? <span className="rec-row-cli">{s.cli}</span> : null}
                    <span className="rec-row-cwd" title={s.cwd}>{s.cwd}</span>
                  </span>
                </div>
                <div className="rec-row-actions">
                  <button
                    type="button"
                    className="rec-btn"
                    onClick={() => setALer(s)}
                    disabled={!peso}
                    aria-label={`Ver o output de ${s.name}`}
                    title={peso ? `${peso} de output guardado` : 'Sem output guardado'}
                  >
                    Ver output
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="rec-notice-foot">
          <button type="button" className="rec-btn" onClick={onDismiss}>Dispensar</button>
        </footer>
      </section>

      {aLer && <TailDialog session={aLer} onLoadTail={onLoadTail} onClose={fecharLeitura} />}
    </>
  );
}

/**
 * O output que a conversa tinha quando morreu, repintado por um terminal a sério.
 *
 * Porquê o xterm e não uma limpeza de escapes: o CLI por omissão é o `claude`, um TUI, e um TUI
 * não escreve linhas — redesenha o ecrã por posição (sobe o cursor, apaga a linha, escreve por
 * cima). Quem limpa os escapes e parte o texto por `\n` vê dezenas de linhas visuais coladas num
 * só pedaço e fica com a última, porque foi o último `apagar linha` que mandou. Medido numa cauda
 * real de 2767 caracteres: a limpeza dava 150 caracteres em 2 linhas; o mesmo texto repintado no
 * xterm, na geometria original, dá o ecrã inteiro do Claude Code (nome, versão, modelo, pasta,
 * caixa de escrita e barra de estado).
 *
 * O terminal é só de leitura — nasce sem entrada e sem cursor a piscar, e nada volta para trás:
 * os PTYs morreram com o backend anterior.
 */
function TailDialog({ session, onLoadTail, onClose }: {
  session: RecoveredSession;
  onLoadTail: (sessionId: string) => Promise<string>;
  onClose: () => void;
}) {
  const [cru, setCru] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const cols = session.cols ?? GEOMETRIA_FALLBACK.cols;
  const rows = session.rows ?? GEOMETRIA_FALLBACK.rows;

  useEffect(() => {
    let vivo = true;
    onLoadTail(session.id)
      .then((texto) => { if (vivo) setCru(texto); })
      .catch(() => { if (vivo) setErro('Não foi possível ler o output guardado desta conversa.'); });
    return () => { vivo = false; };
  }, [session.id, onLoadTail]);

  // Foco: capturar quem abriu ANTES de focar o que quer que seja, e devolver-lho ao fechar. Sem
  // `autoFocus` — competir com ele é o caminho conhecido para o foco acabar no <body>.
  // Efeito separado do teclado de propósito: se `onClose` mudar de identidade, só o listener é que
  // se refaz; recapturar o "quem abriu" a meio guardaria o botão de fechar em vez do gatilho.
  useEffect(() => {
    const abriu = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
    return () => { abriu?.focus?.(); };
  }, []);

  useEffect(() => {
    const aoTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const caixa = dialogRef.current;
      if (!caixa) return;
      const focaveis = [...caixa.querySelectorAll<HTMLElement>(FOCUSAVEIS)].filter((el) => el.offsetParent !== null);
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primeiro || activo === caixa)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    // Fase de captura, como o resto da app: o Escape desta caixa não pode escapar para os handlers
    // globais do App (que fechariam outra coisa qualquer).
    document.addEventListener('keydown', aoTeclado, true);
    return () => document.removeEventListener('keydown', aoTeclado, true);
  }, [onClose]);

  return (
    <div
      className="rec-tail-backdrop"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rec-tail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rec-tail-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="rec-tail-head">
          <div className="rec-tail-titles">
            <h2 id="rec-tail-title">{session.name}</h2>
            <p className="rec-tail-cwd">{session.cwd}</p>
          </div>
          <button ref={fecharRef} type="button" className="rec-tail-x" onClick={onClose} aria-label="Fechar">
            <CloseIcon />
          </button>
        </header>

        {/* `tabIndex={0}`: uma caixa que faz scroll tem de ser alcançável por teclado, senão quem
            navega sem rato não consegue lá chegar. */}
        <div className="rec-tail-body" tabIndex={0} role="region" aria-label="Output guardado">
          {erro ? <p className="rec-tail-msg">{erro}</p> : null}
          {!erro && cru === null ? <p className="rec-tail-msg">A ler…</p> : null}
          {!erro && cru !== null ? (
            cru.length > 0 ? <TailReplay cru={cru} cols={cols} rows={rows} />
              : <p className="rec-tail-msg">Esta conversa não tinha output guardado.</p>
          ) : null}
        </div>

        <footer className="rec-tail-foot">
          <span className="rec-tail-note">Repintado como estava no terminal ({cols}×{rows}).</span>
          <button type="button" className="rec-btn" onClick={onClose}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Um xterm só de leitura, com o output cru escrito lá dentro.
 *
 * A geometria é a ORIGINAL, e não a que caberia na caixa: um TUI posiciona em absoluto (`ESC[29;3H`)
 * e apaga por linha, portanto reproduzi-lo mais estreito parte as réguas ao meio e reproduzi-lo mais
 * baixo manda a barra de estado para fora do ecrã. Medido na mesma cauda: 180×32 mostra as 10 linhas
 * do ecrã; 180×24 mostra 6. Se não couber na caixa, é a caixa que faz scroll — a geometria não cede.
 *
 * Cores: só o fundo e o texto vêm dos tokens da app (`--bg-terminal`, `--text-normal`), para o leitor
 * pertencer ao tema activo. As 16 cores ANSI ficam as do xterm; o `minimumContrastRatio` é o mesmo
 * do terminal a sério e é ele que impede um branco cravado de desaparecer sobre fundo claro.
 */
function TailReplay({ cru, cols, rows }: { cru: string; cols: number; rows: number }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const raiz = getComputedStyle(document.documentElement);
    const token = (nome: string) => raiz.getPropertyValue(nome).trim() || undefined;

    const term = new Terminal({
      cols,
      rows,
      fontFamily: token('--font-mono') ?? 'ui-monospace, monospace',
      // 11px e não os 13 do terminal a sério: aqui o ecrã inteiro de uma sessão (30-32 linhas) tem
      // de caber numa caixa, e cada linha custa quase o dobro do tamanho da fonte em altura.
      fontSize: 11,
      lineHeight: 1.4,
      scrollback: SCROLLBACK,
      // Conversa morta: não se escreve nela, e um cursor a piscar num terminal que já não recebe
      // nada é uma promessa falsa.
      disableStdin: true,
      cursorBlink: false,
      cursorInactiveStyle: 'none',
      minimumContrastRatio: 4.5,
      theme: { background: token('--bg-terminal'), foreground: token('--text-normal') },
    });

    term.open(host);
    term.write(cru);

    return () => term.dispose();
  }, [cru, cols, rows]);

  // `width: max-content` (no CSS) para o flex da caixa não encolher o terminal abaixo da largura
  // que a geometria exige — encolher aqui era o mesmo que reproduzir noutra largura.
  return <div className="rec-tail-term" ref={hostRef} />;
}
