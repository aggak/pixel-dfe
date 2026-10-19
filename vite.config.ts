import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: {
    '@untitledui/icons': fileURLToPath(new URL('./src/design/uicons.tsx', import.meta.url)),
    '@untitledui/file-icons': fileURLToPath(new URL('./src/design/file-icon.tsx', import.meta.url)),
    '@': fileURLToPath(new URL('./src/design/vendor', import.meta.url)),
  } },
})
