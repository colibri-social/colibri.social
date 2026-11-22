import { describe, expect, it, vi } from "vitest";
import {
	type BoostAudioContext,
	type BoostableElement,
	createAudioBoost,
} from "./gain";

const element = (): BoostableElement & { playing: boolean } => {
	const el = {
		srcObject: null as MediaProvider | null,
		volume: 1,
		muted: false,
		autoplay: false,
		playing: false,
		async play() {
			el.playing = true;
		},
		pause() {
			el.playing = false;
		},
	};
	return el;
};

const fakeContext = () => {
	const boosted = { id: "boosted" } as unknown as MediaStream;
	const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
	const source = { connect: vi.fn(), disconnect: vi.fn() };
	const context: BoostAudioContext = {
		state: "suspended",
		createMediaStreamSource: vi.fn(() => source),
		createGain: vi.fn(() => gain),
		createMediaStreamDestination: vi.fn(() => ({
			stream: boosted,
			connect: vi.fn(),
			disconnect: vi.fn(),
		})),
		resume: vi.fn(async () => {}),
	};
	return { context, gain, source, boosted };
};

const stream = { id: "remote" } as unknown as MediaStream;

describe("createAudioBoost", () => {
	it("uses the element volume up to 100%", () => {
		const el = element();
		const context = vi.fn(() => fakeContext().context);
		const boost = createAudioBoost({
			el,
			stream,
			context,
			createHolder: element,
		});
		boost.apply(0.4);
		expect(el.volume).toBe(0.4);
		expect(context).not.toHaveBeenCalled();
	});

	it("routes through a gain node above 100% and back again", () => {
		const el = element();
		el.srcObject = stream;
		const fake = fakeContext();
		const holders: ReturnType<typeof element>[] = [];
		const boost = createAudioBoost({
			el,
			stream,
			context: () => fake.context,
			createHolder: () => {
				const holder = element();
				holders.push(holder);
				return holder;
			},
		});
		boost.apply(1.5);
		expect(el.volume).toBe(1);
		expect(fake.gain.gain.value).toBe(1.5);
		expect(el.srcObject).toBe(fake.boosted);
		expect(fake.context.resume).toHaveBeenCalled();
		expect(holders[0]?.muted).toBe(true);
		expect(holders[0]?.srcObject).toBe(stream);
		boost.apply(1.8);
		expect(fake.gain.gain.value).toBe(1.8);
		expect(fake.context.createGain).toHaveBeenCalledTimes(1);
		boost.apply(0.7);
		expect(el.srcObject).toBe(stream);
		expect(el.volume).toBe(0.7);
		expect(fake.source.disconnect).toHaveBeenCalled();
		expect(holders[0]?.srcObject).toBeNull();
	});

	it("caps at 100% where Web Audio is missing", () => {
		const el = element();
		const boost = createAudioBoost({
			el,
			stream,
			context: () => undefined,
			createHolder: element,
		});
		boost.apply(2);
		expect(el.volume).toBe(1);
	});

	it("tears the graph down on dispose", () => {
		const el = element();
		const fake = fakeContext();
		const boost = createAudioBoost({
			el,
			stream,
			context: () => fake.context,
			createHolder: element,
		});
		boost.apply(2);
		boost.dispose();
		expect(fake.gain.disconnect).toHaveBeenCalled();
	});
});
