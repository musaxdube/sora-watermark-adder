import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/upload": "https://sora-watermark-adder.vercel.app",
      "/progress": "https://sora-watermark-adder.vercel.app",
      "/download": "https://sora-watermark-adder.vercel.app",
    },
  },
})
