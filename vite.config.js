import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/tasks': 'http://127.0.0.1:8000',
      '/history': 'http://127.0.0.1:8000',
      '/stats': 'http://127.0.0.1:8000',
      '/version': 'http://127.0.0.1:8000',
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/tasks': 'http://127.0.0.1:8000',
      '/history': 'http://127.0.0.1:8000',
      '/stats': 'http://127.0.0.1:8000',
      '/version': 'http://127.0.0.1:8000',
    },
  },
  build: {
    outDir: 'dist-react',
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'lucide-react'],
  },
})
