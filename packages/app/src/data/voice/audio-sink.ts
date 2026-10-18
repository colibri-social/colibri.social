export const DEFAULT_SINK_ID = "default";

export interface SinkableMediaElement {
	sinkId?: string;
	setSinkId?: (id: string) => Promise<void>;
}

type RoutableMediaElement = SinkableMediaElement & {
	setSinkId: (id: string) => Promise<void>;
};

const canRoute = (el: SinkableMediaElement): el is RoutableMediaElement =>
	typeof el.setSinkId === "function";

export const applyAudioSink = async (
	el: SinkableMediaElement,
	preferredDeviceId: string | undefined,
	options: { force?: boolean } = {},
): Promise<string | null> => {
	if (!canRoute(el)) return null;

	const target = preferredDeviceId || DEFAULT_SINK_ID;

	if (!options.force && el.sinkId === target) return target;

	try {
		await el.setSinkId(target);
		return target;
	} catch (err) {
		if (target === DEFAULT_SINK_ID) throw err;
	}

	await el.setSinkId(DEFAULT_SINK_ID);
	return DEFAULT_SINK_ID;
};
