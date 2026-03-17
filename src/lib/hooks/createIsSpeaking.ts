import { useGlobalContext } from "@/components/solid/contexts/GlobalContext";
import { createEffect, createSignal, onCleanup } from "solid-js";

export type CreateIsSpeakingOptions = {
	intervalMs?: number;
	threshold?: number;
	// how long to stay "speaking" after volume drops below threshold
	holdMs?: number;
};

export function createIsSpeaking(
	track: MediaStreamTrack | null,
	{
		intervalMs = 100,
		threshold = 0.05,
		holdMs = 500,
	}: CreateIsSpeakingOptions = {},
) {
	if (!track) return () => false;

	const [, { sendSocketMessage }] = useGlobalContext();

	const [isSpeaking, setIsSpeaking] = createSignal(false);

	createEffect(() => {
		const _ = isSpeaking();

		sendSocketMessage({ action: "activity" });
	});

	const audioContext = new AudioContext();
	const analyser = audioContext.createAnalyser();
	analyser.fftSize = 32;
	analyser.smoothingTimeConstant = 0;

	const source = audioContext.createMediaStreamSource(new MediaStream([track]));
	source.connect(analyser);

	const buffer = new Float32Array(analyser.fftSize);
	let holdTimeout: ReturnType<typeof setTimeout> | null = null;

	const interval = setInterval(() => {
		analyser.getFloatTimeDomainData(buffer);
		const volume = Math.sqrt(
			buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length,
		);

		if (volume > threshold) {
			if (holdTimeout) {
				clearTimeout(holdTimeout);
				holdTimeout = null;
			}
			setIsSpeaking(true);
		} else if (isSpeaking()) {
			if (!holdTimeout) {
				holdTimeout = setTimeout(() => {
					setIsSpeaking(false);
					holdTimeout = null;
				}, holdMs);
			}
		}
	}, intervalMs);

	onCleanup(() => {
		clearInterval(interval);
		if (holdTimeout) clearTimeout(holdTimeout);
		source.disconnect();
		audioContext.close();
	});

	return isSpeaking;
}
