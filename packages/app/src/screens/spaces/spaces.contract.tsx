import { ColibriError } from "@colibri-social/lib";
import {
	afterSpaceRailMotion,
	Button,
	CategoryContextMenu,
	CategoryDrawer,
	ChannelContextMenu,
	ChannelDrawer,
	ChannelList,
	type ChannelListCategory,
	ChannelListHeader,
	type ChannelListItemState,
	type ChannelPlatform,
	ChannelRow,
	ChannelThreadRow,
	ChannelThreads,
	copyText,
	type DeveloperModeCardProps,
	SpaceContextMenu,
	SpaceDrawer,
	type SpaceMenuActions,
	SpaceRailItem,
	StatusScreen,
	toast,
	useHaptics,
	VoiceChannelContextMenu,
	VoiceChannelRow,
	type VoiceParticipant,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { VolumeSmallIcon } from "@solar-icons/solid/bold/volume-small";
import {
	batch,
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	onCleanup,
	Show,
} from "solid-js";
import { displayNameOf } from "../../data/adapters/authors";
import { summaryParts } from "../../data/channel-summary";
import { SPACE_ORDER_NOT_SAVED } from "../../data/error-copy";
import { channelSlug, isVoiceChannel, skeyOf, spaceKey } from "../../data/ids";
import { mutedTotals, spaceNotificationPrefs } from "../../data/notifications";
import { type SpaceData, useData } from "../../data/store";
import {
	type CategoryView,
	type ChannelView,
	type CommunityView,
	type Did,
	type SpaceRef,
	type ThreadView,
	VOICE_CHANNEL,
} from "../../data/types";
import { voice } from "../../data/voice";
import { openExternalUrl } from "../../native/open-external";
import { defineContract, slot } from "../../screen/define";
import { usePlatform } from "../../screen/platform";
import { lastViewedSpace } from "../../shell/cold-start";
import { useOptionalDesktopShell } from "../../shell/desktop/context";
import { DISCOVERY_ENABLED } from "../../shell/features";
import {
	channelPath,
	isChannelLayer,
	NEW_ENTRY,
	type ThreadLayer,
} from "../../shell/layers";
import { LoadErrorState } from "../../shell/load-error";
import { useStack } from "../../shell/stack";
import { newEntryId } from "../admin/channel/channel-target";
import { createInviteDrawer } from "../admin/invites/invite-drawer";
import { createLeaveSpace } from "../admin/overview/leave-space";
import { SPACE_PERMISSIONS } from "../admin/space-admin";
import { whenOverlaysClosed } from "../channel/forward/overlay-wait";
import { useMemberMenu } from "../members/member-menu";
import { useProfileSheet } from "../profile/profile-sheet";
import { createThreadMenu } from "../threads/thread-menu";
import { canJoinVoice, clickVoiceChannel } from "../voice/voice-click";
import { openVoicePrompt } from "../voice/voice-prompt";
import { createCategoryCollapse } from "./category-collapse";
import { createDeleteDialogs } from "./delete-dialogs";
import NotificationSettingsScreen from "./notification-settings/notification-settings.screen";
import { sidebarThreadsFor } from "./sidebar-threads";

export type SpacesArgs = { slug?: string };

const comingSoon = (label: string) => () =>
	toast.info(`${label} arrives in a later round`);

const SETTINGS_PERMISSIONS = Object.values(SPACE_PERMISSIONS);

export const pdslsUrl = (did: string) => `https://pdsls.dev/at://${did}`;

const spaceDeveloperCard = (did: string): DeveloperModeCardProps => ({
	copyLabel: "Copy DID",
	copyValue: did,
	pdslsHref: pdslsUrl(did),
});

export const spaces = defineContract({
	id: "spaces",
	model: (args: SpacesArgs) => {
		const data = useData();
		const stack = useStack();
		const platform = usePlatform();
		const desktopShell = useOptionalDesktopShell();
		const communities = () => data.communities.value() ?? [];
		const community = createMemo<CommunityView | undefined>(() => {
			const list = communities();
			if (args.slug) return data.spaceByKey(args.slug);
			return lastViewedSpace(data, list) ?? list[0];
		});
		const missing = () =>
			!!args.slug && !data.communities.loading() && !community();
		createEffect(() => {
			const current = community();
			if (current && !args.slug) {
				stack.setRoot({ tab: "spaces", space: spaceKey(current) });
			}
		});
		const space = createMemo<SpaceData | undefined>(() => {
			const current = community();
			return current ? data.space(current) : undefined;
		});
		const viewedThread = createMemo<ThreadLayer | undefined>((previous) => {
			if (platform() === "desktop") {
				const pane = stack.mounted().find((layer) => layer.kind === "thread");
				return pane?.kind === "thread" ? pane : undefined;
			}
			const top = stack.top();
			if (!isChannelLayer(top)) return previous;
			return top.kind === "thread" ? top : undefined;
		}, undefined);
		const viewedThreadHere = () => {
			const current = community();
			const viewed = viewedThread();
			return current && viewed?.space === spaceKey(current)
				? viewed
				: undefined;
		};
		const activeChannel = () => {
			const current = community();
			if (!current || viewedThreadHere()) return undefined;
			if (platform() === "desktop") {
				const chat = stack.mounted().find((layer) => layer.kind === "chat");
				return chat?.kind === "chat" && chat.space === spaceKey(current)
					? chat.channel
					: undefined;
			}
			return data.lastChannel(spaceKey(current));
		};
		const [pendingSpace, setPendingSpace] = createSignal<Did>();
		let cancelPendingSwitch: (() => void) | undefined;
		const cancelSwitch = () => {
			cancelPendingSwitch?.();
			cancelPendingSwitch = undefined;
		};
		onCleanup(cancelSwitch);
		const selectSpace = (target: CommunityView) => {
			cancelSwitch();
			setPendingSpace(target.did);
			cancelPendingSwitch = afterSpaceRailMotion(() => {
				cancelPendingSwitch = undefined;
				batch(() => {
					stack.setRoot({ tab: "spaces", space: spaceKey(target) });
					setPendingSpace(undefined);
				});
			});
		};
		const railSpace = () => pendingSpace() ?? community()?.did;
		const reorderSpaces = async (ids: string[]) => {
			const store = data.preferences;
			const previous = communities().map((entry) => entry.did);
			const order = ids as Did[];
			if (await store.setCommunityOrder(order)) return;
			const current = store.preferences();
			const unchanged =
				current.communityOrder.length === order.length &&
				current.communityOrder.every((did, index) => did === order[index]);
			if (unchanged) store.adopt({ ...current, communityOrder: previous });
			toast.error(SPACE_ORDER_NOT_SAVED.title, {
				description: SPACE_ORDER_NOT_SAVED.description,
			});
			throw new ColibriError({
				code: "Unexpected",
				message: "the Space order wasn't saved",
			});
		};
		const openChannel = (channel: ChannelView) => {
			const current = community();
			if (!current) return;
			if (isVoiceChannel(channel) && platform() !== "desktop") {
				openVoicePrompt({ space: spaceKey(current), channel: channel.space });
				return;
			}
			if (isVoiceChannel(channel)) {
				clickVoiceChannel({
					space: spaceKey(current),
					channel,
					stack,
					confirmJoin: data.controls().confirmVoiceJoin,
				});
				return;
			}
			stack.push({
				kind: "chat",
				channelType: isVoiceChannel(channel) ? VOICE_CHANNEL : channel.type,
				space: spaceKey(current),
				channel: channelSlug(channel),
			});
		};
		const profileSheet = useProfileSheet();
		const participants = (channel: ChannelView): VoiceParticipant[] =>
			voice.participants(channel.space);
		const memberMenu = useMemberMenu();
		const participantMenu = (did: string, row: JSX.Element) => {
			const current = community();
			return current
				? memberMenu.contextMenu(did, spaceKey(current), row, "contents")
				: row;
		};
		const openParticipantMenu = (did: string) => {
			const current = community();
			if (current) memberMenu.open(did, spaceKey(current));
		};
		const openParticipant = (did: string) => {
			const current = community();
			profileSheet.open(did, current ? spaceKey(current) : undefined);
		};
		const ownerHandle = () => {
			const current = space();
			const ownerRole = current?.roles.value()?.find((role) => role.protected);
			if (!current || !ownerRole) return undefined;
			return current.members
				.value()
				?.find((member) => member.roles.includes(ownerRole.rkey))?.actor.handle;
		};
		const authorName = (did: Did) => {
			if (did === data.viewer.did) return displayNameOf(data.viewer);
			const member = space()?.memberByDid(did);
			return member ? displayNameOf(member.actor, member) : "Someone";
		};
		const joinedVoice = (channel: ChannelView) =>
			voice.current()?.channel === channel.space;
		const collapse = createCategoryCollapse();
		const categories = createMemo((): ChannelListCategory<ChannelView>[] => {
			const did = community()?.did ?? "";
			return (space()?.categories.value() ?? []).map((category) => ({
				id: category.rkey,
				name: category.name,
				channels: category.channels,
				collapsed: collapse.collapsed(did, category.rkey),
			}));
		});
		const setCategoryCollapsed = (rkey: string, collapsed: boolean) => {
			const current = community();
			if (current) collapse.setCollapsed(current.did, rkey, collapsed);
		};
		const uncategorized = createMemo(() =>
			(space()?.channels.value() ?? []).filter((channel) => !channel.category),
		);
		const prefs = spaceNotificationPrefs(data);
		const spaceMuted = (target?: CommunityView) =>
			!!target && prefs.isMuted(target.did);
		const [notificationTarget, setNotificationTarget] =
			createSignal<CommunityView>();
		const [notificationOpen, setNotificationOpen] = createSignal(false);
		const openNotificationSettings = (target: CommunityView) => {
			setNotificationTarget(target);
			void whenOverlaysClosed().then(() => setNotificationOpen(true));
		};
		const activeThread = (channel: ChannelView) => {
			const viewed = viewedThreadHere();
			return viewed?.channel === channelSlug(channel)
				? viewed.thread
				: undefined;
		};
		const isActiveThread = (channel: ChannelView, thread: SpaceRef) => {
			const viewed = viewedThreadHere();
			return (
				viewed?.channel === channelSlug(channel) &&
				viewed.thread === skeyOf(thread)
			);
		};
		const sidebarThreads = (channel: ChannelView) =>
			sidebarThreadsFor(data, space(), channel.space, activeThread(channel));
		const [reorderMode, setReorderMode] = createSignal(false);
		const [held, setHeld] = createSignal<ChannelView>();
		const [drawerOpen, setDrawerOpen] = createSignal(false);
		const canIn = (target: CommunityView | undefined, permission: string) => {
			const viewer = target?.viewer;
			return !!viewer?.isOwner || !!viewer?.permissions?.includes(permission);
		};
		const can = (permission: string) => canIn(community(), permission);
		const [heldSpace, setHeldSpace] = createSignal<CommunityView>();
		const [spaceDrawerOpen, setSpaceDrawerOpen] = createSignal(false);
		const holdSpace = (target: CommunityView) => {
			setHeldSpace(target);
			setSpaceDrawerOpen(true);
		};
		const holdChannel = (channel: ChannelView) => {
			setHeld(channel);
			setDrawerOpen(true);
		};
		const voiceCallFor = (channel: ChannelView) => {
			const current = community();
			return current
				? { space: spaceKey(current), channel: channel.space }
				: undefined;
		};
		const joinVoice = (channel: ChannelView) => {
			if (!canJoinVoice(channel)) return;
			const call = voiceCallFor(channel);
			if (call) voice.join(call);
		};
		const openVoiceChat = (channel: ChannelView) => {
			const current = community();
			if (!current) return;
			void whenOverlaysClosed().then(() =>
				stack.push({
					kind: "chat",
					channelType: channel.type,
					space: spaceKey(current),
					channel: channelSlug(channel),
				}),
			);
		};
		const openVoiceChatPane = (channel: ChannelView) => {
			const current = community();
			if (!current) return;
			stack.push({
				kind: "chat",
				channelType: VOICE_CHANNEL,
				space: spaceKey(current),
				channel: channelSlug(channel),
			});
			desktopShell?.setVoiceChatOpen(true);
		};
		const startThread = (channel: ChannelView) => {
			const current = community();
			if (!current) return;
			const target = {
				space: spaceKey(current),
				channel: channelSlug(channel),
				channelType: channel.type,
			};
			stack.push({ kind: "chat", ...target });
			stack.push({ kind: "threadDraft", ...target });
		};
		const markChannelRead = (channel: ChannelView) => {
			const feed = data.channel(channel.space);
			const loaded = feed.ready();
			feed.markRead();
			feed.clearUnreadMarker();
			if (!loaded) void data.source.markRead(channel.space).catch(() => {});
			const ids = data.notifications
				.items()
				.filter(
					(entry) =>
						!entry.seenAt && !entry.thread && entry.channel === channel.space,
				)
				.map((entry) => entry.id);
			if (ids.length) void data.notifications.markRead(ids).catch(() => {});
		};
		const showThreads = (channel: ChannelView) => {
			const current = community();
			if (!current) return;
			const target = {
				space: spaceKey(current),
				channel: channelSlug(channel),
				channelType: channel.type,
			};
			stack.push({ kind: "chat", ...target });
			stack.push({ kind: "threads", ...target });
		};
		const duplicateChannel = (channel: ChannelView) =>
			void data.channels.duplicate(channel).then(
				(created) => toast.success(`Created #${created.name}`),
				() => toast.error("Couldn't duplicate the channel"),
			);
		const openAdmin = (
			target: CommunityView,
			page: "channel" | "category",
			id: string,
		) =>
			void whenOverlaysClosed().then(() =>
				stack.push({ kind: "admin", space: spaceKey(target), page, id }),
			);
		const editChannel = (channel: ChannelView) => {
			const current = community();
			if (current) openAdmin(current, "channel", channelSlug(channel));
		};
		const [heldCategory, setHeldCategory] = createSignal<CategoryView>();
		const [categoryDrawerOpen, setCategoryDrawerOpen] = createSignal(false);
		const holdCategory = (rkey: string) => {
			const category = space()
				?.categories.value()
				?.find((entry) => entry.rkey === rkey);
			if (!category) return;
			setHeldCategory(category);
			setCategoryDrawerOpen(true);
		};
		const createChannelIn = (rkey?: string) => {
			const current = community();
			if (current) openAdmin(current, "channel", newEntryId(rkey));
		};
		const editCategory = (rkey: string) => {
			const current = community();
			if (current) openAdmin(current, "category", rkey);
		};
		const markCategoryRead = (category: CategoryView) => {
			for (const channel of category.channels) {
				if (!isVoiceChannel(channel)) markChannelRead(channel);
			}
		};
		const copyChannelLink = (channel: ChannelView) => {
			const current = community();
			if (!current) return;
			const url = `${location.origin}${channelPath({
				space: spaceKey(current),
				channel: channelSlug(channel),
				channelType: channel.type,
			})}`;
			void copyText(url).then(() => toast.success("Channel link copied"));
		};
		const setSpaceMuted = (did: string, muted: boolean) =>
			prefs.setMuted(did, muted);
		const deleteDialogs = createDeleteDialogs({
			onChannelDeleted: (view) => {
				const chat = stack.mounted().find((layer) => layer.kind === "chat");
				if (chat?.kind === "chat" && chat.channel === channelSlug(view)) {
					stack.popTo(0);
				}
			},
		});
		const deleteChannel = (channel: ChannelView) =>
			deleteDialogs.requestChannel(channel);
		const deleteCategory = (rkey: string) => {
			const current = community();
			const category = space()
				?.categories.value()
				?.find((entry) => entry.rkey === rkey);
			if (current && category)
				deleteDialogs.requestCategory(current.did, category);
		};
		const openThread = (
			channel: ChannelView,
			thread: ThreadView,
			presentation?: "full",
		) => {
			const current = community();
			if (!current) return;
			const target = {
				space: spaceKey(current),
				channel: channelSlug(channel),
				channelType: channel.type,
			};
			stack.push({
				kind: "thread",
				...target,
				thread: skeyOf(thread.space),
				...(presentation ? { presentation } : {}),
			});
		};
		const leaveSpace = createLeaveSpace();
		const inviteDrawer = createInviteDrawer();
		const spaceMenu = (target: CommunityView): SpaceMenuActions => {
			const allowed = (permission: string, action: () => void) =>
				canIn(target, permission) ? action : undefined;
			return {
				get developerMode() {
					return data.controls().developerMode;
				},
				onCopyAtUri: () =>
					void copyText(target.did).then(() => toast.success("DID copied")),
				onShowOnPdsls: () => openExternalUrl(pdslsUrl(target.did)),
				get muted() {
					return prefs.isMuted(target.did);
				},
				onMutedChange: (muted) => setSpaceMuted(target.did, muted),
				onReorderChannels: allowed("channel.update", () => {
					if (community()?.did !== target.did) selectSpace(target);
					setReorderMode(true);
				}),
				onInvite: allowed("invitation.create", () => {
					void whenOverlaysClosed().then(() => inviteDrawer.show(target));
				}),
				onOpenSettings: SETTINGS_PERMISSIONS.some((permission) =>
					canIn(target, permission),
				)
					? () =>
							stack.push({
								kind: "admin",
								space: spaceKey(target),
								page: "overview",
							})
					: undefined,
				onOpenNotificationSettings: () => openNotificationSettings(target),
				onMarkAsRead: () =>
					void data.community.markRead(target.did).catch(() => {}),
				onCreateChannel: allowed("channel.create", () =>
					openAdmin(target, "channel", newEntryId()),
				),
				onCreateCategory: allowed("category.create", () =>
					openAdmin(target, "category", NEW_ENTRY),
				),
				onLeave: target.viewer.isOwner
					? undefined
					: () => leaveSpace.open(target),
			};
		};
		return {
			data,
			platform,
			authorName,
			ownerHandle,
			missing,
			inviteDrawer,
			openCreateSpace: () => stack.push({ kind: "createSpace" }),
			openDiscover: DISCOVERY_ENABLED
				? () => stack.push({ kind: "discover" })
				: undefined,
			fallbackSpace: () => communities()[0],
			haptics: useHaptics(),
			spaceMenu,
			leaveSpace,
			heldSpace,
			spaceDrawerOpen,
			setSpaceDrawerOpen,
			holdSpace,
			reorderMode,
			held,
			drawerOpen,
			setDrawerOpen,
			can,
			holdChannel,
			joinVoice,
			openVoiceChat,
			openVoiceChatPane,
			copyChannelLink,
			editChannel,
			heldCategory,
			categoryDrawerOpen,
			setCategoryDrawerOpen,
			holdCategory,
			createChannelIn,
			editCategory,
			markCategoryRead,
			startThread,
			showThreads,
			markChannelRead,
			duplicateChannel,
			setReorderMode,
			communities,
			community,
			space,
			activeChannel,
			selectSpace,
			railSpace,
			reorderSpaces,
			openChannel,
			participants,
			openParticipant,
			participantMenu,
			openParticipantMenu,
			joinedVoice,
			categories,
			setCategoryCollapsed,
			uncategorized,
			comingSoon,
			spaceMuted,
			notificationTarget,
			notificationOpen,
			setNotificationOpen,
			deleteChannel,
			deleteCategory,
			deleteDialogs,
			sidebarThreads,
			isActiveThread,
			openThread,
		};
	},
	slots: {
		Missing: slot((m) => (
			<StatusScreen
				tone="destructive"
				icon={<DangerTriangleIcon />}
				title="This Space isn't available"
				description="It may have been deleted, or you're no longer a member."
				actions={
					<Show when={m.fallbackSpace()}>
						{(space) => (
							<Button block onClick={() => m.selectSpace(space())}>
								{`Go to ${space().name}`}
							</Button>
						)}
					</Show>
				}
			/>
		)),
		RailItems: slot((m, props: { platform?: ChannelPlatform }) => {
			const desktop = () => props.platform === "desktop";
			return (
				<>
					<For each={m.communities()}>
						{(community) => {
							const totals = () =>
								mutedTotals(
									m.data.space(community).totals(),
									m.spaceMuted(community),
								);
							const item = () => (
								<SpaceRailItem
									id={community.did}
									name={community.name}
									iconSrc={community.picture}
									active={m.railSpace() === community.did}
									unread={totals().hasUnread}
									mentions={totals().mentions || undefined}
									onSelect={() => m.selectSpace(community)}
									onMenu={desktop() ? undefined : () => m.holdSpace(community)}
								/>
							);
							return (
								<Show when={desktop()} fallback={item()}>
									<SpaceContextMenu
										{...m.spaceMenu(community)}
										name={community.name}
										class="contents"
									>
										{item()}
									</SpaceContextMenu>
								</Show>
							);
						}}
					</For>
					<m.leaveSpace.Dialog />
					<m.inviteDrawer.Overlay />
					<NotificationSettingsScreen
						args={{
							space: m.notificationTarget(),
							open: m.notificationOpen(),
							onOpenChange: m.setNotificationOpen,
						}}
					/>
					<Show when={!desktop() && m.heldSpace()}>
						{(community) => (
							<SpaceDrawer
								{...m.spaceMenu(community())}
								open={m.spaceDrawerOpen()}
								onOpenChange={m.setSpaceDrawerOpen}
								name={community().name}
								iconSrc={community().picture}
								bannerSrc={community().banner}
								memberCount={community().memberCount ?? 0}
								description={community().description}
								developer={spaceDeveloperCard(community().did)}
							/>
						)}
					</Show>
				</>
			);
		}),
		Header: slot((m, props: { platform?: ChannelPlatform }) => (
			<Show when={m.community()}>
				{(community) => (
					<ChannelListHeader
						platform={props.platform ?? "mobile"}
						ownerHandle={m.ownerHandle()}
						name={community().name}
						iconSrc={community().picture}
						bannerSrc={community().banner}
						memberCount={community().memberCount ?? 0}
						description={community().description}
						developer={
							m.data.controls().developerMode
								? spaceDeveloperCard(community().did)
								: undefined
						}
						menu={m.spaceMenu(community())}
					/>
				)}
			</Show>
		)),
		Channels: slot((m, props: { platform?: ChannelPlatform }) => {
			const desktop = () => props.platform === "desktop";
			const platform = () => props.platform ?? "mobile";
			const density = () =>
				m.data.controls().showMessagePreviews ? "default" : "compact";
			const developer = (ref: string) => ({
				developerMode: m.data.controls().developerMode,
				onCopyAtUri: () =>
					void copyText(ref).then(() => toast.success("AT-URI copied")),
				onShowOnPdsls: () => openExternalUrl(`https://pdsls.dev/${ref}`),
			});
			const voiceRow = (channel: ChannelView) => (
				<VoiceChannelRow
					name={channel.name}
					platform={platform()}
					density={density()}
					private={channel.private}
					joined={m.joinedVoice(channel)}
					active={desktop() && m.activeChannel() === channelSlug(channel)}
					participants={m.participants(channel)}
					onOpenParticipant={m.openParticipant}
					participantMenu={
						desktop()
							? (participant, row) => m.participantMenu(participant.id, row)
							: undefined
					}
					onParticipantMenu={
						desktop() ? undefined : (id) => m.openParticipantMenu(id)
					}
					onClick={() => m.openChannel(channel)}
					onOpenChat={
						desktop() && channel.viewer.canRead
							? () => m.openVoiceChatPane(channel)
							: undefined
					}
					onOpenSettings={
						desktop() && m.can("channel.update")
							? () => m.editChannel(channel)
							: undefined
					}
				/>
			);
			const textRow = (channel: ChannelView) => {
				const slug = channelSlug(channel);
				const unread = () =>
					m.spaceMuted(m.community()) ? undefined : m.space()?.unread(slug);
				const summary = () =>
					m.data.controls().showMessagePreviews
						? m.data.lastMessage(channel.space)
						: undefined;
				return (
					<ChannelRow
						name={channel.name}
						platform={platform()}
						density={density()}
						private={channel.private}
						active={m.activeChannel() === slug}
						unread={unread()?.hasUnread}
						mentions={unread()?.mentions || undefined}
						muted={m.data.isMuted(channel.space)}
						preview={(() => {
							const current = summary();
							return current
								? {
										author: m.authorName(current.author),
										text: current.text,
										parts: summaryParts(current, (feature) =>
											m.data.emoji.mention(m.community()?.did, feature),
										),
									}
								: undefined;
						})()}
						attachment={summary()?.attachment}
						onClick={() => m.openChannel(channel)}
						onOpenSettings={
							desktop() && m.can("channel.update")
								? () => m.editChannel(channel)
								: undefined
						}
					/>
				);
			};
			const desktopChannel = (channel: ChannelView): JSX.Element =>
				isVoiceChannel(channel) ? (
					<VoiceChannelContextMenu
						name={channel.name}
						connected={m.joinedVoice(channel)}
						onConnectedChange={
							canJoinVoice(channel) || m.joinedVoice(channel)
								? (connected) => {
										if (connected) m.joinVoice(channel);
										else voice.leave();
									}
								: undefined
						}
						onOpenChat={() => m.openVoiceChatPane(channel)}
						onCopyLink={() => m.copyChannelLink(channel)}
						onDuplicate={
							m.can("channel.create")
								? () => m.duplicateChannel(channel)
								: undefined
						}
						onEdit={
							m.can("channel.update") ? () => m.editChannel(channel) : undefined
						}
						onDelete={
							m.can("channel.delete")
								? () => m.deleteChannel(channel)
								: undefined
						}
						{...developer(channel.space)}
					>
						{voiceRow(channel)}
					</VoiceChannelContextMenu>
				) : (
					<ChannelContextMenu
						name={channel.name}
						onMarkAsRead={() => m.markChannelRead(channel)}
						muted={m.data.isMuted(channel.space)}
						onMutedChange={(muted) => m.data.setMuted(channel.space, muted)}
						onStartThread={
							m.can("thread.create") ? () => m.startThread(channel) : undefined
						}
						onShowThreads={() => m.showThreads(channel)}
						onCopyLink={() => m.copyChannelLink(channel)}
						onDuplicate={
							m.can("channel.create")
								? () => m.duplicateChannel(channel)
								: undefined
						}
						onEdit={
							m.can("channel.update") ? () => m.editChannel(channel) : undefined
						}
						onDelete={
							m.can("channel.delete")
								? () => m.deleteChannel(channel)
								: undefined
						}
						{...developer(channel.space)}
					>
						{textRow(channel)}
					</ChannelContextMenu>
				);
			const threadRows = (channel: ChannelView) => {
				const current = m.community();
				if (!current) return undefined;
				const menu = createThreadMenu({
					space: spaceKey(current),
					channel: channelSlug(channel),
					channelType: channel.type,
				});
				const states = () => m.sidebarThreads(channel);
				const refs = createMemo(
					() => states().map((state) => state.thread.space),
					undefined,
					{
						equals: (a, b) =>
							a.length === b.length && a.every((ref, at) => ref === b[at]),
					},
				);
				const stateOf = (ref: SpaceRef) =>
					states().find((state) => state.thread.space === ref);
				return (
					<Show when={refs().length > 0}>
						<ChannelThreads>
							<For each={refs()}>
								{(ref) => (
									<Show when={stateOf(ref)}>
										{(state) => {
											const row = () => (
												<ChannelThreadRow
													name={state().thread.name}
													platform={platform()}
													private={state().thread.private}
													active={m.isActiveThread(channel, ref)}
													unread={
														!m.spaceMuted(m.community()) && state().unread
													}
													mentions={
														m.spaceMuted(m.community())
															? undefined
															: state().mentions || undefined
													}
													muted={m.data.isMuted(ref)}
													onClick={(event) =>
														m.openThread(
															channel,
															state().thread,
															desktop() && !event.shiftKey ? "full" : undefined,
														)
													}
													onLongPress={
														desktop()
															? undefined
															: () => menu.open(state().thread)
													}
												/>
											);
											return (
												<Show when={desktop()} fallback={row()}>
													<menu.ContextMenu thread={state().thread}>
														{row()}
													</menu.ContextMenu>
												</Show>
											);
										}}
									</Show>
								)}
							</For>
						</ChannelThreads>
						<menu.Overlay />
					</Show>
				);
			};
			const withThreads = (
				channel: ChannelView,
				row: JSX.Element,
				state: ChannelListItemState,
			) => (
				<div data-channel-entry="" class="flex min-w-0 flex-col gap-0.5">
					{row}
					<Show when={!state.reorderMode()}>{threadRows(channel)}</Show>
				</div>
			);
			const renderChannel = (
				channel: ChannelView,
				state: ChannelListItemState,
			): JSX.Element => {
				if (isVoiceChannel(channel)) {
					return desktop() ? desktopChannel(channel) : voiceRow(channel);
				}
				return withThreads(
					channel,
					desktop() ? desktopChannel(channel) : textRow(channel),
					state,
				);
			};
			const categoryOf = (rkey: string) =>
				m
					.space()
					?.categories.value()
					?.find((entry) => entry.rkey === rkey);
			const categoryUri = (rkey: string) =>
				`at://${m.community()?.did}/social.colibri.beta.category/${rkey}`;
			const categoryMenu = (rkey: string, header: JSX.Element) => {
				const category = () => categoryOf(rkey);
				return (
					<CategoryContextMenu
						name={category()?.name ?? ""}
						disabled={!category()}
						onMarkAsRead={() => {
							const current = category();
							if (current) m.markCategoryRead(current);
						}}
						muted={
							(category()?.channels.length ?? 0) > 0 &&
							(category()?.channels ?? []).every((channel) =>
								m.data.isMuted(channel.space),
							)
						}
						onMutedChange={(muted) => {
							for (const channel of category()?.channels ?? []) {
								m.data.setMuted(channel.space, muted);
							}
						}}
						onCreateChannel={
							m.can("channel.create")
								? () => m.createChannelIn(rkey)
								: undefined
						}
						onEdit={
							m.can("category.update") ? () => m.editCategory(rkey) : undefined
						}
						onDelete={
							m.can("category.delete")
								? () => m.deleteCategory(rkey)
								: undefined
						}
						{...developer(categoryUri(rkey))}
					>
						{header}
					</CategoryContextMenu>
				);
			};
			const listError = () =>
				m.space()?.channels.error() ?? m.space()?.categories.error();
			const retryList = () => {
				const current = m.space();
				if (!current) return;
				if (current.channels.error()) current.channels.retry();
				if (current.categories.error()) current.categories.retry();
			};
			return (
				<>
					<Show when={listError()}>
						{(error) => (
							<LoadErrorState
								variant="inline"
								error={error()}
								onRetry={retryList}
							/>
						)}
					</Show>
					<ChannelList
						categories={m.categories()}
						uncategorized={m.uncategorized()}
						getId={(channel) => channel.space}
						density={density()}
						reorderMode={m.reorderMode()}
						onReorderModeChange={m.setReorderMode}
						canReorder={m.reorderMode()}
						onChannelLongPress={
							desktop() ? undefined : (channel) => m.holdChannel(channel)
						}
						onCategoryLongPress={
							desktop() ? undefined : (rkey) => m.holdCategory(rkey)
						}
						onCreateChannel={
							desktop() && m.can("channel.create")
								? (rkey) => m.createChannelIn(rkey)
								: undefined
						}
						onOpenCategorySettings={
							desktop() && m.can("category.update")
								? (rkey) => m.editCategory(rkey)
								: undefined
						}
						wrapCategoryHeader={desktop() ? categoryMenu : undefined}
						onCollapsedChange={m.setCategoryCollapsed}
						haptics={m.haptics}
						channelName={(channel) => channel.name}
						renderChannel={renderChannel}
					/>
					<Show when={!desktop() && m.held()}>
						{(channel) => (
							<ChannelDrawer
								open={m.drawerOpen()}
								onOpenChange={m.setDrawerOpen}
								name={channel().name}
								icon={
									isVoiceChannel(channel()) ? <VolumeSmallIcon /> : undefined
								}
								onJoinVoice={
									isVoiceChannel(channel()) && canJoinVoice(channel())
										? () => m.joinVoice(channel())
										: undefined
								}
								onOpenCall={
									isVoiceChannel(channel()) && m.joinedVoice(channel())
										? () => voice.expand()
										: undefined
								}
								onOpenChat={
									isVoiceChannel(channel())
										? () => m.openVoiceChat(channel())
										: undefined
								}
								onMarkAsRead={
									isVoiceChannel(channel())
										? undefined
										: () => m.markChannelRead(channel())
								}
								muted={m.data.isMuted(channel().space)}
								onMutedChange={
									isVoiceChannel(channel())
										? undefined
										: (muted) => m.data.setMuted(channel().space, muted)
								}
								onStartThread={
									!isVoiceChannel(channel()) && m.can("thread.create")
										? () => m.startThread(channel())
										: undefined
								}
								onShowThreads={
									isVoiceChannel(channel())
										? undefined
										: () => m.showThreads(channel())
								}
								onCopyLink={() => m.copyChannelLink(channel())}
								onDuplicate={
									m.can("channel.create")
										? () => m.duplicateChannel(channel())
										: undefined
								}
								onEdit={
									m.can("channel.update")
										? () => m.editChannel(channel())
										: undefined
								}
								onDelete={
									m.can("channel.delete")
										? () => m.deleteChannel(channel())
										: undefined
								}
								developerMode={m.data.controls().developerMode}
								developer={{
									copyLabel: "Copy AT-URI",
									copyValue: channel().space,
									pdslsHref: `https://pdsls.dev/${channel().space}`,
								}}
							/>
						)}
					</Show>
					<Show when={!desktop() && m.heldCategory()}>
						{(category) => (
							<CategoryDrawer
								open={m.categoryDrawerOpen()}
								onOpenChange={m.setCategoryDrawerOpen}
								name={category().name}
								onMarkAsRead={() => m.markCategoryRead(category())}
								muted={
									category().channels.length > 0 &&
									category().channels.every((channel) =>
										m.data.isMuted(channel.space),
									)
								}
								onMutedChange={(muted) => {
									for (const channel of category().channels) {
										m.data.setMuted(channel.space, muted);
									}
								}}
								onCreateChannel={
									m.can("channel.create")
										? () => m.createChannelIn(category().rkey)
										: undefined
								}
								onEdit={
									m.can("category.update")
										? () => m.editCategory(category().rkey)
										: undefined
								}
								onDelete={
									m.can("category.delete")
										? () => m.deleteCategory(category().rkey)
										: undefined
								}
								developerMode={m.data.controls().developerMode}
								developer={{
									copyLabel: "Copy AT-URI",
									copyValue: `at://${m.community()?.did}/social.colibri.beta.category/${category().rkey}`,
									pdslsHref: `https://pdsls.dev/at://${m.community()?.did}/social.colibri.beta.category/${category().rkey}`,
								}}
							/>
						)}
					</Show>
					<m.deleteDialogs.Dialogs />
				</>
			);
		}),
	},
});
