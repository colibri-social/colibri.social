import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const resolvePackaged = (specifier) =>
	fileURLToPath(import.meta.resolve(specifier));

const wasm = readFileSync(
	resolvePackaged("@sapphi-red/web-noise-suppressor/rnnoise.wasm"),
);
const simdWasm = readFileSync(
	resolvePackaged("@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm"),
);

if (!wasm.equals(simdWasm)) {
	throw new Error(
		"rnnoise.wasm and rnnoise_simd.wasm now differ, so inlining a single build would silently drop SIMD support. Restore the runtime SIMD probe in createNoiseSuppressor.ts before bumping @sapphi-red/web-noise-suppressor.",
	);
}

const workletSource = readFileSync(
	resolvePackaged("@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js"),
	"utf8",
).replace(/\n\/\/# sourceMappingURL=.*\s*$/, "\n");

const out = `export const RNNOISE_WASM_B64 = ${JSON.stringify(wasm.toString("base64"))};

export const RNNOISE_WORKLET_SRC = ${JSON.stringify(workletSource)};
`;

const root = dirname(
	fileURLToPath(new URL("../package.json", import.meta.url)),
);
writeFileSync(join(root, "src", "hooks", "rnnoise-assets.generated.ts"), out);

console.log(
	`Wrote rnnoise-assets.generated.ts (${wasm.length} wasm bytes, ${workletSource.length} worklet chars).`,
);
