import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7352,
    proxy: {
      '/ws': {
        target: 'ws://localhost:7351',
        ws: true,
      },
      '/upload': { target: 'http://localhost:7351' },
      '/files': { target: 'http://localhost:7351' },
      '/file-content': { target: 'http://localhost:7351' },
      '/open': { target: 'http://localhost:7351' },
      '/projects': { target: 'http://localhost:7351' },
      '/joca-items': { target: 'http://localhost:7351' },
    },
  },
});
