// OpenPorts — «Portas abertas» na barra do projecto (issue #13).
//
// Mostra as portas TCP em escuta dos processos que correm nos terminais deste projecto (um
// `npm run dev` na 5173, por exemplo), com link para abrir. Vive na barra fina e não numa faixa
// própria: o palco do workspace é o terminal, e uma faixa a mais comia-lhe altura mesmo vazia.
//
// Polling de 10 s só enquanto está montado — ou seja, só enquanto a vista do projecto está aberta —
// e parado com o separador escondido (retoma com um pedido logo ao voltar). 10 s = a cache do
// backend (ports.ts): com uma cache mais curta que o intervalo, cada poll falha a cache e lança
// um PowerShell novo. Não baixar a cache abaixo do intervalo.
// Não há polling quando o projecto não tem terminais: sem terminal não há de onde vir porta.
//
// Uma falha (503 do backend, 401, rede em baixo) mostra-se como falha, nunca como «nenhuma».
// O componente é remontado por projecto (`key` no ProjectWorkspace): as portas do projecto
// anterior nunca aparecem por baixo do novo enquanto o primeiro pedido não responde.
import { useEffect, useState } from 'react';

interface OpenPort {
  port: number;
  pid: number;
  processName?: string;
  sessionId: string;
  sessionName: string;
  url: string;
}

const POLL_MS = 10_000;

export default function OpenPorts({ projectId, terminalCount }: { projectId: string; terminalCount: number }) {
  const [ports, setPorts] = useState<OpenPort[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (terminalCount === 0) return;
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      fetch(`/projects/${projectId}/ports`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((list: unknown) => {
          if (!alive) return;
          if (!Array.isArray(list)) throw new Error('resposta inválida');
          setPorts(list as OpenPort[]);
          setFailed(false);
        })
        .catch(() => { if (alive) setFailed(true); });
    };
    load();
    const t = setInterval(load, POLL_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [projectId, terminalCount]);

  // Sem terminais a lista antiga não vale — deriva-se aqui em vez de a limpar dentro do efeito.
  const shown = terminalCount === 0 ? [] : ports;
  const unavailable = terminalCount > 0 && failed;

  return (
    <div className="pw-ports" aria-label="Portas abertas">
      <span className="pw-ports-label">Portas abertas</span>
      {unavailable ? (
        <span className="pw-ports-error" title="O JOCA não conseguiu ler as portas do sistema (ou o pedido falhou). Tenta de novo sozinho.">
          não foi possível ler as portas
        </span>
      ) : shown.length === 0 ? (
        <span className="pw-ports-empty">nenhuma</span>
      ) : shown.map((p) => (
        <a
          key={`${p.port}:${p.pid}`}
          className="pw-port"
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${p.processName ?? 'processo'} (PID ${p.pid}) — terminal «${p.sessionName}». Abrir ${p.url} num separador novo.`}
        >
          <span className="pw-port-num">:{p.port}</span>
          <span className="pw-port-meta">{p.processName ?? 'processo'} · {p.sessionName}</span>
        </a>
      ))}
    </div>
  );
}
