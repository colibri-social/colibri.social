import { type ParentComponent, Show } from "solid-js";
import SpinnerIcon from "~icons/ph/spinner-gap";
import { cx } from "../../utils/cva";

export const StatusPill: ParentComponent<{
	class?: string;
	spinner?: boolean;
}> = (props) => (
	<div
		class={cx(
			"flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground shadow-md",
			props.class,
		)}
	>
		<Show when={props.spinner}>
			<SpinnerIcon class="animate-spin" />
		</Show>
		<span>{props.children}</span>
	</div>
);
