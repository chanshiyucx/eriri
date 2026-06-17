import path from 'path'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type UserConfig } from 'vite'

export default defineConfig(
  async (): Promise<UserConfig> => ({
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      // Bind on the LAN so phones/tablets can load the HMR dev server at
      // http://<mac-ip>:1420 and get live updates (not just the Mac).
      host: true,
      watch: {
        ignored: ['**/src-tauri/**'],
      },
      // In dev the UI is served by Vite (HMR) but the data/image API lives on
      // the embedded axum server. Proxy those paths so loading from :1420
      // works just like the production server on :1430.
      proxy: {
        '/api': 'http://127.0.0.1:1430',
        '/file': 'http://127.0.0.1:1430',
      },
    },
  }),
)
