import "../../app.css";
import { ColibriError } from "@colibri-social/lib";
import { render } from "solid-js/web";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { voice } from "../../data/voice";
import { Providers } from "../../providers";

const native = vi.hoisted(() => ({
	start: vi.fn(),
	startAudio: vi.fn(),
	audioTrack: vi.fn(),
	stop: vi.fn(async () => {}),
	list: vi.fn(async () => []),
	prepare: vi.fn(async () => {}),
}));

vi.mock("../../native/screen-capture", () => ({
	CaptureBridgeError: class extends Error {},
	createNativeAudioTrack: native.audioTrack,
	createNativeCaptureTrack: vi.fn(),
	listNativeAudioApps: async () => [
		{
			id: "process-7",
			name: "Spotify",
			processId: 7,
			iconName: null,
			binary: null,
			preselected: true,
			router: false,
		},
		{
			id: "process-9",
			name: "Easy Effects",
			processId: 9,
			iconName: null,
			binary: null,
			preselected: false,
			router: true,
		},
	],
	listNativeCaptureSources: native.list,
	nativeCapturePermission: async () => true,
	nativeCapturePicker: async () => ({ kind: "browser" }),
	nativeCaptureQuality: () => ({}),
	nativeThumbnailUrl: async () => undefined,
	openScreenRecordingSettings: async () => {},
	previewAspectRatio: () => 16 / 9,
	prepareDisplayCapture: native.prepare,
	startNativeAudioCapture: native.startAudio,
	startNativeCapture: native.start,
	stopNativeCapture: native.stop,
	supportsNativeCapture: async () => true,
}));

vi.mock("../../shell/desktop/window-chrome", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("../../shell/desktop/window-chrome")
	>()),
	isNativeShell: () => true,
}));

const LINUX_AGENT =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
const originalAgent = navigator.userAgent;

beforeAll(() => {
	Object.defineProperty(navigator, "userAgent", {
		value: LINUX_AGENT,
		configurable: true,
	});
});

afterAll(() => {
	Object.defineProperty(navigator, "userAgent", {
		value: originalAgent,
		configurable: true,
	});
});

const { ScreenShareHost, changeScreenShareSettings, toggleScreenShare } =
	await import("./screen-share");

type Capture = Parameters<typeof voice.shareScreen>[0];

const SESSION = { url: "ws://127.0.0.1:1", token: "t" };

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	native.start.mockReset();
	native.startAudio.mockReset();
	native.audioTrack.mockReset();
	native.stop.mockClear();
	native.list.mockClear();
	native.prepare.mockClear();
	changeScreenShareSettings({ shareAudio: false });
	vi.restoreAllMocks();
});

const fakeStream = (displaySurface: string, painting = true) => {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 36;
	const context = canvas.getContext("2d");
	const source = canvas.captureStream(30);
	const video = source.getVideoTracks()[0] as MediaStreamTrack;
	const stop = video.stop.bind(video);
	Object.assign(video, {
		stop: vi.fn(stop),
		getSettings: () => ({
			...MediaStreamTrack.prototype.getSettings.call(video),
			displaySurface,
		}),
	});
	const paint = setInterval(() => {
		if (!painting) return;
		context?.fillRect(0, 0, 8, 8);
	}, 20);
	video.addEventListener("ended", () => clearInterval(paint));
	return { video, stream: source };
};

const fakeSound = () => ({
	track: { kind: "audio", stop: vi.fn() } as unknown as MediaStreamTrack,
	stop: vi.fn(),
});

const stubShare = () =>
	vi.spyOn(voice, "shareScreen").mockImplementation(async () => true);

const openPicker = async () => {
	const root = document.createElement("div");
	document.body.append(root);
	dispose = render(
		() => (
			<Providers>
				<ScreenShareHost />
			</Providers>
		),
		root,
	);
	await new Promise((resolve) => setTimeout(resolve, 50));
	await toggleScreenShare();
	await expect
		.element(page.getByRole("radio", { name: /Whole screen/ }))
		.toBeInTheDocument();
};

const shareFrom = async (displaySurface: string, painting = true) => {
	const { video, stream } = fakeStream(displaySurface, painting);
	const display = vi
		.spyOn(navigator.mediaDevices, "getDisplayMedia")
		.mockResolvedValue(stream);
	return { video, display };
};

const sharedCapture = async (
	share: ReturnType<typeof stubShare>,
): Promise<Capture> => {
	await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
	return share.mock.calls[0]?.[0] as Capture;
};

