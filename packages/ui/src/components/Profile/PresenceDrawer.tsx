import { CheckIcon } from "@solar-icons/solid/linear/check";
import { For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import {
	type Presence,
	PresenceIndicator,
	presenceLabels,
} from "../Avatar/Avatar";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { ListGroup } from "../List/List";

export const presenceOptions: readonly Presence[] = [
	"online",
	"idle",
	"dnd",
	"offline",
];

export type PresenceOptionProps = {
	presence: Presence;
	selected: boolean;
	onSelect: (presence: Presence) => void;
	class?: string;
};

export const PresenceOption = (props: PresenceOptionProps) => {
	const ripple = createRipple();
	return (
		// biome-ignore lint/a11y/useSemanticElements: a ripple row button is the radio, a native input cannot carry the row layout
		<button
			ref={ripple}
			type="button"
			role="radio"
			aria-checked={props.selected}
			data-presence-option={props.presence}
			onClick={() => props.onSelect(props.presence)}
			class={cx(
				"ripple flex h-10 w-full shrink-0 cursor-pointer items-center gap-3 px-3 text-left text-foreground outline-none hover:bg-secondary-highlight focus-ring-inset",
				props.class,
			)}
		>
			<span
				aria-hidden="true"
				class="flex size-6 shrink-0 items-center justify-center"
			>
				<PresenceIndicator
					presence={props.presence}
					size={12}
					class="bg-transparent"
				/>
			</span>
			<span class="min-w-0 flex-1 truncate text-sm font-semibold">
				{presenceLabels[props.presence]}
			</span>
			<Show when={props.selected}>
				<span
					aria-hidden="true"
					class="flex size-5 shrink-0 items-center justify-center text-primary [&>svg]:size-5"
				>
					<CheckIcon />
				</span>
			</Show>
		</button>
	);
};

export type PresenceDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: Presence;
	onChange: (presence: Presence) => void;
	title?: string;
};

export const PresenceDrawer = (props: PresenceDrawerProps) => {
	const select = (presence: Presence) => {
		props.onOpenChange(false);
		if (presence !== props.value) props.onChange(presence);
	};

	return (
		<Drawer
			open={props.open}
			onOpenChange={props.onOpenChange}
			initialFocus="content"
		>
			<DrawerContent
				aria-label={props.title ?? "Online status"}
				header={
					<span class="text-lg leading-6 font-bold">
						{props.title ?? "Online status"}
					</span>
				}
			>
				<ListGroup>
					<div
						role="radiogroup"
						aria-label={props.title ?? "Online status"}
						class="flex flex-col [&>*]:border-border [&>*~*]:border-t"
					>
						<For each={presenceOptions}>
							{(presence) => (
								<PresenceOption
									presence={presence}
									selected={props.value === presence}
									onSelect={select}
								/>
							)}
						</For>
					</div>
				</ListGroup>
			</DrawerContent>
		</Drawer>
	);
};
