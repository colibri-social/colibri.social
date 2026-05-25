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
import type { Channel } from "../../../atproto/xrpc/social/colibri/community/listChannels";
import type { Category as CategoryType } from "../../../atproto/xrpc/social/colibri/community/listCategories";
import { Button } from "../../ui/Button";
import CaretRightIcon from "~icons/ph/caret-right";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import GearIcon from "~icons/ph/gear";
import PlusIcon from "~icons/ph/plus";
import SpeakerHighIcon from "~icons/ph/speaker-high-fill";
import SpeakerLowIcon from "~icons/ph/speaker-low-fill";

// TODO: Re-introduce these once their backing endpoints/modals exist again in
// the client package.
// import { CategorySettingsModal } from "./CategorySettingsModal";
// import { ChannelCreationModal } from "./ChannelCreationModal";
// import { ChannelSettingsModal } from "./ChannelSettingsModal";
// import { useVoiceChatContext } from "../../../contexts/VoiceChat";

export type ChannelDropTarget = {
	categoryUri: string;
	insertBeforeUri: string | null;
};

/**
 * A category-augmented Channel list element: the original Astro code passed
 * `SidebarCategoryData` (a Category with its channels already nested). We
 * keep the same shape here so the rest of the ported sidebar logic stays
 * close to the original.
 */
export type CategoryWithChannels = CategoryType & {
	channels: Channel[];
};

const SortableChannel: Component<{
	channel: Channel;
	communityUri: string;
}> = (props) => {
	const params = useParams();
	const sortable = createSortable(props.channel.uri);
	const [, { onDragStart: onDndDragStart, onDragEnd: onDndDragEnd }] =
		useDragDropContext()!;

	// TODO: Replace with a real permission check once role helpers exist.
	// Previously: `globalData.user.sub === props.community.owner_did`.
	const canManage = () => true;

	const [isDragging, setIsDragging] = createSignal(false);

	onDndDragStart(({ draggable }) => {
		if (!canManage()) return;
		if (String(draggable.id) === props.channel.uri) setIsDragging(true);
	});

	onDndDragEnd(() => {
		if (!canManage()) return;
		setTimeout(() => setIsDragging(false), 0);
	});

	// TODO: Re-wire voice channel member list once the VoiceChat context lands.
	// const [voiceData, { connect }] = useVoiceChatContext();
	// const liveVoiceChannelMembers = createMemo<Array<string>>(() => { ... });
	// const handleVoiceChannelJoin = (e: MouseEvent & ...) => { ... };

	const channelRkey = () => props.channel.uri.split("/").pop() ?? "";

	return (
		<div
			ref={canManage() ? sortable.ref : undefined}
			style={{
				"touch-action": "none",
				transform: sortable.transform
					? `translate(${sortable.transform.x}px, ${sortable.transform.y}px)`
					: undefined,
				transition: sortable.isActiveDraggable
					? "none"
					: "transform 150ms ease",
			}}
			classList={{
				"opacity-50": sortable.isActiveDraggable && canManage(),
			}}
			{...sortable.dragActivators}
		>
			<div
				class="flex flex-col gap-1"
				style={{ "pointer-events": isDragging() ? "none" : undefined }}
				draggable={false}
			>
				<A
					class="group/channel text-muted-foreground flex flex-row justify-between items-center gap-2 hover:bg-card rounded-sm cursor-pointer p-1 py-0.5 pr-1.25"
					href={`/app/c/${params.community}/${props.channel.type.slice(0, 1)}/${channelRkey()}`}
					activeClass="bg-muted! text-foreground!"
					// TODO: re-add active-voice gradient once voice chat is wired up.
					// classList={{
					// 	"bg-linear-145 from-[#090615] via-[#31226d70] to-[#e0deec30]":
					// 		voiceData.connection.rkey === channelRkey() &&
					// 		voiceData.connection.state === ConnectionState.Connected,
					// }}
				>
					<div class="flex flex-row items-center gap-2">
						<Switch>
							<Match
								when={
									props.channel.type === "text" ||
									props.channel.type === "social.colibri.channel.text"
								}
							>
								<ChatCircleDotsIcon width={20} height={20} />
							</Match>
							<Match
								when={
									props.channel.type === "voice" ||
									props.channel.type === "social.colibri.channel.voice"
								}
							>
								{/* TODO: swap between speaker-low / speaker-high based on
								    connection state once voice context exists. */}
								<SpeakerLowIcon width={20} height={20} />
							</Match>
						</Switch>
						<span>{props.channel.name}</span>
					</div>
					<div class="flex justify-center items-center pb-px">
						{/* TODO: Re-introduce ChannelSettingsModal (gated on canManage())
						    once it's ported. Original:
						<Show when={canManage()}>
							<ChannelSettingsModal class="p-0 w-5 h-5.5" channel={props.channel}>
								<Button
									size="sm"
									class="opacity-0 group-hover/channel:opacity-100 p-0 w-5 h-5 cursor-pointer channel-settings"
									classList={{ "opacity-100!": params.channel === channelRkey() }}
									variant="ghost"
									onClick={(e) => e.preventDefault()}
								>
									<GearIcon width={16} height={16} />
								</Button>
							</ChannelSettingsModal>
						</Show> */}
					</div>
				</A>
				{/* TODO: Live voice members display from old code:
				<Show
					when={props.channel.type === "voice" && liveVoiceChannelMembers().length > 0}
				>
					<div class="pl-7.5 text-muted-foreground flex flex-col select-none">
						<For each={liveVoiceChannelMembers()}>
							{(did) => ( ... )}
						</For>
					</div>
				</Show> */}
			</div>
		</div>
	);
};

