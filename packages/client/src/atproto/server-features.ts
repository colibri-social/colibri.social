import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";

const log = createLogger("server-features");

const DESCRIBE_TIMEOUT_MS = 5_000;
const FEATURES_TTL_MS = 5 * 60 * 1000;

export const VOICE_FEATURE = "voice";

type Cached = { features: ReadonlySet<string>; atMs: number };

const known = new Map<string, Cached>();
const inFlight = new Map<string, Promise<ReadonlySet<string> | undefined>>();

const readFeatures = async (
	origin: string,
): Promise<ReadonlySet<string> | undefined> => {
	try {
		const res = await fetch(
			`${origin}/xrpc/social.colibri.beta.server.describeServer`,
			{ signal: AbortSignal.timeout(DESCRIBE_TIMEOUT_MS) },
		);
		if (!res.ok) return undefined;

		const data = (await res.json()) as { features?: unknown };
		if (!Array.isArray(data.features)) return undefined;

		return new Set(
			data.features.filter((name): name is string => typeof name === "string"),
		);
	} catch (err) {
		log.warn("could not read what this appview supports", {
			code: classifyThrown(err, {
				method: "social.colibri.beta.server.describeServer",
			}).code,
		});
		return undefined;
	}
};

export const serverFeatures = (
	origin: string,
): Promise<ReadonlySet<string> | undefined> => {
	const cached = known.get(origin);
	if (cached && Date.now() - cached.atMs < FEATURES_TTL_MS) {
		return Promise.resolve(cached.features);
	}

	const existing = inFlight.get(origin);
	if (existing) return existing;

	const pending = readFeatures(origin)
		.then((features) => {
			if (features) known.set(origin, { features, atMs: Date.now() });
			return features;
		})
		.finally(() => inFlight.delete(origin));

	inFlight.set(origin, pending);
	return pending;
};

export const voiceDisabledOn = async (origin: string): Promise<boolean> => {
	const features = await serverFeatures(origin);
	return features !== undefined && !features.has(VOICE_FEATURE);
};

export const forgetServerFeatures = (): void => {
	known.clear();
	inFlight.clear();
};
