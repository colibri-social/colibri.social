export const AUDIO_SAMPLE_RATE = 48_000;
export const AUDIO_PROCESSOR = "colibri-capture-audio";

const MAX_QUEUED_CHUNKS = 48;

export const WORKLET_SOURCE = `
class ColibriCaptureAudio extends AudioWorkletProcessor {
	constructor() {
		super();
		this.queue = [];
		this.offset = 0;
		this.port.onmessage = (event) => {
			while (this.queue.length >= ${MAX_QUEUED_CHUNKS}) {
				this.queue.shift();
				this.offset = 0;
			}
			this.queue.push(event.data);
		};
	}

	process(_inputs, outputs) {
		const output = outputs[0];
		if (!output || output.length === 0) return true;

		const needed = output[0].length;
		let written = 0;

		while (written < needed && this.queue.length > 0) {
			const chunk = this.queue[0];
			const available = chunk.frames - this.offset;
			const take = Math.min(available, needed - written);

			for (let channel = 0; channel < output.length; channel += 1) {
				const plane = chunk.planes[Math.min(channel, chunk.planes.length - 1)];
				output[channel].set(
					plane.subarray(this.offset, this.offset + take),
					written,
				);
			}

			this.offset += take;
			written += take;

			if (this.offset >= chunk.frames) {
				this.queue.shift();
				this.offset = 0;
			}
		}

		for (let channel = 0; channel < output.length; channel += 1) {
			output[channel].fill(0, written);
		}

		return true;
	}
}

registerProcessor(${JSON.stringify(AUDIO_PROCESSOR)}, ColibriCaptureAudio);
`;

export interface NativeAudioChunk {
	frames: number;
	planes: Float32Array[];
}

export interface NativeAudioBridge {
	track: MediaStreamTrack;
	push: (chunk: NativeAudioChunk) => void;
	stop: () => void;
}

export const createNativeAudioBridge = async (): Promise<NativeAudioBridge> => {
	const context = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
	const blob = new Blob([WORKLET_SOURCE], { type: "text/javascript" });
	const url = URL.createObjectURL(blob);

	try {
		await context.audioWorklet.addModule(url);
	} finally {
		URL.revokeObjectURL(url);
	}

	const node = new AudioWorkletNode(context, AUDIO_PROCESSOR, {
		numberOfInputs: 0,
		numberOfOutputs: 1,
		outputChannelCount: [2],
	});

	const destination = context.createMediaStreamDestination();
	node.connect(destination);

	if (context.state === "suspended") await context.resume();

	const track = destination.stream.getAudioTracks()[0];
	if (!track) {
		await context.close();
		throw new Error("the audio bridge produced no track");
	}

	return {
		track,
		push: (chunk) => {
			const buffer = chunk.planes[0]?.buffer;
			if (!buffer) return;
			node.port.postMessage(chunk, [buffer]);
		},
		stop: () => {
			node.disconnect();
			track.stop();
			void context.close().catch(() => {});
		},
	};
};
