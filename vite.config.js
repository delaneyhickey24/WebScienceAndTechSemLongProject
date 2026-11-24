import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        login: fileURLToPath(new URL('./login.html', import.meta.url))
      }
    }
  },
  server: {
    proxy: {
      "/api": {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
