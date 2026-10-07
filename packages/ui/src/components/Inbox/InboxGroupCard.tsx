import { For, type JSX, children as resolveChildren, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Card } from "../Card/Card";
import { SpaceIcon } from "../Space/SpaceIcon";

export type InboxGroupCardProps = {
	name: string;
	iconSrc?: string;
	summary?: JSX.Element;
	children?: JSX.Element;
	class?: string;
};

export const InboxGroupCard = (props: InboxGroupCardProps) => {
	const items = resolveChildren(() => props.children);
	const list = () =>
		items.toArray().filter((item) => item != null && item !== false);

	return (
		<Card tone="card" class={cx("flex flex-col", props.class)}>
			<div class="flex items-center gap-3 p-3">
				<SpaceIcon name={props.name} src={props.iconSrc} />
				<div class="flex min-w-0 flex-1 flex-col">
					<h2 class="truncate text-xl leading-[26px] font-bold text-foreground">
						{props.name}
					</h2>
					<Show when={props.summary}>
						<p class="truncate text-sm leading-[18px] text-foreground">
							{props.summary}
						</p>
					</Show>
				</div>
			</div>
			<For each={list()}>
				{(item) => (
					<>
						<div aria-hidden="true" class="h-px shrink-0 bg-border" />
						{item}
					</>
				)}
			</For>
		</Card>
	);
};
