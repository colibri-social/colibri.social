import { defineConfig } from "tsup";
import { solidPlugin } from 'esbuild-plugin-solid';
import Icons from 'unplugin-icons/esbuild';

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  esbuildPlugins: [Icons({ compiler: 'solid' }), solidPlugin()],
})
