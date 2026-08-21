import { createLogger } from "./logger";

const log = createLogger("switch");

const started = Date.now();

const at = () => Date.now() - started;

export const shortUri = (uri: string | undefined): string =>
	uri ? (uri.split("/").pop() ?? uri) : "none";

export const probe = (event: string, data?: Record<string, unknown>): void => {
	log.info(event, { t: at(), ...data });
};

let mismatchSince: number | undefined;
let lastShape = "";

export const probeRender = (input: {
	channelUri: string;
	owner: string | undefined;
	count: number;
	initialLoading: boolean;
}): void => {
	const mismatched =
		input.count > 0 &&
		input.owner !== undefined &&
		input.owner !== input.channelUri;

	const shape = `${input.channelUri}|${input.owner}|${input.count}|${input.initialLoading}`;
	if (shape === lastShape) return;
	lastShape = shape;

	if (mismatched && mismatchSince === undefined) {
		mismatchSince = Date.now();
		probe("STALE LIST ON SCREEN", {
			rendering: shortUri(input.channelUri),
			listBelongsTo: shortUri(input.owner),
			rows: input.count,
			initialLoading: input.initialLoading,
		});
		return;
	}

	if (!mismatched && mismatchSince !== undefined) {
		probe("stale list cleared", {
			visibleForMs: Date.now() - mismatchSince,
			rendering: shortUri(input.channelUri),
			rows: input.count,
		});
		mismatchSince = undefined;
		return;
	}

	probe("render", {
		rendering: shortUri(input.channelUri),
		listBelongsTo: shortUri(input.owner),
		rows: input.count,
		initialLoading: input.initialLoading,
	});
};
