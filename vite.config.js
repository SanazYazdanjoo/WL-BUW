import { defineConfig, loadEnv } from "vite";
import { applicationApi } from "./server/api.js";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const middleware = applicationApi({
    ...loadEnv(mode, process.cwd(), "NEXTCLOUD_"),
    ...process.env,
  });
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "nextcloud-api",
        configureServer(server) {
          server.middlewares.use(middleware);
        },
        configurePreviewServer(server) {
          server.middlewares.use(middleware);
        },
      },
    ],
  };
});