/**
 * Builds the display order for channels: channels present in
 * `channelOrder` come first (in that order), then any extras not listed.
 */
export function buildChannelOrder(category: CategoryWithChannels): string[] {
	const order = category.channelOrder ?? [];
	const channelUris = new Set(category.channels.map((ch) => ch.uri));
	const ordered = order.filter((id) => channelUris.has(id));
	const extras = category.channels
		.filter((ch) => !order.includes(ch.uri))
		.map((ch) => ch.uri);
	return [...ordered, ...extras];
}

/**
 * A single category on the sidebar.
 */
export const Category: ParentComponent<{
	category: CategoryWithChannels;
	communityUri: string;
	activeDraggable: boolean;
	channelOrder: string[];
	onChannelReorder: (categoryUri: string, newOrder: string[]) => void;
	injectedChannels?: Channel[];
	dropTarget?: ChannelDropTarget | null;
}> = (props) => {
	// TODO: Replace with a real permission check once role helpers exist.
	const canManage = () => true;

	// TODO: Persist collapse state to local storage (was `makePersisted` from
	// `@solid-primitives/storage` keyed on the category rkey). Skipped here
	// because the dependency isn't installed in the client package yet.
	const [open, setOpen] = createSignal(true);

	const orderedChannels = createMemo((): Channel[] => {
		const order = props.channelOrder;
		const channelMap = new Map<string, Channel>([
			...props.category.channels.map((ch): [string, Channel] => [ch.uri, ch]),
			...(props.injectedChannels ?? []).map((ch): [string, Channel] => [
				ch.uri,
				ch,
			]),
		]);
		return order
			.map((id) => channelMap.get(id))
			.filter((ch): ch is Channel => ch !== undefined);
	});

	const [, { onDragStart: onDndDragStart, onDragEnd: onDndDragEnd }] =
		useDragDropContext()!;

	let channelWasHere = false;
	onDndDragStart(({ draggable }) => {
		if (!canManage()) return;
		channelWasHere = props.channelOrder.includes(String(draggable.id));
	});

	onDndDragEnd(({ draggable, droppable }) => {
		if (!channelWasHere) return;
		if (!draggable || !droppable) return;
		if (!canManage()) return;

		const order = props.channelOrder;
		const from = order.indexOf(String(draggable.id));
		if (from === -1) return;

		const to = order.indexOf(String(droppable.id));
		if (to === -1 || from === to) return;

		const newOrder = order.slice();
		newOrder.splice(to, 0, ...newOrder.splice(from, 1));
		props.onChannelReorder(props.category.uri, newOrder);
	});

	return (
		<div class="flex flex-col py-3">
			<button
				type="button"
				class="group/category flex flex-row justify-between items-center px-4 pb-2 pl-4.5 text-muted-foreground hover:text-foreground text-sm"
				style={{
					cursor: canManage()
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
							<CaretRightIcon class="rotate-90" />
						</Match>
						<Match when={!open()}>
							<CaretRightIcon class="rotate-0" />
						</Match>
					</Switch>
					<span>{props.category.name}</span>
				</div>
				<div class="flex flex-row items-center gap-1">
					{/* TODO: Re-introduce CategorySettingsModal + ChannelCreationModal
					    (gated on canManage()) once they are ported. Original:
					<Show when={canManage()}>
						<CategorySettingsModal category={props.category}>
							<Button
								size="sm"
								class="opacity-0 group-hover/category:opacity-100 w-5 h-5 cursor-pointer"
								variant="ghost"
							>
								<GearIcon width={16} height={16} />
							</Button>
						</CategorySettingsModal>
						<ChannelCreationModal category={props.category.uri} community={props.communityUri}>
							<Button size="sm" class="w-5 h-5 cursor-pointer" variant="ghost">
								<PlusIcon width={16} height={16} />
							</Button>
						</ChannelCreationModal>
					</Show> */}
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
								<Show when={props.dropTarget?.insertBeforeUri === channel.uri}>
									<div class="bg-primary mx-1 rounded h-0.5" />
								</Show>
								<SortableChannel
									channel={channel}
									communityUri={props.communityUri}
								/>
							</>
						)}
					</For>
					<Show
						when={props.dropTarget && props.dropTarget.insertBeforeUri === null}
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
