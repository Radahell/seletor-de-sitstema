import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const seletorApiHost = process.env.VITE_SELETOR_API_HOST ?? "seletor-sistema-api";
const seletorApiPort = process.env.VITE_SELETOR_API_PORT ?? process.env.SELETOR_API_PORT ?? "22012";
const seletorWebPort = Number(process.env.VITE_SELETOR_WEB_PORT ?? process.env.SELETOR_WEB_PORT ?? 22011);
const sclHost = process.env.VITE_SCL_HOST ?? "scl";
const sclPort = process.env.VITE_SCL_PORT ?? process.env.SCL_PORT ?? "6000";

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: seletorWebPort,
    strictPort: true,
    proxy: {
      "/seletor-api": {
        target: `http://${seletorApiHost}:${seletorApiPort}`,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/seletor-api/, ""),
      },
      "/scl-api": {
        target: `http://${sclHost}:${sclPort}`,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/scl-api/, ""),
      },
      "/uploads": {
        target: `http://${seletorApiHost}:${seletorApiPort}`,
        changeOrigin: true,
        secure: false,
      },
      "/admin-api": {
        target: `https://${process.env.VITE_ADMIN_HOST ?? "admin"}:${process.env.VITE_ADMIN_PORT ?? "20006"}`,
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => path.replace(/^\/admin-api/, ""),
      },
    },
  },
});
