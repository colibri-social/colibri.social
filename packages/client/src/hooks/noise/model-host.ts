import type { NoiseSuppressionMode } from "../../contexts/UserPreferences";
import {
	createExperimentalBackend,
	type ExperimentalBackend,
	MODEL_SAMPLE_RATE,
} from "./backends";
import { DFN_SAMPLE_RATE } from "./dfn";

export const MODEL_HOST_PROCESSOR = "colibri-model-host";

const RATIO = DFN_SAMPLE_RATE / MODEL_SAMPLE_RATE;
const TAPS = 48;
const HISTORY = 64;
const PRIME_BLOCKS = 2;

const antiAliasTaps = (): number[] => {
	const cutoff = 0.5 / RATIO;
	const middle = (TAPS - 1) / 2;
	const taps: number[] = [];
	let sum = 0;

	for (let i = 0; i < TAPS; i += 1) {
		const t = i - middle;
		const sinc =
			t === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * t) / (Math.PI * t);
		const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (TAPS - 1));
		const value = sinc * window;
		taps.push(value);
		sum += value;
	}

	return taps.map((v) => v / sum);
};

const hostSource = (blockSize: number): string => `
const H = ${JSON.stringify(antiAliasTaps())};
const TAPS = ${TAPS};
const MASK = ${HISTORY - 1};
const RATIO = ${RATIO};
const BLOCK = ${blockSize};
const PRIME = ${PRIME_BLOCKS};

class ColibriModelHost extends AudioWorkletProcessor {
	constructor() {
		super();
		this.downHist = new Float32Array(${HISTORY});
		this.downPos = 0;
		this.downPhase = 0;
		this.upHist = new Float32Array(${HISTORY});
		this.upPos = 0;

		this.pending = new Float32Array(BLOCK);
		this.pendingLen = 0;
		this.slots = [];
		this.seq = 0;

		this.out = new Float32Array(BLOCK * RATIO * 4);
		this.outRead = 0;
		this.outWrite = 0;
		this.playing = false;
		this.failed = false;

		this.port.onmessage = (event) => {
			const data = event.data;
			if (data.type === "processed") {
				const slot = this.slots.find((s) => s.seq === data.seq);
				if (slot) slot.samples = data.samples;
			} else if (data.type === "failed") {
				this.failed = true;
			}
		};
	}

	pushDown(sample) {
		this.downHist[this.downPos] = sample;
		this.downPhase += 1;
		let out = null;

		if (this.downPhase === RATIO) {
			this.downPhase = 0;
			let acc = 0;
			for (let k = 0; k < TAPS; k += 1) {
				acc += H[k] * this.downHist[(this.downPos - k) & MASK];
			}
			out = acc;
		}

		this.downPos = (this.downPos + 1) & MASK;
		return out;
	}

	pushUp(sample) {
		this.upHist[this.upPos] = sample;

		for (let p = 0; p < RATIO; p += 1) {
			let acc = 0;
			for (let k = p; k < TAPS; k += RATIO) {
				acc += H[k] * this.upHist[(this.upPos - (k - p) / RATIO) & MASK];
			}
			this.out[this.outWrite] = acc * RATIO;
			this.outWrite = (this.outWrite + 1) % this.out.length;
		}

		this.upPos = (this.upPos + 1) & MASK;
	}

	available() {
		return (this.outWrite - this.outRead + this.out.length) % this.out.length;
	}

	process(inputs, outputs) {
		const output = outputs[0];
		if (!output || output.length === 0) return true;

		const input = inputs[0]?.[0];
		const frames = output[0].length;

		if (!input || this.failed) {
			for (const channel of output) {
				if (input) channel.set(input);
				else channel.fill(0);
			}
			return true;
		}

		for (let i = 0; i < input.length; i += 1) {
			const down = this.pushDown(input[i]);
			if (down === null) continue;

			this.pending[this.pendingLen] = down;
			this.pendingLen += 1;

			if (this.pendingLen === BLOCK) {
				this.pendingLen = 0;
				const seq = this.seq;
				this.seq += 1;
				this.slots.push({ seq, samples: this.pending.slice() });
				const copy = this.pending.slice();
				this.port.postMessage({ type: "block", seq, samples: copy }, [
					copy.buffer,
				]);
			}
		}

		if (!this.playing && this.slots.length > PRIME) this.playing = true;

		while (this.playing && this.available() < frames && this.slots.length > 0) {
			const slot = this.slots.shift();
			for (let i = 0; i < slot.samples.length; i += 1) this.pushUp(slot.samples[i]);
		}

		const first = output[0];

		if (this.available() >= frames) {
			for (let i = 0; i < frames; i += 1) {
				first[i] = this.out[this.outRead];
				this.outRead = (this.outRead + 1) % this.out.length;
			}
		} else {
			first.fill(0);
		}

		for (let channel = 1; channel < output.length; channel += 1) {
			output[channel].set(first);
		}

		return true;
	}
}

registerProcessor(${JSON.stringify(MODEL_HOST_PROCESSOR)}, ColibriModelHost);
`;

export interface ModelHost {
	node: AudioWorkletNode;
	destroy: () => void;
}

export const createModelHost = async (
	ctx: AudioContext,
	mode: NoiseSuppressionMode,
	onFailure?: () => void,
): Promise<ModelHost> => {
	const backend: ExperimentalBackend = await createExperimentalBackend(mode);

	const blob = new Blob([hostSource(backend.blockSize)], {
		type: "text/javascript",
	});
	const url = URL.createObjectURL(blob);

	try {
		await ctx.audioWorklet.addModule(url);
	} finally {
		URL.revokeObjectURL(url);
	}

	const node = new AudioWorkletNode(ctx, MODEL_HOST_PROCESSOR);
	const output = new Float32Array(backend.blockSize);
	let queue: Promise<void> = Promise.resolve();
	let destroyed = false;

	node.port.onmessage = (event) => {
		if (destroyed || event.data?.type !== "block") return;
		const { seq, samples } = event.data as {
			seq: number;
			samples: Float32Array;
		};

		queue = queue
			.then(async () => {
				if (destroyed) return;
				await backend.process(samples, output);
				if (destroyed) return;
				const copy = output.slice();
				node.port.postMessage({ type: "processed", seq, samples: copy }, [
					copy.buffer,
				]);
			})
			.catch(() => {
				if (destroyed) return;
				node.port.postMessage({ type: "failed" });
				onFailure?.();
			});
	};

	return {
		node,
		destroy: () => {
			destroyed = true;
			node.port.onmessage = null;
			backend.destroy();
		},
	};
};
