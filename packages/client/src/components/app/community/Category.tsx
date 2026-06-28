import { A, useParams } from "@solidjs/router";
import {
	createSortable,
	SortableProvider,
	useDragDropContext,
} from "@thisbeyond/solid-dnd";
import { ConnectionState } from "livekit-client";
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
import CaretRightIcon from "~icons/ph/caret-right";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import GearIcon from "~icons/ph/gear";
import PlusIcon from "~icons/ph/plus";
import SpeakerHighIcon from "~icons/ph/speaker-high-fill";
import SpeakerLowIcon from "~icons/ph/speaker-low-fill";
import type { Category as CategoryType } from "../../../atproto/xrpc/social/colibri/community/listCategories";
import type { Channel } from "../../../atproto/xrpc/social/colibri/community/listChannels";
import { usePermissions } from "../../../contexts/Community";
import { useMutes } from "../../../contexts/Mutes";
import { useNotifications } from "../../../contexts/Notifications";
import { useUserContext } from "../../../contexts/User";
import { useVoiceChatContext } from "../../../contexts/VoiceChat";
import { Button } from "../../ui/Button";
import { ChannelContextMenu } from "./ChannelContextMenu";
import { ChannelCreationModal } from "./ChannelCreationModal";

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
	onOpenSettings: () => void;
}> = (props) => {
	const params = useParams();
	const sortable = createSortable(props.channel.uri);
	const [, { onDragStart: onDndDragStart, onDragEnd: onDndDragEnd }] =
		useDragDropContext()!;

	const user = useUserContext();
	const { canUpdateChannel: _canUpdateChannel } = usePermissions();
	const canManage = () => _canUpdateChannel(user.did);

	const notifications = useNotifications();
	const pingCount = () => notifications.pingsForChannel(props.channel.uri);
	const hasUnreadMessages = () =>
		notifications.hasUnreadMessages(props.channel.uri);
	const isUnread = () => pingCount() > 0 || hasUnreadMessages();

	const mutes = useMutes();
	const isActive = () => params.channel === ChannelRkey();
	const isMuted = () => mutes.isChannelMuted(props.channel.uri) && !isActive();

	const [isDragging, setIsDragging] = createSignal(false);

	onDndDragStart(({ draggable }) => {
		if (!canManage()) return;
		if (String(draggable.id) === props.channel.uri) setIsDragging(true);
	});

	onDndDragEnd(() => {
		if (!canManage()) return;
		setTimeout(() => setIsDragging(false), 0);
	});

	const [voiceData, { connect }] = useVoiceChatContext();

	const ChannelUri = () => props.channel.uri;
	const ChannelRkey = () => props.channel.uri.split("/").pop();

	const liveVoiceChannelMembers = createMemo<string[]>(() => {
		if (voiceData.connection.state !== ConnectionState.Connected) return [];
		if (voiceData.connection.uri !== ChannelUri()) return [];
		return voiceData.participants;
	});

	const _handleVoiceChannelJoin = () => {
		if (props.channel.type !== "social.colibri.channel.voice") return;
		connect(ChannelUri());
	};

	const channelRoutePrefix = () => {
		return props.channel.type;
	};

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
				<ChannelContextMenu
					channel={props.channel}
					onOpenSettings={props.onOpenSettings}
				>
					<A
						class="group/channel text-muted-foreground flex flex-row justify-between items-center gap-2 hover:bg-card rounded-sm cursor-pointer p-1 py-0.5 pr-1.25"
						href={`/app/c/${params.community}/${channelRoutePrefix()}/${ChannelRkey()}`}
						activeClass="bg-muted! text-foreground!"
						classList={{
							"bg-linear-145 from-[#090615] via-[#31226d70] to-[#e0deec30]":
								voiceData.connection.uri === ChannelUri() &&
								voiceData.connection.state === ConnectionState.Connected,
							"opacity-45 hover:opacity-100": isMuted(),
						}}
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
									<Show
										when={
											voiceData.connection.uri === ChannelUri() &&
											voiceData.connection.state ===
												ConnectionState.Connected &&
											voiceData.states.micEnabled
										}
										fallback={<SpeakerLowIcon width={20} height={20} />}
									>
										<SpeakerHighIcon width={20} height={20} />
									</Show>
								</Match>
							</Switch>
							<span classList={{ "font-semibold text-foreground": isUnread() }}>
								{props.channel.name}
							</span>
						</div>
						<div class="flex justify-center items-center gap-1.5 pb-px">
							<Show
								when={pingCount() > 0}
								fallback={
									<Show when={hasUnreadMessages()}>
										<span class="w-2 h-2 rounded-full bg-white pointer-events-none select-none" />
									</Show>
								}
							>
								<span class="min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none select-none">
									{pingCount() > 9 ? "9+" : pingCount()}
								</span>
							</Show>
							<Show when={canManage()}>
								<Button
									size="sm"
									class="opacity-0 group-hover/channel:opacity-100 p-0 w-5 h-5 cursor-pointer channel-settings"
									classList={{
										"opacity-100!": params.channel === ChannelUri(),
									}}
									variant="ghost"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										props.onOpenSettings();
									}}
								>
									<GearIcon width={16} height={16} />
								</Button>
							</Show>
						</div>
					</A>
				</ChannelContextMenu>
				<Show
					when={
						(props.channel.type === "voice" ||
							props.channel.type === "social.colibri.channel.voice") &&
						liveVoiceChannelMembers().length > 0
					}
				>
					<div class="pl-7.5 text-muted-foreground flex flex-col select-none text-xs">
						<For each={liveVoiceChannelMembers()}>
							{(did) => <span class="truncate">{did}</span>}
						</For>
					</div>
				</Show>
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
	onOpenChannelSettings: (channelUri: string) => void;
	onOpenCategorySettings: (categoryUri: string) => void;
}> = (props) => {
	const user = useUserContext();
	const {
		canUpdateCategory: _canUpdateCategory,
		canCreateChannel: _canCreateChannel,
	} = usePermissions();
	const canUpdateCategory = () => _canUpdateCategory(user.did);
	const canCreateChannel = () => _canCreateChannel(user.did);

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
		if (!canUpdateCategory()) return;
		channelWasHere = props.channelOrder.includes(String(draggable.id));
	});

	onDndDragEnd(({ draggable, droppable }) => {
		if (!channelWasHere) return;
		if (!draggable || !droppable) return;
		if (!canUpdateCategory()) return;

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
					cursor: canUpdateCategory()
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
					<Show when={canUpdateCategory()}>
						<Button
							size="sm"
							class="opacity-0 group-hover/category:opacity-100 w-5 h-5 cursor-pointer"
							variant="ghost"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								props.onOpenCategorySettings(props.category.uri);
							}}
						>
							<GearIcon width={16} height={16} />
						</Button>
					</Show>
					<Show when={canCreateChannel()}>
						<ChannelCreationModal
							category={props.category.uri}
							community={props.communityUri}
						>
							<Button size="sm" class="w-5 h-5 cursor-pointer" variant="ghost">
								<PlusIcon width={16} height={16} />
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
								<Show when={props.dropTarget?.insertBeforeUri === channel.uri}>
									<div class="bg-primary mx-1 rounded h-0.5" />
								</Show>
								<SortableChannel
									channel={channel}
									communityUri={props.communityUri}
									onOpenSettings={() =>
										props.onOpenChannelSettings(channel.uri)
									}
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
