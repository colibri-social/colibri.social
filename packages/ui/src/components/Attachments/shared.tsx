import { EyeIcon } from "@solar-icons/solid/bold/eye";
import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";

export const pressSurface = "ripple cursor-pointer outline-none focus-ring";
export const pressSurfaceInset =
	"ripple cursor-pointer outline-none focus-ring-inset";

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
			"inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-control-xs border-0 bg-transparent px-1 py-0.5 text-sm font-semibold text-primary-highlight outline-none hover:bg-primary/10 focus-ring [&>svg]:size-4",
			props.class,
		)}
	>
		{props.icon}
		{props.children}
	</button>
);

export type SpoilerFrameProps = {
	hidden: boolean;
	label: string;
	onReveal: () => void;
	class?: string;
	children: JSX.Element;
};

export const SpoilerFrame = (props: SpoilerFrameProps) => (
	<div
		data-spoiler-frame=""
		data-spoiler-hidden={props.hidden ? "" : undefined}
		class={cx(
			"relative w-full max-w-[416px] overflow-hidden rounded-surface",
			props.class,
		)}
	>
		<div
			inert={props.hidden}
			aria-hidden={props.hidden ? "true" : undefined}
			class={cx(
				"transition-[filter] duration-[calc(150ms*var(--motion-scale))] motion-reduce:transition-none reduced-motion:transition-none",
				props.hidden && "blur-md select-none",
			)}
		>
			{props.children}
		</div>
		<Show when={props.hidden}>
			<button
				type="button"
				data-spoiler-reveal=""
				onClick={() => props.onReveal()}
				class="focus-ring-inset absolute inset-0 flex cursor-pointer items-center justify-center rounded-surface border-0 bg-black/25 p-0 outline-none"
			>
				<span class="sr-only">{props.label}</span>
				<span
					aria-hidden="true"
					class="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm [&>svg]:size-4"
				>
					<EyeIcon />
					Spoiler
				</span>
			</button>
		</Show>
	</div>
);
