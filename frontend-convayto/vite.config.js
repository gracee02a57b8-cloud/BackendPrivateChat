import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    open: false,
    proxy: {
      "/api": {
        target: "https://barsikchat.duckdns.org",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "wss://barsikchat.duckdns.org",
        ws: true,
        secure: false,
      },
    },
  },
});
