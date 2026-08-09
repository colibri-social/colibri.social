import type { NoiseSuppressionMode } from "../../contexts/UserPreferences";

export const EXPERIMENTAL_DENOISERS_EXPERIMENT = "voice-denoisers-v1";

export interface NoiseModeDef {
	id: NoiseSuppressionMode;
	label: string;
	description: string;
	experimental: boolean;
	tunable: boolean;
	usesDeepFilterNet: boolean;
	fallback: NoiseSuppressionMode | null;
}

export const NOISE_MODES: ReadonlyArray<NoiseModeDef> = [
	{
		id: "off",
		label: "Off",
		description: "Your microphone is sent through untouched.",
		experimental: false,
		tunable: false,
		usesDeepFilterNet: false,
		fallback: null,
	},
	{
		id: "low",
		label: "Low",
		description:
			"RNNoise. Very cheap to run and removes steady background noise like fans or hum.",
		experimental: false,
		tunable: false,
		usesDeepFilterNet: false,
		fallback: "off",
	},
	{
		id: "medium",
		label: "Medium",
		description:
			"DeepFilterNet. Removes most background noise, including keyboards and voices behind you.",
		experimental: false,
		tunable: true,
		usesDeepFilterNet: true,
		fallback: "low",
	},
	{
		id: "high",
		label: "High",
		description:
			"DeepFilterNet with extra filtering and voice gating, so silence stays silent. Costs the most CPU.",
		experimental: false,
		tunable: false,
		usesDeepFilterNet: true,
		fallback: "medium",
	},
	{
		id: "exp-dtln",
		label: "Experimental (DTLN)",
		description:
			"Dual-signal Transformation LSTM Network, running at 16 kHz. Downloads extra assets the first time you use it.",
		experimental: true,
		tunable: false,
		usesDeepFilterNet: false,
		fallback: "medium",
	},
	{
		id: "exp-gtcrn",
		label: "Experimental (GTCRN)",
		description:
			"Grouped Temporal Convolutional Recurrent Network, running at 16 kHz. Downloads extra assets the first time you use it.",
		experimental: true,
		tunable: false,
		usesDeepFilterNet: false,
		fallback: "medium",
	},
	{
		id: "exp-ulunas",
		label: "Experimental (UL-UNAS)",
		description:
			"Ultra-lightweight U-Net found by architecture search, running at 16 kHz. Downloads extra assets the first time you use it.",
		experimental: true,
		tunable: false,
		usesDeepFilterNet: false,
		fallback: "medium",
	},
];

const BY_ID = new Map(NOISE_MODES.map((mode) => [mode.id, mode]));

export const noiseMode = (id: NoiseSuppressionMode): NoiseModeDef =>
	BY_ID.get(id) ?? NOISE_MODES[0];

export const isNoiseSuppressionMode = (
	value: unknown,
): value is NoiseSuppressionMode =>
	typeof value === "string" && BY_ID.has(value as NoiseSuppressionMode);

export const fallbackFrom = (
	id: NoiseSuppressionMode,
	skip: (mode: NoiseSuppressionMode) => boolean = () => false,
): NoiseSuppressionMode => {
	let next = noiseMode(id).fallback;
	while (next && skip(next)) next = noiseMode(next).fallback;
	return next ?? "off";
};
