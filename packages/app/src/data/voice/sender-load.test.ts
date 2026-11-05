import { describe, expect, it } from "vitest";
import {
	BASE_RECOVERY_POLLS,
	INITIAL_SENDER_LOAD,
	MAX_RECOVERY_POLLS,
	type SenderLoad,
	stepSenderLoad,
	tunedEncodings,
	tuningFor,
} from "./sender-load";
import { readVideoStats, type StatsLike } from "./video-stats";

const outbound = (qualityLimitationReason: string) => {
	const stats: StatsLike = new Map(
		[
			{
				id: "out",
				type: "outbound-rtp",
				kind: "video",
				frameWidth: 1280,
				frameHeight: 720,
				framesPerSecond: 12,
				bytesSent: 1_000,
				timestamp: 1,
				qualityLimitationReason,
			},
			{ id: "src", type: "media-source", kind: "video", framesPerSecond: 30 },
		].map((stat) => [stat.id, stat]),
	);

	return readVideoStats(
		stats,
		{ id: "cam-1", direction: "send", source: "cam" },
		undefined,
	).sample;
};

const CPU = outbound("cpu");
const CLEAR = outbound("none");
const BANDWIDTH = outbound("bandwidth");

const run = (
	samples: readonly (typeof CPU | undefined)[],
	layers = 3,
	start: SenderLoad = INITIAL_SENDER_LOAD,
) => {
	return samples.reduce(
		(load, sample) => stepSenderLoad(load, sample, layers),
		start,
	);
};

describe("stepSenderLoad", () => {
	it("ignores a single cpu limited poll", () => {
		expect(run([CPU]).level).toBe(0);
		expect(run([CPU, CLEAR, CPU]).level).toBe(0);
	});

	it("lowers the frame rate after sustained cpu limits, then the top layer", () => {
		expect(run([CPU, CPU]).level).toBe(1);
		expect(run([CPU, CPU, CPU, CPU]).level).toBe(2);
		expect(run([CPU, CPU, CPU, CPU, CPU, CPU]).level).toBe(2);
	});

	it("stops at the frame rate step for a single layer stream", () => {
		expect(run([CPU, CPU, CPU, CPU], 1).level).toBe(1);
	});

	it("leaves bandwidth limits and missing samples to the network", () => {
		expect(run([BANDWIDTH, BANDWIDTH, BANDWIDTH]).level).toBe(0);
		const loaded = run([CPU, CPU]);
		expect(stepSenderLoad(loaded, undefined, 3)).toBe(loaded);
	});

	it("steps back up one level after the recovery window", () => {
		const loaded = run([CPU, CPU, CPU, CPU]);
		const clear = Array.from({ length: BASE_RECOVERY_POLLS }, () => CLEAR);
		expect(run(clear.slice(1), 3, loaded).level).toBe(2);
		expect(run(clear, 3, loaded).level).toBe(1);
		expect(run([...clear, ...clear], 3, loaded).level).toBe(0);
	});

	it("waits longer each time the load returns right after a step up", () => {
		const clear = Array.from({ length: BASE_RECOVERY_POLLS }, () => CLEAR);
		const bounced = run([CPU, CPU, ...clear, CPU, CPU]);
		expect(bounced).toMatchObject({
			level: 1,
			recoveryPolls: BASE_RECOVERY_POLLS * 2,
		});
		const capped = Array.from({ length: 6 }).reduce<SenderLoad>(
			(load) =>
				run([...clear, ...clear, ...clear, ...clear, CPU, CPU], 3, load),
			bounced,
		);
		expect(capped.recoveryPolls).toBe(MAX_RECOVERY_POLLS);
	});
});

describe("tunedEncodings", () => {
	const base: RTCRtpEncodingParameters[] = [
		{ scaleResolutionDownBy: 4, maxBitrate: 150_000, maxFramerate: 15 },
		{ scaleResolutionDownBy: 2, maxBitrate: 500_000, maxFramerate: 30 },
		{ scaleResolutionDownBy: 1, maxBitrate: 1_500_000, maxFramerate: 30 },
	];

	it("sends every layer at full rate when unloaded", () => {
		expect(tunedEncodings(base, tuningFor(0, 3))).toEqual(
			base.map((encoding) => ({ ...encoding, active: true })),
		);
	});

	it("halves the frame rate with a floor", () => {
		expect(
			tunedEncodings(base, tuningFor(1, 3)).map(
				(encoding) => encoding.maxFramerate,
			),
		).toEqual([8, 15, 15]);
	});

	it("turns off the top layer at the second level", () => {
		expect(
			tunedEncodings(base, tuningFor(2, 3)).map((encoding) => encoding.active),
		).toEqual([true, true, false]);
		expect(
			tunedEncodings([base[2]], tuningFor(2, 1)).map(
				(encoding) => encoding.active,
			),
		).toEqual([true]);
	});
});
