import { toast } from "somoto";

const SAMPLE_MS = 200;
const SPEECH_RMS = 0.05;
const VOICE_PRESENT_RMS = 0.006;
const NOISE_FLOOR_RMS = 0.008;
const VOICE_EATEN_MS = 2000;
const NOISE_LEAK_MS = 5000;
const LEVEL_STEP = 20;
const LEVEL_MIN = 10;
const LEVEL_MAX = 100;
const COOLDOWN_MS = 60000;

export type SuppressionMonitor = { destroy: () => void };

export type SuppressionMonitorOptions = {
	rawTrack: MediaStreamTrack;
	processedTrack: MediaStreamTrack;
	isActive: () => boolean;
	isDeepFilter: () => boolean;
	hintsEnabled: () => boolean;
	getLevel: () => number;
	setLevel: (level: number) => void;
	disableHints: () => void;
};

const clampLevel = (level: number): number =>
	Math.max(0, Math.min(LEVEL_MAX, Math.round(level)));

export const createSuppressionMonitor = ({
	rawTrack,
	processedTrack,
	isActive,
	isDeepFilter,
	hintsEnabled,
	getLevel,
	setLevel,
	disableHints,
}: SuppressionMonitorOptions): SuppressionMonitor => {
	const ctx = new AudioContext();

	const makeAnalyser = (track: MediaStreamTrack): AnalyserNode => {
		const analyser = ctx.createAnalyser();
		analyser.fftSize = 512;
		ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
		return analyser;
	};

	const rawAnalyser = makeAnalyser(rawTrack);
	const procAnalyser = makeAnalyser(processedTrack);
	const rawBuf = new Uint8Array(rawAnalyser.frequencyBinCount);
	const procBuf = new Uint8Array(procAnalyser.frequencyBinCount);

	const readRms = (
		analyser: AnalyserNode,
		buf: Uint8Array<ArrayBuffer>,
	): number => {
		analyser.getByteTimeDomainData(buf);
		let sum = 0;
		for (const v of buf) {
			const n = (v - 128) / 128;
			sum += n * n;
		}
		return Math.sqrt(sum / buf.length);
	};

	let voiceEatenMs = 0;
	let noiseLeakMs = 0;
	let cooldownUntil = 0;
	let activeToast: string | number | null = null;

	const showHint = (direction: "up" | "down", level: number): void => {
		const clearActive = (): void => {
			activeToast = null;
		};

		const apply = (): void => {
			setLevel(
				clampLevel(
					direction === "down" ? level - LEVEL_STEP : level + LEVEL_STEP,
				),
			);
			clearActive();
		};

		const disable = (): void => {
			disableHints();
			clearActive();
		};

		const options = {
			action: {
				label: direction === "down" ? "Lower it" : "Raise it",
				onClick: apply,
			},
			cancel: { label: "Don't show again", onClick: disable },
			onAutoClose: clearActive,
			onDismiss: clearActive,
		};

		activeToast =
			direction === "down"
				? toast("Your voice might be getting cut off", {
						description: "Noise suppression may be too strong.",
						...options,
					})
				: toast("We might still be hearing background noise", {
						description: "Try stronger noise suppression.",
						...options,
					});
	};

	const interval = setInterval(() => {
		if (!isActive() || !hintsEnabled() || !isDeepFilter()) {
			voiceEatenMs = 0;
			noiseLeakMs = 0;
			return;
		}

		const rawRms = readRms(rawAnalyser, rawBuf);
		const procRms = readRms(procAnalyser, procBuf);

		if (rawRms > SPEECH_RMS) {
			voiceEatenMs =
				procRms < VOICE_PRESENT_RMS
					? voiceEatenMs + SAMPLE_MS
					: Math.max(0, voiceEatenMs - SAMPLE_MS);
			noiseLeakMs = Math.max(0, noiseLeakMs - SAMPLE_MS);
		} else {
			noiseLeakMs =
				procRms > NOISE_FLOOR_RMS
					? noiseLeakMs + SAMPLE_MS
					: Math.max(0, noiseLeakMs - SAMPLE_MS);
		}

		if (Date.now() < cooldownUntil || activeToast !== null) return;

		const level = getLevel();

		if (voiceEatenMs >= VOICE_EATEN_MS && level > LEVEL_MIN) {
			voiceEatenMs = 0;
			noiseLeakMs = 0;
			cooldownUntil = Date.now() + COOLDOWN_MS;
			showHint("down", level);
		} else if (noiseLeakMs >= NOISE_LEAK_MS && level < LEVEL_MAX) {
			voiceEatenMs = 0;
			noiseLeakMs = 0;
			cooldownUntil = Date.now() + COOLDOWN_MS;
			showHint("up", level);
		}
	}, SAMPLE_MS);

	const destroy = (): void => {
		clearInterval(interval);
		ctx.close().catch(() => {});
		if (activeToast !== null) {
			toast.dismiss(activeToast);
			activeToast = null;
		}
	};

	return { destroy };
};
