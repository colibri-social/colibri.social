import { describe, expect, it } from "vitest";
import { AUDIO_SAMPLE_RATE, WORKLET_SOURCE } from "./audio";

type Chunk = { frames: number; planes: Float32Array[] };

type Processor = {
	port: { onmessage: (event: { data: Chunk }) => void };
	process: (inputs: unknown, outputs: Float32Array[][]) => boolean;
};

const loadProcessor = (): Processor => {
	let registered: (new () => Processor) | undefined;
	class AudioWorkletProcessor {
		port = { onmessage: (_event: { data: Chunk }) => {} };
	}
	new Function("AudioWorkletProcessor", "registerProcessor", WORKLET_SOURCE)(
		AudioWorkletProcessor,
		(_name: string, processor: new () => Processor) => {
			registered = processor;
		},
	);
	if (!registered) throw new Error("the worklet registered no processor");
	return new registered();
};

const chunk = (frames: number, value: number): Chunk => ({
	frames,
	planes: [new Float32Array(frames).fill(value)],
});

const render = (processor: Processor, frames = 128) => {
	const output = [new Float32Array(frames), new Float32Array(frames)];
	processor.process([], [output]);
	return output[0];
};

describe("capture audio worklet", () => {
	it("plays chunks in order", () => {
		const processor = loadProcessor();
		processor.port.onmessage({ data: chunk(128, 1) });
		processor.port.onmessage({ data: chunk(128, 2) });

		expect(render(processor)[0]).toBe(1);
		expect(render(processor)[0]).toBe(2);
	});

	it("drops the oldest audio once more than 100 ms is queued", () => {
		const processor = loadProcessor();
		const chunkFrames = 1024;
		const backlog = Math.ceil((AUDIO_SAMPLE_RATE * 1) / chunkFrames);
		for (let index = 0; index < backlog; index += 1) {
			processor.port.onmessage({ data: chunk(chunkFrames, index) });
		}

		const first = render(processor)[0] as number;
		const queuedAhead = (backlog - first) * chunkFrames;

		expect(queuedAhead).toBeLessThanOrEqual(
			AUDIO_SAMPLE_RATE / 10 + chunkFrames,
		);
	});

	it("keeps the newest chunk even when it alone exceeds the cap", () => {
		const processor = loadProcessor();
		processor.port.onmessage({ data: chunk(AUDIO_SAMPLE_RATE, 7) });

		expect(render(processor)[0]).toBe(7);
	});
});
