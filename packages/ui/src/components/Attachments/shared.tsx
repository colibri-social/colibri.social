import type { JSX } from "solid-js";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";

export const pressSurface =
	"ripple cursor-pointer outline-none focus-visible:shadow-[0_0_0_2px_var(--primary)]";

export const embedSurface =
	"rounded-surface border border-border bg-card text-foreground";

export const createPressRipple = () => createRipple({ placement: "over" });

export const formatBytes = (bytes: number) => {
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB", "TB"];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
};

export { formatClock } from "../Media/format";

export const formatCompact = (value: number) =>
	new Intl.NumberFormat("en", { notation: "compact" }).format(value);

export type TextActionProps = {
	children: JSX.Element;
	onClick: () => void;
	icon?: JSX.Element;
	class?: string;
};

export const TextAction = (props: TextActionProps) => (
	<button
		type="button"
		onClick={() => props.onClick()}
		class={cx(
			"inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-control-xs border-0 bg-transparent px-1 py-0.5 text-sm font-semibold text-primary-highlight outline-none hover:bg-primary/10 focus-visible:shadow-[0_0_0_2px_var(--primary)] [&>svg]:size-4",
			props.class,
		)}
	>
		{props.icon}
		{props.children}
	</button>
);
