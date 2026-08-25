import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
	initialize: vi.fn(async () => {}),
	createAudioWorkletNode: vi.fn(async () => ({}) as AudioWorkletNode),
	destroy: vi.fn(),
}));

vi.mock("deepfilternet3-noise-filter", () => ({
	DeepFilterNet3Core: class {
		initialize = hooks.initialize;
		createAudioWorkletNode = hooks.createAudioWorkletNode;
		destroy = hooks.destroy;
	},
	getAssetLoader: () => ({
		getAssetUrls: () => ({
			wasm: "/noise/deepfilternet3/v3/pkg/df_bg.wasm",
			model: "/noise/deepfilternet3/v3/model.tar.gz",
		}),
	}),
}));

const gzipResponse = () => ({
	ok: true,
	arrayBuffer: async () => new Uint8Array([0x1f, 0x8b]).buffer,
});

const arrayBuffer = vi.fn(async () => new ArrayBuffer(4));
const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
	init?.headers ? gzipResponse() : { ok: true, arrayBuffer },
);

const loadDfn = async () => {
	vi.resetModules();
	return await import("./dfn");
};

const params = { attenLim: 80, postFilterBeta: 0 };
const ctx = {} as AudioContext;

beforeEach(() => {
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	hooks.initialize.mockImplementation(async () => {});
});

describe("DeepFilterNet wasm availability", () => {
	it("starts out usable and stays usable when the core builds", async () => {
		const dfn = await loadDfn();

		await dfn.createDfnCore(ctx, params);

		expect(dfn.dfnWasmUsable()).toBe(true);
	});

	it("latches off after the engine refuses the wasm module", async () => {
		const dfn = await loadDfn();
		hooks.initialize.mockRejectedValueOnce(
			new WebAssembly.CompileError("function body length too big"),
		);

		await expect(dfn.createDfnCore(ctx, params)).rejects.toThrow();

		expect(dfn.dfnWasmUsable()).toBe(false);
	});

	it("refuses later attempts without touching the assets again", async () => {
		const dfn = await loadDfn();
		hooks.initialize.mockRejectedValueOnce(
			new WebAssembly.CompileError("function body length too big"),
		);

		await expect(dfn.createDfnCore(ctx, params)).rejects.toThrow();
		const fetchesAfterFirstTry = fetchMock.mock.calls.length;

		await expect(dfn.createDfnCore(ctx, params)).rejects.toThrow(
			/already failed to compile/,
		);

		expect(fetchMock.mock.calls.length).toBe(fetchesAfterFirstTry);
		expect(hooks.initialize).toHaveBeenCalledTimes(1);
	});

	it("keeps the path open when the failure is not the wasm engine", async () => {
		const dfn = await loadDfn();
		hooks.initialize.mockRejectedValueOnce(new Error("network went away"));

		await expect(dfn.createDfnCore(ctx, params)).rejects.toThrow();

		expect(dfn.dfnWasmUsable()).toBe(true);
	});
});

describe("preloading the DeepFilterNet assets", () => {
	it("reads each body to the end, so the browser cache holds a whole file", async () => {
		const dfn = await loadDfn();

		dfn.preloadNoiseSuppressor();
		await vi.waitFor(() => expect(arrayBuffer).toHaveBeenCalledTimes(2));

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("downloads nothing once the wasm is known to be unusable", async () => {
		const dfn = await loadDfn();
		hooks.initialize.mockRejectedValueOnce(
			new WebAssembly.CompileError("function body length too big"),
		);
		await expect(dfn.createDfnCore(ctx, params)).rejects.toThrow();
		fetchMock.mockClear();

		dfn.preloadNoiseSuppressor();

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
