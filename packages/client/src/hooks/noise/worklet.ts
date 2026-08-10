const registered = new WeakMap<BaseAudioContext, Set<string>>();

export const ensureWorkletModule = async (
	ctx: BaseAudioContext,
	name: string,
	source: string,
): Promise<void> => {
	let names = registered.get(ctx);
	if (!names) {
		names = new Set();
		registered.set(ctx, names);
	}
	if (names.has(name)) return;

	const blob = new Blob([source], { type: "text/javascript" });
	const url = URL.createObjectURL(blob);

	try {
		await ctx.audioWorklet.addModule(url);
	} finally {
		URL.revokeObjectURL(url);
	}

	names.add(name);
};
