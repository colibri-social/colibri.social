import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { DEVICE_KEYS } from "../../../data/device-prefs";
import { voiceSettings } from "../../../data/voice-settings";
import { cleanup, mountPage } from "./page-test-kit";
import VoiceVideoPage from "./voice-video";

const original = navigator.mediaDevices;
const deviceListeners = new Set<() => void>();

const fakeStream = (kind: "audio" | "video") => {
	if (kind === "video") {
		const canvas = document.createElement("canvas");
		canvas.width = 64;
		canvas.height = 48;
		canvas.getContext("2d")?.fillRect(0, 0, 64, 48);
		return canvas.captureStream(10);
	}
	const context = new AudioContext();
	const tone = context.createOscillator();
	const out = context.createMediaStreamDestination();
	tone.connect(out);
	tone.start();
	return out.stream;
};

const stubDevices = (options: { cameraDenied?: boolean } = {}) => {
	const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
		if (constraints.video && options.cameraDenied)
			throw new DOMException("Permission denied", "NotAllowedError");
		return fakeStream(constraints.video ? "video" : "audio");
	});
	Object.defineProperty(navigator, "mediaDevices", {
		configurable: true,
		value: {
			getUserMedia,
			enumerateDevices: async () => [
				{ deviceId: "mic-1", kind: "audioinput", label: "Desk mic" },
				{ deviceId: "mic-2", kind: "audioinput", label: "Headset" },
				{ deviceId: "cam-1", kind: "videoinput", label: "Webcam" },
			],
			addEventListener: (_: string, listener: () => void) =>
				deviceListeners.add(listener),
			removeEventListener: (_: string, listener: () => void) =>
				deviceListeners.delete(listener),
		},
	});
	return getUserMedia;
};

afterEach(() => {
	cleanup();
	deviceListeners.clear();
	voiceSettings().update({ microphone: undefined });
	localStorage.removeItem(DEVICE_KEYS.voiceSettings);
	Object.defineProperty(navigator, "mediaDevices", {
		configurable: true,
		value: original,
	});
});

it("tests the microphone, previews the camera and syncs voice view options", async () => {
	const getUserMedia = stubDevices();
	const { store } = await mountPage(() => <VoiceVideoPage platform="mobile" />);
	const video = () =>
		document.querySelector<HTMLVideoElement>("video[data-camera-video]");

	await expect
		.element(page.getByRole("button", { name: "Preview camera" }))
		.toBeVisible();
	expect(
		getUserMedia.mock.calls.some(([constraints]) => !!constraints.video),
	).toBe(false);
	await userEvent.click(page.getByRole("button", { name: "Preview camera" }));
	await expect.poll(() => video()?.srcObject).toBeTruthy();
	const preview = video()?.srcObject as MediaStream;
	await userEvent.click(page.getByRole("button", { name: "Stop preview" }));
	await expect.poll(() => video()?.srcObject ?? null).toBeNull();
	expect(
		preview.getTracks().every((track) => track.readyState === "ended"),
	).toBe(true);
	await expect
		.element(page.getByRole("button", { name: "Preview camera" }))
		.toBeVisible();

	await userEvent.click(page.getByRole("button", { name: "Test microphone" }));
	await expect
		.element(page.getByRole("button", { name: "Stop test" }))
		.toBeVisible();
	expect(getUserMedia).toHaveBeenCalledWith(
		expect.objectContaining({
			audio: expect.objectContaining({ noiseSuppression: true }),
		}),
	);
	await userEvent.click(page.getByRole("button", { name: "Stop test" }));
	await expect
		.element(page.getByRole("button", { name: "Test microphone" }))
		.toBeVisible();

	await userEvent.click(page.getByText("Noise suppression"));
	await expect
		.poll(() =>
			JSON.parse(localStorage.getItem(DEVICE_KEYS.voiceSettings) ?? "{}"),
		)
		.toMatchObject({ noiseSuppression: false });

	await userEvent.click(page.getByText("Confirm before joining"));
	await expect
		.poll(() => store.preferences.client().voiceView.confirmJoin)
		.toBe(true);
	await userEvent.click(page.getByText("Show your own camera"));
	await expect
		.poll(() => store.preferences.client().voiceView.showOwnCamera)
		.toBe(false);
});

it("explains a blocked camera", async () => {
	stubDevices({ cameraDenied: true });
	await mountPage(() => <VoiceVideoPage platform="mobile" />);
	await userEvent.click(page.getByRole("button", { name: "Preview camera" }));
	await expect
		.element(
			page
				.getByText("Allow access in your device settings", { exact: false })
				.first(),
		)
		.toBeVisible();
	await expect
		.element(page.getByRole("button", { name: "Try again" }))
		.toBeVisible();
});

it("keeps the microphone test running when the device list refreshes", async () => {
	const getUserMedia = stubDevices();
	voiceSettings().update({ microphone: "mic-2" });
	await mountPage(() => <VoiceVideoPage platform="desktop" />);
	await expect
		.element(page.getByRole("button", { name: /Microphone/ }).first())
		.toHaveTextContent("Headset");

	await userEvent.click(page.getByRole("button", { name: "Test microphone" }));
	await expect
		.element(page.getByRole("button", { name: "Stop test" }))
		.toBeVisible();
	for (const listener of deviceListeners) listener();
	await new Promise((resolve) => setTimeout(resolve, 300));

	const audioCalls = getUserMedia.mock.calls.filter(
		([constraints]) => !!constraints.audio,
	);
	expect(audioCalls).toHaveLength(1);
	expect(audioCalls[0]?.[0].audio).toMatchObject({
		deviceId: { exact: "mic-2" },
	});
	await expect
		.element(page.getByRole("button", { name: "Stop test" }))
		.toBeVisible();
});
