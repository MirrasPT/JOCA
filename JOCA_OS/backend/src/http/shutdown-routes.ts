// POST /shutdown — o botão «Sair» da dashboard: corre o stop.bat / stop.sh desta instalação, o mesmo
// que o dono faria à mão, para não ter de abrir a pasta.
//
// O stop mata o backend que o lança. Duas coisas garantem que ele chega ao fim:
//  - Windows: o stop.bat faz `taskkill /T` ao PID do backend, que mata a árvore de filhos. Um filho
//    directo do node (mesmo `detached`) morria a meio — antes de chegar ao frontend. Por isso vai
//    por `cmd /c start`: o `start` cria o stop.bat como filho de um cmd intermédio que sai logo, e o
//    stop.bat deixa de estar pendurado na árvore do backend.
//  - Unix: `detached` = `setsid` (sessão e grupo próprios) e stdio a `ignore` — nenhum sinal nem pipe
//    partido do backend morto chega ao stop.sh.
// A resposta 202 sai ANTES do spawn (no `finish`), para o browser a receber enquanto há backend.
import path from 'path';
import { spawn } from 'child_process';
import { Router } from 'express';

/** A pasta JOCA_OS (onde estão os stop.*): src/http e dist/http estão ambas 3 níveis abaixo. */
export const JOCA_OS_DIR = path.resolve(__dirname, '../../..');

export type StopSpec = { cmd: string; args: string[]; windowsVerbatimArguments: boolean };

export function stopCommand(platform: NodeJS.Platform = process.platform, dir = JOCA_OS_DIR): StopSpec {
  if (platform === 'win32') {
    const bat = path.win32.join(dir, 'stop.bat');
    // Verbatim: o Node não re-escapa as aspas; o `/s` tira só o par exterior. `""` é o título do start.
    // `cmd /d /c` explícito: um .bat lançado directo pelo `start` abre como `cmd /K` e a janela fica
    // aberta para sempre (presa à pasta). Com `/c` fecha quando o stop.bat acaba.
    return {
      cmd: 'cmd.exe',
      args: ['/d', '/s', '/c', `"start "" /min cmd /d /c "${bat}""`],
      windowsVerbatimArguments: true,
    };
  }
  return { cmd: 'bash', args: [path.posix.join(dir, 'stop.sh')], windowsVerbatimArguments: false };
}

/** Só a própria máquina pode desligar o JOCA OS. */
export function isLoopbackAddress(addr: string | undefined): boolean {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

export function shutdownRouter(): Router {
  const r = Router();
  let stopping = false;

  r.post('/shutdown', (req, res) => {
    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      return res.status(403).json({ error: 'só se desliga a partir da própria máquina' });
    }
    if (stopping) return res.status(202).json({ ok: true, stopping: true });
    stopping = true;
    const spec = stopCommand();
    res.on('finish', () => {
      const child = spawn(spec.cmd, spec.args, {
        cwd: JOCA_OS_DIR,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        windowsVerbatimArguments: spec.windowsVerbatimArguments,
        // As portas que ESTA instância usa — o stop pára esta e não outra.
        env: {
          ...process.env,
          JOCA_BACKEND_PORT: String(Number(process.env.PORT || 7491)),
          JOCA_FRONTEND_PORT: String(Number(process.env.JOCA_FRONTEND_PORT || 7492)),
        },
      });
      child.on('error', (err) => { stopping = false; console.error('[shutdown] stop falhou:', err.message); });
      child.unref();
    });
    res.status(202).json({ ok: true, stopping: true });
  });

  return r;
}
