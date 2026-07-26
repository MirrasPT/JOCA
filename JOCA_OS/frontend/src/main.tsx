import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '@xterm/xterm/css/xterm.css';
import 'highlight.js/styles/github-dark.css';
import './App.css';
import App from './App';
import LoginScreen from './components/LoginScreen';

// AuthGate — checks GET /auth/status on mount. While loading shows a minimal spinner; if auth is
// enabled and the cookie is missing/expired shows the LoginScreen; otherwise mounts the App. After
// a successful login it re-checks the status (the httpOnly cookie was just set) and mounts the App.
function AuthGate() {
  const [status, setStatus] = useState<{ enabled: boolean; authenticated: boolean } | null>(null);
  const [failed, setFailed] = useState(false);

  const check = useCallback(() => {
    fetch('/auth/status')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s: { enabled: boolean; authenticated: boolean }) => { setStatus(s); setFailed(false); })
      .catch(() => {
        // Backend unreachable or old backend without /auth — don't lock the user out of the UI.
        setStatus({ enabled: false, authenticated: false });
        setFailed(true);
      });
  }, []);

  useEffect(() => { check(); }, [check]);

  if (status === null) {
    return (
      <div className="auth-gate-loading" aria-label="A carregar">
        <div className="auth-gate-spinner" aria-hidden />
      </div>
    );
  }
  if (status.enabled && !status.authenticated && !failed) {
    return <LoginScreen onSuccess={check} />;
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<AuthGate />);

// PWA: register the service worker only in production builds — in dev it would cache Vite's
// module graph and break HMR. sw.js lives in public/ and is copied as-is to dist/.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* PWA é opcional */ });
  });
}
