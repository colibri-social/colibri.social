import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = process.argv[2];
if (!script) {
	console.error("usage: frontend.mjs <dev|build|preview>");
	process.exit(1);
}

const tauriConfig = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"src-tauri",
	"tauri.conf.json",
);
const { version } = JSON.parse(readFileSync(tauriConfig, "utf8"));

const child = spawn(
	"pnpm",
	["--filter", "@colibri-social/app", script, ...process.argv.slice(3)],
	{
		stdio: "inherit",
		shell: process.platform === "win32",
		env: { ...process.env, VITE_APP_VERSION: version },
	},
);
child.on("exit", (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	else process.exit(code ?? 0);
});
