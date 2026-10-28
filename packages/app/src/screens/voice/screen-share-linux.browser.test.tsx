import "../../app.css";
import { ColibriError } from "@colibri-social/lib";
import { render } from "solid-js/web";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Providers } from "../../providers";

const native = vi.hoisted(() => ({
	start: vi.fn(),
}));

vi.mock("../../native/screen-capture", () => ({
	CaptureBridgeError: class extends Error {},
	createNativeCaptureTrack: vi.fn(),
	listNativeAudioApps: async () => [
		{
			id: "process-7",
			name: "Spotify",
			processId: 7,
			iconName: null,
			binary: null,
			preselected: false,
			router: false,
		},
	],
	listNativeCaptureSources: async () => [
		{
			id: "display-portal",
			kind: "display",
			name: "Whole screen",
			application: null,
			width: 7680,
			height: 4320,
			hasThumbnail: false,
		},
		{
			id: "window-portal",
			kind: "window",
			name: "One window",
			application: null,
			width: 7680,
			height: 4320,
			hasThumbnail: false,
		},
	],
	nativeCapturePermission: async () => true,
	nativeCapturePicker: async () => ({ kind: "portal" }),
	nativeCaptureQuality: () => ({}),
	nativeThumbnailUrl: async () => undefined,
	openScreenRecordingSettings: async () => {},
	previewAspectRatio: () => 16 / 9,
	startNativeCapture: native.start,
	stopNativeCapture: async () => {},
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

const { ScreenShareHost, toggleScreenShare } = await import("./screen-share");

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	native.start.mockReset();
	vi.restoreAllMocks();
});

const cancelled = () =>
	Promise.reject(
		new ColibriError({
			code: "NativeCancelled",
			method: "screen_capture_start",
		}),
	);

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

it("hands the whole screen to the system dialog without using the browser", async () => {
	native.start.mockImplementation(cancelled);
	const display = vi.spyOn(navigator.mediaDevices, "getDisplayMedia");
	const user = vi.spyOn(navigator.mediaDevices, "getUserMedia");
	await openPicker();
	await userEvent.click(page.getByRole("button", { name: "Continue" }));
	await vi.waitFor(() => expect(native.start).toHaveBeenCalledTimes(1));
	expect(native.start.mock.calls[0]?.[0]).toBe("display-portal");
	expect(native.start.mock.calls[0]?.[3]).toBeUndefined();
	expect(display).not.toHaveBeenCalled();
	expect(user).not.toHaveBeenCalled();
});

it("closes quietly when the system dialog is cancelled", async () => {
	native.start.mockImplementation(cancelled);
	await openPicker();
	await userEvent.click(page.getByText("One window"));
	await userEvent.click(page.getByRole("button", { name: "Continue" }));
	await vi.waitFor(() => expect(native.start).toHaveBeenCalledTimes(1));
	expect(native.start.mock.calls[0]?.[0]).toBe("window-portal");
	await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
});
