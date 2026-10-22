import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // port busy ho to dusre port pe shift mat karo, error do (warna CORS/Firebase authorized domain tootta hai)
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
})
