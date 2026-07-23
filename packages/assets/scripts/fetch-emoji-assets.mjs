import { spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = dirname(
	fileURLToPath(new URL("../package.json", import.meta.url)),
);
const clientPkg = JSON.parse(
	await readFile(join(root, "..", "client", "package.json"), "utf8"),
);
const version = (clientPkg.dependencies["@twemoji/api"] ?? "").replace(
	/^[^0-9]*/,
	"",
);

const outDir = join(root, "files", "twemoji");
const pngDir = join(outDir, "72x72");
const stamp = join(outDir, ".version");
const tarUrl = `https://codeload.github.com/jdecked/twemoji/tar.gz/refs/tags/v${version}`;

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function stampVersion() {
	try {
		return (await readFile(stamp, "utf8")).trim();
	} catch {
		return null;
	}
}

if (!version) {
	console.error("  ! Could not resolve @twemoji/api version from client.");
	process.exit(1);
}

if ((await stampVersion()) === version && (await exists(pngDir))) {
	console.log(`  ✓ twemoji ${version} assets (cached)`);
	process.exit(0);
}

const tmp = join(outDir, ".download.tar.gz");

try {
	await mkdir(outDir, { recursive: true });

	const res = await fetch(tarUrl);
	if (!res.ok || !res.body) {
		throw new Error(`${res.status} ${res.statusText}`);
	}
	await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));

	await rm(pngDir, { recursive: true, force: true });
	const extract = spawnSync(
		"tar",
		[
			"-xzf",
			tmp,
			"-C",
			outDir,
			"--strip-components=2",
			`twemoji-${version}/assets/72x72`,
		],
		{ stdio: "inherit" },
	);
	if (extract.status !== 0) {
		throw new Error(`tar exited with ${extract.status ?? extract.signal}`);
	}

	await rm(tmp, { force: true });
	await writeFile(stamp, version);
	console.log(`  ↓ twemoji ${version} assets ready.`);
} catch (err) {
	await rm(tmp, { force: true }).catch(() => {});
	if (await exists(pngDir)) {
		console.warn(
			`  ! Could not refresh twemoji assets (${err.message}). Using cached set.`,
		);
	} else {
		console.error(
			`  ! Failed to fetch twemoji ${version} assets (${err.message}).`,
		);
		process.exit(1);
	}
}
