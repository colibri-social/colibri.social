import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoiseSuppressionMode } from "../contexts/UserPreferences";

const hooks = vi.hoisted(() => ({
	createDfnCore: vi.fn(),
	createVoiceGateNode: vi.fn(),
}));

vi.mock("@sapphi-red/web-noise-suppressor", () => ({
	loadRnnoise: vi.fn(async () => new ArrayBuffer(8)),
	RnnoiseWorkletNode: class {
		connect = vi.fn();
		disconnect = vi.fn();
		destroy = vi.fn();
	},
}));

vi.mock("@sapphi-red/web-noise-suppressor/rnnoise.wasm?url", () => ({
	default: "/rnnoise.wasm",
}));

vi.mock("@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url", () => ({
	default: "/rnnoise_simd.wasm",
}));

vi.mock("@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url", () => ({
	default: "/rnnoiseWorklet.js",
}));

vi.mock("./noise/gate-worklet", () => ({
	createVoiceGateNode: hooks.createVoiceGateNode,
}));

vi.mock("./noise/dfn", async (importOriginal) => ({
	...(await importOriginal<typeof import("./noise/dfn")>()),
	createDfnCore: hooks.createDfnCore,
	deviceLikelyTooWeakForDfn: () => false,
}));

class FakeNode {
	connect = vi.fn();
	disconnect = vi.fn();
}

class FakeAudioContext {
	state = "running";
	audioWorklet = { addModule: vi.fn(async () => {}) };
	createMediaStreamSource = () => new FakeNode();
	createMediaStreamDestination = () => ({
		...new FakeNode(),
		stream: { getAudioTracks: () => [{ id: "processed" }] },
	});
	createBiquadFilter = () => ({
		...new FakeNode(),
		type: "",
		frequency: { value: 0 },
		Q: { value: 0 },
	});
	close = vi.fn(async () => {});
}

const rawTrack = { id: "raw" } as unknown as MediaStreamTrack;

const build = async (
	desiredMode: NoiseSuppressionMode,
	onFallback: (from: NoiseSuppressionMode, to: NoiseSuppressionMode) => void,
) => {
	const { createNoiseSuppressor } = await import("./createNoiseSuppressor");
	return await createNoiseSuppressor(rawTrack, { desiredMode, onFallback });
};

beforeEach(() => {
	vi.resetModules();
	hooks.createDfnCore.mockRejectedValue(
		new WebAssembly.CompileError("function body length too big"),
	);
	vi.stubGlobal("AudioContext", FakeAudioContext);
	vi.stubGlobal(
		"MediaStream",
		class {
			getAudioTracks = () => [rawTrack];
		},
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("noise suppression falling back", () => {
	it("reports the mode it landed on, which is what persists the choice", async () => {
		const onFallback = vi.fn();

		const suppressor = await build("high", onFallback);

		await vi.waitFor(() =>
			expect(onFallback).toHaveBeenCalledWith("high", "low"),
		);
		expect(suppressor.getActiveMode()).toBe("low");
	});

	it("skips DeepFilterNet on the next mode change instead of downloading again", async () => {
		const onFallback = vi.fn();
		const suppressor = await build("high", onFallback);
		await vi.waitFor(() =>
			expect(hooks.createDfnCore).toHaveBeenCalledTimes(1),
		);

		await suppressor.setModeOrFallback("medium");

		expect(hooks.createDfnCore).toHaveBeenCalledTimes(1);
		expect(onFallback).toHaveBeenLastCalledWith("medium", "low");
		expect(suppressor.getActiveMode()).toBe("low");
	});

	it("never rejects when a mode change cannot be honoured", async () => {
		const suppressor = await build("low", vi.fn());

		await expect(suppressor.setModeOrFallback("high")).resolves.toBeUndefined();
	});
});
