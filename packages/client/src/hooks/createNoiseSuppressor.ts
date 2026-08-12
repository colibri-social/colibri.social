import {
	loadRnnoise,
	RnnoiseWorkletNode,
} from "@sapphi-red/web-noise-suppressor";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseWasmSimdPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import type { DeepFilterNet3Core } from "deepfilternet3-noise-filter";
import type { NoiseSuppressionMode } from "../contexts/UserPreferences";
import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import {
	clampLevel,
	createDfnCore,
	createHighPassNode,
	DFN_DEFAULT_LEVEL,
	DFN_SAMPLE_RATE,
	deviceLikelyTooWeakForDfn,
	dfnParamsFor,
} from "./noise/dfn";
import { createVoiceGateNode } from "./noise/gate-worklet";
import { createModelHost, type ModelHost } from "./noise/model-host";
import { fallbackFrom, noiseMode } from "./noise/modes";

export { deviceLikelyTooWeakForDfn, preloadNoiseSuppressor } from "./noise/dfn";

const log = createLogger("noise");

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
	onSpeaking?: (speaking: boolean) => void;
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

	let currentChain: AudioNode[] = [];
	let activeMode: NoiseSuppressionMode | null = null;
	let pendingMode: NoiseSuppressionMode | null = null;
	let destroyed = false;

	let rnnoiseNode: RnnoiseWorkletNode | null = null;
	let rnnoiseWasm: ArrayBuffer | null = null;
	let rnnoisePromise: Promise<AudioNode> | null = null;

	let dfnNode: AudioWorkletNode | null = null;
	let dfnCore: DeepFilterNet3Core | null = null;
	let dfnPromise: Promise<AudioWorkletNode> | null = null;
	let highPassNode: BiquadFilterNode | null = null;
	let gateNode: AudioWorkletNode | null = null;

	const modelHosts = new Map<NoiseSuppressionMode, Promise<ModelHost>>();
	const builtHosts: ModelHost[] = [];

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
			const from = activeMode ?? options.desiredMode;
			const to = fallbackFrom(from);
			void setMode(to).then(() => {
				options.onFallback?.(from, to);
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

	const buildRnnoiseNode = (): Promise<AudioNode> => {
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

	const buildDfnNode = (
		mode: NoiseSuppressionMode,
	): Promise<AudioWorkletNode> => {
		dfnPromise ??= (async () => {
			const { core, node } = await createDfnCore(
				ctx,
				dfnParamsFor(mode, currentLevel),
			);
			dfnCore = core;
			dfnNode = node;
			return node;
		})().catch((err) => {
			log.warn("DeepFilterNet unavailable", { code: classifyThrown(err).code });
			dfnPromise = null;
			throw err;
		});
		return dfnPromise;
	};

	const applyDfnParams = (mode: NoiseSuppressionMode): void => {
		if (!dfnCore) return;
		const params = dfnParamsFor(mode, currentLevel);
		dfnCore.setSuppressionLevel(params.attenLim);
		dfnCore.setPostFilterBeta(params.postFilterBeta);
	};

	const onModelFailure = (mode: NoiseSuppressionMode): void => {
		if (activeMode !== mode) return;
		const to = fallbackFrom(mode);
		void setMode(to).then(() => {
			options.onFallback?.(mode, to);
		});
	};

	const buildModelHost = (mode: NoiseSuppressionMode): Promise<ModelHost> => {
		let promise = modelHosts.get(mode);
		if (!promise) {
			promise = createModelHost(ctx, mode, () => onModelFailure(mode)).then(
				(host) => {
					builtHosts.push(host);
					return host;
				},
			);
			promise.catch(() => modelHosts.delete(mode));
			modelHosts.set(mode, promise);
		}
		return promise;
	};

	const buildChain = async (
		mode: NoiseSuppressionMode,
	): Promise<AudioNode[]> => {
		if (mode === "low") return [await buildRnnoiseNode()];

		if (mode === "medium") {
			const node = await buildDfnNode(mode);
			applyDfnParams(mode);
			return [node];
		}

		if (mode === "high") {
			const node = await buildDfnNode(mode);
			applyDfnParams(mode);
			highPassNode ??= createHighPassNode(ctx);
			gateNode ??= await createVoiceGateNode(ctx, {
				onSpeaking: (speaking) => {
					if (activeMode === "high") options.onSpeaking?.(speaking);
				},
			});
			return [highPassNode, node, gateNode];
		}

		if (noiseMode(mode).experimental)
			return [(await buildModelHost(mode)).node];

		return [];
	};

	const setMode = async (mode: NoiseSuppressionMode): Promise<void> => {
		if (destroyed) return;
		if (mode === activeMode && mode === pendingMode) return;
		pendingMode = mode;

		const chain = await buildChain(mode);
		if (destroyed || pendingMode !== mode) return;

		source.disconnect();
		for (const node of currentChain) node.disconnect();

		let tail: AudioNode = source;
		for (const node of chain) {
			tail.connect(node);
			tail = node;
		}
		tail.connect(destination);

		currentChain = chain;
		activeMode = mode;

		if (noiseMode(mode).usesDeepFilterNet) startWatchdog();
		else stopWatchdog();
	};

	const startAt = async (mode: NoiseSuppressionMode): Promise<void> => {
		const heavy = mode !== "off" && mode !== "low";

		if (!heavy) {
			await setMode(mode);
			return;
		}

		await setMode("low");

		if (!renderCapacityOf(ctx) && deviceLikelyTooWeakForDfn()) {
			options.onFallback?.(mode, "low");
			return;
		}

		void setMode(mode).catch(() => {
			const to = fallbackFrom(mode);
			void setMode(to).then(() => {
				options.onFallback?.(mode, to);
			});
		});
	};

	await startAt(options.desiredMode);

	return {
		outputTrack: destination.stream.getAudioTracks()[0],
		setMode,
		setSuppressionLevel: (level) => {
			currentLevel = clampLevel(level);
			if (activeMode) applyDfnParams(activeMode);
		},
		getActiveMode: () => activeMode ?? "off",
		destroy: () => {
			destroyed = true;
			stopWatchdog();
			source.disconnect();
			rnnoiseNode?.disconnect();
			dfnNode?.disconnect();
			highPassNode?.disconnect();
			gateNode?.disconnect();
			dfnCore?.destroy();
			for (const host of builtHosts) {
				host.node.disconnect();
				host.destroy();
			}
			rnnoiseNode = null;
			dfnNode = null;
			dfnCore = null;
			highPassNode = null;
			gateNode = null;
			ctx.close().catch(() => {});
		},
	};
}
