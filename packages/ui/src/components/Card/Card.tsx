import { type JSX, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";
import { createRipple, type RippleOptions } from "../../utils/ripple";

export type CardTone = "card" | "secondary";

const toneClass: Record<CardTone, string> = {
	card: "rounded-surface bg-card",
	secondary: "rounded-control bg-secondary",
};

const interactiveToneClass: Record<CardTone, string> = {
	card: "hover:bg-popover",
	secondary: "hover:bg-secondary-highlight",
};

export const cardSurface = (tone: CardTone = "card") =>
	cx("border border-border", toneClass[tone]);

export type CardProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "onClick"> & {
	tone?: CardTone;
	onClick?: JSX.EventHandler<HTMLElement, MouseEvent>;
	href?: string;
	disabled?: boolean;
	ripple?: RippleOptions;
	"aria-label"?: string;
};

export const Card = (props: CardProps) => {
	const [local, rest] = splitProps(props, [
		"tone",
		"onClick",
		"href",
		"disabled",
		"ripple",
		"class",
		"children",
	]);
	const tone = () => local.tone ?? "card";
	const interactive = () => !!(local.onClick || local.href);
	const ripple = createRipple({ placement: "over", ...local.ripple });

	return (
		<Dynamic
			{...rest}
			ref={(element: HTMLElement) => {
				if (interactive()) ripple(element);
			}}
			component={local.href ? "a" : interactive() ? "button" : "div"}
			type={!local.href && interactive() ? "button" : undefined}
			href={local.href}
			onClick={local.onClick}
			disabled={!local.href && interactive() ? local.disabled : undefined}
			data-interactive={interactive() || undefined}
			class={cx(
				"block w-full overflow-hidden text-left text-foreground",
				cardSurface(tone()),
				interactive() &&
					cx(
						"ripple cursor-pointer outline-none focus-ring",
						"disabled:cursor-not-allowed disabled:opacity-50",
						interactiveToneClass[tone()],
					),
				local.class,
			)}
		>
			{local.children}
		</Dynamic>
	);
};
