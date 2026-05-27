import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7372,
    proxy: {
      '/ws': {
        target: 'ws://localhost:7371',
        ws: true,
      },
      '/upload': { target: 'http://localhost:7371' },
      '/files': { target: 'http://localhost:7371' },
      '/file-content': { target: 'http://localhost:7371' },
      '/open': { target: 'http://localhost:7371' },
      '/projects': { target: 'http://localhost:7371' },
      '/runtime': { target: 'http://localhost:7371' },
      '/cli-tools': { target: 'http://localhost:7371' },
      '/joca-items': { target: 'http://localhost:7371' },
      '/toolkit-item': { target: 'http://localhost:7371' },
      '/file-op': { target: 'http://localhost:7371' },
      '/file-diff': { target: 'http://localhost:7371' },
      '/project-memory': { target: 'http://localhost:7371' },
      '/ui-settings': { target: 'http://localhost:7371' },
      '/rate-limits': { target: 'http://localhost:7371' },
      '/joca-logic': { target: 'http://localhost:7371' },
      '/knowledge-graph': { target: 'http://localhost:7371' },
    },
  },
});
