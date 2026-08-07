// Downloads the DeepFilterNet wasm + model into this package's files/ dir so the
// host serves them same-origin at /noise/deepfilternet3/... (consumed by the
// client's createNoiseSuppressor)
import { createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { withAssetLock } from "./asset-lock.mjs";

const CDN_BASE =
	"https://cdn.mezon.ai/AI/models/datas/noise_suppression/deepfilternet3";

const root = dirname(
	fileURLToPath(new URL("../package.json", import.meta.url)),
);
const outBase = join(root, "files", "noise", "deepfilternet3");

const ASSETS = [
	{
		url: `${CDN_BASE}/v3/pkg/df_bg.wasm`,
		dest: join(outBase, "v3", "pkg", "df_bg.wasm"),
	},
	{
		url: `${CDN_BASE}/v3/models/DeepFilterNet3_onnx.tar.gz`,
		dest: join(outBase, "v3", "models", "DeepFilterNet3_onnx.tar.gz"),
	},
];

function tmpPath(dest) {
	return `${dest}.${process.pid}.tmp`;
}

async function remoteSize(url) {
	try {
		const res = await fetch(url, { method: "HEAD" });
		const len = res.headers.get("content-length");
		return len ? Number(len) : null;
	} catch {
		return null;
	}
}

async function localSize(path) {
	try {
		return (await stat(path)).size;
	} catch {
		return null;
	}
}

async function download({ url, dest }) {
	const expected = await remoteSize(url);
	const existing = await localSize(dest);

	if (existing !== null && (expected === null || existing === expected)) {
		console.log(`  ✓ ${dest} (cached)`);
		return true;
	}

	await mkdir(dirname(dest), { recursive: true });
	const res = await fetch(url);
	if (!res.ok || !res.body) {
		throw new Error(`${res.status} ${res.statusText}`);
	}

	const tmp = tmpPath(dest);
	await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
	await rename(tmp, dest);
	console.log(`  ↓ ${dest}`);
	return true;
}

await mkdir(outBase, { recursive: true });

const failed = await withAssetLock(join(outBase, ".fetch.lock"), async () => {
	let incomplete = false;

	for (const asset of ASSETS) {
		try {
			await download(asset);
		} catch (err) {
			incomplete = true;
			console.warn(
				`  ! Skipped ${asset.url} (${err.message}). DeepFilterNet will fall back to RNNoise until this is fetched.`,
			);
			await unlink(tmpPath(asset.dest)).catch(() => {});
		}
	}

	return incomplete;
});

console.log(
	failed
		? "Noise-suppression assets incomplete (see warnings above)."
		: "Noise-suppression assets ready.",
);
