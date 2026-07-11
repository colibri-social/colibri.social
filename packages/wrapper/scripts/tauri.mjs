// Thin wrapper around the Tauri CLI that bridges the DISABLE_SENTRY env var to
// the Rust build
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const disableSentry =
	process.env.DISABLE_SENTRY !== undefined && process.env.DISABLE_SENTRY !== "";

// Subcommands that compile the Rust crate and therefore need the feature flag
const COMPILE_SUBCOMMANDS = new Set(["dev", "build", "android", "ios"]);

if (disableSentry && COMPILE_SUBCOMMANDS.has(args[0])) {
	if (!args.includes("--")) args.push("--");
	args.push("--no-default-features");
}

// Resolve the Tauri CLI entry from its package manifest so we invoke it
// directly with node
const pkgPath = require.resolve("@tauri-apps/cli/package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const binRel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.tauri;
const cli = join(dirname(pkgPath), binRel);

const child = spawn(process.execPath, [cli, ...args], { stdio: "inherit" });
child.on("exit", (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	else process.exit(code ?? 0);
});
