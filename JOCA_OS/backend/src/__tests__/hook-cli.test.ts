// `joca hook <Evento>` — o contrato que o Claude Code exige de um hook (issue #6):
//   stdout VAZIO (no UserPromptSubmit o stdout entra no contexto do modelo), exit 0 SEMPRE (exit 2
//   bloqueia o agente) e depressa, mesmo com o backend desligado. E só o detalhe filtrado sai.
import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import http from 'http';
import type { AddressInfo } from 'net';
import { JOCA_CLI_PATH } from '../agent-bridge';

function correrHook(event: string, stdin: string, env: Record<string, string>) {
  return new Promise<{ code: number | null; stdout: string; stderr: string; ms: number }>((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [JOCA_CLI_PATH, 'hook', event], {
      env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', ...env },
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => resolve({ code, stdout, stderr, ms: Date.now() - t0 }));
    child.stdin.end(stdin);
  });
}

describe('joca hook', () => {
  it('backend desligado: exit 0, stdout e stderr vazios, dentro do tecto', async () => {
    const r = await correrHook('UserPromptSubmit', JSON.stringify({ prompt: 'olá' }), {
      JOCA_SESSION_ID: 'sessao-x', JOCA_API_URL: 'http://127.0.0.1:1',
    });
    expect(r).toMatchObject({ code: 0, stdout: '', stderr: '' });
    expect(r.ms).toBeLessThan(3000);
  });

  it('envia só o evento e o detalhe filtrado, sem escrever nada', async () => {
    const recebidos: { url?: string; body: string; sessao?: string }[] = [];
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        recebidos.push({ url: req.url, body, sessao: req.headers['x-joca-session'] as string });
        res.end('{"ok":true}');
      });
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
    const port = (srv.address() as AddressInfo).port;
    try {
      const r = await correrHook('StopFailure', JSON.stringify({
        hook_event_name: 'StopFailure', error: 'rate_limit', transcript_path: '/segredo', session_id: 'y',
      }), { JOCA_SESSION_ID: 'sessao-x', JOCA_API_URL: `http://127.0.0.1:${port}` });
      expect(r).toMatchObject({ code: 0, stdout: '', stderr: '' });
    } finally { srv.close(); }
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0].url).toBe('/sessions/sessao-x/agent-event');
    expect(recebidos[0].sessao).toBe('sessao-x');
    expect(JSON.parse(recebidos[0].body)).toEqual({ event: 'StopFailure', detail: { message: 'rate_limit' } });
  });
});
