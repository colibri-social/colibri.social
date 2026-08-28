export type BlueskyClientID =
	| "anisota"
	| "blacksky"
	| "bluesky"
	| "custom"
	| "deer"
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
	{
		name: "Anisota",
		base: "anisota.net",
		color: "#ef8f06",
		id: "anisota",
	},
	{
		name: "Blacksky",
		base: "blacksky.community",
		color: "#6868b6",
		id: "blacksky",
	},
	{
		name: "Bluesky",
		base: "bsky.app",
		color: "#0f73ff",
		id: "bluesky",
	},
	{
		name: "Deer Social",
		base: "deer.social",
		color: "#729f7c",
		id: "deer",
	},
	{
		name: "Mu Social",
		base: "mu.social",
		color: "#db4aa6",
		id: "mu",
	},
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
	{
		name: "Witchsky",
		base: "witchsky.app",
		color: "#ed5345",
		id: "witchsky",
	},
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

export const DEFAULT_BLUESKY_CLIENT: ResolvedBlueskyClient = resolveAlternative(
	BSKY_ALTERNATIVES.find((x) => x.id === "bluesky")!,
);

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
