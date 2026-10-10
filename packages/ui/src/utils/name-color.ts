import {
	createContext,
	type JSX,
	type ParentProps,
	useContext,
} from "solid-js";
import { createComponent } from "solid-js/web";

export type ColorTheme = "dark" | "light";

type Rgb = [number, number, number];

const HEX_PATTERN = /^#?([0-9a-f]+)$/i;

const TARGET_CONTRAST = 4.5;
const DARK_SURFACE: Rgb = [0x2c, 0x2c, 0x2c];
const LIGHT_SURFACE: Rgb = [0xe4, 0xe4, 0xe6];
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

export const contrastRatio = (a: string, b: string): number | undefined => {
	const first = parseHex(a);
	const second = parseHex(b);
	if (!first || !second) return undefined;
	return contrast(luminance(first), luminance(second));
};

const contrast = (a: number, b: number): number =>
	(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const darken = (rgb: Rgb, amount: number): Rgb => [
	rgb[0] * (1 - amount),
	rgb[1] * (1 - amount),
	rgb[2] * (1 - amount),
];

const lighten = (rgb: Rgb, amount: number): Rgb => [
	rgb[0] + (255 - rgb[0]) * amount,
	rgb[1] + (255 - rgb[1]) * amount,
	rgb[2] + (255 - rgb[2]) * amount,
];

const toHex = (rgb: Rgb, round: (value: number) => number = Math.round) =>
	`#${rgb
		.map((channel) =>
			Math.min(255, round(channel)).toString(16).padStart(2, "0"),
		)
		.join("")}`;

const search = (passes: (amount: number) => boolean) => {
	let low = 0;
	let high = 1;
	for (let step = 0; step < SEARCH_STEPS; step++) {
		const mid = (low + high) / 2;
		if (passes(mid)) high = mid;
		else low = mid;
	}
	return high;
};

export const readableUserColor = (
	color: string | undefined,
	theme: ColorTheme,
): string | undefined => {
	if (color === undefined) return undefined;

	const rgb = parseHex(color);
	if (rgb === null) return color;

	const light = theme === "light";
	const surface = luminance(light ? LIGHT_SURFACE : DARK_SURFACE);
	const shift = light ? darken : lighten;
	if (contrast(luminance(rgb), surface) >= TARGET_CONTRAST) return color;

	const amount = search(
		(mid) => contrast(luminance(shift(rgb, mid)), surface) >= TARGET_CONTRAST,
	);
	return toHex(shift(rgb, amount), light ? Math.floor : Math.ceil);
};

export type ThemedColor = { dark: string; light: string };

export const themedColor = (color: string | undefined) => {
	if (!color) return undefined;
	const dark = readableUserColor(color, "dark");
	const light = readableUserColor(color, "light");
	if (!dark || !light) return undefined;
	return { dark, light } satisfies ThemedColor;
};

export const themedColorStyle = (
	variable: string,
	color: ThemedColor | undefined,
): JSX.CSSProperties =>
	color
		? {
				[`--${variable}-dark`]: color.dark,
				[`--${variable}-light`]: color.light,
			}
		: {};

export type NameColorContext = "chat" | "member-list";

export type RankedRole = { color?: string; position?: number };

export const topRoleColor = (roles: readonly RankedRole[] | undefined) => {
	let best: RankedRole | undefined;
	for (const role of roles ?? []) {
		if (!role.color) continue;
		if (!best || (role.position ?? 0) > (best.position ?? 0)) best = role;
	}
	return best?.color;
};

export type NameColorInput = {
	userColor?: string;
	roleColor?: string;
	context: NameColorContext;
	overrideUserColors?: boolean;
};

export const pickNameColor = (input: NameColorInput) => {
	if (input.roleColor) return input.roleColor;
	if (input.context !== "chat" || input.overrideUserColors) return undefined;
	return input.userColor;
};

export const resolveNameColor = (input: NameColorInput) =>
	themedColor(pickNameColor(input));

export const NAME_COLOR_VARIABLE = "name-color";

export const nameColorClass =
	"text-(--name-color-dark) light:text-(--name-color-light)";

export const nameColorStyle = (color: ThemedColor | undefined) =>
	themedColorStyle(NAME_COLOR_VARIABLE, color);

export type NameColorSettings = { overrideUserColors?: boolean };

const NameColorSettingsContext = createContext<NameColorSettings>({});

export const NameColorProvider = (props: ParentProps<NameColorSettings>) =>
	createComponent(NameColorSettingsContext.Provider, {
		value: {
			get overrideUserColors() {
				return props.overrideUserColors;
			},
		},
		get children() {
			return props.children;
		},
	});

export const useNameColor = (
	input: () => Omit<NameColorInput, "overrideUserColors">,
) => {
	const settings = useContext(NameColorSettingsContext);
	return () =>
		resolveNameColor({
			...input(),
			overrideUserColors: settings.overrideUserColors,
		});
};
