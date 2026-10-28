import { afterEach, beforeEach, expect, it, vi } from "vitest";

type SoundsModule = typeof import("./voice-sounds");

class FakeAudioContext {
	static instances: FakeAudioContext[] = [];
	static missing = new Set<string>();
	static routable = true;
	state: AudioContextState = "running";
	sinkId = "";
	destination = {};
	events: string[] = [];
	setSinkId?: (id: string) => Promise<void>;

	constructor() {
		FakeAudioContext.instances.push(this);
		if (FakeAudioContext.routable) {
			this.setSinkId = vi.fn(async (id: string) => {
				if (FakeAudioContext.missing.has(id)) {
					throw new DOMException("gone", "NotFoundError");
				}
				this.sinkId = id;
				this.events.push(`sink:${id}`);
			});
		}
	}

	async resume() {}

	async decodeAudioData() {
		return {};
	}

	createBufferSource() {
		return {
			buffer: null,
			connect: () => {},
			addEventListener: () => {},
			start: () => this.events.push(`start:${this.sinkId}`),
		};
	}

	createGain() {
		return { gain: { value: 1 }, connect: () => {}, disconnect: () => {} };
	}
}

let sounds: SoundsModule;

const context = () => {
	const created = FakeAudioContext.instances[0];
	if (!created) throw new Error("no audio context");
	return created;
};

beforeEach(async () => {
	FakeAudioContext.instances = [];
	FakeAudioContext.missing = new Set();
	FakeAudioContext.routable = true;
	vi.stubGlobal("AudioContext", FakeAudioContext);
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(new ArrayBuffer(8))),
	);
	vi.resetModules();
	sounds = await import("./voice-sounds");
});

afterEach(() => {
	vi.unstubAllGlobals();
});

it("routes call sounds to the saved speaker before playing", async () => {
	sounds.setSoundEffectsSink("speaker-1");
	sounds.createVoiceSoundPlayer()("join");
	await vi.waitFor(() => expect(context().events).toContain("start:speaker-1"));
	expect(context().events).toEqual(["sink:speaker-1", "start:speaker-1"]);
});

it("follows the speaker when the setting changes", async () => {
	const play = sounds.createVoiceSoundPlayer();
	play("mute");
	await vi.waitFor(() => expect(context().events).toContain("start:"));
	sounds.setSoundEffectsSink("speaker-2");
	play("unmute");
	await vi.waitFor(() => expect(context().events).toContain("start:speaker-2"));
	sounds.setSoundEffectsSink(undefined);
	await vi.waitFor(() => expect(context().sinkId).toBe(""));
	expect(context().setSinkId).toHaveBeenLastCalledWith("");
});

it("plays on the default device when the saved speaker is missing", async () => {
	FakeAudioContext.missing.add("unplugged");
	sounds.setSoundEffectsSink("unplugged");
	sounds.createVoiceSoundPlayer()("leave");
	await vi.waitFor(() => expect(context().events).toContain("start:"));
	expect(context().setSinkId).toHaveBeenCalledWith("unplugged");
	expect(context().setSinkId).toHaveBeenLastCalledWith("");
});

it("moves back to the saved speaker once it reappears", async () => {
	FakeAudioContext.missing.add("headset");
	sounds.setSoundEffectsSink("headset");
	const play = sounds.createVoiceSoundPlayer();
	play("join");
	await vi.waitFor(() => expect(context().events).toContain("start:"));
	FakeAudioContext.missing.delete("headset");
	sounds.refreshSoundEffectsSink();
	play("leave");
	await vi.waitFor(() => expect(context().events).toContain("start:headset"));
});

it("plays without routing where audio contexts cannot pick a speaker", async () => {
	FakeAudioContext.routable = false;
	sounds.setSoundEffectsSink("speaker-1");
	sounds.createVoiceSoundPlayer()("join");
	await vi.waitFor(() => expect(context().events).toEqual(["start:"]));
});
