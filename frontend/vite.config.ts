import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/seletor/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 22011,
    strictPort: true,
    allowedHosts: ["varzeaprime.com.br", "www.varzeaprime.com.br"],
    proxy: {
      "/api": {
        target: "https://seletor-sistema-api:22012",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "https://seletor-sistema-api:22012",
        changeOrigin: true,
        secure: false,
      },
    },
    hmr: {
      protocol: "wss",
      host: "varzeaprime.com.br",
      clientPort: 443,
    },
  },
});
