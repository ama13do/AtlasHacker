import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@map': fileURLToPath(new URL('./src/modules/map/', import.meta.url)),
        '@testimonies': fileURLToPath(new URL('./src/modules/testimonies/', import.meta.url)),
        '@admin': fileURLToPath(new URL('./src/modules/admin/', import.meta.url)),
      },
    },
    server: {
      // La base y los secretos de `npm run api:local` nunca se sirven (con --host serían visibles en la red)
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.local-db/**'] },
      // En dev la API se llama por el mismo origen (/api) y Vite la reenvía: evita el CORS de la API,
      // que solo permite el dominio de producción
      proxy: env.VITE_API_URL ? { '/api': { target: env.VITE_API_URL, changeOrigin: true } } : undefined,
    },
  }
})