it("shares the whole screen through the system dialog without a source list", async () => {
	const { video, display } = await shareFrom("monitor");
	const share = stubShare();
	await openPicker();
	await userEvent.click(page.getByRole("button", { name: "Continue" }));
	const capture = await sharedCapture(share);
	expect(capture.video).toBe(video);
	expect(capture.audio).toBeNull();
	const request = display.mock.calls[0]?.[0] as {
		video: MediaTrackConstraints;
		audio: unknown;
	};
	expect(request.audio).toBe(false);
	expect(request.video.displaySurface).toBe("monitor");
	expect(native.prepare).toHaveBeenCalledTimes(1);
	expect(request.video.frameRate).toBeDefined();
	expect(native.list).not.toHaveBeenCalled();
	expect(native.start).not.toHaveBeenCalled();
	expect(native.startAudio).not.toHaveBeenCalled();
	capture.release();
	expect(video.stop).toHaveBeenCalled();
	expect(native.stop).toHaveBeenCalled();
});

it("adds the sound of the whole screen without the routing apps", async () => {
	const { video } = await shareFrom("monitor");
	const share = stubShare();
	const sound = fakeSound();
	native.startAudio.mockResolvedValue(SESSION);
	native.audioTrack.mockResolvedValue(sound);
	changeScreenShareSettings({ shareAudio: true });
	await openPicker();
	await expect
		.element(page.getByRole("checkbox", { name: "Easy Effects" }))
		.not.toBeChecked();
	await userEvent.click(page.getByRole("button", { name: "Continue" }));
	const capture = await sharedCapture(share);
	expect(native.startAudio).toHaveBeenCalledWith("display", ["process-7"]);
	expect(native.audioTrack.mock.calls[0]?.[0]).toBe(SESSION);
	expect(capture.video).toBe(video);
	expect(capture.audio).toBe(sound.track);
	capture.release();
	expect(video.stop).toHaveBeenCalled();
	expect(sound.stop).toHaveBeenCalled();
	expect(native.stop).toHaveBeenCalled();
});

it("takes the sound of the picked app when the system shares a window", async () => {
	await shareFrom("window");
	const share = stubShare();
	native.startAudio.mockResolvedValue(SESSION);
	native.audioTrack.mockResolvedValue(fakeSound());
	changeScreenShareSettings({ shareAudio: true });
	await openPicker();
	await userEvent.click(page.getByText("One window"));
	await userEvent.click(page.getByRole("button", { name: "Continue" }));
	await sharedCapture(share);
	expect(native.startAudio).toHaveBeenCalledWith("window", ["process-7"]);
	expect(native.prepare).not.toHaveBeenCalled();
});

it("follows the surface the system shared, not the one picked in the sheet", async () => {
	const { display } = await shareFrom("window");
	const share = stubShare();
	native.startAudio.mockResolvedValue(SESSION);
	native.audioTrack.mockResolvedValue(fakeSound());
	changeScreenShareSettings({ shareAudio: true });
	await openPicker();
	await userEvent.click(page.getByText("Whole screen"));
	await userEvent.click(page.getByRole("button", { name: "Continue" }));
	await sharedCapture(share);
	const request = display.mock.calls[0]?.[0] as {
		video: MediaTrackConstraints;
	};
	expect(request.video.displaySurface).toBe("monitor");
	expect(native.startAudio.mock.calls[0]?.[0]).toBe("window");
});

it("keeps sharing the video when the sound fails to start", async () => {
	const { video } = await shareFrom("monitor");
	const share = stubShare();
	native.startAudio.mockRejectedValue(
		new ColibriError({
			code: "NativeFailed",
			method: "screen_capture_start_audio",
		}),
	);
	changeScreenShareSettings({ shareAudio: true });
	await openPicker();
	await userEvent.click(page.getByRole("button", { name: "Continue" }));
	const capture = await sharedCapture(share);
	expect(capture.video).toBe(video);
	expect(capture.audio).toBeNull();
	expect(native.audioTrack).not.toHaveBeenCalled();
	await expect
		.element(page.getByText("Your screen is shared without sound"))
		.toBeInTheDocument();
	expect(video.stop).not.toHaveBeenCalled();
});

it("sends nothing when the shared surface ends before its first picture", async () => {
	const { video } = await shareFrom("monitor", false);
	const share = stubShare();
	await openPicker();
	await userEvent.click(page.getByRole("button", { name: "Continue" }));
	await new Promise((resolve) => setTimeout(resolve, 100));
	video.dispatchEvent(new Event("ended"));
	await new Promise((resolve) => setTimeout(resolve, 50));
	expect(share).not.toHaveBeenCalled();
	expect(native.startAudio).not.toHaveBeenCalled();
	expect(video.stop).toHaveBeenCalled();
});

it("closes quietly when the system dialog is cancelled", async () => {
	vi.spyOn(navigator.mediaDevices, "getDisplayMedia").mockRejectedValue(
		new DOMException("Permission denied", "NotAllowedError"),
	);
	const share = stubShare();
	changeScreenShareSettings({ shareAudio: true });
	await openPicker();
	await userEvent.click(page.getByRole("button", { name: "Continue" }));
	await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	await new Promise((resolve) => setTimeout(resolve, 50));
	expect(share).not.toHaveBeenCalled();
	expect(native.startAudio).not.toHaveBeenCalled();
	expect(page.getByText("Couldn't share your screen").query()).toBeNull();
});
