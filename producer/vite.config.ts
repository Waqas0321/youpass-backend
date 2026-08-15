import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function redirectProducerBase(): Plugin {
  return {
    name: 'redirect-producer-base',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/producer') {
          res.writeHead(301, { Location: '/producer/' });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), redirectProducerBase()],
  base: '/producer/',
  build: {
    outDir: '../public/producer',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
    },
  },
});
