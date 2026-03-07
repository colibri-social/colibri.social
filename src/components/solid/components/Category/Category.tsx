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

	const [isDragging, setIsDragging] = createSignal(false);

	onDndDragStart(({ draggable }) => {
		if (String(draggable.id) === props.channel.rkey) setIsDragging(true);
	});

	onDndDragEnd(() => {
		setTimeout(() => setIsDragging(false), 0);
	});

	return (
		<div
			ref={sortable.ref}
			style={{
				"touch-action": "none",
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
 * Builds the display order for channels: channels present in
 * `channel_order` come first (in that order), then any extras not listed.
 */
export function buildChannelOrder(category: SidebarCategoryData): string[] {
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
	/** Live channel order managed by the parent drag controller. */
	channelOrder: string[];
	/** Called when the user finishes dragging a channel within this category. */
	onChannelReorder: (categoryRkey: string, newOrder: string[]) => void;
	/** Channels injected from other categories (cross-category moves). */
	injectedChannels?: SidebarChannelData[];
	/** When non-null, shows an insertion indicator for cross-category drag. */
	dropTarget?: { catRkey: string; insertBeforeId: string | null } | null;
}> = (props) => {
	const [open, setOpen] = makePersisted(createSignal(true), {
		name: props.category.rkey,
	});

	// Channel objects in display order.
	// Uses props.category.channels as primary source; injectedChannels supplements
	// with channels moved in from other categories.
	const orderedChannels = createMemo((): SidebarChannelData[] => {
		const order = props.channelOrder;
		const channelMap = new Map<string, SidebarChannelData>([
			...props.category.channels.map(
				(ch): [string, SidebarChannelData] => [ch.rkey, ch],
			),
			...(props.injectedChannels ?? []).map(
				(ch): [string, SidebarChannelData] => [ch.rkey, ch],
			),
		]);
		return order
			.map((id) => channelMap.get(id))
			.filter((ch): ch is SidebarChannelData => ch !== undefined);
	});

	// Subscribe to the parent DragDropProvider's onDragEnd to commit within-category reorders.
	const [, { onDragStart: onDndDragStart, onDragEnd: onDndDragEnd }] = useDragDropContext()!;

	// Track whether the currently dragged channel originated in THIS category.
	// Prevents spurious reorders firing for the destination category after a cross-category drop.
	let channelWasHere = false;
	onDndDragStart(({ draggable }) => {
		channelWasHere = props.channelOrder.includes(String(draggable.id));
	});

	onDndDragEnd(({ draggable, droppable }) => {
		if (!channelWasHere) return; // channel started in a different category
		if (!draggable || !droppable) return;

		const order = props.channelOrder;
		const from = order.indexOf(String(draggable.id));
		if (from === -1) return; // dragged item is not a channel in this category

		const to = order.indexOf(String(droppable.id));
		if (to === -1 || from === to) return; // cross-category drop or same position

		const newOrder = order.slice();
		newOrder.splice(to, 0, ...newOrder.splice(from, 1));
		props.onChannelReorder(props.category.rkey, newOrder);
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
				<SortableProvider ids={props.channelOrder}>
					<For each={orderedChannels()}>
						{(channel) => (
							<>
								<Show when={props.dropTarget?.insertBeforeId === channel.rkey}>
									<div class="h-0.5 bg-primary rounded mx-1" />
								</Show>
								<SortableChannel channel={channel} community={props.community} />
							</>
						)}
					</For>
					<Show when={props.dropTarget && props.dropTarget.insertBeforeId === null}>
						<div class="h-0.5 bg-primary rounded mx-1" />
					</Show>
				</SortableProvider>
				<Show when={orderedChannels().length === 0 && !props.dropTarget}>
					<span class="text-xs text-muted-foreground ml-8">
						This category is empty.
					</span>
				</Show>
			</div>
		</div>
	);
};
