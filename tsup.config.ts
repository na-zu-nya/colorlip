import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    entry: ["src/adapters/sharp.ts", "src/adapters/canvas.ts"],
    outDir: "dist/adapters",
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    external: ["sharp"],
  },
]);
