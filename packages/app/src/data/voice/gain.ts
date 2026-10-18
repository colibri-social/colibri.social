import { classifyThrown, createLogger } from "@colibri-social/lib";

const log = createLogger("voice");

type BoostNode = {
	connect: (target: never) => unknown;
	disconnect: () => void;
};

export type BoostGainNode = BoostNode & { gain: { value: number } };

export type BoostDestinationNode = BoostNode & { stream: MediaStream };

export type BoostAudioContext = {
	state?: string;
	createMediaStreamSource: (stream: MediaStream) => BoostNode;
	createGain: () => BoostGainNode;
	createMediaStreamDestination: () => BoostDestinationNode;
	resume?: () => Promise<void>;
};

export type BoostableElement = {
	srcObject: MediaProvider | null;
	volume: number;
	muted: boolean;
	autoplay: boolean;
	play(): Promise<void>;
	pause(): void;
};

export type AudioBoost = {
	apply: (gain: number) => void;
	dispose: () => void;
};

type Graph = {
	source: BoostNode;
	gain: BoostGainNode;
	destination: BoostDestinationNode;
	holder: BoostableElement;
};

export const browserAudioContext = (): BoostAudioContext | undefined =>
	typeof AudioContext === "undefined"
		? undefined
		: (new AudioContext() as unknown as BoostAudioContext);

export const createAudioBoost = (options: {
	el: BoostableElement;
	stream: MediaStream;
	context: () => BoostAudioContext | undefined;
	createHolder: () => BoostableElement;
}): AudioBoost => {
	let graph: Graph | undefined;
	let unavailable = false;

	const build = (): Graph | undefined => {
		if (graph || unavailable) return graph;
		try {
			const context = options.context();
			if (!context) {
				unavailable = true;
				return undefined;
			}
			const source = context.createMediaStreamSource(options.stream);
			const gain = context.createGain();
			const destination = context.createMediaStreamDestination();
			source.connect(gain as never);
			gain.connect(destination as never);
			if (context.state === "suspended") {
				void context.resume?.().catch(() => undefined);
			}
			const holder = options.createHolder();
			holder.muted = true;
			holder.autoplay = true;
			holder.srcObject = options.stream;
			holder.play().catch(() => undefined);
			graph = { source, gain, destination, holder };
			options.el.srcObject = destination.stream;
			options.el.play().catch(() => undefined);
			return graph;
		} catch (thrown) {
			unavailable = true;
			log.warn("louder than 100% isn't available here", {
				code: classifyThrown(thrown, { method: "voice.boost" }).code,
			});
			return undefined;
		}
	};

	const teardown = () => {
		if (!graph) return;
		const current = graph;
		graph = undefined;
		current.source.disconnect();
		current.gain.disconnect();
		current.holder.pause();
		current.holder.srcObject = null;
	};

	return {
		apply: (value) => {
			const level = Math.max(0, value);
			if (level <= 1) {
				if (graph) {
					teardown();
					options.el.srcObject = options.stream;
					options.el.play().catch(() => undefined);
				}
				options.el.volume = level;
				return;
			}
			const active = build();
			if (!active) {
				options.el.volume = 1;
				return;
			}
			options.el.volume = 1;
			active.gain.gain.value = level;
		},
		dispose: teardown,
	};
};
