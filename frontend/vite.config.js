import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API is proxied so the session cookie stays same-origin (SameSite=strict).
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      // Long-lived vendor chunks: app releases do not invalidate them.
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
    },
  },
});
