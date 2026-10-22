import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // En WSL sobre un disco de Windows (/mnt/...) no llegan los eventos de cambio de ficheros
    watch: process.env.WSL_DISTRO_NAME ? { usePolling: true, interval: 300 } : undefined,
  },
});
