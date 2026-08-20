// System routes — the persistent-inbox / multi-CLI surface.
//   /notifications  → persistent inbox (survives closed tabs; unread state)
//   /cli-profiles   → the CLIs a session can run on, with availability
import express, { Router } from 'express';
import {
  loadNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, unreadCount,
  pushNotification,
} from '../notifications/store';
import { loadCliProfiles, CLI_IDS, type CliId } from '../cli-profiles';
import { binExists } from '../providers/provider';
import { execFile } from 'child_process';

// ── Selector de pasta nativo: o comando por plataforma ───────────────────────
// Função pura + exportada para ser testável fora do Windows (nenhuma máquina Windows aqui
// consegue ser reproduzida; o que se testa é a FORMA do comando).
//
// Windows — o script anterior falhava em silêncio por três motivos, todos corrigidos aqui:
//  1. `ShowDialog()` SEM janela dona. O diálogo nasce dentro de uma árvore de processos de
//     fundo (`JOCA OS.vbs` corre o `start.bat` com window style 0 → `start /b "" cmd /c` →
//     node → powershell), que nunca teve o foreground. O Windows não deixa um processo
//     nessas condições roubar o primeiro plano: a janela abre ATRÁS do browser ou limita-se
//     a piscar na barra de tarefas — para o utilizador, "o botão não faz nada". Uma janela
//     dona `TopMost`, activada antes, e passada a `ShowDialog($owner)`, força-a à frente.
//  2. O script trazia aspas DUPLAS lá dentro. Na linha de comando do Windows o Node tem de
//     as escapar (`\"`) e a re-análise que o powershell.exe faz do seu próprio command line
//     é território conhecido de partir-se. Aqui é tudo plicas: zero aspas duplas, zero escape.
//  3. `RootFolder` ficava no default (Desktop). No Windows não há raiz única — o nível de topo
//     são as unidades. `MyComputer` põe C:\, D:\, G:\… à cabeça da árvore.
// Ver também o ponto 4 no handler: cancelar (1) deixou de ser indistinguível de rebentar (2).
const WINDOWS_PICKER_BODY = [
  `Add-Type -AssemblyName System.Windows.Forms`,
  `$owner=New-Object System.Windows.Forms.Form`,
  `$owner.StartPosition='Manual'`,
  `$owner.Left=-4000`,
  `$owner.Top=-4000`,
  `$owner.Width=1`,
  `$owner.Height=1`,
  `$owner.ShowInTaskbar=$false`,
  `$owner.TopMost=$true`,
  `$owner.Show()`,
  `$owner.Activate()`,
  `$d=New-Object System.Windows.Forms.FolderBrowserDialog`,
  `$d.Description='Escolhe a pasta do projecto'`,
  `$d.RootFolder=[System.Environment+SpecialFolder]::MyComputer`,
  `$d.ShowNewFolderButton=$true`,
  `$r=$d.ShowDialog($owner)`,
  `$owner.Close()`,
  `if($r -eq [System.Windows.Forms.DialogResult]::OK -and $d.SelectedPath){[Console]::Out.Write($d.SelectedPath);exit 0}`,
  `exit 1`,
].join('; ');

export const WINDOWS_PICKER_PS =
  `$ErrorActionPreference='Stop'; try{ ${WINDOWS_PICKER_BODY} }catch{ [Console]::Error.Write($_.Exception.Message); exit 2 }`;

export type FolderPickerSpec = { cmd: string; args: string[]; trimTrailingSlash: boolean };

export function folderPickerCommand(platform: NodeJS.Platform = process.platform): FolderPickerSpec {
  if (platform === 'win32') {
    return {
      cmd: 'powershell.exe',
      args: ['-NoProfile', '-STA', '-Command', WINDOWS_PICKER_PS],
      // Em Windows o caminho pode SER a raiz de uma unidade (`C:\`) — cortar a barra final
      // transformava-a em `C:` (caminho relativo ao directório actual dessa unidade).
      trimTrailingSlash: false,
    };
  }
  if (platform === 'darwin') {
    return {
      cmd: 'osascript',
      args: ['-e', 'POSIX path of (choose folder with prompt "Escolhe a pasta do projecto")'],
      trimTrailingSlash: true,
    };
  }
  // Linux: zenity quando existe; sem ele, o modal cai no campo manual.
  return {
    cmd: 'zenity',
    args: ['--file-selection', '--directory', '--title=Escolhe a pasta do projecto'],
    trimTrailingSlash: true,
  };
}

