import type { OnlineState } from "@colibri-social/lib";
import {
	createSignal,
	For,
	type ParentComponent,
	type Setter,
	Show,
} from "solid-js";
import CheckIcon from "~icons/ph/check";
import { useIsMobile } from "../../../utils/mobile-pane";
import {
	HoverCard,
	HoverCardContent,
	HoverCardPortal,
	HoverCardTrigger,
} from "../../ui/HoverCard";
import { MenuDrawer, MenuDrawerItem } from "../../ui/MenuDrawer";

export const STATE_LABELS: Record<OnlineState, string> = {
	away: "Away",
	dnd: "Do Not Disturb",
	offline: "Offline",
	online: "Online",
};

export const STATE_OPTIONS: Array<{ value: OnlineState; dot: string }> = [
	{ value: "online", dot: "bg-green-400" },
	{ value: "away", dot: "bg-yellow-400" },
	{ value: "dnd", dot: "bg-red-400" },
	{ value: "offline", dot: "bg-neutral-400" },
];

export const DropdownStatusSelect: ParentComponent<{
	value: OnlineState;
	setValue: Setter<OnlineState>;
}> = (props) => {
	const isMobile = useIsMobile();
	const [open, setOpen] = createSignal(false);

	return (
		<Show
			when={isMobile()}
			fallback={
				<HoverCard placement="right-start" openDelay={100} closeDelay={150}>
					<HoverCardTrigger as="div">{props.children}</HoverCardTrigger>
					<HoverCardPortal>
						<HoverCardContent class="w-44 p-2 gap-2">
							<For each={STATE_OPTIONS}>
								{(s) => (
									<button
										type="button"
										class="w-full flex flex-row items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer text-left"
										onClick={() => props.setValue(s.value)}
									>
										<span
											class={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`}
										/>
										<span>{STATE_LABELS[s.value]}</span>
										<Show when={props.value === s.value}>
											<CheckIcon class="ml-auto" />
										</Show>
									</button>
								)}
							</For>
						</HoverCardContent>
					</HoverCardPortal>
				</HoverCard>
			}
		>
			<div style={{ display: "contents" }} onClick={() => setOpen(true)}>
				{props.children}
			</div>
			<MenuDrawer open={open()} onOpenChange={setOpen} title="Status">
				<For each={STATE_OPTIONS}>
					{(s) => (
						<MenuDrawerItem
							onClick={() => {
								setOpen(false);
								props.setValue(s.value);
							}}
						>
							<span class={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
							<span>{STATE_LABELS[s.value]}</span>
							<Show when={props.value === s.value}>
								<CheckIcon class="ml-auto" />
							</Show>
						</MenuDrawerItem>
					)}
				</For>
			</MenuDrawer>
		</Show>
	);
};
