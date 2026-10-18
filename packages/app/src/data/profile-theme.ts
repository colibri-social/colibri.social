import type { ProfileTheme } from "./source";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const DEFAULT_BANNER = "#2b2b31";

export const themeColorsOf = (theme: ProfileTheme | undefined) => {
	if (theme?.gradient?.primary && theme.gradient.secondary) {
		return [theme.gradient.primary, theme.gradient.secondary];
	}
	return [theme?.bannerColor ?? DEFAULT_BANNER];
};

export const themeFrom = (
	accent: string | undefined,
	colors: string[],
): ProfileTheme => {
	const theme: ProfileTheme = {};
	if (accent) theme.accentColor = accent;
	const [primary, secondary] = colors;
	if (primary && secondary) theme.gradient = { primary, secondary };
	else if (primary) theme.bannerColor = primary;
	return theme;
};

const hexColor = (value: string | undefined) =>
	value && HEX_COLOR.test(value) ? value : undefined;

export const profileBannerFill = (
	theme: ProfileTheme | undefined,
): string | undefined => {
	const primary = hexColor(theme?.gradient?.primary);
	const secondary = hexColor(theme?.gradient?.secondary);
	if (primary && secondary)
		return `linear-gradient(135deg, ${primary}, ${secondary})`;
	return hexColor(theme?.bannerColor) ?? primary;
};
