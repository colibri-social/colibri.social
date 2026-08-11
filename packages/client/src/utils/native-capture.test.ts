import { describe, expect, it } from "vitest";
import {
	createCaptureCleanup,
	nativeCaptureQuality,
	previewAspectRatio,
} from "./native-capture";
import { WIRE_PARSER_SOURCE } from "./native-capture-worker";
import { screenMaxBitrate } from "./screen-share";

type ParsedMessage =
	| {
			kind: "video";
			type: "key" | "delta";
			timestamp: number;
			data: Uint8Array;
	  }
	| { kind: "audio"; frames: number; planes: Float32Array[] };

const loadParser = (): ((buffer: ArrayBuffer) => ParsedMessage) =>
	new Function(`${WIRE_PARSER_SOURCE}\nreturn parseMessage;`)();

const loadBase64 = (): ((value: string) => Uint8Array) =>
	new Function(`${WIRE_PARSER_SOURCE}\nreturn decodeBase64;`)();

const videoFrame = (
	keyframe: boolean,
	timestamp: bigint,
	payload: number[],
): ArrayBuffer => {
	const buffer = new ArrayBuffer(10 + payload.length);
	const view = new DataView(buffer);
	view.setUint8(0, 0);
	view.setUint8(1, keyframe ? 1 : 0);
	view.setBigInt64(2, timestamp, false);
	new Uint8Array(buffer, 10).set(payload);
	return buffer;
};

const audioFrame = (planes: number[][]): ArrayBuffer => {
	const frames = planes[0].length;
	const buffer = new ArrayBuffer(6 + planes.length * frames * 4);
	const view = new DataView(buffer);
	view.setUint8(0, 1);
	view.setUint8(1, planes.length);
	view.setUint32(2, frames, false);
	const samples = new Float32Array(planes.flat());
	new Uint8Array(buffer, 6).set(new Uint8Array(samples.buffer));
	return buffer;
};

describe("the worker wire parser", () => {
	it("reads a keyframe with its timestamp and payload", () => {
		const parsed = loadParser()(videoFrame(true, 1_234_567n, [7, 8, 9]));

		expect(parsed.kind).toBe("video");
		if (parsed.kind !== "video") return;
		expect(parsed.type).toBe("key");
		expect(parsed.timestamp).toBe(1_234_567);
		expect(Array.from(parsed.data)).toEqual([7, 8, 9]);
	});

	it("reads a delta frame", () => {
		const parsed = loadParser()(videoFrame(false, 0n, [1]));
		expect(parsed.kind === "video" && parsed.type).toBe("delta");
	});

	it("agrees with the server on the ten byte video header", () => {
		const parsed = loadParser()(videoFrame(true, 42n, [5, 5, 5, 5]));
		expect(parsed.kind === "video" && parsed.data.length).toBe(4);
	});

	it("splits audio into one plane per channel", () => {
		const parsed = loadParser()(
			audioFrame([
				[0.25, 0.5],
				[-0.25, -0.5],
			]),
		);

		expect(parsed.kind).toBe("audio");
		if (parsed.kind !== "audio") return;
		expect(parsed.frames).toBe(2);
		expect(parsed.planes.length).toBe(2);
		expect(Array.from(parsed.planes[0])).toEqual([0.25, 0.5]);
		expect(Array.from(parsed.planes[1])).toEqual([-0.25, -0.5]);
	});

	it("handles mono audio", () => {
		const parsed = loadParser()(audioFrame([[1, 0, -1]]));

		expect(parsed.kind === "audio" && parsed.planes.length).toBe(1);
		expect(parsed.kind === "audio" && parsed.frames).toBe(3);
	});

	it("tells audio and video apart by the leading kind byte", () => {
		expect(loadParser()(videoFrame(true, 0n, [1])).kind).toBe("video");
		expect(loadParser()(audioFrame([[0]])).kind).toBe("audio");
	});

	it("decodes the base64 codec description", () => {
		expect(Array.from(loadBase64()("AQID"))).toEqual([1, 2, 3]);
	});
});

