import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  // Use relative asset URLs so `dist/index.html` works when opened locally.
  // Also helps GitHub Pages because it doesn't assume a root base path.
  base: "./",
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "assets", dest: "" },
        { src: "data", dest: "" },
        { src: "favicon.svg", dest: "" },
      ],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});

