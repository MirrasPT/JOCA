import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const FRONTEND_PORT = Number(process.env.JOCA_FRONTEND_PORT ?? 7372);
const BACKEND_PORT = process.env.JOCA_BACKEND_PORT ?? '7371';
const http = `http://localhost:${BACKEND_PORT}`;
const ws = `ws://localhost:${BACKEND_PORT}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: FRONTEND_PORT,
    proxy: {
      '/ws': { target: ws, ws: true },
      '/upload': { target: http },
      '/files': { target: http },
      '/file-content': { target: http },
      '/open': { target: http },
      '/projects': { target: http },
      '/runtime': { target: http },
      '/cli-tools': { target: http },
      '/joca-items': { target: http },
      '/toolkit-item': { target: http },
      '/file-op': { target: http },
      '/file-diff': { target: http },
      '/project-memory': { target: http },
      '/ui-settings': { target: http },
      '/rate-limits': { target: http },
      '/joca-logic': { target: http },
      '/knowledge-graph': { target: http },
    },
  },
});
