import { fileURLToPath } from "node:url";
import { solidPlugin } from "esbuild-plugin-solid";
import { defineConfig, type Options } from "tsup";
import Icons from "unplugin-icons/esbuild";

type EsbuildPlugin = NonNullable<Options["esbuildPlugins"]>[number];

// When DISABLE_SENTRY is set, redirect the Sentry imports to local no-op stubs
// so `@sentry/solid` is never pulled into the bundle. This lets us ship builds
// with no tracking code at all (e.g. for F-Droid)
const disableSentry =
	process.env.DISABLE_SENTRY !== undefined && process.env.DISABLE_SENTRY !== "";

const stub = (relative: string) =>
	fileURLToPath(new URL(relative, import.meta.url));

const disableSentryPlugin: EsbuildPlugin = {
	name: "disable-sentry",
	setup(build) {
		build.onResolve({ filter: /^@sentry\/solid\/solidrouter$/ }, () => ({
			path: stub("./src/stubs/sentry-solidrouter.ts"),
		}));
		build.onResolve({ filter: /^@sentry\/solid$/ }, () => ({
			path: stub("./src/stubs/sentry-solid.ts"),
		}));
	},
};

export default defineConfig({
	entry: ["src/index.ts", "src/atproto/scopes.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	// Dependencies are externalized by default, opt `@sentry/solid` back into
	// bundling so the stub redirect below can take effect and the real SDK is
	// dropped rather than left as an external import
	noExternal: disableSentry ? [/^@sentry\/solid/] : [],
	esbuildPlugins: [
		...(disableSentry ? [disableSentryPlugin] : []),
		Icons({ compiler: "solid" }),
		solidPlugin(),
	],
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
