import {
	loadRnnoise,
	RnnoiseWorkletNode,
} from "@sapphi-red/web-noise-suppressor";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseWasmSimdPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import {
	DeepFilterNet3Core,
	getAssetLoader,
} from "deepfilternet3-noise-filter";
import type { NoiseSuppressionMode } from "../contexts/UserPreferences";

const DFN_ASSET_BASE = "/noise/deepfilternet3";
const DFN_SAMPLE_RATE = 48000;
const DFN_DEFAULT_LEVEL = 80;

const clampLevel = (level: number): number =>
	Math.max(0, Math.min(100, Math.round(level)));

const WATCHDOG_UPDATE_INTERVAL = 1;
const WATCHDOG_UNDERRUN_THRESHOLD = 0.1;
const WATCHDOG_LOAD_THRESHOLD = 0.9;
const WATCHDOG_STREAK = 3;

interface RenderCapacityUpdateEvent extends Event {
	averageLoad: number;
	peakLoad: number;
	underrunRatio: number;
}

interface AudioRenderCapacity {
	start(options?: { updateInterval?: number }): void;
	stop(): void;
	addEventListener(
		type: "update",
		listener: (event: RenderCapacityUpdateEvent) => void,
	): void;
	removeEventListener(
		type: "update",
		listener: (event: RenderCapacityUpdateEvent) => void,
	): void;
}

export interface NoiseSuppressor {
	readonly outputTrack: MediaStreamTrack;
	setMode(mode: NoiseSuppressionMode): Promise<void>;
	setSuppressionLevel(level: number): void;
	getActiveMode(): NoiseSuppressionMode;
	destroy(): void;
}

export interface NoiseSuppressorOptions {
	desiredMode: NoiseSuppressionMode;
	suppressionLevel?: number;
	onFallback?: (from: NoiseSuppressionMode, to: NoiseSuppressionMode) => void;
}

/**
 * Warms the browser's HTTP cache with the DeepFilterNet assets so the first
 * upgrade to the "deepfilternet" mode swaps in without a visible download
 */
export function preloadNoiseSuppressor(): void {
	try {
		const { wasm, model } = getAssetLoader({
			cdnUrl: DFN_ASSET_BASE,
		}).getAssetUrls();
		void fetch(wasm).catch(() => {});
		void fetch(model).catch(() => {});
	} catch {}
}

/**
 * Coarse guess for devices that likely can't sustain DeepFilterNet in real time
 */
export function deviceLikelyTooWeakForDfn(): boolean {
	const cores = navigator.hardwareConcurrency || 4;
	const uaData = (
		navigator as Navigator & { userAgentData?: { mobile?: boolean } }
	).userAgentData;
	const mobile =
		uaData?.mobile === true ||
		/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
	return cores <= 2 || (mobile && cores <= 4);
}

/**
 * Guards against a mis-served model asset. A missing file resolves to the SPA
 * fallback (index.html, HTTP 200)
 */
async function assertDfnModelReachable(): Promise<void> {
	const { model } = getAssetLoader({ cdnUrl: DFN_ASSET_BASE }).getAssetUrls();
	const res = await fetch(model, { headers: { Range: "bytes=0-1" } });
	const bytes = new Uint8Array(await res.arrayBuffer());
	if (!res.ok || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
		throw new Error(
			`DeepFilterNet model is not a valid gzip at ${model} — check /noise asset hosting`,
		);
	}
}

function renderCapacityOf(ctx: AudioContext): AudioRenderCapacity | null {
	const rc = (ctx as AudioContext & { renderCapacity?: AudioRenderCapacity })
		.renderCapacity;
	return rc && typeof rc.start === "function" ? rc : null;
}

/**
 * Builds a hot-swappable noise-suppression graph around a raw mic track
 */