describe("nativeCaptureQuality", () => {
	it("scales a 4k source down to the chosen tier keeping its aspect ratio", () => {
		const quality = nativeCaptureQuality(
			{ resolution: "1080", framerate: 30 },
			3840,
			2160,
		);

		expect(quality.height).toBe(1080);
		expect(quality.width).toBe(1920);
	});

	it("never scales a small window up", () => {
		const quality = nativeCaptureQuality(
			{ resolution: "1440", framerate: 30 },
			800,
			600,
		);

		expect(quality.width).toBe(800);
		expect(quality.height).toBe(600);
	});

	it("passes the source through untouched at source resolution", () => {
		const quality = nativeCaptureQuality(
			{ resolution: "source", framerate: 60 },
			3440,
			1440,
		);

		expect(quality.width).toBe(3440);
		expect(quality.height).toBe(1440);
	});

	it("always produces even dimensions, which H.264 requires", () => {
		const quality = nativeCaptureQuality(
			{ resolution: "720", framerate: 30 },
			1365,
			767,
		);

		expect(quality.width % 2).toBe(0);
		expect(quality.height % 2).toBe(0);
	});

	it("carries the ladder bitrate and framerate through", () => {
		const source = { resolution: "1440", framerate: 60 } as const;
		const quality = nativeCaptureQuality(source, 2560, 1440);

		expect(quality.framerate).toBe(60);
		expect(quality.maxBitrate).toBe(screenMaxBitrate(source));
	});

	it("falls back to sane dimensions for a source that reports nothing", () => {
		const quality = nativeCaptureQuality(
			{ resolution: "source", framerate: 30 },
			0,
			0,
		);

		expect(quality.width).toBeGreaterThan(0);
		expect(quality.height).toBeGreaterThan(0);
	});
});

describe("createCaptureCleanup", () => {
	const spyTargets = () => {
		const calls = { terminate: 0, revoke: 0, audio: 0, close: 0 };
		const cleanup = createCaptureCleanup({
			worker: {
				terminate: () => {
					calls.terminate += 1;
				},
			},
			revoke: () => {
				calls.revoke += 1;
			},
			audio: {
				stop: () => {
					calls.audio += 1;
				},
			},
			writer: {
				close: () => {
					calls.close += 1;
					return Promise.resolve();
				},
			},
		});
		return { calls, cleanup };
	};

	it("tears the worker, the object url, the audio bridge and the writer down", () => {
		const { calls, cleanup } = spyTargets();
		cleanup();

		expect(calls).toEqual({ terminate: 1, revoke: 1, audio: 1, close: 1 });
	});

	it("closes the writer once when the ended track and the stop button both fire", () => {
		const { calls, cleanup } = spyTargets();
		cleanup();
		cleanup();
		cleanup();

		expect(calls.close).toBe(1);
		expect(calls.terminate).toBe(1);
	});

	it("does not leave an unhandled rejection when the writer is already closing", async () => {
		const seen: Array<unknown> = [];
		const onUnhandled = (reason: unknown): void => {
			seen.push(reason);
		};
		process.on("unhandledRejection", onUnhandled);

		createCaptureCleanup({
			worker: { terminate: () => {} },
			revoke: () => {},
			audio: null,
			writer: {
				close: () =>
					Promise.reject(
						new TypeError(
							"Cannot close a writable stream that has already been requested to be closed",
						),
					),
			},
		})();

		await new Promise((resolve) => setTimeout(resolve, 10));
		process.off("unhandledRejection", onUnhandled);

		expect(seen).toEqual([]);
	});

	it("still tears everything down when the writer throws on close", () => {
		const calls = { terminate: 0, revoke: 0 };
		const cleanup = createCaptureCleanup({
			worker: {
				terminate: () => {
					calls.terminate += 1;
				},
			},
			revoke: () => {
				calls.revoke += 1;
			},
			audio: null,
			writer: {
				close: () => {
					throw new TypeError("the writer is in an invalid state");
				},
			},
		});

		expect(() => cleanup()).not.toThrow();
		expect(calls).toEqual({ terminate: 1, revoke: 1 });
	});

	it("works without an audio bridge or a writer", () => {
		const calls = { terminate: 0 };
		const cleanup = createCaptureCleanup({
			worker: {
				terminate: () => {
					calls.terminate += 1;
				},
			},
			revoke: () => {},
			audio: null,
			writer: null,
		});

		expect(() => cleanup()).not.toThrow();
		expect(calls.terminate).toBe(1);
	});
});

describe("previewAspectRatio", () => {
	it("matches a 16:9 display exactly", () => {
		expect(
			Number(previewAspectRatio({ width: 3840, height: 2160 })),
		).toBeCloseTo(16 / 9, 4);
	});

	it("keeps an ultrawide display wide rather than forcing 16:9", () => {
		const ratio = Number(previewAspectRatio({ width: 5120, height: 1440 }));
		expect(ratio).toBeGreaterThan(16 / 9);
	});

	it("keeps a portrait window taller than it is wide", () => {
		const ratio = Number(previewAspectRatio({ width: 700, height: 1200 }));
		expect(ratio).toBeLessThan(1);
		expect(ratio).toBeCloseTo(700 / 1200, 4);
	});

	it("clamps a pathologically tall window so one tile cannot dominate", () => {
		const ratio = Number(previewAspectRatio({ width: 100, height: 4000 }));
		expect(ratio).toBe(0.5);
	});

	it("clamps an absurdly wide strip", () => {
		expect(Number(previewAspectRatio({ width: 8000, height: 100 }))).toBe(3.5);
	});

	it("never returns a zero or negative ratio", () => {
		expect(Number(previewAspectRatio({ width: 0, height: 0 }))).toBeGreaterThan(
			0,
		);
	});
});
