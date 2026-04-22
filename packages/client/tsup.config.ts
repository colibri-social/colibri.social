import { defineConfig } from "tsup";
import { solidPlugin } from 'esbuild-plugin-solid';

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  esbuildPlugins: [solidPlugin()],
})
