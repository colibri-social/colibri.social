import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import { createRnnoiseNode, type RnnoiseNode } from "./noise/rnnoise";

const log = createLogger("noise");

export const CAPTURE_SAMPLE_RATE = 48000;

const LEVELER_THRESHOLD_DB = -24;
const LEVELER_KNEE_DB = 12;
const LEVELER_RATIO = 3;
const LEVELER_ATTACK_S = 0.01;
const LEVELER_RELEASE_S = 0.25;
const LEVELER_MAKEUP = 2;

export interface NoiseSuppressor {
	readonly outputTrack: MediaStreamTrack;
	setSuppression: (enabled: boolean) => void;
	setGate: (enabled: boolean) => void;
	setInputGain: (gain: number) => void;
	destroy: () => void;
}

export interface NoiseSuppressorOptions {
	suppression: boolean;
	gate: boolean;
	inputGain?: number;
	onSpeaking?: (speaking: boolean) => void;
}

export const captureConstraints = (
	preferredDeviceId?: string,
): MediaTrackConstraints => ({
	echoCancellation: true,
	autoGainControl: false,
	noiseSuppression: false,
	channelCount: 1,
	deviceId: preferredDeviceId ? { ideal: preferredDeviceId } : undefined,
});

export async function createNoiseSuppressor(
	rawTrack: MediaStreamTrack,
	options: NoiseSuppressorOptions,
): Promise<NoiseSuppressor> {
	const ctx = new AudioContext({ sampleRate: CAPTURE_SAMPLE_RATE });
	const source = ctx.createMediaStreamSource(new MediaStream([rawTrack]));

	const destination = ctx.createMediaStreamDestination();
	destination.channelCount = 1;

	const leveler = ctx.createDynamicsCompressor();
	leveler.threshold.value = LEVELER_THRESHOLD_DB;
	leveler.knee.value = LEVELER_KNEE_DB;
	leveler.ratio.value = LEVELER_RATIO;
	leveler.attack.value = LEVELER_ATTACK_S;
	leveler.release.value = LEVELER_RELEASE_S;

	const makeup = ctx.createGain();
	makeup.gain.value = LEVELER_MAKEUP * (options.inputGain ?? 1);

	let rnnoise: RnnoiseNode | null = null;
	let destroyed = false;

	try {
		rnnoise = await createRnnoiseNode(ctx, {
			suppression: options.suppression,
			gate: options.gate,
			onSpeaking: options.onSpeaking,
		});
	} catch (err) {
		log.warn("RNNoise unavailable, capturing unprocessed", {
			code: classifyThrown(err).code,
		});
	}

	if (rnnoise) source.connect(rnnoise.node).connect(leveler);
	else source.connect(leveler);
	leveler.connect(makeup).connect(destination);

	return {
		outputTrack: destination.stream.getAudioTracks()[0],
		setSuppression: (enabled) => rnnoise?.setSuppression(enabled),
		setGate: (enabled) => rnnoise?.setGate(enabled),
		setInputGain: (gain) => {
			makeup.gain.value = LEVELER_MAKEUP * Math.max(0, Math.min(2, gain));
		},
		destroy: () => {
			if (destroyed) return;
			destroyed = true;
			source.disconnect();
			rnnoise?.destroy();
			leveler.disconnect();
			makeup.disconnect();
			ctx.close().catch(() => {});
		},
	};
}
