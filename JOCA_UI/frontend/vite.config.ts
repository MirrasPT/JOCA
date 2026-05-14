import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7342,
    proxy: {
      '/ws': {
        target: 'ws://localhost:7341',
        ws: true,
      },
      '/upload': { target: 'http://localhost:7341' },
      '/files': { target: 'http://localhost:7341' },
      '/file-content': { target: 'http://localhost:7341' },
      '/open': { target: 'http://localhost:7341' },
      '/projects': { target: 'http://localhost:7341' },
      '/joca-items': { target: 'http://localhost:7341' },
    },
  },
});
