// Downloads the noise-suppression models into this package's files/ dir so the
// host serves them same-origin at /noise/... (consumed by the client's
// createNoiseSuppressor). The experimental backends live beside DeepFilterNet:
// GTCRN and UL-UNAS come from their upstream repos, DTLN's LiteRT runtime and
// tflite weights are copied out of the npm package that ships them
import { createWriteStream } from "node:fs";
import { copyFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const CDN_BASE =
	"https://cdn.mezon.ai/AI/models/datas/noise_suppression/deepfilternet3";
const GTCRN_BASE =
	"https://raw.githubusercontent.com/Xiaobin-Rong/gtcrn/main/stream/onnx_models";
const ULUNAS_BASE =
	"https://raw.githubusercontent.com/Xiaobin-Rong/ul-unas/main/ulunas_onnx/onnx_models";

const root = dirname(
	fileURLToPath(new URL("../package.json", import.meta.url)),
);
const noiseBase = join(root, "files", "noise");
const outBase = join(noiseBase, "deepfilternet3");

const ASSETS = [
	{
		url: `${CDN_BASE}/v3/pkg/df_bg.wasm`,
		dest: join(outBase, "v3", "pkg", "df_bg.wasm"),
	},
	{
		url: `${CDN_BASE}/v3/models/DeepFilterNet3_onnx.tar.gz`,
		dest: join(outBase, "v3", "models", "DeepFilterNet3_onnx.tar.gz"),
	},
	{
		url: `${GTCRN_BASE}/gtcrn_simple.onnx`,
		dest: join(noiseBase, "gtcrn", "gtcrn_simple.onnx"),
	},
	{
		url: `${ULUNAS_BASE}/ulunas_stream_simple.onnx`,
		dest: join(noiseBase, "ulunas", "ulunas_stream_simple.onnx"),
	},
];

const require = createRequire(import.meta.url);

function dtlnCopies() {
	const dist = dirname(
		require.resolve("@workadventure/noise-suppression/package.json"),
	);
	const dtlnOut = join(noiseBase, "dtln");

	const litert = [
		"litert_wasm_internal",
		"litert_wasm_compat_internal",
	].flatMap((name) => [`${name}.js`, `${name}.mjs`, `${name}.wasm`]);

	return [
		["dist/assets/model_quant_1.tflite", join(dtlnOut, "model_quant_1.tflite")],
		["dist/assets/model_quant_2.tflite", join(dtlnOut, "model_quant_2.tflite")],
		...litert.map((name) => [
			`dist/vendor/litert/${name}`,
			join(dtlnOut, "litert", name),
		]),
	].map(([from, dest]) => ({ from: join(dist, from), dest }));
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

	const tmp = `${dest}.tmp`;
	await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
	await rename(tmp, dest);
	console.log(`  ↓ ${dest}`);
	return true;
}

async function copy({ from, dest }) {
	const [expected, existing] = await Promise.all([
		localSize(from),
		localSize(dest),
	]);

	if (existing !== null && existing === expected) {
		console.log(`  ✓ ${dest} (cached)`);
		return;
	}

	await mkdir(dirname(dest), { recursive: true });
	await copyFile(from, dest);
	console.log(`  → ${dest}`);
}

let failed = false;
for (const asset of ASSETS) {
	try {
		await download(asset);
	} catch (err) {
		failed = true;
		console.warn(
			`  ! Skipped ${asset.url} (${err.message}). The mode using it falls back to a lighter one until it is fetched.`,
		);
		await unlink(`${asset.dest}.tmp`).catch(() => {});
	}
}

let dtlnAssets = [];
try {
	dtlnAssets = dtlnCopies();
} catch (err) {
	failed = true;
	console.warn(`  ! DTLN assets unavailable (${err.message}).`);
}

for (const asset of dtlnAssets) {
	try {
		await copy(asset);
	} catch (err) {
		failed = true;
		console.warn(`  ! Skipped ${asset.from} (${err.message}).`);
	}
}

console.log(
	failed
		? "Noise-suppression assets incomplete (see warnings above)."
		: "Noise-suppression assets ready.",
);
