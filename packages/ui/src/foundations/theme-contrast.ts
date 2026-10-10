export type Theme = "dark" | "light";

export type Rgba = [number, number, number, number];

export type ThemeTokens = Record<string, string>;

export type ContrastKind = "text" | "ui";

export type ContrastPair = {
	id: string;
	kind: ContrastKind;
	foreground: string;
	background: string;
	tint?: number;
	minimum: number;
};

export type ParityPair = {
	id: string;
	foreground: string;
	background: string;
};

export const THEMES: readonly Theme[] = ["dark", "light"];

export const TEXT_MINIMUM = 4.5;
export const UI_MINIMUM = 3;
export const PARITY_TOLERANCE = 0.95;

export const SURFACES = [
	"background",
	"card",
	"popover",
	"popover-highlight",
	"secondary",
	"secondary-highlight",
	"muted",
] as const;

export const COLOR_TOKENS = [
	"background",
	"foreground",
	"card",
	"popover",
	"popover-highlight",
	"primary",
	"primary-highlight",
	"primary-foreground",
	"primary-fill",
	"primary-fill-highlight",
	"secondary",
	"secondary-highlight",
	"secondary-foreground",
	"muted",
	"muted-foreground",
	"accent",
	"destructive",
	"destructive-highlight",
	"destructive-foreground",
	"destructive-fill",
	"destructive-fill-highlight",
	"success",
	"warning",
	"info",
	"border",
	"control-border",
	"overlay",
	"shadow-color",
	"mention",
] as const;

const TINT_STRENGTH = 0.15;
const TINT_SURFACES = ["background", "card", "popover"] as const;
const TINTED_TEXT = [
	"primary-highlight",
	"destructive",
	"success",
	"warning",
	"info",
] as const;

const onSurfaces = (
	foreground: string,
	kind: ContrastKind,
	surfaces: readonly string[] = SURFACES,
): ContrastPair[] =>
	surfaces.map((background) => ({
		id: `${foreground} on ${background}`,
		kind,
		foreground,
		background,
		minimum: kind === "text" ? TEXT_MINIMUM : UI_MINIMUM,
	}));

const onFill = (foreground: string, fills: readonly string[]) =>
	onSurfaces(foreground, "text", fills);

const onTint = (foreground: string): ContrastPair[] =>
	TINT_SURFACES.map((background) => ({
		id: `${foreground} on ${foreground}/15 over ${background}`,
		kind: "text",
		foreground,
		background,
		tint: TINT_STRENGTH,
		minimum: TEXT_MINIMUM,
	}));

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
	...onSurfaces("foreground", "text", [...SURFACES, "accent"]),
	...onSurfaces("secondary-foreground", "text", [
		"secondary",
		"secondary-highlight",
	]),
	...onSurfaces("muted-foreground", "text"),
	...onSurfaces("primary-highlight", "text"),
	...onSurfaces("destructive", "text"),
	...onSurfaces("destructive-highlight", "text"),
	...onSurfaces("success", "text"),
	...onSurfaces("warning", "text"),
	...onSurfaces("info", "text"),
	...onFill("primary-foreground", ["primary-fill", "primary-fill-highlight"]),
	...onFill("destructive-foreground", [
		"destructive-fill",
		"destructive-fill-highlight",
	]),
	...TINTED_TEXT.flatMap(onTint),
	...onSurfaces("primary", "ui"),
];

const parity = (foreground: string, background: string): ParityPair => ({
	id: `${foreground} on ${background}`,
	foreground,
	background,
});

export const PARITY_PAIRS: readonly ParityPair[] = [
	parity("card", "background"),
	parity("popover-highlight", "popover"),
	parity("secondary-highlight", "secondary"),
	parity("accent", "secondary-highlight"),
	...["background", "card", "popover", "secondary"].flatMap((surface) => [
		parity("border", surface),
		parity("control-border", surface),
		parity("accent", surface),
	]),
];

const HEX = /^#([0-9a-f]{3,8})$/i;
const FUNCTIONAL = /^rgba?\(\s*([^)]+)\)$/i;

