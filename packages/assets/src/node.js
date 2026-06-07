// Node-only entry: resolves the absolute path to this package's files/ directory.
// Used by Vite/Astro configs to provision the static assets at the site root.
//
// Resolution is by package name (not relative to this file) so it stays correct
// even when a config bundler inlines this module into its own bundle.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export const assetsDir = join(
	dirname(require.resolve("@colibri-social/assets/package.json")),
	"files",
);
