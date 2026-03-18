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
import type {
	CommunityData,
	SidebarCategoryData,
	SidebarChannelData,
} from "@/utils/sdk";
import { useGlobalContext } from "../../contexts/GlobalContext";
import { useVoiceChatContext } from "../../contexts/VoiceChatContext";
import { CaretRight } from "../../icons/CaretRight";
import { ChatCircleDots } from "../../icons/ChatCircleDots";
import { Gear } from "../../icons/Gear";
import { PlusSmall } from "../../icons/PlusSmall";
import { SpeakerLow } from "../../icons/SpeakerLow";
import { Button } from "../../shadcn-solid/Button";
import { CategorySettingsModal } from "./CategorySettingsModal";
import { ChannelCreationModal } from "./ChannelCreationModal";
import { ChannelSettingsModal } from "./ChannelSettingsModal";

export type ChannelDropTarget = {
	catRkey: string;
	insertBeforeId: string | null;
};

const SortableChannel: Component<{
	channel: SidebarChannelData;
	community: CommunityData;
}> = (props) => {
	const sortable = createSortable(props.channel.rkey);
	const [, { onDragStart: onDndDragStart, onDragEnd: onDndDragEnd }] =
		useDragDropContext()!;
	const [globalData] = useGlobalContext();
	const params = useParams();
	const [, { connect }] = useVoiceChatContext();

	const [isDragging, setIsDragging] = createSignal(false);

	onDndDragStart(({ draggable }) => {
		if (String(draggable.id) === props.channel.rkey) setIsDragging(true);
	});

	onDndDragEnd(() => {
		setTimeout(() => setIsDragging(false), 0);
	});

	const handleVoiceChannelJoin = (
		e: MouseEvent & {
			currentTarget: HTMLAnchorElement;
			target: Element;
		},
	) => {
		if (
			props.channel.channel_type !== "voice" ||
			e.target.closest(".channel-settings") ||
			e.target.classList.contains("channel-settings") ||
			e.target.closest('[role="alertdialog"]')
		) {
			return;
		}
		connect(props.channel.rkey, props.channel.name);
	};

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
			<A
				href={`/c/${params.community}/${props.channel.channel_type.slice(0, 1)}/${props.channel.rkey}`}
				class="group/channel flex flex-row justify-between items-center gap-2 hover:bg-card p-1 py-0.5 pr-1.25 rounded-sm text-muted-foreground cursor-pointer"
				activeClass="bg-card"
				style={{ "pointer-events": isDragging() ? "none" : undefined }}
				draggable={false}
				onClick={handleVoiceChannelJoin}
			>
				<div class="flex flex-row items-center gap-2">
					<Switch>
						<Match when={props.channel.channel_type === "text"}>
							<ChatCircleDots />
						</Match>
						<Match when={props.channel.channel_type === "voice"}>
							<SpeakerLow />
						</Match>
					</Switch>
					<span>{props.channel.name}</span>
				</div>
				<div class="flex justify-center items-center pb-px">
					<Show when={props.community.owner_did === globalData.user.sub}>
						<ChannelSettingsModal class="p-0 w-5 h-5.5" channel={props.channel}>
							<Button
								size="sm"
								class="opacity-0 group-hover/channel:opacity-100 p-0 w-5 h-5 cursor-pointer channel-settings"
								classList={{
									"opacity-100!": params.channel === props.channel.rkey,
								}}
								variant="ghost"
								onClick={(e) => e.preventDefault()}
							>
								<Gear size={16} />
							</Button>
						</ChannelSettingsModal>
					</Show>
				</div>
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
	community: CommunityData;
	activeDraggable: boolean;
	channelOrder: string[];
	onChannelReorder: (categoryRkey: string, newOrder: string[]) => void;
	injectedChannels?: SidebarChannelData[];
	dropTarget?: ChannelDropTarget | null;
}> = (props) => {
	const [globalData] = useGlobalContext();
	const [open, setOpen] = makePersisted(createSignal(true), {
		name: props.category.rkey,
	});

	const orderedChannels = createMemo((): SidebarChannelData[] => {
		const order = props.channelOrder;
		const channelMap = new Map<string, SidebarChannelData>([
			...props.category.channels.map((ch): [string, SidebarChannelData] => [
				ch.rkey,
				ch,
			]),
			...(props.injectedChannels ?? []).map(
				(ch): [string, SidebarChannelData] => [ch.rkey, ch],
			),
		]);
		return order
			.map((id) => channelMap.get(id))
			.filter((ch): ch is SidebarChannelData => ch !== undefined);
	});

	const [, { onDragStart: onDndDragStart, onDragEnd: onDndDragEnd }] =
		useDragDropContext()!;

	let channelWasHere = false;
	onDndDragStart(({ draggable }) => {
		channelWasHere = props.channelOrder.includes(String(draggable.id));
	});

	onDndDragEnd(({ draggable, droppable }) => {
		if (!channelWasHere) return;
		if (!draggable || !droppable) return;

		const order = props.channelOrder;
		const from = order.indexOf(String(draggable.id));
		if (from === -1) return;

		const to = order.indexOf(String(droppable.id));
		if (to === -1 || from === to) return;

		const newOrder = order.slice();
		newOrder.splice(to, 0, ...newOrder.splice(from, 1));
		props.onChannelReorder(props.category.rkey, newOrder);
	});

	return (
		<div class="flex flex-col py-3">
			<button
				type="button"
				class="group/category flex flex-row justify-between items-center px-4 pb-2 pl-4.5 text-muted-foreground hover:text-foreground text-sm"
				style={{
					cursor:
						props.community.owner_did === globalData.user.sub
							? props.activeDraggable
								? "grabbing"
								: "grab"
							: "pointer",
				}}
			>
				<div
					class="flex flex-row items-center gap-2.5 cursor-pointer"
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
				<div class="flex flex-row items-center gap-1">
					<Show when={props.community.owner_did === globalData.user.sub}>
						<CategorySettingsModal category={props.category}>
							<Button
								size="sm"
								class="opacity-0 group-hover/category:opacity-100 w-5 h-5 cursor-pointer"
								variant="ghost"
							>
								<Gear size={16} />
							</Button>
						</CategorySettingsModal>
						<ChannelCreationModal
							category={props.category.rkey}
							community={props.community.rkey}
						>
							<Button size="sm" class="w-5 h-5 cursor-pointer" variant="ghost">
								<PlusSmall />
							</Button>
						</ChannelCreationModal>
					</Show>
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
									<div class="bg-primary mx-1 rounded h-0.5" />
								</Show>
								<SortableChannel
									channel={channel}
									community={props.community}
								/>
							</>
						)}
					</For>
					<Show
						when={props.dropTarget && props.dropTarget.insertBeforeId === null}
					>
						<div class="bg-primary mx-1 rounded h-0.5" />
					</Show>
				</SortableProvider>
				<Show when={orderedChannels().length === 0 && !props.dropTarget}>
					<span class="ml-8 text-muted-foreground text-xs">
						This category is empty.
					</span>
				</Show>
			</div>
		</div>
	);
};
