import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";
import Icons from "unplugin-icons/rolldown";
import Solid from "unplugin-solid/rolldown";

const clientVersion = JSON.parse(
	readFileSync(
		fileURLToPath(new URL("./package.json", import.meta.url)),
		"utf8",
	),
).version as string;

const clientCommit = (() => {
	if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
	try {
		return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
			encoding: "utf8",
		}).trim();
	} catch {
		return "unknown";
	}
})();

// When DISABLE_SENTRY is set, redirect the Sentry imports to local no-op stubs
// so `@sentry/solid` is never pulled into the bundle. This lets us ship builds
// with no tracking code at all (e.g. for F-Droid)
const disableSentry =
	process.env.DISABLE_SENTRY !== undefined && process.env.DISABLE_SENTRY !== "";

const stub = (relative: string) =>
	fileURLToPath(new URL(relative, import.meta.url));

const disableSentryPlugin = {
	name: "disable-sentry",
	resolveId(id: string) {
		if (id === "@sentry/solid/solidrouter")
			return stub("./src/stubs/sentry-solidrouter.ts");
		if (id === "@sentry/solid") return stub("./src/stubs/sentry-solid.ts");
		return null;
	},
};

export default defineConfig({
	entry: ["src/index.ts", "src/atproto/scopes.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	define: {
		__CLIENT_VERSION__: JSON.stringify(clientVersion),
		__CLIENT_COMMIT__: JSON.stringify(clientCommit),
	},
	// Dependencies are externalized by default, opt `@sentry/solid` back into
	// bundling so the stub redirect below can take effect and the real SDK is
	// dropped rather than left as an external import
	deps: {
		alwaysBundle: disableSentry
			? [/^@colibri-social\//, /^@sentry\/solid/]
			: [/^@colibri-social\//],
	},
	plugins: [
		...(disableSentry ? [disableSentryPlugin] : []),
		Icons({ compiler: "solid" }),
		Solid(),
	],
});
