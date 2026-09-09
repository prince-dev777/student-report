import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (!res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backend server starting up...' }));
            }
          });
        }
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (!res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backend server starting up...' }));
            }
          });
        }
      }
    },
    watch: {
      ignored: ['**/server/**', '**/.wwebjs_cache/**', '**/.wwebjs_auth/**']
    }
  },
  build: {
    modulePreload: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('src/data/test-series') || normalized.includes('questions_')) {
            return 'data-test-series';
          }
          if (normalized.includes('node_modules')) {
            if (normalized.includes('react/') || normalized.includes('react-dom') || normalized.includes('react-router')) {
              return 'vendor-react';
            }
            if (normalized.includes('xlsx') || normalized.includes('exceljs')) {
              return 'vendor-sheets';
            }
            if (normalized.includes('jspdf') || normalized.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            if (normalized.includes('recharts') || normalized.includes('d3-')) {
              return 'vendor-charts';
            }
            if (normalized.includes('katex')) {
              return 'vendor-math';
            }
            if (normalized.includes('framer-motion') || normalized.includes('lucide-react')) {
              return 'vendor-ui';
            }
            return 'vendor-core';
          }
        }
      }
    }
  }
})