const channel = (value: string, scale: number) =>
	value.endsWith("%")
		? (Number.parseFloat(value) / 100) * scale
		: Number.parseFloat(value);

export const parseColor = (value: string): Rgba | undefined => {
	const trimmed = value.trim();
	const hex = HEX.exec(trimmed);
	if (hex) {
		const digits = hex[1];
		if (![3, 4, 6, 8].includes(digits.length)) return undefined;
		const full =
			digits.length <= 4
				? digits
						.split("")
						.map((digit) => digit + digit)
						.join("")
				: digits;
		const read = (index: number) =>
			Number.parseInt(full.slice(index * 2, index * 2 + 2), 16);
		return [read(0), read(1), read(2), full.length === 8 ? read(3) / 255 : 1];
	}

	const functional = FUNCTIONAL.exec(trimmed);
	if (!functional) return undefined;
	const parts = functional[1]
		.split(/[\s,/]+/)
		.filter((part) => part.length > 0);
	if (parts.length < 3 || parts.length > 4) return undefined;
	const [red, green, blue] = parts
		.slice(0, 3)
		.map((part) => channel(part, 255));
	const alpha = parts[3] === undefined ? 1 : channel(parts[3], 1);
	const result: Rgba = [red, green, blue, alpha];
	return result.every(Number.isFinite) ? result : undefined;
};

export const composite = (top: Rgba, bottom: Rgba): Rgba => {
	const alpha = top[3] + bottom[3] * (1 - top[3]);
	if (alpha === 0) return [0, 0, 0, 0];
	const mix = (index: number) =>
		(top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha;
	return [mix(0), mix(1), mix(2), alpha];
};

const linearize = (value: number) => {
	const unit = value / 255;
	return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (color: Rgba) =>
	0.2126 * linearize(color[0]) +
	0.7152 * linearize(color[1]) +
	0.0722 * linearize(color[2]);

export const contrastBetween = (first: Rgba, second: Rgba) => {
	const a = relativeLuminance(first);
	const b = relativeLuminance(second);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const token = (tokens: ThemeTokens, name: string): Rgba => {
	const value = tokens[name];
	const parsed = value === undefined ? undefined : parseColor(value);
	if (!parsed) throw new Error(`--${name} is not a parseable color: ${value}`);
	return parsed;
};

const surfaceColor = (tokens: ThemeTokens, name: string) =>
	composite(token(tokens, name), token(tokens, "background"));

export const pairRatio = (
	tokens: ThemeTokens,
	pair: Pick<ContrastPair, "foreground" | "background" | "tint">,
) => {
	const foreground = token(tokens, pair.foreground);
	let background = surfaceColor(tokens, pair.background);
	if (pair.tint !== undefined) {
		background = composite(
			[foreground[0], foreground[1], foreground[2], foreground[3] * pair.tint],
			background,
		);
	}
	return contrastBetween(composite(foreground, background), background);
};

const BLOCK = (selector: string) =>
	new RegExp(`(^|\\n)${selector}\\s*\\{([^}]*)\\}`);

const declarations = (body: string): ThemeTokens => {
	const tokens: ThemeTokens = {};
	for (const match of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
		tokens[match[1]] = match[2].trim().replace(/\s+/g, " ");
	}
	return tokens;
};

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const DARK_SELECTOR = ':root,\n[data-theme="dark"]';
export const LIGHT_SELECTOR =
	':root[data-theme="light"],\n[data-theme="light"]';

export const readThemeBlock = (css: string, selector: string) => {
	const pattern = selector
		.split("\n")
		.map((line) => escapeRegExp(line.trim()))
		.join("\\s*");
	const match = BLOCK(pattern).exec(css);
	return match ? declarations(match[2]) : undefined;
};

export const readThemes = (css: string): Record<Theme, ThemeTokens> => {
	const dark = readThemeBlock(css, DARK_SELECTOR);
	const light = readThemeBlock(css, LIGHT_SELECTOR);
	if (!dark || !light) throw new Error("theme blocks not found");
	return { dark, light };
};
