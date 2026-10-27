import { afterEach, expect, it, vi } from "vitest";
import {
	createNativeSoundPlayer,
	setSoundEffectsVolume,
	VOICE_SOUNDS,
} from "./voice-sounds";

afterEach(() => setSoundEffectsVolume(100));

const until = async (check: () => boolean, timeout = 4000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

it("stores each sound once and plays it natively", async () => {
	const files = new Map<string, string>();
	const bridge = {
		hasSound: vi.fn((name: string) => files.has(name)),
		storeSound: vi.fn((name: string, base64: string) => {
			files.set(name, base64);
		}),
		playSound: vi.fn(),
	};
	const play = createNativeSoundPlayer(bridge);
	play("join");
	play("join");
	await until(() => bridge.playSound.mock.calls.length === 2);
	expect(bridge.storeSound).toHaveBeenCalledTimes(1);
	const [name, base64] = bridge.storeSound.mock.calls[0] as [string, string];
	expect(VOICE_SOUNDS.join).toContain(name);
	expect(base64.length).toBeGreaterThan(100);
	expect(bridge.playSound).toHaveBeenCalledWith(name);
});

it("skips storing a sound the device already has", async () => {
	const bridge = {
		hasSound: vi.fn(() => true),
		storeSound: vi.fn(),
		playSound: vi.fn(),
	};
	createNativeSoundPlayer(bridge)("mute");
	await until(() => bridge.playSound.mock.calls.length === 1);
	expect(bridge.storeSound).not.toHaveBeenCalled();
});

it("passes the sound effects volume to the device", async () => {
	const bridge = {
		hasSound: vi.fn(() => true),
		storeSound: vi.fn(),
		playSound: vi.fn(),
		playSoundAt: vi.fn(),
	};
	setSoundEffectsVolume(40);
	createNativeSoundPlayer(bridge)("join");
	await until(() => bridge.playSoundAt.mock.calls.length === 1);
	expect(bridge.playSoundAt.mock.calls[0]?.[1]).toBeCloseTo(0.4);
	expect(bridge.playSound).not.toHaveBeenCalled();
});

it("stays silent when sound effects are turned all the way down", async () => {
	const bridge = {
		hasSound: vi.fn(() => true),
		storeSound: vi.fn(),
		playSound: vi.fn(),
		playSoundAt: vi.fn(),
	};
	setSoundEffectsVolume(0);
	createNativeSoundPlayer(bridge)("leave");
	await new Promise((resolve) => setTimeout(resolve, 100));
	expect(bridge.playSoundAt).not.toHaveBeenCalled();
	expect(bridge.playSound).not.toHaveBeenCalled();
});
