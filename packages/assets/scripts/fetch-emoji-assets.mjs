import { spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { withAssetLock } from "./asset-lock.mjs";

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
const lock = join(outDir, ".fetch.lock");
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

async function cached() {
	return (await stampVersion()) === version && (await exists(pngDir));
}

async function fetchAssets() {
	const staging = await mkdtemp(join(outDir, ".staging-"));

	try {
		const archive = join(staging, "twemoji.tar.gz");

		const res = await fetch(tarUrl);
		if (!res.ok || !res.body) {
			throw new Error(`${res.status} ${res.statusText}`);
		}
		await pipeline(Readable.fromWeb(res.body), createWriteStream(archive));

		const extract = spawnSync(
			"tar",
			[
				"-xzf",
				basename(archive),
				"--strip-components=2",
				`twemoji-${version}/assets/72x72`,
			],
			{ stdio: "inherit", cwd: staging },
		);
		if (extract.status !== 0) {
			throw new Error(`tar exited with ${extract.status ?? extract.signal}`);
		}

		await rm(pngDir, { recursive: true, force: true });
		await rename(join(staging, "72x72"), pngDir);
		await writeFile(stamp, version);
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}

if (!version) {
	console.error("  ! Could not resolve @twemoji/api version from client.");
	process.exit(1);
}

await mkdir(outDir, { recursive: true });

try {
	const done = await withAssetLock(lock, async () => {
		if (await cached()) return "cached";
		await fetchAssets();
		return "fetched";
	});

	console.log(
		done === "cached"
			? `  ✓ twemoji ${version} assets (cached)`
			: `  ↓ twemoji ${version} assets ready.`,
	);
} catch (err) {
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
