import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";

export type StatusScreenProps = {
	icon: JSX.Element;
	title: JSX.Element;
	description?: JSX.Element;
	actions?: JSX.Element;
	tone?: "neutral" | "destructive";
	class?: string;
};

export const StatusScreen = (props: StatusScreenProps) => {
	const actions = createSlot(() => props.actions);
	const description = createSlot(() => props.description);
	return (
		<div
			data-status-screen=""
			role="status"
			class={cx(
				"flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center",
				props.class,
			)}
		>
			<span
				aria-hidden="true"
				class={cx(
					"flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary [&>svg]:size-7",
					props.tone === "destructive"
						? "text-destructive"
						: "text-muted-foreground",
				)}
			>
				{props.icon}
			</span>
			<div class="flex max-w-80 flex-col gap-1.5">
				<h2 class="m-0 text-lg leading-6 font-bold text-balance text-foreground">
					{props.title}
				</h2>
				<Show when={description.has()}>
					<p class="m-0 text-sm text-pretty text-muted-foreground">
						{description()}
					</p>
				</Show>
			</div>
			<Show when={actions.has()}>
				<div
					data-status-screen-actions=""
					class="flex w-full max-w-80 flex-col gap-2"
				>
					{actions()}
				</div>
			</Show>
		</div>
	);
};
