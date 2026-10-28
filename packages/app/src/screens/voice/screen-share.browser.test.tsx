import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Providers } from "../../providers";

const capture = vi.hoisted(() => ({
	start: vi.fn(() => new Promise<never>(() => {})),
	audioApps: vi.fn(async (): Promise<unknown[]> => []),
}));

vi.mock("../../native/screen-capture", () => ({
	CaptureBridgeError: class extends Error {},
	createNativeCaptureTrack: vi.fn(),
	listNativeAudioApps: capture.audioApps,
	listNativeCaptureSources: async () => [
		{
			id: "screen-1",
			kind: "display",
			name: "Display 1",
			application: null,
			width: 1920,
			height: 1080,
			hasThumbnail: false,
		},
	],
	nativeCapturePermission: async () => true,
	nativeCapturePicker: async () => ({ kind: "sources" }),
	nativeCaptureQuality: () => ({}),
	nativeThumbnailUrl: async () => undefined,
	openScreenRecordingSettings: async () => {},
	previewAspectRatio: () => 16 / 9,
	startNativeCapture: capture.start,
	stopNativeCapture: async () => {},
	supportsNativeCapture: async () => true,
}));

const { ScreenShareHost, changeScreenShareSettings, toggleScreenShare } =
	await import("./screen-share");

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	capture.start.mockClear();
	capture.audioApps.mockReset();
	capture.audioApps.mockImplementation(async () => []);
});

const audioApp = (id: string, name: string, router: boolean) => ({
	id,
	name,
	processId: null,
	iconName: null,
	binary: null,
	preselected: false,
	router,
});

it("starts the native capture for the source picked in the picker", async () => {
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
	const tile = page.elementLocator(
		await vi.waitFor(() => {
			const found = document.querySelector<HTMLElement>(
				'[data-screen-source="screen-1"]',
			);
			expect(found).not.toBeNull();
			return found as HTMLElement;
		}),
	);
	await userEvent.click(tile);
	await userEvent.click(
		page.getByRole("button", { name: "Share", exact: true }),
	);
	await vi.waitFor(() =>
		expect(capture.start).toHaveBeenCalledWith(
			"screen-1",
			expect.anything(),
			expect.any(Boolean),
			undefined,
		),
	);
});

it("leaves a sound router out of a whole screen share", async () => {
	capture.audioApps.mockImplementation(async () => [
		audioApp("process-7", "Spotify", false),
		audioApp("process-9", "Voicemeeter", true),
	]);
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
	const tile = page.elementLocator(
		await vi.waitFor(() => {
			const found = document.querySelector<HTMLElement>(
				'[data-screen-source="screen-1"]',
			);
			expect(found).not.toBeNull();
			return found as HTMLElement;
		}),
	);
	changeScreenShareSettings({ shareAudio: true });
	await userEvent.click(tile);
	await expect
		.element(page.getByRole("checkbox", { name: "Voicemeeter" }))
		.not.toBeChecked();
	await expect
		.element(page.getByRole("checkbox", { name: "Spotify" }))
		.toBeChecked();
	await userEvent.click(
		page.getByRole("button", { name: "Share", exact: true }),
	);
	await vi.waitFor(() =>
		expect(capture.start).toHaveBeenCalledWith(
			"screen-1",
			expect.anything(),
			true,
			["process-7"],
		),
	);
});
