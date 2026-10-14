import { type Accessor, createMemo, createRoot, createSignal } from "solid-js";
import { readStored, writeStored } from "./persist";

export const PREFERENCES_STORAGE_KEY = "colibri:user-preferences";

export type BlueskyClientID =
	| "anisota"
	| "blacksky"
	| "bluesky"
	| "custom"
	| "mu"
	| "northsky"
	| "witchsky";

export type BlueskyAlternative = {
	name: string;
	base: string;
	color: string | Array<string>;
	id: BlueskyClientID;
};

export const BSKY_ALTERNATIVES: Array<BlueskyAlternative> = [
	{ name: "Anisota", base: "anisota.net", color: "#ef8f06", id: "anisota" },
	{
		name: "Blacksky",
		base: "blacksky.community",
		color: "#6868b6",
		id: "blacksky",
	},
	{ name: "Bluesky", base: "bsky.app", color: "#0f73ff", id: "bluesky" },
	{ name: "Mu Social", base: "mu.social", color: "#db4aa6", id: "mu" },
	{
		name: "Northsky",
		base: "northsky.app",
		color: [
			"#2affba",
			"#31f4bd",
			"#53bccc",
			"#718ada",
			"#8a5fe5",
			"#9f3def",
			"#af22f6",
			"#bb0ffb",
			"#c204fe",
			"#c400ff",
		],
		id: "northsky",
	},
	{ name: "Witchsky", base: "witchsky.app", color: "#ed5345", id: "witchsky" },
];

export const CUSTOM_BLUESKY_CLIENT: BlueskyAlternative = {
	name: "Custom",
	base: "",
	color: "var(--primary)",
	id: "custom",
};

export const BSKY_CLIENT_OPTIONS: Array<BlueskyAlternative> = [
	...BSKY_ALTERNATIVES,
	CUSTOM_BLUESKY_CLIENT,
];

export type BlueskyClientPreference = {
	preferredBlueskyClient: BlueskyClientID;
	customBlueskyClientBase: string;
};

export type ResolvedBlueskyClient = {
	id: BlueskyClientID;
	name: string;
	base: string;
	accentColor: string;
};

export const DEFAULT_BLUESKY_CLIENT_PREFERENCE: BlueskyClientPreference = {
	preferredBlueskyClient: "bluesky",
	customBlueskyClientBase: "",
};

export const normalizeBskyClientBase = (input: string): string | null => {
	const trimmed = input.trim().toLowerCase();
	if (trimmed.length === 0) return null;
	try {
		const { hostname } = new URL(
			/^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`,
		);
		return hostname.includes(".") ? hostname : null;
	} catch {
		return null;
	}
};

export const isKnownBlueskyClientID = (id: unknown): id is BlueskyClientID =>
	typeof id === "string" && BSKY_CLIENT_OPTIONS.some((x) => x.id === id);

const accentColorOf = (color: string | Array<string>): string =>
	typeof color === "string" ? color : color[Math.floor(color.length / 2)];

const resolveAlternative = (
	alternative: BlueskyAlternative,
): ResolvedBlueskyClient => ({
	id: alternative.id,
	name: alternative.name,
	base: alternative.base,
	accentColor: accentColorOf(alternative.color),
});

const blueskyAlternative = BSKY_ALTERNATIVES.find((x) => x.id === "bluesky");

export const DEFAULT_BLUESKY_CLIENT: ResolvedBlueskyClient = blueskyAlternative
	? resolveAlternative(blueskyAlternative)
	: { id: "bluesky", name: "Bluesky", base: "bsky.app", accentColor: "" };

export const resolveBlueskyClient = (
	preference: BlueskyClientPreference,
): ResolvedBlueskyClient => {
	if (preference.preferredBlueskyClient === "custom") {
		const base = normalizeBskyClientBase(preference.customBlueskyClientBase);
		if (!base) return DEFAULT_BLUESKY_CLIENT;
		return {
			id: "custom",
			name: base,
			base,
			accentColor: accentColorOf(CUSTOM_BLUESKY_CLIENT.color),
		};
	}
	const alternative = BSKY_ALTERNATIVES.find(
		(x) => x.id === preference.preferredBlueskyClient,
	);
	return alternative ? resolveAlternative(alternative) : DEFAULT_BLUESKY_CLIENT;
};

export const buildBskyProfileUrl = (
	client: ResolvedBlueskyClient,
	identifier: string,
): string => `https://${client.base}/profile/${identifier}`;

const parseStored = (raw: string | null): Record<string, unknown> => {
	if (!raw) return {};
	try {
		const parsed: unknown = JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
};

export const parseBlueskyClientPreference = (
	raw: string | null,
): BlueskyClientPreference => {
	const parsed = parseStored(raw);
	const base =
		typeof parsed.customBlueskyClientBase === "string"
			? (normalizeBskyClientBase(parsed.customBlueskyClientBase) ?? "")
			: "";
	return {
		preferredBlueskyClient: isKnownBlueskyClientID(
			parsed.preferredBlueskyClient,
		)
			? parsed.preferredBlueskyClient
			: DEFAULT_BLUESKY_CLIENT_PREFERENCE.preferredBlueskyClient,
		customBlueskyClientBase: base,
	};
};

export const mergeBlueskyClientPreference = (
	raw: string | null,
	preference: BlueskyClientPreference,
): string => JSON.stringify({ ...parseStored(raw), ...preference });

const readStorage = (): string | null =>
	readStored(PREFERENCES_STORAGE_KEY) ?? null;

const writeStorage = (preference: BlueskyClientPreference) =>
	writeStored(
		PREFERENCES_STORAGE_KEY,
		mergeBlueskyClientPreference(readStorage(), preference),
	);

const store = createRoot(() => {
	const [preference, setPreference] = createSignal(
		parseBlueskyClientPreference(readStorage()),
	);
	const client = createMemo(() => resolveBlueskyClient(preference()));
	if (typeof window !== "undefined") {
		window.addEventListener("storage", (event) => {
			if (event.key !== PREFERENCES_STORAGE_KEY) return;
			setPreference(parseBlueskyClientPreference(event.newValue));
		});
	}
	return { preference, setPreference, client };
});

export const blueskyClientPreference: Accessor<BlueskyClientPreference> =
	store.preference;

export const blueskyClient: Accessor<ResolvedBlueskyClient> = store.client;

export const useBlueskyClient = (): Accessor<ResolvedBlueskyClient> =>
	blueskyClient;

export const setBlueskyClientPreference = (
	client: BlueskyClientID,
	customBase?: string,
) => {
	const current = store.preference();
	const next: BlueskyClientPreference = {
		preferredBlueskyClient: client,
		customBlueskyClientBase:
			customBase === undefined
				? current.customBlueskyClientBase
				: (normalizeBskyClientBase(customBase) ?? ""),
	};
	store.setPreference(next);
	writeStorage(next);
};
