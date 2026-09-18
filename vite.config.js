import { defineConfig, loadEnv } from "vite";
import { applicationApi } from "./server/api.js";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const middleware = applicationApi({
    ...loadEnv(mode, process.cwd(), ["NEXTCLOUD_", "STAFF_", "CONTENT_"]),
    ...process.env,
  });
  return {
    plugins: [
      react(),
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
