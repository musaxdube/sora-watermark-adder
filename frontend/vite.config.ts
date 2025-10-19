import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/upload": "http://localhost:3000",
      "/progress": "http://localhost:3000",
      "/download": "http://localhost:3000",
    },
  },
});
