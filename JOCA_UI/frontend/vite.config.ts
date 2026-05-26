import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7362,
    proxy: {
      '/ws': {
        target: 'ws://localhost:7361',
        ws: true,
      },
      '/upload': { target: 'http://localhost:7361' },
      '/files': { target: 'http://localhost:7361' },
      '/file-content': { target: 'http://localhost:7361' },
      '/open': { target: 'http://localhost:7361' },
      '/projects': { target: 'http://localhost:7361' },
      '/runtime': { target: 'http://localhost:7361' },
      '/cli-tools': { target: 'http://localhost:7361' },
      '/joca-items': { target: 'http://localhost:7361' },
      '/toolkit-item': { target: 'http://localhost:7361' },
      '/file-op': { target: 'http://localhost:7361' },
      '/file-diff': { target: 'http://localhost:7361' },
      '/project-memory': { target: 'http://localhost:7361' },
      '/session-snapshots': { target: 'http://localhost:7361' },
      '/restore-session': { target: 'http://localhost:7361' },
      '/joca-logic': { target: 'http://localhost:7361' },
      '/knowledge-graph': { target: 'http://localhost:7361' },
    },
  },
});
