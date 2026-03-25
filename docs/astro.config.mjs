import { defineConfig } from "astro/config";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: "https://na-zu-nya.github.io",
  base: "/colorlip",
  output: "static",
  vite: {
    resolve: {
      alias: {
        colorlip: path.resolve(__dirname, "../src/index.ts"),
      },
    },
  },
});
