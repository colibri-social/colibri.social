export const DEFAULT_SINK_ID = "default";

export const DEFAULT_CONTEXT_SINK_ID = "";

export interface SinkableMediaElement {
	sinkId?: string;
	setSinkId?: (id: string) => Promise<void>;
}

export interface SinkableOutput {
	readonly sinkId?: unknown;
	setSinkId?: (id: string) => Promise<void>;
}

type RoutableOutput = SinkableOutput & {
	setSinkId: (id: string) => Promise<void>;
};

const canRoute = (output: SinkableOutput): output is RoutableOutput =>
	typeof output.setSinkId === "function";

export const applyAudioSink = async (
	output: SinkableOutput,
	preferredDeviceId: string | undefined,
	options: { force?: boolean; defaultId?: string } = {},
): Promise<string | null> => {
	if (!canRoute(output)) return null;

	const fallback = options.defaultId ?? DEFAULT_SINK_ID;
	const target = preferredDeviceId || fallback;

	if (!options.force && output.sinkId === target) return target;

	try {
		await output.setSinkId(target);
		return target;
	} catch (err) {
		if (target === fallback) throw err;
	}

	await output.setSinkId(fallback);
	return fallback;
};
