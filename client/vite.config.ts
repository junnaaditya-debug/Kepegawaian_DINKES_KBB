import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Dipakai hanya jika VITE_API_URL tidak diset (lihat src/api/client.ts) — forward ke
    // Worker Cloudflare yang dijalankan via `wrangler dev` (default port 8787).
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
