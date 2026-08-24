import { A, useNavigate, useParams } from "@solidjs/router";
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
import BellSlashIcon from "~icons/ph/bell-slash";
import CaretRightIcon from "~icons/ph/caret-right";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import GearIcon from "~icons/ph/gear";
import LockSimpleFillIcon from "~icons/ph/lock-simple-fill";
import PlusIcon from "~icons/ph/plus";
import SpeakerHighIcon from "~icons/ph/speaker-high-fill";
import SpeakerLowIcon from "~icons/ph/speaker-low-fill";
import { buildChannelPath } from "../../../atproto/colibri-channel-url";
import { SPACE_TYPES } from "../../../atproto/lexicons";
import { spaceSkey } from "../../../atproto/space-ref";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import type {
	Category as CategoryType,
	Channel,
} from "../../../contexts/community-payload";
import { useMutes } from "../../../contexts/Mutes";
import { useNotifications } from "../../../contexts/Notifications";
import { useUserContext } from "../../../contexts/User";
import {
	ConnectionState,
	useVoiceChatContext,
} from "../../../contexts/VoiceChat";
import { openChannel, useIsMobile } from "../../../utils/mobile-pane";
import { Ear } from "../../icons/Ear";
import { Microphone } from "../../icons/Microphone";
import { Button } from "../../ui/Button";
import User from "../user";
import { CategoryContextMenu } from "./CategoryContextMenu";
import { ChannelContextMenu } from "./ChannelContextMenu";
import { MemberContextMenu } from "./MemberContextMenu";

export type ChannelDropTarget = {
	categoryRkey: string;
	insertBeforeSpace: string | null;
};

const collapseKey = (rkey: string) => `colibri:category-collapsed:${rkey}`;

const loadCollapsed = (rkey: string): boolean => {
	try {
		return localStorage.getItem(collapseKey(rkey)) === "1";
	} catch {
		return false;
	}
};

const saveCollapsed = (rkey: string, collapsed: boolean) => {
	try {
		if (collapsed) localStorage.setItem(collapseKey(rkey), "1");
		else localStorage.removeItem(collapseKey(rkey));
	} catch {}
};

export type CategoryWithChannels = CategoryType;

