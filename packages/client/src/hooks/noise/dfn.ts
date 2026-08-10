import {
	DeepFilterNet3Core,
	getAssetLoader,
} from "deepfilternet3-noise-filter";
import type { NoiseSuppressionMode } from "../../contexts/UserPreferences";

export const DFN_ASSET_BASE = "/noise/deepfilternet3";
export const DFN_SAMPLE_RATE = 48000;
export const DFN_DEFAULT_LEVEL = 80;

export const HIGH_ATTEN_LIM = 100;
export const HIGH_POST_FILTER_BETA = 0.02;
export const HIGH_PASS_HZ = 90;

export const clampLevel = (level: number): number =>
	Math.max(0, Math.min(100, Math.round(level)));

export function preloadNoiseSuppressor(): void {
	try {
		const { wasm, model } = getAssetLoader({
			cdnUrl: DFN_ASSET_BASE,
		}).getAssetUrls();
		void fetch(wasm).catch(() => {});
		void fetch(model).catch(() => {});
	} catch {}
}

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

export async function assertDfnModelReachable(): Promise<void> {
	const { model } = getAssetLoader({ cdnUrl: DFN_ASSET_BASE }).getAssetUrls();
	const res = await fetch(model, { headers: { Range: "bytes=0-1" } });
	const bytes = new Uint8Array(await res.arrayBuffer());
	if (!res.ok || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
		throw new Error(
			`DeepFilterNet model is not a valid gzip at ${model} — check /noise asset hosting`,
		);
	}
}

export interface DfnParams {
	attenLim: number;
	postFilterBeta: number;
}

export const dfnParamsFor = (
	mode: NoiseSuppressionMode,
	level: number,
): DfnParams =>
	mode === "high"
		? { attenLim: HIGH_ATTEN_LIM, postFilterBeta: HIGH_POST_FILTER_BETA }
		: { attenLim: clampLevel(level), postFilterBeta: 0 };

export const createDfnCore = async (
	ctx: AudioContext,
	params: DfnParams,
): Promise<{ core: DeepFilterNet3Core; node: AudioWorkletNode }> => {
	await assertDfnModelReachable();

	const core = new DeepFilterNet3Core({
		sampleRate: DFN_SAMPLE_RATE,
		noiseReductionLevel: params.attenLim,
		postFilterBeta: params.postFilterBeta,
		assetConfig: { cdnUrl: DFN_ASSET_BASE },
	});

	await core.initialize();
	const node = await core.createAudioWorkletNode(ctx);

	return { core, node };
};

export const createHighPassNode = (ctx: AudioContext): BiquadFilterNode => {
	const filter = ctx.createBiquadFilter();
	filter.type = "highpass";
	filter.frequency.value = HIGH_PASS_HZ;
	filter.Q.value = Math.SQRT1_2;
	return filter;
};
