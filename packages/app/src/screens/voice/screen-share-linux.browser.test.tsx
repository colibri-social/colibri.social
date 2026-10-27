import "../../app.css";
import { render } from "solid-js/web";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { windowCaptureRequest } from "../../data/screen-share";
import { Providers } from "../../providers";

vi.mock("../../native/screen-capture", () => ({
	CaptureBridgeError: class extends Error {},
	createNativeCaptureTrack: vi.fn(),
	listNativeCaptureSources: async () => [],
	nativeCapturePermission: async () => true,
	nativeCaptureQuality: () => ({}),
	nativeThumbnailUrl: async () => undefined,
	openScreenRecordingSettings: async () => {},
	previewAspectRatio: () => 16 / 9,
	startNativeCapture: vi.fn(),
	stopNativeCapture: async () => {},
	supportsNativeCapture: async () => false,
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
	vi.restoreAllMocks();
});

const cancelled = () =>
	Promise.reject(new DOMException("cancelled", "NotAllowedError"));

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
	await new Promise((resolve) => setTimeout(resolve, 0));
	await toggleScreenShare();
	await expect
		.element(page.getByRole("radio", { name: /Whole screen/ }))
		.toBeInTheDocument();
};

it("asks the system for a screen when the whole screen is picked", async () => {
	const display = vi
		.spyOn(navigator.mediaDevices, "getDisplayMedia")
		.mockImplementation(cancelled);
	const user = vi
		.spyOn(navigator.mediaDevices, "getUserMedia")
		.mockImplementation(cancelled);
	await openPicker();
	await userEvent.click(page.getByRole("button", { name: "Continue" }));
	await vi.waitFor(() => expect(display).toHaveBeenCalledTimes(1));
	expect(user).not.toHaveBeenCalled();
});

it("asks the system for a window when one window is picked", async () => {
	const display = vi
		.spyOn(navigator.mediaDevices, "getDisplayMedia")
		.mockImplementation(cancelled);
	const user = vi
		.spyOn(navigator.mediaDevices, "getUserMedia")
		.mockImplementation(cancelled);
	await openPicker();
	await userEvent.click(page.getByText("One window"));
	await userEvent.click(page.getByRole("button", { name: "Continue" }));
	await vi.waitFor(() => expect(user).toHaveBeenCalledTimes(1));
	expect(user.mock.calls[0]?.[0]).toEqual(
		windowCaptureRequest({
			resolution: "1080",
			framerate: 30,
			shareAudio: false,
		}),
	);
	expect(display).not.toHaveBeenCalled();
});
