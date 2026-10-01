import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: { port: 5173 },

  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split heavy vendor libs into separate cached chunks.
        // Each chunk is downloaded once and cached independently,
        // so a UI-only change does not bust the Recharts/Framer cache.
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'chunk-react';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'chunk-framer';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-vendor')) {
            return 'chunk-recharts';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'chunk-lucide';
          }
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/engine.io-client')) {
            return 'chunk-socket';
          }
        },
      },
    },
  },

  // Drop all console.* and debugger statements in production builds.
  // This directly fixes the Lighthouse "Best Practices" deduction for
  // "Browser errors were logged to the console."
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none',
  },
});

