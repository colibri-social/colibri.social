import { afterEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
	track: { kind: "audio" },
	push: vi.fn(),
	stop: vi.fn(),
}));

vi.mock("./audio", () => ({
	createNativeAudioBridge: async () => bridge,
}));

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));

const { CaptureBridgeError, createNativeAudioTrack, startNativeAudioCapture } =
	await import("./index");

class FakeWorker {
	static last: FakeWorker | undefined;
	onmessage: ((event: { data: unknown }) => void) | null = null;
	onerror: (() => void) | null = null;
	posted: unknown[] = [];
	terminated = false;
	constructor() {
		FakeWorker.last = this;
	}
	postMessage(message: unknown) {
		this.posted.push(message);
	}
	terminate() {
		this.terminated = true;
	}
	emit(data: unknown) {
		this.onmessage?.({ data });
	}
}

const SESSION = { url: "ws://127.0.0.1:1", token: "t" };

const stubWorker = () => {
	vi.stubGlobal("Worker", FakeWorker);
	vi.stubGlobal("URL", {
		createObjectURL: () => "blob:capture",
		revokeObjectURL: () => {},
	});
};

afterEach(() => {
	vi.unstubAllGlobals();
	FakeWorker.last = undefined;
	bridge.push.mockReset();
	bridge.stop.mockReset();
	tauri.invoke.mockReset();
});

describe("startNativeAudioCapture", () => {
	it("asks the shell for sound of the picked kind and apps", async () => {
		tauri.invoke.mockResolvedValue(SESSION);
		await expect(
			startNativeAudioCapture("window", ["process-7"]),
		).resolves.toBe(SESSION);
		expect(tauri.invoke).toHaveBeenCalledWith("screen_capture_start_audio", {
			kind: "window",
			audioApps: ["process-7"],
		});
	});

	it("passes a missing app list through as null", async () => {
		tauri.invoke.mockResolvedValue(SESSION);
		await startNativeAudioCapture("display", null);
		expect(tauri.invoke).toHaveBeenCalledWith("screen_capture_start_audio", {
			kind: "display",
			audioApps: null,
		});
	});
});

describe("createNativeAudioTrack", () => {
	it("opens the bridge in audio mode and hands back the sound track", async () => {
		stubWorker();
		const pending = createNativeAudioTrack(SESSION);
		await vi.waitFor(() => expect(FakeWorker.last).toBeDefined());
		const worker = FakeWorker.last as FakeWorker;
		expect(worker.posted[0]).toEqual({ ...SESSION, mode: "audio" });
		worker.emit({ type: "ready" });
		const sound = await pending;
		expect(sound.track).toBe(bridge.track);
		const planes = [new Float32Array(4)];
		worker.emit({ type: "audio", frames: 4, planes });
		expect(bridge.push).toHaveBeenCalledWith({ frames: 4, planes });
		sound.stop();
		expect(worker.terminated).toBe(true);
		expect(bridge.stop).toHaveBeenCalledTimes(1);
	});

	it("tears the sound bridge down when the connection fails before it starts", async () => {
		stubWorker();
		const pending = createNativeAudioTrack(SESSION);
		await vi.waitFor(() => expect(FakeWorker.last).toBeDefined());
		FakeWorker.last?.emit({
			type: "error",
			stage: "connection",
			message: "the capture connection failed",
		});
		const error = await pending.catch((thrown: unknown) => thrown);
		expect(error).toBeInstanceOf(CaptureBridgeError);
		expect(bridge.stop).toHaveBeenCalledTimes(1);
	});
});
