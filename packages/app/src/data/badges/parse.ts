import type { BadgeAppearance, BadgeDefinition } from "@colibri-social/ui";

export type { BadgeAppearance, BadgeDefinition };

export type RawLabel = {
	uri: string;
	val: string;
	neg?: boolean;
	exp?: string;
	cts: string;
};

export type LabelerLabel = { val: string; neg: boolean; exp?: string };

export const BOT_BADGE = "bot";

const MAX_DEFINITIONS = 100;
const MAX_COLORS = 6;
const HEX_COLOR = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const VARIANTS = new Set<string>(["solid", "gradientBorder"]);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

const asColor = (value: unknown): string | undefined =>
	typeof value === "string" && HEX_COLOR.test(value) ? value : undefined;

export const parseAppearance = (
	value: unknown,
): BadgeAppearance | undefined => {
	const raw = asRecord(value);
	if (!raw) return undefined;
	const variant = raw.variant ?? "solid";
	if (typeof variant !== "string" || !VARIANTS.has(variant)) return undefined;
	const foreground = asColor(raw.foreground);
	if (!foreground || !Array.isArray(raw.colors)) return undefined;
	const colors: string[] = [];
	for (const entry of raw.colors.slice(0, MAX_COLORS)) {
		const color = asColor(entry);
		if (!color) return undefined;
		colors.push(color);
	}
	if (colors.length === 0) return undefined;
	return {
		variant: variant as BadgeAppearance["variant"],
		colors,
		foreground,
	};
};

export const parseDefinition = (
	value: unknown,
): BadgeDefinition | undefined => {
	const raw = asRecord(value);
	if (!raw) return undefined;
	const { identifier, name, description, precedence } = raw;
	if (typeof identifier !== "string" || identifier.length === 0) {
		return undefined;
	}
	if (typeof name !== "string" || name.length === 0) return undefined;
	if (typeof description !== "string") return undefined;
	const definition: BadgeDefinition = { identifier, name, description };
	if (typeof precedence === "number" && Number.isFinite(precedence)) {
		definition.precedence = precedence;
	}
	const appearance = parseAppearance(raw.appearance);
	if (appearance) definition.appearance = appearance;
	return definition;
};

export const parseDefinitions = (value: unknown): BadgeDefinition[] => {
	const raw = asRecord(value)?.badgeDefinitions;
	if (!Array.isArray(raw)) return [];
	const out: BadgeDefinition[] = [];
	for (const entry of raw.slice(0, MAX_DEFINITIONS)) {
		const definition = parseDefinition(entry);
		if (definition) out.push(definition);
	}
	return out;
};

export const resolveActiveLabels = (
	raw: readonly Pick<RawLabel, "val" | "neg" | "exp" | "cts">[],
	now = Date.now(),
): LabelerLabel[] => {
	const byVal = new Map<string, LabelerLabel & { cts: string }>();
	for (const label of raw) {
		const existing = byVal.get(label.val);
		if (existing && existing.cts > label.cts) continue;
		byVal.set(label.val, {
			val: label.val,
			neg: label.neg ?? false,
			exp: label.exp,
			cts: label.cts,
		});
	}
	return [...byVal.values()]
		.filter((label) => !label.neg)
		.filter((label) => label.exp === undefined || Date.parse(label.exp) > now)
		.map(({ val, neg, exp }) => (exp ? { val, neg, exp } : { val, neg }));
};

export const groupByUri = (rows: readonly RawLabel[]) => {
	const byUri = new Map<string, RawLabel[]>();
	for (const row of rows) {
		const bucket = byUri.get(row.uri);
		if (bucket) bucket.push(row);
		else byUri.set(row.uri, [row]);
	}
	return byUri;
};

export type BadgeIndex = ReadonlyMap<string, BadgeDefinition>;

export const indexDefinitions = (
	definitions: readonly BadgeDefinition[],
	fallbacks: readonly BadgeDefinition[],
	bot: BadgeDefinition,
): BadgeIndex => {
	const fallbackAppearance = new Map(
		fallbacks.map((definition) => [
			definition.identifier,
			definition.appearance,
		]),
	);
	const index = new Map<string, BadgeDefinition>();
	for (const definition of definitions) {
		if (definition.identifier === BOT_BADGE) continue;
		const appearance =
			definition.appearance ?? fallbackAppearance.get(definition.identifier);
		index.set(
			definition.identifier,
			appearance ? { ...definition, appearance } : definition,
		);
	}
	index.set(BOT_BADGE, bot);
	return index;
};

export const badgeRank = (index: BadgeIndex, val: string) => {
	if (val === BOT_BADGE) return Number.POSITIVE_INFINITY;
	return index.get(val)?.precedence ?? Number.MAX_SAFE_INTEGER;
};

export type BadgeSubject = {
	isBot?: boolean;
	preferredBadge?: string;
};

export const sortBadges = (
	index: BadgeIndex,
	labels: readonly string[],
	subject: BadgeSubject,
) => {
	const vals = [...labels];
	if (subject.isBot) vals.push(BOT_BADGE);
	return [...new Set(vals)].sort(
		(a, b) => badgeRank(index, a) - badgeRank(index, b),
	);
};

export const primaryBadge = (
	sorted: readonly string[],
	preferred: string | undefined,
) => (preferred && sorted.includes(preferred) ? preferred : sorted[0]);

export const definitionFor = (
	index: BadgeIndex,
	val: string,
): BadgeDefinition =>
	index.get(val) ?? {
		identifier: val,
		name: val.replaceAll("-", " ").toUpperCase(),
		description: "",
	};
