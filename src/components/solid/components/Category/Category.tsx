import { makePersisted } from "@solid-primitives/storage";
import { A, useParams } from "@solidjs/router";
import {
	createSortable,
	SortableProvider,
	useDragDropContext,
} from "@thisbeyond/solid-dnd";
import {
	type Component,
	createMemo,
	createSignal,
	For,
	Match,
	type ParentComponent,
	Show,
	Switch,
} from "solid-js";
import { actions } from "astro:actions";
import type { SidebarCategoryData, SidebarChannelData } from "@/utils/sdk";
import { CaretRight } from "../../icons/CaretRight";
import { ChatCircleDots } from "../../icons/ChatCircleDots";
import { Gear } from "../../icons/Gear";
import { PlusSmall } from "../../icons/PlusSmall";
import { Button } from "../../shadcn-solid/Button";
import { CategorySettingsModal } from "./CategorySettingsModal";
import { ChannelCreationModal } from "./ChannelCreationModal";
import { ChannelSettingsModal } from "./ChannelSettingsModal";

const SortableChannel: Component<{
	channel: SidebarChannelData;
	community: string;
}> = (props) => {
	const sortable = createSortable(props.channel.rkey);
	const [, { onDragStart: onDndDragStart, onDragEnd: onDndDragEnd }] =
		useDragDropContext()!;
	const params = useParams();

	// Track when this specific channel is being dragged so we can suppress
	// the click-to-navigate that fires on pointerup.
	const [isDragging, setIsDragging] = createSignal(false);

	onDndDragStart(({ draggable }) => {
		if (String(draggable.id) === props.channel.rkey) setIsDragging(true);
	});

	onDndDragEnd(() => {
		// Defer past the click event that fires on pointerup.
		setTimeout(() => setIsDragging(false), 0);
	});

	return (
		<div
			ref={sortable.ref}
			style={{
				"touch-action": "none",
				// solid-dnd computes this transform to show where the item will land.
				// Non-active items slide smoothly; the active item has no transition
				// so it follows the pointer instantly.
				transform: sortable.transform
					? `translate(${sortable.transform.x}px, ${sortable.transform.y}px)`
					: undefined,
				transition: sortable.isActiveDraggable
					? "none"
					: "transform 150ms ease",
			}}
			classList={{ "opacity-50": sortable.isActiveDraggable }}
			{...sortable.dragActivators}
		>
			{/* TODO: This doesn't yet account for different channel types */}
			<A
				href={`/c/${params.community}/${props.channel.rkey}`}
				class="flex flex-row items-center gap-2 justify-between text-muted-foreground hover:bg-card cursor-pointer p-1 pr-1.25 py-0.5 rounded-sm group/channel"
				activeClass="bg-card"
				style={{ "pointer-events": isDragging() ? "none" : undefined }}
				draggable={false}
			>
				<div class="flex flex-row items-center gap-2">
					<ChatCircleDots />
					<span>{props.channel.name}</span>
				</div>
				<ChannelSettingsModal class="w-5 h-5.5 p-0" channel={props.channel}>
					<Button
						size="sm"
						class="w-5 h-5 cursor-pointer opacity-0 group-hover/channel:opacity-100 p-0"
						classList={{
							"opacity-100!": params.channel === props.channel.rkey,
						}}
						variant="ghost"
						onClick={(e) => e.preventDefault()}
					>
						<Gear size={16} />
					</Button>
				</ChannelSettingsModal>
			</A>
		</div>
	);
};

/**
 * Builds the initial display order for channels: channels present in
 * `channel_order` come first (in that order), then any extras not listed.
 */
function buildInitialOrder(category: SidebarCategoryData): string[] {
	const order = category.channel_order ?? [];
	const channelRkeys = new Set(category.channels.map((ch) => ch.rkey));
	const ordered = order.filter((id) => channelRkeys.has(id));
	const extras = category.channels
		.filter((ch) => !order.includes(ch.rkey))
		.map((ch) => ch.rkey);
	return [...ordered, ...extras];
}

/**
 * A single category on the sidebar.
 */
export const Category: ParentComponent<{
	category: SidebarCategoryData;
	community: string;
	activeDraggable: boolean;
}> = (props) => {
	const [open, setOpen] = makePersisted(createSignal(true), {
		name: props.category.rkey,
	});

	// Local channel order — null means "follow server order".
	const [localOrder, setLocalOrder] = createSignal<string[] | null>(null);

	// The order used for display and SortableProvider ids.
	const channelOrder = createMemo(() => {
		return localOrder() ?? buildInitialOrder(props.category);
	});

	// Channel objects in display order (stable references for <For>).
	const orderedChannels = createMemo((): SidebarChannelData[] => {
		const order = channelOrder();
		const channelMap = new Map(
			props.category.channels.map((ch) => [ch.rkey, ch]),
		);
		return order
			.map((id) => channelMap.get(id))
			.filter((ch): ch is SidebarChannelData => ch !== undefined);
	});

	// Subscribe to the parent DragDropProvider's onDragEnd to commit reorders.
	const [, { onDragEnd: onDndDragEnd }] = useDragDropContext()!;

	onDndDragEnd(({ draggable, droppable }) => {
		if (!draggable || !droppable) return;

		const order = channelOrder();
		const from = order.indexOf(String(draggable.id));
		if (from === -1) return; // dragged item is not a channel in this category

		const to = order.indexOf(String(droppable.id));
		if (to === -1 || from === to) return;

		const newOrder = order.slice();
		newOrder.splice(to, 0, ...newOrder.splice(from, 1));
		setLocalOrder(newOrder);

		actions.reorderChannels({
			categoryRkey: props.category.rkey,
			channelOrder: newOrder,
		});
	});

	return (
		<div class="flex flex-col py-3">
			<button
				type="button"
				class="flex flex-row items-center justify-between pb-2 px-4 pl-4.5 text-sm text-muted-foreground group/category hover:text-foreground"
				style={{
					cursor: props.activeDraggable ? "grabbing" : "grab",
				}}
			>
				<div
					class="flex flex-row gap-2.5 cursor-pointer items-center"
					onClick={() => setOpen((current) => !current)}
				>
					<Switch>
						<Match when={open()}>
							<CaretRight className={"rotate-90"} />
						</Match>
						<Match when={!open()}>
							<CaretRight className={"rotate-0"} />
						</Match>
					</Switch>
					<span>{props.category.name}</span>
				</div>
				<div class="flex flex-row gap-1 items-center">
					<CategorySettingsModal category={props.category}>
						<Button
							size="sm"
							class="w-5 h-5 cursor-pointer opacity-0 group-hover/category:opacity-100"
							variant="ghost"
						>
							<Gear size={16} />
						</Button>
					</CategorySettingsModal>
					<ChannelCreationModal
						category={props.category.rkey}
						community={props.community}
					>
						<Button size="sm" class="w-5 h-5 cursor-pointer" variant="ghost">
							<PlusSmall />
						</Button>
					</ChannelCreationModal>
				</div>
			</button>
			<div
				class="flex flex-col gap-1 mx-3"
				classList={{
					hidden: !open(),
				}}
				onPointerDown={(e) => e.stopPropagation()}
			>
				<SortableProvider ids={channelOrder()}>
					<For each={orderedChannels()}>
						{(channel) => (
							<SortableChannel
								channel={channel}
								community={props.community}
							/>
						)}
					</For>
				</SortableProvider>
				<Show when={props.category.channels.length === 0}>
					<span class="text-xs text-muted-foreground ml-8">
						This category is empty.
					</span>
				</Show>
			</div>
		</div>
	);
};
