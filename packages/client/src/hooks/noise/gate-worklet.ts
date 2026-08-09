export const GATE_PROCESSOR = "colibri-voice-gate";

const OPEN_DBFS = -45;
const CLOSE_DBFS = -55;
const ATTACK_MS = 5;
const HOLD_MS = 250;
const RELEASE_MS = 200;

const GATE_SOURCE = `
const OPEN_RMS = ${10 ** (OPEN_DBFS / 20)};
const CLOSE_RMS = ${10 ** (CLOSE_DBFS / 20)};

class ColibriVoiceGate extends AudioWorkletProcessor {
	constructor() {
		super();
		this.gain = 0;
		this.open = false;
		this.holdSamples = 0;
		this.attackStep = 1 / Math.max(1, (${ATTACK_MS} / 1000) * sampleRate);
		this.releaseStep = 1 / Math.max(1, (${RELEASE_MS} / 1000) * sampleRate);
		this.holdLength = Math.round((${HOLD_MS} / 1000) * sampleRate);
	}

	process(inputs, outputs) {
		const input = inputs[0];
		const output = outputs[0];
		if (!output || output.length === 0) return true;

		const source = input?.[0];
		if (!source) {
			for (const channel of output) channel.fill(0);
			return true;
		}

		let sum = 0;
		for (let i = 0; i < source.length; i += 1) sum += source[i] * source[i];
		const rms = Math.sqrt(sum / source.length);

		if (rms > OPEN_RMS) {
			if (!this.open) {
				this.open = true;
				this.port.postMessage({ type: "speaking", value: true });
			}
			this.holdSamples = this.holdLength;
		} else if (this.open && rms < CLOSE_RMS) {
			this.holdSamples -= source.length;
			if (this.holdSamples <= 0) {
				this.open = false;
				this.port.postMessage({ type: "speaking", value: false });
			}
		}

		const step = this.open ? this.attackStep : -this.releaseStep;
		const first = output[0];

		for (let i = 0; i < source.length; i += 1) {
			this.gain = Math.min(1, Math.max(0, this.gain + step));
			first[i] = source[i] * this.gain;
		}

		for (let channel = 1; channel < output.length; channel += 1) {
			output[channel].set(first);
		}

		return true;
	}
}

registerProcessor(${JSON.stringify(GATE_PROCESSOR)}, ColibriVoiceGate);
`;

export interface VoiceGateOptions {
	onSpeaking?: (speaking: boolean) => void;
}

export const createVoiceGateNode = async (
	ctx: AudioContext,
	options: VoiceGateOptions = {},
): Promise<AudioWorkletNode> => {
	const blob = new Blob([GATE_SOURCE], { type: "text/javascript" });
	const url = URL.createObjectURL(blob);

	try {
		await ctx.audioWorklet.addModule(url);
	} finally {
		URL.revokeObjectURL(url);
	}

	const node = new AudioWorkletNode(ctx, GATE_PROCESSOR);

	node.port.onmessage = (event) => {
		if (event.data?.type === "speaking") {
			options.onSpeaking?.(Boolean(event.data.value));
		}
	};

	return node;
};
