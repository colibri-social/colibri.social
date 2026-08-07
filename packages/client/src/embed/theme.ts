import chroma from "chroma-js";
import { createLogger } from "../utils/logger";
import type { EmbedEmitter, EmbedThemeToken, EmbedThemeTokens } from "./types";

const log = createLogger("embed");

export const themeVariable = (token: EmbedThemeToken): string =>
	`--colibri-embed-${token}`;

export const applyTheme = (
	root: HTMLElement,
	theme: Partial<EmbedThemeTokens>,
): void => {
	for (const [token, value] of Object.entries(theme)) {
		if (value === undefined) continue;
		root.style.setProperty(themeVariable(token as EmbedThemeToken), value);
	}
};

const MIN_CONTRAST = 4.5;

const readable = (background: string): string => {
	const onDark = chroma.contrast(background, "#fafafa");
	const onLight = chroma.contrast(background, "#18181b");
	return onLight >= onDark ? "#18181b" : "#fafafa";
};

export const deriveBrandTokens = (
	brand: string,
): { tokens: Partial<EmbedThemeTokens>; lowContrast: boolean } => {
	const base = chroma(brand);
	const foreground = readable(brand);

	return {
		tokens: {
			primary: base.hex(),
			"primary-hover": base.brighten(0.6).hex(),
			"primary-foreground": foreground,
			ring: base.hex(),
			"sidebar-primary": base.hex(),
			"sidebar-primary-foreground": foreground,
		},
		lowContrast: chroma.contrast(brand, foreground) < MIN_CONTRAST,
	};
};

export const applyBrand = (
	root: HTMLElement,
	brand: string,
	emitter: EmbedEmitter,
): void => {
	let derived: ReturnType<typeof deriveBrandTokens>;
	try {
		derived = deriveBrandTokens(brand);
	} catch {
		log.warn("the brand colour could not be parsed, keeping the default");
		emitter.emit({ kind: "error", code: "EmbedConfigInvalid" });
		return;
	}

	applyTheme(root, derived.tokens);

	if (derived.lowContrast) {
		log.warn(
			"the brand colour cannot carry legible text at any foreground, using the closest one",
			{ brand },
		);
		emitter.emit({ kind: "error", code: "EmbedLowContrastBrand" });
	}
};
