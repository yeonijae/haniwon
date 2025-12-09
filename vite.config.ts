import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@portal': path.resolve(__dirname, './src/modules/portal'),
      '@manage': path.resolve(__dirname, './src/modules/manage'),
      '@chart': path.resolve(__dirname, './src/modules/chart'),
      '@inventory': path.resolve(__dirname, './src/modules/inventory'),
      '@treatment': path.resolve(__dirname, './src/modules/treatment'),
      '@funnel': path.resolve(__dirname, './src/modules/funnel'),
      '@content': path.resolve(__dirname, './src/modules/content'),
      '@blog': path.resolve(__dirname, './src/modules/blog'),
      '@acting': path.resolve(__dirname, './src/modules/acting'),
    },
  },
  server: {
    port: 5170,
    host: '0.0.0.0'
  }
})