const SortableChannel: Component<{
	channel: Channel;
	communityDid: string;
	onOpenSettings: () => void;
}> = (props) => {
	const params = useParams();
	const navigate = useNavigate();
	const sortable = createSortable(props.channel.space);
	const [, { onDragStart: onDndDragStart, onDragEnd: onDndDragEnd }] =
		useDragDropContext()!;

	const user = useUserContext();
	const { canUpdateChannel: _canUpdateChannel } = usePermissions();
	const canManage = () => _canUpdateChannel(user.did);
	const isMobile = useIsMobile();

	const notifications = useNotifications();
	const pingCount = () => notifications.pingsForChannel(props.channel.space);
	const hasUnreadMessages = () =>
		notifications.hasUnreadMessages(props.channel.space);
	const isUnread = () => pingCount() > 0 || hasUnreadMessages();

	const canRead = () => props.channel.viewer.canRead;

	const mutes = useMutes();
	const isActive = () => params.channel === ChannelRkey();
	const isMuted = () =>
		mutes.isChannelMuted(props.channel.space) && !isActive();

	const [isDragging, setIsDragging] = createSignal(false);
	let didDrag = false;

	onDndDragStart(({ draggable }) => {
		if (!canManage()) return;
		if (String(draggable.id) === props.channel.space) {
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

	const ChannelSpace = () => props.channel.space;
	const ChannelRkey = () => spaceSkey(props.channel.space);

	const liveVoiceChannelMembers = createMemo<string[]>(
		() => voiceData.presence[ChannelSpace()] ?? [],
	);

	const isVoiceChannel = () => props.channel.type === SPACE_TYPES.channelVoice;

	const isConnectedHere = () =>
		voiceData.connection.uri === ChannelSpace() &&
		voiceData.connection.state === ConnectionState.Connected;

	const handleChannelClick = (e: MouseEvent) => {
		if (!canRead()) {
			e.preventDefault();
			return;
		}
		if (didDrag) {
			e.preventDefault();
			return;
		}
		if (isVoiceChannel() && !isConnectedHere()) {
			e.preventDefault();
			connect(ChannelSpace(), {
				channelName: props.channel.name,
				communityName: community().community.name,
				managingApp: community().community.managingApp,
			});
			return;
		}
		if (isMobile()) {
			e.preventDefault();
			openChannel(navigate, channelHref());
		}
	};

	const channelHref = () => buildChannelPath(props.channel.space) ?? "#";

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
						href={channelHref()}
						onClick={handleChannelClick}
						draggable={false}
						activeClass="bg-muted! text-foreground!"
						classList={{
							"bg-linear-145 from-primary/10 via-primary/25 to-foreground/10":
								voiceData.connection.uri === ChannelSpace() &&
								voiceData.connection.state === ConnectionState.Connected,
							"opacity-45 hover:opacity-100": !canRead(),
							"opacity-70": canRead() && isMuted(),
						}}
					>
						<div class="flex flex-row items-center gap-2">
							<Switch>
								<Match when={props.channel.type === SPACE_TYPES.channelText}>
									<ChatCircleDotsIcon width={20} height={20} />
								</Match>
								<Match when={isVoiceChannel()}>
									<Show
										when={
											voiceData.connection.uri === ChannelSpace() &&
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
							<Show when={props.channel.private}>
								<LockSimpleFillIcon
									width={12}
									height={12}
									class="text-muted-foreground shrink-0"
								/>
							</Show>
							<Show when={canRead() && isMuted()}>
								<BellSlashIcon
									width={12}
									height={12}
									class="text-muted-foreground shrink-0"
								/>
							</Show>
						</div>
						<div class="flex justify-center items-center gap-1.5 pb-px">
							<Show
								when={pingCount() > 0}
								fallback={
									<Show when={hasUnreadMessages()}>
										<span class="w-2 h-2 rounded-full bg-foreground pointer-events-none select-none" />
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
										"opacity-100!": params.channel === ChannelRkey(),
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
				<Show when={isVoiceChannel() && liveVoiceChannelMembers().length > 0}>
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
												user={member()!.actor}
												nickname={member()!.nickname}
												class="flex items-center gap-2 hover:bg-card rounded-sm p-1 cursor-pointer"
											>
												<div
													class="rounded-full transition-shadow"
													classList={{
														"ring-2 ring-primary": isSpeaking(),
													}}
												>
													<User.Avatar
														user={member()!.actor}
														nickname={member()!.nickname}
														size="small"
														disableState={true}
													/>
												</div>
												<span class="truncate flex-1 text-sm">
													<User.DisplayableName
														color={false}
														user={member()!.actor}
														nickname={member()!.nickname}
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

export function buildChannelOrder(category: CategoryWithChannels): string[] {
	return category.channels.map((channel) => channel.space);
}

export const Category: ParentComponent<{
	category: CategoryWithChannels;
	communityDid: string;
	activeDraggable: boolean;
	channelOrder: string[];
	onChannelReorder: (categoryRkey: string, newOrder: string[]) => void;
	injectedChannels?: Channel[];
	dropTarget?: ChannelDropTarget | null;
	onOpenChannelSettings: (channelSpace: string) => void;
	onOpenCategorySettings: (categoryRkey: string) => void;
	onOpenChannelCreation: (categoryRkey: string) => void;
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
			props.communityDid,
			props.category.channels
				.filter((ch) => ch.type !== SPACE_TYPES.channelVoice)
				.map((ch) => ch.space),
		);

	const [open, setOpen] = createSignal(!loadCollapsed(props.category.rkey));
	createEffect(() => saveCollapsed(props.category.rkey, !open()));

	const orderedChannels = createMemo((): Channel[] => {
		const order = props.channelOrder;
		const channelMap = new Map<string, Channel>([
			...props.category.channels.map((ch): [string, Channel] => [ch.space, ch]),
			...(props.injectedChannels ?? []).map((ch): [string, Channel] => [
				ch.space,
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
			droppableId === props.category.rkey
				? order.length - 1
				: order.indexOf(droppableId);
		if (to === -1 || from === to) return;

		const newOrder = order.slice();
		newOrder.splice(to, 0, ...newOrder.splice(from, 1));
		props.onChannelReorder(props.category.rkey, newOrder);
	});

	return (
		<div class="flex flex-col py-3">
			<CategoryContextMenu
				categoryName={props.category.name}
				canEdit={canUpdateCategory()}
				onEdit={() => props.onOpenCategorySettings(props.category.rkey)}
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
									props.onOpenCategorySettings(props.category.rkey);
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
									props.onOpenChannelCreation(props.category.rkey);
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
								<Show
									when={props.dropTarget?.insertBeforeSpace === channel.space}
								>
									<div class="bg-primary mx-1 rounded h-0.5" />
								</Show>
								<SortableChannel
									channel={channel}
									communityDid={props.communityDid}
									onOpenSettings={() =>
										props.onOpenChannelSettings(channel.space)
									}
								/>
							</>
						)}
					</For>
					<Show
						when={
							props.dropTarget && props.dropTarget.insertBeforeSpace === null
						}
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
