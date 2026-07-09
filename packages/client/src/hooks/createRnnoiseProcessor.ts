import {
	loadRnnoise,
	RnnoiseWorkletNode,
} from "@sapphi-red/web-noise-suppressor";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseWasmSimdPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";

export async function processTrackWithRnnoise(
	track: MediaStreamTrack,
	audioContext: AudioContext,
): Promise<MediaStreamTrack> {
	const rnnoiseWasmBinary = await loadRnnoise({
		url: rnnoiseWasmPath,
		simdUrl: rnnoiseWasmSimdPath,
	});

	await audioContext.audioWorklet.addModule(rnnoiseWorkletPath);

	const rnnoiseNode = new RnnoiseWorkletNode(audioContext, {
		wasmBinary: rnnoiseWasmBinary,
		maxChannels: 2,
	});

	const source = audioContext.createMediaStreamSource(new MediaStream([track]));
	const destination = audioContext.createMediaStreamDestination();

	source.connect(rnnoiseNode);
	rnnoiseNode.connect(destination);

	return destination.stream.getAudioTracks()[0];
}
