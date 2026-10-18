import { For, splitProps } from "solid-js";
import { cx } from "../../utils/cx";

export type PagerDotsProps = {
	count: number;
	index: number;
	label?: string;
	class?: string;
};

export const PagerDots = (props: PagerDotsProps) => {
	const [local, rest] = splitProps(props, ["count", "index", "label", "class"]);
	const state = (dot: number) =>
		dot === local.index
			? "active"
			: dot < local.index
				? "completed"
				: "upcoming";

	return (
		<div
			{...rest}
			role="img"
			aria-label={local.label ?? `Step ${local.index + 1} of ${local.count}`}
			class={cx("flex items-center gap-2.5 p-2.5", local.class)}
		>
			<For each={Array.from({ length: local.count }, (_, dot) => dot)}>
				{(dot) => (
					<span
						data-pager-dot={state(dot)}
						class={cx(
							"size-2 rounded-full",
							"transition-colors duration-[calc(var(--duration-color)*var(--motion-scale))]",
							"data-[pager-dot=active]:bg-primary data-[pager-dot=completed]:bg-foreground data-[pager-dot=upcoming]:bg-muted-foreground",
						)}
					/>
				)}
			</For>
		</div>
	);
};
