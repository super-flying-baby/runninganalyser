import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";

export default defineConfig({
  base: "/runninganalyser/",
  plugins: [vue(), vuetify({ autoImport: true })],
  build: {
    outDir: "dist",
    sourcemap: false
  }
});
