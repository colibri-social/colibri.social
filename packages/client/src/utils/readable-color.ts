import type { AppTheme } from "./theme";

type Rgb = [number, number, number];

const HEX_PATTERN = /^#?([0-9a-f]+)$/i;

const LIGHT_BACKGROUND_LUMINANCE = 1;
const TARGET_CONTRAST = 4.5;
const SEARCH_STEPS = 12;

const parseHex = (value: string): Rgb | null => {
	const match = HEX_PATTERN.exec(value.trim());
	if (!match) return null;

	const digits = match[1];
	let hex: string;

	if (digits.length === 3 || digits.length === 4) {
		hex = digits
			.slice(0, 3)
			.split("")
			.map((digit) => digit + digit)
			.join("");
	} else if (digits.length === 6 || digits.length === 8) {
		hex = digits.slice(0, 6);
	} else {
		return null;
	}

	const packed = Number.parseInt(hex, 16);
	return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
};

const linearize = (channel: number): number => {
	const value = channel / 255;
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = (rgb: Rgb): number =>
	0.2126 * linearize(rgb[0]) +
	0.7152 * linearize(rgb[1]) +
	0.0722 * linearize(rgb[2]);

const contrast = (a: number, b: number): number =>
	(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const darken = (rgb: Rgb, amount: number): Rgb => [
	rgb[0] * (1 - amount),
	rgb[1] * (1 - amount),
	rgb[2] * (1 - amount),
];

const toHex = (rgb: Rgb): string =>
	`#${rgb
		.map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
		.join("")}`;

export const readableUserColor = (
	color: string | undefined,
	theme: AppTheme,
): string | undefined => {
	if (color === undefined || theme === "dark") return color;

	const rgb = parseHex(color);
	if (rgb === null) return color;

	if (contrast(luminance(rgb), LIGHT_BACKGROUND_LUMINANCE) >= TARGET_CONTRAST)
		return color;

	let low = 0;
	let high = 1;

	for (let step = 0; step < SEARCH_STEPS; step++) {
		const mid = (low + high) / 2;
		const passes =
			contrast(luminance(darken(rgb, mid)), LIGHT_BACKGROUND_LUMINANCE) >=
			TARGET_CONTRAST;

		if (passes) high = mid;
		else low = mid;
	}

	return toHex(darken(rgb, high));
};
