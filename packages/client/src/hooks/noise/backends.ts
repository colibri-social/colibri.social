import type { Tensor } from "onnxruntime-web";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import type { NoiseSuppressionMode } from "../../contexts/UserPreferences";
import { classifyThrown } from "../../errors/classify";
import { createLogger } from "../../utils/logger";
import { BIN_COUNT, HOP_SIZE, SpectralStream } from "./stft";

const log = createLogger("noise");

export const MODEL_SAMPLE_RATE = 16000;

const DTLN_ASSET_BASE = "/noise/dtln";
const DTLN_BLOCK_SIZE = 512;

const ONNX_MODEL_URLS: Partial<Record<NoiseSuppressionMode, string>> = {
	"exp-gtcrn": "/noise/gtcrn/gtcrn_simple.onnx",
	"exp-ulunas": "/noise/ulunas/ulunas_stream_simple.onnx",
};

export interface ExperimentalBackend {
	blockSize: number;
	process(input: Float32Array, output: Float32Array): Promise<void>;
	destroy(): void;
}

async function createOnnxBackend(url: string): Promise<ExperimentalBackend> {
	const ort = await import("onnxruntime-web/wasm");

	ort.env.wasm.numThreads = 1;
	ort.env.wasm.proxy = true;
	ort.env.wasm.wasmPaths = { wasm: ortWasmUrl };

	const session = await ort.InferenceSession.create(url, {
		executionProviders: ["wasm"],
		graphOptimizationLevel: "all",
	});

	const caches = new Map<string, Tensor>();

	for (const meta of session.inputMetadata) {
		if (meta.name === "mix" || !meta.isTensor) continue;
		const dims = meta.shape.map((d) =>
			typeof d === "number" && d > 0 ? d : 1,
		);
		const size = dims.reduce((a, b) => a * b, 1);
		caches.set(
			meta.name,
			new ort.Tensor("float32", new Float32Array(size), dims),
		);
	}

	const stream = new SpectralStream();
	let destroyed = false;

	return {
		blockSize: HOP_SIZE,
		process: async (input, output) => {
			if (destroyed) return;

			const spectrum = stream.analyse(input);
			const feeds: Record<string, Tensor> = {
				mix: new ort.Tensor("float32", spectrum.slice(), [1, BIN_COUNT, 1, 2]),
			};

			for (const [name, tensor] of caches) feeds[name] = tensor;

			const results = await session.run(feeds);
			if (destroyed) return;

			for (const name of [...caches.keys()]) {
				const next = results[`${name}_out`];
				if (next) caches.set(name, next as Tensor);
			}

			stream.synthesise(results.enh.data as Float32Array, output);
		},
		destroy: () => {
			destroyed = true;
			void session.release().catch(() => {});
		},
	};
}

type LiteRtFactory = (arg?: unknown) => Promise<unknown>;

async function liteRtFactory(): Promise<LiteRtFactory | null> {
	try {
		const mod = await import(
			/* @vite-ignore */ `${DTLN_ASSET_BASE}/litert/litert_wasm_internal.mjs`
		);
		const factory = (mod as { default?: LiteRtFactory }).default;
		if (typeof factory !== "function") return null;

		return (arg) =>
			factory({
				...(typeof arg === "object" && arg ? arg : {}),
				print: (text: string) => log.debug(text),
				printErr: (text: string) =>
					/^(INFO|VERBOSE)\b/.test(text) ? log.debug(text) : log.warn(text),
			});
	} catch (err) {
		log.warn("LiteRT print hooks unavailable", {
			code: classifyThrown(err).code,
		});
		return null;
	}
}

async function createDtlnBackend(): Promise<ExperimentalBackend> {
	const { createNoiseSuppressionRuntime } = await import(
		"@workadventure/noise-suppression"
	);

	const factory = await liteRtFactory();

	const module = await createNoiseSuppressionRuntime({
		liteRtWasmRoot: `${DTLN_ASSET_BASE}/litert/`,
		...(factory ? { liteRtWasmModuleFactory: factory } : {}),
		model1Url: `${DTLN_ASSET_BASE}/model_quant_1.tflite`,
		model2Url: `${DTLN_ASSET_BASE}/model_quant_2.tflite`,
		threads: false,
		numThreads: 1,
	});

	await module.ready;

	const handle = module.dtln_create();
	let destroyed = false;

	return {
		blockSize: DTLN_BLOCK_SIZE,
		process: async (input, output) => {
			if (destroyed) return;
			module.dtln_denoise(handle, input, output);
		},
		destroy: () => {
			if (destroyed) return;
			destroyed = true;
			module.dtln_stop(handle);
			module.dtln_destroy(handle);
		},
	};
}

export const createExperimentalBackend = (
	mode: NoiseSuppressionMode,
): Promise<ExperimentalBackend> => {
	if (mode === "exp-dtln") return createDtlnBackend();

	const url = ONNX_MODEL_URLS[mode];
	if (!url) throw new Error(`no experimental backend for ${mode}`);

	return createOnnxBackend(url);
};
