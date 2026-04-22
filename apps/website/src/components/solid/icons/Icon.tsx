import type { Component } from "solid-js";
import type { PhosphorIconProps } from "solid-phosphor";
import * as fill from "solid-phosphor/fill";
import * as regular from "solid-phosphor/regular";

type PhosphorIconVariant = "regular" | "fill";

const pascalToKebab = (s: string) =>
	s
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();

const kebabToPascal = (s: string) =>
	s
		.split(/[-_ ]+/)
		.map((p) => (p.length ? p.charAt(0).toUpperCase() + p.slice(1) : ""))
		.join("");

type IsUppercase<C extends string> =
	C extends Uppercase<C> ? (C extends Lowercase<C> ? false : true) : false;

type PascalToKebab<S extends string, Acc extends string = ""> = S extends ""
	? Acc
	: S extends `${infer C}${infer Rest}`
		? Rest extends ""
			? `${Acc}${Lowercase<C>}`
			: IsUppercase<C> extends true
				? Acc extends ""
					? PascalToKebab<Rest, `${Lowercase<C>}`>
					: PascalToKebab<Rest, `${Acc}-${Lowercase<C>}`>
				: PascalToKebab<Rest, `${Acc}${C}`>
		: Acc;

type RegularKeys = Extract<keyof typeof regular, string>;

export type IconName = PascalToKebab<RegularKeys>;

export const ICON_NAMES: IconName[] = Object.keys(regular).map(
	pascalToKebab,
) as IconName[];

interface IconProps {
	variant?: PhosphorIconVariant;
	name: IconName;
	size?: number;
}

type Props = PhosphorIconProps & IconProps;

const VARIANT_MAP = {
	regular,
	fill,
} as const;

export const Icon: Component<Props> = (props) => {
	const {
		name,
		variant = "regular",
		size,
		class: className,
		...rest
	} = props as Props & { class?: string };

	const raw = String(name || "");
	const kebab = raw.toLowerCase().replace(/^\s+|\s+$/g, "");
	const stripped = kebab.replace(/-icon$/i, "");
	const pascal = kebabToPascal(stripped);

	const set = VARIANT_MAP[variant] ?? regular;

	let Comp = (set as any)[pascal] as Component<any> | undefined;
	if (!Comp) {
		Comp = (set as any)[`${pascal}Icon`] as Component<any> | undefined;
	}

	if (!Comp) return null;

	const forwarded: Record<string, unknown> = { ...rest };

	if (size !== undefined) {
		forwarded.size = size;
		forwarded.height = `${size}px`;
		forwarded.width = `${size}px`;
	}

	if (className !== undefined) {
		forwarded.class = className;
	}

	return <Comp {...(forwarded as PhosphorIconProps)} />;
};

export default Icon;
