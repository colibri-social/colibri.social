import type { VideoStatsSample } from "./video-stats";

export type SenderLoad = {
	level: number;
	cpuStreak: number;
	clearStreak: number;
	recoveryPolls: number;
	lastMove: "down" | "up" | null;
};

export type SenderTuning = {
	framerateScale: number;
	maxSpatialLayer: number;
};

const CPU_STREAK_TO_STEP_DOWN = 2;

export const BASE_RECOVERY_POLLS = 8;

export const MAX_RECOVERY_POLLS = 60;

const REDUCED_FRAMERATE_SCALE = 0.5;

const MIN_REDUCED_FRAMERATE = 8;

export const INITIAL_SENDER_LOAD: SenderLoad = {
	level: 0,
	cpuStreak: 0,
	clearStreak: 0,
	recoveryPolls: BASE_RECOVERY_POLLS,
	lastMove: null,
};

const maxLoadLevel = (spatialLayers: number): number => {
	return spatialLayers > 1 ? 2 : 1;
};

export const stepSenderLoad = (
	load: SenderLoad,
	sample: Pick<VideoStatsSample, "limitation"> | undefined,
	spatialLayers: number,
): SenderLoad => {
	if (!sample) return load;

	const ceiling = maxLoadLevel(spatialLayers);

	if (sample.limitation === "cpu") {
		const cpuStreak = load.cpuStreak + 1;

		if (cpuStreak < CPU_STREAK_TO_STEP_DOWN || load.level >= ceiling) {
			return { ...load, cpuStreak, clearStreak: 0 };
		}

		return {
			level: load.level + 1,
			cpuStreak: 0,
			clearStreak: 0,
			recoveryPolls:
				load.lastMove === "up"
					? Math.min(load.recoveryPolls * 2, MAX_RECOVERY_POLLS)
					: load.recoveryPolls,
			lastMove: "down",
		};
	}

	if (load.level === 0) {
		return load.cpuStreak === 0 && load.clearStreak === 0
			? load
			: { ...load, cpuStreak: 0, clearStreak: 0 };
	}

	const clearStreak = load.clearStreak + 1;

	if (clearStreak < load.recoveryPolls) {
		return { ...load, cpuStreak: 0, clearStreak };
	}

	return {
		...load,
		level: load.level - 1,
		cpuStreak: 0,
		clearStreak: 0,
		lastMove: "up",
	};
};

export const tuningFor = (
	level: number,
	spatialLayers: number,
): SenderTuning => {
	const top = Math.max(0, spatialLayers - 1);

	return {
		framerateScale: level >= 1 ? REDUCED_FRAMERATE_SCALE : 1,
		maxSpatialLayer: level >= 2 && top > 0 ? top - 1 : top,
	};
};

export const tunedEncodings = (
	base: readonly RTCRtpEncodingParameters[],
	tuning: SenderTuning,
): RTCRtpEncodingParameters[] => {
	return base.map((encoding, index) => {
		const framerate = encoding.maxFramerate;
		const maxFramerate =
			framerate === undefined || tuning.framerateScale >= 1
				? framerate
				: Math.min(
						framerate,
						Math.max(
							MIN_REDUCED_FRAMERATE,
							Math.round(framerate * tuning.framerateScale),
						),
					);

		return {
			...encoding,
			...(maxFramerate === undefined ? {} : { maxFramerate }),
			active: index <= tuning.maxSpatialLayer,
		};
	});
};
