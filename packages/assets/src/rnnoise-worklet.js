import { Rnnoise } from "@shiguredo/rnnoise-wasm";

if (typeof globalThis.WorkerGlobalScope === "undefined") {
	globalThis.WorkerGlobalScope = function WorkerGlobalScope() {};
}

const FRAME_SIZE = 480;
const RENDER_QUANTUM = 128;
const RING_SIZE = 1920;
const READ_OFFSET =
	(Math.floor(FRAME_SIZE / RENDER_QUANTUM) + 1) * RENDER_QUANTUM +
	RENDER_QUANTUM;
const PCM_SCALE = 32767;

const FRAME_BOUNDARIES = new Set([128, 512, 1024, 1536]);

const VAD_OPEN = 0.6;
const VAD_CLOSE = 0.35;
const HOLD_MS = 250;
const ATTACK_MS = 5;
const RELEASE_MS = 200;

class ColibriRnnoise extends AudioWorkletProcessor {
	constructor(options) {
		super();

		const processorOptions = options?.processorOptions ?? {};
		this.suppression = processorOptions.suppression !== false;
		this.gate = processorOptions.gate === true;

		this.ready = false;
		this.destroyed = false;
		this.speaking = false;
		this.gain = this.gate ? 0 : 1;
		this.holdSamples = 0;

		this.attackStep = 1 / Math.max(1, (ATTACK_MS / 1000) * sampleRate);
		this.releaseStep = 1 / Math.max(1, (RELEASE_MS / 1000) * sampleRate);
		this.holdLength = Math.round((HOLD_MS / 1000) * sampleRate);

		this.ring = new Float32Array(RING_SIZE);
		this.scratch = new Float32Array(FRAME_SIZE);
		this.write = 0;
		this.frameStart = RING_SIZE - FRAME_SIZE * 2;

		this.port.onmessage = (event) => {
			const data = event.data;
			if (data?.type === "config") {
				if (typeof data.suppression === "boolean")
					this.suppression = data.suppression;
				if (typeof data.gate === "boolean") this.gate = data.gate;
				return;
			}
			if (data?.type === "destroy") this.destroy();
		};

		Rnnoise.load()
			.then((rnnoise) => {
				if (this.destroyed) return;
				if (rnnoise.frameSize !== FRAME_SIZE) {
					throw new Error(
						`rnnoise frame size must be ${FRAME_SIZE}, was ${rnnoise.frameSize}`,
					);
				}
				this.state = rnnoise.createDenoiseState();
				this.ready = true;
				this.port.postMessage({ type: "ready" });
			})
			.catch((error) => {
				this.port.postMessage({
					type: "error",
					message: error?.message ?? String(error),
				});
			});
	}

	destroy() {
		this.destroyed = true;
		this.ready = false;
		this.state?.destroy();
		this.state = undefined;
	}

	reportSpeaking(vad) {
		if (vad > VAD_OPEN) {
			this.holdSamples = this.holdLength;
			if (this.speaking) return;
			this.speaking = true;
			this.port.postMessage({ type: "speaking", value: true });
			return;
		}

		if (!this.speaking || vad >= VAD_CLOSE) return;

		this.holdSamples -= FRAME_SIZE;
		if (this.holdSamples > 0) return;
		this.speaking = false;
		this.port.postMessage({ type: "speaking", value: false });
	}

	denoiseFrame(frame) {
		if (!this.suppression) {
			const scratch = this.scratch;
			for (let i = 0; i < FRAME_SIZE; i += 1) scratch[i] = frame[i] * PCM_SCALE;
			this.reportSpeaking(this.state.processFrame(scratch));
			return;
		}

		for (let i = 0; i < FRAME_SIZE; i += 1) frame[i] *= PCM_SCALE;
		const vad = this.state.processFrame(frame);
		for (let i = 0; i < FRAME_SIZE; i += 1) frame[i] /= PCM_SCALE;
		this.reportSpeaking(vad);
	}

	applyGate(block) {
		const open = !this.gate || this.speaking;
		if (open && this.gain === 1) return;

		const step = open ? this.attackStep : -this.releaseStep;
		for (let i = 0; i < block.length; i += 1) {
			this.gain = Math.min(1, Math.max(0, this.gain + step));
			block[i] *= this.gain;
		}
	}

	fanOut(output) {
		for (let channel = 1; channel < output.length; channel += 1)
			output[channel].set(output[0]);
	}

	process(inputs, outputs) {
		const output = outputs[0];
		if (!output || output.length === 0) return true;

		const first = output[0];
		const source = inputs[0]?.[0];

		if (!this.ready || !source || source.length !== RENDER_QUANTUM) {
			if (source && source.length === first.length) first.set(source);
			else first.fill(0);
			this.fanOut(output);
			return true;
		}

		const ring = this.ring;
		ring.set(source, this.write);
		this.write = (this.write + RENDER_QUANTUM) % RING_SIZE;

		if (FRAME_BOUNDARIES.has(this.write)) {
			this.frameStart = (this.frameStart + FRAME_SIZE) % RING_SIZE;
			this.denoiseFrame(
				ring.subarray(this.frameStart, this.frameStart + FRAME_SIZE),
			);
		}

		const read = (this.write + RING_SIZE - READ_OFFSET) % RING_SIZE;
		first.set(ring.subarray(read, read + RENDER_QUANTUM));
		this.applyGate(first);
		this.fanOut(output);

		return true;
	}
}

registerProcessor("colibri-rnnoise", ColibriRnnoise);
