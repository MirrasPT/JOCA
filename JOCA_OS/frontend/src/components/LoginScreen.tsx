// LoginScreen — full-screen centered password form shown by AuthGate (main.tsx) when the backend
// has auth enabled and the browser has no valid joca_token cookie. POST /auth/login sets the
// httpOnly cookie server-side; on success we just tell the gate to re-check /auth/status.
import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

export default function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPassword('');
        onSuccess();
        return;
      }
      if (res.status === 429) setError('Demasiadas tentativas. Aguarda um pouco e tenta de novo.');
      else if (res.status === 401) setError('Password errada.');
      else setError('Não foi possível iniciar sessão. Tenta de novo.');
    } catch {
      setError('Sem ligação ao servidor.');
    } finally {
      setBusy(false);
    }
  }, [password, busy, onSuccess]);

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo" aria-hidden>JOCA</div>
        <p className="login-subtitle">Introduz a password para continuar.</p>
        <input
          className="login-input"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          placeholder="Password"
          aria-label="Password"
          autoFocus
          autoComplete="current-password"
        />
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="login-submit" type="submit" disabled={!password || busy}>
          {busy ? 'A entrar…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
