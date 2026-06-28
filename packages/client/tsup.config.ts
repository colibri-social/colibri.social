import { solidPlugin } from "esbuild-plugin-solid";
import { defineConfig } from "tsup";
import Icons from "unplugin-icons/esbuild";

export default defineConfig({
	entry: ["src/index.ts", "src/atproto/scopes.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	esbuildPlugins: [Icons({ compiler: "solid" }), solidPlugin()],
	esbuildOptions(options) {
		options.tsconfig = undefined;
		options.tsconfigRaw = {
			compilerOptions: {
				jsx: "react-jsx",
				jsxImportSource: "solid-js/h",
			},
		};
	},
});
