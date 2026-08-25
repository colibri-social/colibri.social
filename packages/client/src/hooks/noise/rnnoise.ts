import { classifyThrown } from "../../errors/classify";
import { createLogger } from "../../utils/logger";

const WORKLET_URL = "/worklets/rnnoise.js";
const PROCESSOR_NAME = "colibri-rnnoise";

const log = createLogger("noise");

const registered = new WeakSet<BaseAudioContext>();

export interface RnnoiseNodeOptions {
	suppression: boolean;
	gate: boolean;
	onSpeaking?: (speaking: boolean) => void;
}

export interface RnnoiseNode {
	readonly node: AudioWorkletNode;
	setSuppression: (enabled: boolean) => void;
	setGate: (enabled: boolean) => void;
	destroy: () => void;
}

export async function createRnnoiseNode(
	ctx: AudioContext,
	options: RnnoiseNodeOptions,
): Promise<RnnoiseNode> {
	if (!registered.has(ctx)) {
		await ctx.audioWorklet.addModule(WORKLET_URL);
		registered.add(ctx);
	}

	const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
		numberOfInputs: 1,
		numberOfOutputs: 1,
		outputChannelCount: [1],
		channelCount: 1,
		channelCountMode: "explicit",
		channelInterpretation: "speakers",
		processorOptions: {
			suppression: options.suppression,
			gate: options.gate,
		},
	});

	node.port.onmessage = (event) => {
		const data = event.data;
		if (data?.type === "speaking") {
			options.onSpeaking?.(Boolean(data.value));
			return;
		}
		if (data?.type === "error") {
			log.warn("RNNoise worklet failed to start", {
				code: classifyThrown(new Error(String(data.message))).code,
			});
		}
	};

	const configure = (patch: {
		suppression?: boolean;
		gate?: boolean;
	}): void => {
		node.port.postMessage({ type: "config", ...patch });
	};

	return {
		node,
		setSuppression: (enabled) => configure({ suppression: enabled }),
		setGate: (enabled) => configure({ gate: enabled }),
		destroy: () => {
			node.port.onmessage = null;
			node.port.postMessage({ type: "destroy" });
			node.disconnect();
		},
	};
}
