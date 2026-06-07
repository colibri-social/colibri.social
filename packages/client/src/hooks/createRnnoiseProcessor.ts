// rnnoiseProcessor.ts
import {
	loadRnnoise,
	RnnoiseWorkletNode,
} from "@sapphi-red/web-noise-suppressor";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseWasmSimdPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import type { ProcessorOptions, Track, TrackProcessor } from "livekit-client";

export function createRnnoiseProcessor(): TrackProcessor<Track.Kind.Audio> {
	let rnnoiseNode: RnnoiseWorkletNode | null = null;

	async function init({
		track,
		audioContext,
	}: ProcessorOptions<Track.Kind.Audio>): Promise<void> {
		if (!audioContext) throw new Error("AudioContext is required");

		const rnnoiseWasmBinary = await loadRnnoise({
			url: rnnoiseWasmPath,
			simdUrl: rnnoiseWasmSimdPath,
		});
		await audioContext.audioWorklet.addModule(rnnoiseWorkletPath);

		rnnoiseNode = new RnnoiseWorkletNode(audioContext, {
			wasmBinary: rnnoiseWasmBinary,
			maxChannels: 2,
		});

		const source = audioContext.createMediaStreamSource(
			new MediaStream([track]),
		);
		const destination = audioContext.createMediaStreamDestination();

		source.connect(rnnoiseNode);
		rnnoiseNode.connect(destination);

		processor.processedTrack = destination.stream.getAudioTracks()[0];
	}

	const processor: TrackProcessor<Track.Kind.Audio> = {
		name: "rnnoise",
		processedTrack: undefined,

		init,

		async restart(options: ProcessorOptions<Track.Kind.Audio>): Promise<void> {
			rnnoiseNode?.disconnect();
			rnnoiseNode = null;
			await init(options);
		},

		async destroy(): Promise<void> {
			rnnoiseNode?.disconnect();
			rnnoiseNode = null;
		},
	};

	return processor;
}
