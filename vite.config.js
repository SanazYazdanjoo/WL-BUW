import { defineConfig, loadEnv } from 'vite'
import { nextcloudMiddleware } from './server/nextcloud.js'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const middleware = nextcloudMiddleware(loadEnv(mode, process.cwd(), 'NEXTCLOUD_'))
  return {
    plugins: [react(), tailwindcss(), {
      name: 'nextcloud-api',
      configureServer(server) { server.middlewares.use(middleware) },
      configurePreviewServer(server) { server.middlewares.use(middleware) },
    }],
  }
})