export function systemRouter(): Router {
  const r = Router();

  // ── Native folder picker ───────────────────────────────────────────────────
  // O JOCA corre na máquina do dono — o backend PODE abrir o diálogo nativo de escolher pasta
  // (Finder/Explorer) e devolver o caminho absoluto, coisa que o browser sozinho não consegue
  // (webkitdirectory só dá caminhos relativos). Usado pelo modal de criar/editar projecto.
  // Serializado: um diálogo de cada vez — dois pedidos seguidos não abrem duas janelas.
  let pickerBusy = false;
  r.post('/pick-folder', (_req, res) => {
    if (pickerBusy) return res.status(409).json({ error: 'já há um selector de pasta aberto' });
    pickerBusy = true;
    const done = (status: number, body: object) => { pickerBusy = false; res.status(status).json(body); };
    const timeoutMs = 5 * 60_000; // o dono pode demorar a escolher — não cortar cedo
    const spec = folderPickerCommand();
    execFile(spec.cmd, spec.args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        const code = (err as { code?: number | string }).code;
        // 4. Uma falha REAL deixa de se disfarçar de "cancelei". Antes, qualquer erro do
        //    picker (binário em falta, WinForms indisponível, thread não-STA, política do
        //    PowerShell) devolvia 200 {canceled:true} — o utilizador clicava e não acontecia
        //    nada, sem erro nenhum no ecrã. Agora só o cancelamento é silencioso.
        if (code === 'ENOENT') {
          return done(500, { error: `selector de pastas indisponível: ${spec.cmd} não encontrado` });
        }
        if (code === 2) { // convenção do script do Windows: 2 = rebentou, 1 = cancelado
          const why = (stderr || '').trim().slice(0, 300) || 'erro desconhecido no selector';
          return done(500, { error: `selector de pastas falhou: ${why}` });
        }
        return done(200, { canceled: true }); // cancelar sai com código ≠ 0 em todos os pickers
      }
      const raw = stdout.trim();
      const p = spec.trimTrailingSlash ? raw.replace(/\/$/, '') : raw;
      done(200, p ? { path: p } : { canceled: true });
    });
  });

  // ── Notifications inbox ────────────────────────────────────────────────────
  r.get('/notifications', (req, res) => {
    const onlyUnread = req.query.unread === '1';
    const list = loadNotifications();
    res.json({
      unread: unreadCount(),
      notifications: (onlyUnread ? list.filter((n) => !n.read) : list).slice(-200).reverse(),
    });
  });

  // Push a notification into the inbox. Used by agents inside terminals (joca notify) to reach the
  // user when they finish something long-running.
  r.post('/notifications', express.json({ limit: '256kb' }), (req, res) => {
    const b = (req.body ?? {}) as { text?: unknown; title?: unknown; kind?: unknown };
    if (typeof b.text !== 'string' || !b.text.trim()) return res.status(400).json({ error: 'text obrigatorio' });
    res.json(pushNotification({
      kind: 'system',
      title: typeof b.title === 'string' && b.title.trim() ? b.title : 'Terminal',
      text: b.text,
    }));
  });

  r.patch('/notifications/:id', express.json(), (req, res) => {
    const read = (req.body ?? {}).read !== false;
    const n = markNotificationRead(req.params.id, read);
    if (!n) return res.status(404).json({ error: 'not found' });
    res.json(n);
  });

  r.post('/notifications/read-all', (_req, res) => {
    res.json({ marked: markAllNotificationsRead() });
  });

  r.delete('/notifications/:id', (req, res) => {
    res.json({ ok: deleteNotification(req.params.id) });
  });


  // ── Multi-CLI profiles ─────────────────────────────────────────────────────
  r.get('/cli-profiles', async (_req, res) => {
    const profiles = loadCliProfiles();
    const availability = await Promise.all(CLI_IDS.map((id) => binExists(profiles[id].bin)));
    res.json(CLI_IDS.map((id: CliId, i) => ({
      id, label: profiles[id].label, bin: profiles[id].bin, available: availability[i],
      startupSequence: profiles[id].startupSequence,
      // O botão "Resume" da barra de comandos remonta o mesmo comando do arranque, e a forma dele
      // muda por CLI (`/resume` no claude, `resume` nos outros) e é sobreponível em
      // cli-profiles.json — por isso vai daqui em vez de estar escrito à mão no frontend.
      resumeCmd: profiles[id].resumeCmd,
    })));
  });

  return r;
}
