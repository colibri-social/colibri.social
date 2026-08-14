import type { ActorData } from "@colibri-social/lib";
import { createResource, createSignal, type JSX } from "solid-js";
import type { BadgeAppearance, BadgeDefinition } from "../atproto/cache/schema";
import { getLabelerBadgeDefinitions } from "../atproto/labeler-badges";
import { getLabelerBadges } from "../atproto/labeler-lookup";

export type { BadgeAppearance, BadgeDefinition } from "../atproto/cache/schema";

const BOT_BADGE = "bot";

const BOT_DEFINITION: BadgeDefinition = {
	identifier: BOT_BADGE,
	name: "BOT",
	description: "Self-declared to be automated",
	appearance: {
		variant: "solid",
		colors: ["#fafafa"],
		foreground: "#0a0a0a",
	},
};

const FALLBACK_DEFINITIONS: ReadonlyArray<BadgeDefinition> = [
	{
		identifier: "team",
		name: "TEAM",
		description: "Official Colibri Maintainer",
		precedence: 0,
		appearance: {
			variant: "solid",
			colors: ["#8b5cf6"],
			foreground: "#fafafa",
		},
	},
	{
		identifier: "play-store-tester",
		name: "PLAY STORE TESTER",
		description: "Helped test the Colibri App for the Play Store release",
		precedence: 1,
		appearance: {
			variant: "gradientBorder",
			colors: ["#ff4d4d", "#ffcc00", "#22c55e", "#3b82f6"],
			foreground: "#ffffff",
		},
	},
	{
		identifier: "sponsor-twenty-five",
		name: "$25 SPONSOR",
		description: "Sponsors Colibri with a $25 monthly donation",
		precedence: 2,
		appearance: {
			variant: "solid",
			colors: ["#60a5fa"],
			foreground: "#000000",
		},
	},
	{
		identifier: "supporter-ten",
		name: "$10 SUPPORTER",
		description: "Supports Colibri with a $10 monthly donation",
		precedence: 3,
		appearance: {
			variant: "solid",
			colors: ["#e870df"],
			foreground: "#000000",
		},
	},
	{
		identifier: "backer-five",
		name: "$5 BACKER",
		description: "Backs Colibri with a $5 monthly donation",
		precedence: 4,
		appearance: {
			variant: "solid",
			colors: ["#22d3ee"],
			foreground: "#000000",
		},
	},
	{
		identifier: "donator",
		name: "DONATOR",
		description: "Made a donation to support Colibri",
		precedence: 5,
		appearance: {
			variant: "solid",
			colors: ["#2dd4bf"],
			foreground: "#000000",
		},
	},
];

const FALLBACK_APPEARANCES = new Map(
	FALLBACK_DEFINITIONS.map((definition) => [
		definition.identifier,
		definition.appearance,
	]),
);

const index = (
	definitions: ReadonlyArray<BadgeDefinition>,
): Map<string, BadgeDefinition> => {
	const byIdentifier = new Map<string, BadgeDefinition>();
	for (const definition of definitions) {
		if (definition.identifier === BOT_BADGE) continue;
		byIdentifier.set(definition.identifier, {
			...definition,
			appearance:
				definition.appearance ??
				FALLBACK_APPEARANCES.get(definition.identifier),
		});
	}
	byIdentifier.set(BOT_BADGE, BOT_DEFINITION);
	return byIdentifier;
};

const [definitions, setDefinitions] = createSignal(index(FALLBACK_DEFINITIONS));

export const badgeDefinitions = definitions;

let loading: Promise<void> | undefined;

export const ensureBadgeDefinitions = (): Promise<void> => {
	loading ??= getLabelerBadgeDefinitions()
		.then((published) => {
			if (published.length > 0) setDefinitions(index(published));
		})
		.catch(() => undefined);
	return loading;
};

const definitionOf = (val: string): BadgeDefinition | undefined =>
	definitions().get(val);

export const badgeText = (val: string): string =>
	definitionOf(val)?.name ?? val.replaceAll("-", " ").toUpperCase();

export const badgeDescription = (val: string): string | undefined =>
	definitionOf(val)?.description || undefined;

export const badgeAppearance = (val: string): BadgeAppearance | undefined =>
	definitionOf(val)?.appearance;

const FILL_MIX = 18;

const stops = (colors: ReadonlyArray<string>): string =>
	colors.length === 1 ? `${colors[0]}, ${colors[0]}` : colors.join(", ");

export const appearanceStyle = (
	appearance: BadgeAppearance | undefined,
): JSX.CSSProperties | undefined => {
	if (!appearance) return undefined;

	if (appearance.variant === "gradientBorder") {
		const fill = appearance.colors.map(
			(entry) => `color-mix(in srgb, ${entry} ${FILL_MIX}%, black)`,
		);
		return {
			background: `linear-gradient(90deg, ${stops(fill)}) padding-box, linear-gradient(90deg, ${stops(appearance.colors)}) border-box`,
			color: appearance.foreground,
		};
	}

	return {
		"background-color": appearance.colors[0],
		color: appearance.foreground,
	};
};

export const badgeStyle = (val: string): JSX.CSSProperties | undefined =>
	appearanceStyle(badgeAppearance(val));

export const badgeRank = (val: string): number => {
	if (val === BOT_BADGE) return Number.POSITIVE_INFINITY;
	const precedence = definitionOf(val)?.precedence;
	return precedence ?? Number.MAX_SAFE_INTEGER;
};

export const useUserBadges = (
	user: () => ActorData,
	options?: { enabled?: () => boolean },
) => {
	void ensureBadgeDefinitions();

	const enabled = () => options?.enabled?.() ?? true;
	const [labels] = createResource(
		() => (enabled() ? user().did : false),
		(did) => getLabelerBadges(did),
	);

	const sorted = () => {
		const vals = (labels() ?? []).map((label) => label.val);
		if (user().data.isBot) vals.push(BOT_BADGE);
		return [...new Set(vals)].sort((a, b) => badgeRank(a) - badgeRank(b));
	};

	const primary = () => {
		const list = sorted();
		const pref = user().data.preferredBadge;
		return pref && list.includes(pref) ? pref : list[0];
	};
	const secondary = () => sorted().slice(1);

	return { all: sorted, primary, secondary };
};
