import { A, useParams } from "@solidjs/router";
import {
	createSortable,
	SortableProvider,
	useDragDropContext,
} from "@thisbeyond/solid-dnd";
import {
	type Component,
	createEffect,
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
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useMutes } from "../../../contexts/Mutes";
import { useNotifications } from "../../../contexts/Notifications";
import { useUserContext } from "../../../contexts/User";
import {
	ConnectionState,
	useVoiceChatContext,
} from "../../../contexts/VoiceChat";
import { useIsMobile } from "../../../utils/mobile-pane";
import { Ear } from "../../icons/Ear";
import { Microphone } from "../../icons/Microphone";
import { Button } from "../../ui/Button";
import User from "../user";
import { CategoryContextMenu } from "./CategoryContextMenu";
import { ChannelContextMenu } from "./ChannelContextMenu";
import { MemberContextMenu } from "./MemberContextMenu";

export type ChannelDropTarget = {
	categoryUri: string;
	insertBeforeUri: string | null;
};

const collapseKey = (uri: string) => `colibri:category-collapsed:${uri}`;

const loadCollapsed = (uri: string): boolean => {
	try {
		return localStorage.getItem(collapseKey(uri)) === "1";
	} catch {
		return false;
	}
};

const saveCollapsed = (uri: string, collapsed: boolean) => {
	try {
		if (collapsed) localStorage.setItem(collapseKey(uri), "1");
		else localStorage.removeItem(collapseKey(uri));
	} catch {}
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
	const isMobile = useIsMobile();

	const notifications = useNotifications();
	const pingCount = () => notifications.pingsForChannel(props.channel.uri);
	const hasUnreadMessages = () =>
		notifications.hasUnreadMessages(props.channel.uri);
	const isUnread = () => pingCount() > 0 || hasUnreadMessages();

	const mutes = useMutes();
	const isActive = () => params.channel === ChannelRkey();
	const isMuted = () => mutes.isChannelMuted(props.channel.uri) && !isActive();

	const [isDragging, setIsDragging] = createSignal(false);
	let didDrag = false;

	onDndDragStart(({ draggable }) => {
		if (!canManage()) return;
		if (String(draggable.id) === props.channel.uri) {
			didDrag = false;
			setIsDragging(true);
		}
	});

	onDndDragEnd(() => {
		if (!canManage()) return;
		setTimeout(() => {
			setIsDragging(false);
			didDrag = false;
		}, 0);
	});

	createEffect(() => {
		if (!isDragging()) return;
		const transform = sortable.transform;
		if (!transform) return;
		if (Math.abs(transform.x) > 4 || Math.abs(transform.y) > 4) didDrag = true;
	});

	const community = useCommunityContext();
	const [voiceData, { connect }] = useVoiceChatContext();

	const ChannelUri = () => props.channel.uri;
	const ChannelRkey = () => props.channel.uri.split("/").pop();

	const liveVoiceChannelMembers = createMemo<string[]>(
		() => voiceData.presence[ChannelUri()] ?? [],
	);

	const isVoiceChannel = () =>
		props.channel.type === "voice" ||
		props.channel.type === "social.colibri.channel.voice";

	const isConnectedHere = () =>
		voiceData.connection.uri === ChannelUri() &&
		voiceData.connection.state === ConnectionState.Connected;

	const handleChannelClick = (e: MouseEvent) => {
		if (didDrag) {
			e.preventDefault();
			return;
		}
		if (isVoiceChannel() && !isConnectedHere()) {
			e.preventDefault();
			connect(ChannelUri(), {
				channelName: props.channel.name,
				communityName: community().community.name,
				hubDid: community().community.appview,
			});
		}
	};

	const channelRoutePrefix = () => {
		return props.channel.type;
	};

	return (
		<div
			ref={sortable.ref}
			style={{
				"touch-action": "pan-y",
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
			{...(canManage() ? sortable.dragActivators : {})}
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
						onClick={handleChannelClick}
						draggable={false}
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
											voiceData.connection.state === ConnectionState.Connected
										}
										fallback={<SpeakerLowIcon width={20} height={20} />}
									>
										<SpeakerHighIcon
											width={20}
											height={20}
											class="text-primary"
										/>
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
							<Show when={canManage() && !isMobile()}>
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
					<div class="pl-6 text-muted-foreground flex flex-col gap-0.5 select-none text-xs">
						<For each={liveVoiceChannelMembers()}>
							{(did) => {
								const member = () =>
									community().members.find((m) => m.did === did);
								const isSpeaking = () => voiceData.activeSpeakers.includes(did);
								return (
									<Show
										when={member()}
										fallback={<span class="truncate px-1 py-1">{did}</span>}
									>
										<MemberContextMenu member={member()!}>
											<User.ProfilePopover
												user={member()!}
												class="flex items-center gap-2 hover:bg-card rounded-sm p-1 cursor-pointer"
											>
												<div
													class="rounded-full transition-shadow"
													classList={{
														"ring-2 ring-primary": isSpeaking(),
													}}
												>
													<User.Avatar
														user={member()!}
														size="small"
														disableState={true}
													/>
												</div>
												<span class="truncate flex-1 text-sm">
													<User.DisplayableName
														color={false}
														user={member()!}
													/>
												</span>
												<span class="flex items-center gap-1 [&_svg]:w-3.5 [&_svg]:h-3.5 [&_svg]:shrink-0 [&_svg]:text-red-400">
													<Show
														when={
															voiceData.memberStates[did]?.muted &&
															!voiceData.memberStates[did]?.deafened
														}
													>
														<Microphone enabled={false} />
													</Show>
													<Show when={voiceData.memberStates[did]?.deafened}>
														<Ear enabled={true} />
													</Show>
												</span>
											</User.ProfilePopover>
										</MemberContextMenu>
									</Show>
								);
							}}
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
	onOpenChannelCreation: (categoryUri: string) => void;
}> = (props) => {
	const user = useUserContext();
	const notifications = useNotifications();
	const {
		canUpdateCategory: _canUpdateCategory,
		canUpdateChannel: _canUpdateChannel,
		canCreateChannel: _canCreateChannel,
	} = usePermissions();
	const canUpdateCategory = () => _canUpdateCategory(user.did);
	const canUpdateChannel = () => _canUpdateChannel(user.did);
	const canCreateChannel = () => _canCreateChannel(user.did);
	const isMobile = useIsMobile();

	const markAllRead = () =>
		void notifications.markCategoryAsRead(
			props.communityUri,
			props.category.channels
				.filter(
					(ch) =>
						ch.type !== "voice" && ch.type !== "social.colibri.channel.voice",
				)
				.map((ch) => ch.uri),
		);

	const [open, setOpen] = createSignal(!loadCollapsed(props.category.uri));
	createEffect(() => saveCollapsed(props.category.uri, !open()));

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
		channelWasHere =
			canUpdateChannel() && props.channelOrder.includes(String(draggable.id));
	});

	onDndDragEnd(({ draggable, droppable }) => {
		if (!channelWasHere) return;
		channelWasHere = false;
		if (!draggable || !droppable) return;
		if (!canUpdateChannel()) return;

		const order = props.channelOrder;
		const from = order.indexOf(String(draggable.id));
		if (from === -1) return;

		const droppableId = String(droppable.id);
		const to =
			droppableId === props.category.uri
				? order.length - 1
				: order.indexOf(droppableId);
		if (to === -1 || from === to) return;

		const newOrder = order.slice();
		newOrder.splice(to, 0, ...newOrder.splice(from, 1));
		props.onChannelReorder(props.category.uri, newOrder);
	});

	return (
		<div class="flex flex-col py-3">
			<CategoryContextMenu
				categoryName={props.category.name}
				canEdit={canUpdateCategory()}
				onEdit={() => props.onOpenCategorySettings(props.category.uri)}
				onMarkAllRead={markAllRead}
			>
				<button
					type="button"
					class="group/category flex flex-row justify-between w-full items-center px-4 pb-2 pl-4.5 text-muted-foreground hover:text-foreground text-sm"
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
					<div class="flex flex-row items-center gap-1 h-5">
						<Show when={canUpdateCategory() && !isMobile()}>
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
							<Button
								size="sm"
								class="w-5 h-5 cursor-pointer"
								variant="ghost"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									props.onOpenChannelCreation(props.category.uri);
								}}
							>
								<PlusIcon width={16} height={16} />
							</Button>
						</Show>
					</div>
				</button>
			</CategoryContextMenu>
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
