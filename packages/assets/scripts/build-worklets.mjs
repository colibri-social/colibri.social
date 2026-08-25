import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const root = dirname(
	fileURLToPath(new URL("../package.json", import.meta.url)),
);
const entry = join(root, "src", "rnnoise-worklet.js");
const outDir = join(root, "files", "worklets");
const outFile = join(outDir, "rnnoise.js");
const stamp = join(outDir, ".version");

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = pkg.dependencies["@shiguredo/rnnoise-wasm"];

async function currentStamp() {
	try {
		return (await readFile(stamp, "utf8")).trim();
	} catch {
		return null;
	}
}

if ((await currentStamp()) === version) {
	console.log(`  ✓ ${outFile} (cached)`);
	process.exit(0);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const bundle = await rolldown({
	input: entry,
	transform: { define: { "import.meta": "{}" } },
});

await bundle.write({
	file: outFile,
	format: "iife",
	minify: true,
	sourcemap: false,
});

await bundle.close();
await writeFile(stamp, `${version}\n`);

console.log(`  → ${outFile}`);
console.log("Audio worklets ready.");