export async function createNoiseSuppressor(
	rawTrack: MediaStreamTrack,
	options: NoiseSuppressorOptions,
): Promise<NoiseSuppressor> {
	const ctx = new AudioContext({ sampleRate: DFN_SAMPLE_RATE });
	const source = ctx.createMediaStreamSource(new MediaStream([rawTrack]));
	const destination = ctx.createMediaStreamDestination();

	let currentNode: AudioNode | null = null;
	let activeMode: NoiseSuppressionMode | null = null;
	let pendingMode: NoiseSuppressionMode | null = null;
	let destroyed = false;

	let rnnoiseNode: RnnoiseWorkletNode | null = null;
	let rnnoiseWasm: ArrayBuffer | null = null;
	let rnnoisePromise: Promise<AudioWorkletNode> | null = null;
	let dfnNode: AudioWorkletNode | null = null;
	let dfnCore: DeepFilterNet3Core | null = null;
	let dfnPromise: Promise<AudioWorkletNode> | null = null;

	let currentLevel = clampLevel(options.suppressionLevel ?? DFN_DEFAULT_LEVEL);

	let capacity: AudioRenderCapacity | null = null;
	let overBudgetStreak = 0;

	const stopWatchdog = (): void => {
		if (!capacity) return;
		capacity.removeEventListener("update", onCapacityUpdate);
		try {
			capacity.stop();
		} catch {}
		capacity = null;
		overBudgetStreak = 0;
	};

	const onCapacityUpdate = (event: RenderCapacityUpdateEvent): void => {
		const overBudget =
			event.underrunRatio > WATCHDOG_UNDERRUN_THRESHOLD ||
			event.averageLoad > WATCHDOG_LOAD_THRESHOLD;
		overBudgetStreak = overBudget ? overBudgetStreak + 1 : 0;

		if (overBudgetStreak >= WATCHDOG_STREAK) {
			stopWatchdog();
			const from = activeMode ?? "deepfilternet";
			void setMode("rnnoise").then(() => {
				options.onFallback?.(from, "rnnoise");
			});
		}
	};

	const startWatchdog = (): void => {
		stopWatchdog();
		const rc = renderCapacityOf(ctx);
		if (!rc) return;
		capacity = rc;
		rc.addEventListener("update", onCapacityUpdate);
		rc.start({ updateInterval: WATCHDOG_UPDATE_INTERVAL });
	};

	const buildRnnoiseNode = (): Promise<AudioWorkletNode> => {
		rnnoisePromise ??= (async () => {
			if (!rnnoiseWasm) {
				rnnoiseWasm = await loadRnnoise({
					url: rnnoiseWasmPath,
					simdUrl: rnnoiseWasmSimdPath,
				});
			}
			await ctx.audioWorklet.addModule(rnnoiseWorkletPath);
			rnnoiseNode = new RnnoiseWorkletNode(ctx, {
				wasmBinary: rnnoiseWasm,
				maxChannels: 2,
			});
			return rnnoiseNode;
		})().catch((err) => {
			rnnoisePromise = null;
			throw err;
		});
		return rnnoisePromise;
	};

	const buildDfnNode = (): Promise<AudioWorkletNode> => {
		dfnPromise ??= (async () => {
			await assertDfnModelReachable();
			const core = new DeepFilterNet3Core({
				sampleRate: DFN_SAMPLE_RATE,
				noiseReductionLevel: currentLevel,
				assetConfig: { cdnUrl: DFN_ASSET_BASE },
			});
			await core.initialize();
			dfnNode = await core.createAudioWorkletNode(ctx);
			dfnCore = core;
			return dfnNode;
		})().catch((err) => {
			console.warn(
				"[noise] DeepFilterNet unavailable, falling back to RNNoise:",
				err instanceof Error ? err.message : err,
			);
			dfnPromise = null;
			throw err;
		});
		return dfnPromise;
	};

	const buildNode = async (
		mode: NoiseSuppressionMode,
	): Promise<AudioNode | null> => {
		if (mode === "rnnoise") return buildRnnoiseNode();
		if (mode === "deepfilternet") return buildDfnNode();
		return null;
	};

	const setMode = async (mode: NoiseSuppressionMode): Promise<void> => {
		if (destroyed) return;
		if (mode === activeMode && mode === pendingMode) return;
		pendingMode = mode;

		const node = await buildNode(mode);
		if (destroyed || pendingMode !== mode) return;

		source.disconnect();
		currentNode?.disconnect();
		if (node) {
			source.connect(node);
			node.connect(destination);
		} else {
			source.connect(destination);
		}
		currentNode = node;
		activeMode = mode;

		if (mode === "deepfilternet") startWatchdog();
		else stopWatchdog();
	};

	if (options.desiredMode === "deepfilternet") {
		await setMode("rnnoise");
		if (renderCapacityOf(ctx) || !deviceLikelyTooWeakForDfn()) {
			void setMode("deepfilternet").catch(() => {
				void setMode("rnnoise").then(() => {
					options.onFallback?.("deepfilternet", "rnnoise");
				});
			});
		} else {
			options.onFallback?.("deepfilternet", "rnnoise");
		}
	} else {
		await setMode(options.desiredMode);
	}

	return {
		outputTrack: destination.stream.getAudioTracks()[0],
		setMode,
		setSuppressionLevel: (level) => {
			currentLevel = clampLevel(level);
			dfnCore?.setSuppressionLevel(currentLevel);
		},
		getActiveMode: () => activeMode ?? "off",
		destroy: () => {
			destroyed = true;
			stopWatchdog();
			source.disconnect();
			rnnoiseNode?.disconnect();
			dfnNode?.disconnect();
			dfnCore?.destroy();
			rnnoiseNode = null;
			dfnNode = null;
			dfnCore = null;
			ctx.close().catch(() => {});
		},
	};
}
