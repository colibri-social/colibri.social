import type { Accessor } from "solid-js";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { useGlobalContext } from "@/components/solid/contexts/GlobalContext";

export type CreateIsSpeakingOptions = {
	intervalMs?: number;
	threshold?: number;
	// how long to stay "speaking" after volume drops below threshold
	holdMs?: number;
};

export function createIsSpeaking(
	track: Accessor<MediaStreamTrack | null>,
	{
		intervalMs = 100,
		threshold = 0.01,
		holdMs = 500,
	}: CreateIsSpeakingOptions = {},
) {
	const [, { sendSocketMessage }] = useGlobalContext();
	const [isSpeaking, setIsSpeaking] = createSignal(false);
	const [volume, setVolume] = createSignal(0);

	createEffect(() => {
		const _ = isSpeaking();
		sendSocketMessage({ action: "activity" });
	});

	createEffect(() => {
		const currentTrack = track();
		if (!currentTrack) {
			setIsSpeaking(false);
			setVolume(0);
			return;
		}

		const audioContext = new AudioContext();
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = 32;
		analyser.smoothingTimeConstant = 0;

		const source = audioContext.createMediaStreamSource(
			new MediaStream([currentTrack]),
		);
		source.connect(analyser);

		const buffer = new Float32Array(analyser.fftSize);
		let holdTimeout: ReturnType<typeof setTimeout> | null = null;

		const interval = setInterval(() => {
			analyser.getFloatTimeDomainData(buffer);
			const rms = Math.sqrt(
				buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length,
			);
			if (rms > threshold) {
				if (holdTimeout) {
					clearTimeout(holdTimeout);
					holdTimeout = null;
				}
				setIsSpeaking(true);
				setVolume(rms);
			} else if (isSpeaking()) {
				if (!holdTimeout) {
					holdTimeout = setTimeout(() => {
						setIsSpeaking(false);
						holdTimeout = null;
					}, holdMs);
				}
				setVolume(0);
			}
		}, intervalMs);

		// Runs before the effect re-executes or the component unmounts
		onCleanup(() => {
			clearInterval(interval);
			if (holdTimeout) clearTimeout(holdTimeout);
			source.disconnect();
			audioContext.close();
		});
	});

	return { isSpeaking, volume };
}
