import {
	Button,
	CategoryContextMenu,
	CategoryDrawer,
	ChannelContextMenu,
	ChannelDrawer,
	ChannelList,
	type ChannelListCategory,
	ChannelListHeader,
	type ChannelPlatform,
	ChannelRow,
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
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	Show,
} from "solid-js";
import { displayNameOf } from "../../data/adapters/authors";
import { channelSlug, isVoiceChannel, spaceKey } from "../../data/ids";
import { type SpaceData, useData } from "../../data/store";
import {
	type CategoryView,
	type ChannelView,
	type CommunityView,
	type Did,
	VOICE_CHANNEL,
} from "../../data/types";
import { voice } from "../../data/voice";
import { defineContract, slot } from "../../screen/define";
import { usePlatform } from "../../screen/platform";
import { useOptionalDesktopShell } from "../../shell/desktop/context";
import { channelPath, NEW_ENTRY } from "../../shell/layers";
import { useStack } from "../../shell/stack";
import { newEntryId } from "../admin/channel/channel-target";
import { createInviteDrawer } from "../admin/invites/invite-drawer";
import { createLeaveSpace } from "../admin/overview/leave-space";
import { SPACE_PERMISSIONS } from "../admin/space-admin";
import { whenOverlaysClosed } from "../channel/forward/overlay-wait";
import { useProfileSheet } from "../profile/profile-sheet";
import { clickVoiceChannel } from "../voice/voice-click";
import { openVoicePrompt } from "../voice/voice-prompt";

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
			return args.slug ? data.spaceByKey(args.slug) : list[0];
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
		const activeChannel = () => {
			const current = community();
			if (!current) return undefined;
			if (platform() === "desktop") {
				const chat = stack.mounted().find((layer) => layer.kind === "chat");
				return chat?.kind === "chat" && chat.space === spaceKey(current)
					? chat.channel
					: undefined;
			}
			return data.lastChannel(spaceKey(current));
		};
		const selectSpace = (target: CommunityView) =>
			stack.setRoot({ tab: "spaces", space: spaceKey(target) });
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
		const categories = createMemo((): ChannelListCategory<ChannelView>[] =>
			(space()?.categories.value() ?? []).map((category) => ({
				id: category.rkey,
				name: category.name,
				channels: category.channels,
			})),
		);
		const uncategorized = createMemo(() =>
			(space()?.channels.value() ?? []).filter((channel) => !channel.category),
		);
		const [mutedSpaces, setMutedSpaces] = createSignal<ReadonlySet<string>>(
			new Set(),
		);
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
			data.channel(channel.space).markRead();
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
			setMutedSpaces((current) => {
				const next = new Set(current);
				if (muted) next.add(did);
				else next.delete(did);
				return next;
			});
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
				onShowOnPdsls: () =>
					window.open(pdslsUrl(target.did), "_blank", "noopener"),
				get muted() {
					return mutedSpaces().has(target.did);
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
				onOpenNotificationSettings: comingSoon("Notification settings"),
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
			openDiscover: () => stack.push({ kind: "discover" }),
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
			openChannel,
			participants,
			openParticipant,
			joinedVoice,
			categories,
			uncategorized,
			comingSoon,
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
							const totals = () => m.data.space(community).totals();
							const item = () => (
								<SpaceRailItem
									name={community.name}
									iconSrc={community.picture}
									active={m.community()?.did === community.did}
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
						developer={spaceDeveloperCard(community().did)}
						menu={m.spaceMenu(community())}
					/>
				)}
			</Show>
		)),
		Channels: slot((m, props: { platform?: ChannelPlatform }) => {
			const desktop = () => props.platform === "desktop";
			const platform = () => props.platform ?? "mobile";
			const developer = (ref: string) => ({
				developerMode: m.data.controls().developerMode,
				onCopyAtUri: () =>
					void copyText(ref).then(() => toast.success("AT-URI copied")),
				onShowOnPdsls: () =>
					window.open(`https://pdsls.dev/${ref}`, "_blank", "noopener"),
			});
			const voiceRow = (channel: ChannelView) => (
				<VoiceChannelRow
					name={channel.name}
					platform={platform()}
					private={channel.private}
					joined={m.joinedVoice(channel)}
					active={desktop() && m.activeChannel() === channelSlug(channel)}
					participants={m.participants(channel)}
					onOpenParticipant={m.openParticipant}
					onClick={() => m.openChannel(channel)}
					onOpenSettings={
						desktop() && m.can("channel.update")
							? () => m.editChannel(channel)
							: undefined
					}
				/>
			);
			const textRow = (channel: ChannelView) => {
				const slug = channelSlug(channel);
				const unread = () => m.space()?.unread(slug);
				const summary = () =>
					m.data.controls().showMessagePreviews
						? m.data.lastMessage(channel.space)
						: undefined;
				return (
					<ChannelRow
						name={channel.name}
						platform={platform()}
						private={channel.private}
						active={m.activeChannel() === slug}
						unread={unread()?.hasUnread}
						mentions={unread()?.mentions || undefined}
						muted={desktop() ? m.data.isMuted(channel.space) : undefined}
						preview={(() => {
							const current = summary();
							return current
								? { author: m.authorName(current.author), text: current.text }
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
						onConnectedChange={(connected) => {
							if (connected) m.joinVoice(channel);
							else voice.leave();
						}}
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
						{...developer(channel.space)}
					>
						{textRow(channel)}
					</ChannelContextMenu>
				);
			const renderChannel = (channel: ChannelView): JSX.Element => {
				if (desktop()) return desktopChannel(channel);
				return isVoiceChannel(channel) ? voiceRow(channel) : textRow(channel);
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
						{...developer(categoryUri(rkey))}
					>
						{header}
					</CategoryContextMenu>
				);
			};
			return (
				<>
					<ChannelList
						categories={m.categories()}
						uncategorized={m.uncategorized()}
						getId={(channel) => channel.space}
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
									isVoiceChannel(channel())
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
								developerMode={m.data.controls().developerMode}
								developer={{
									copyLabel: "Copy AT-URI",
									copyValue: `at://${m.community()?.did}/social.colibri.beta.category/${category().rkey}`,
									pdslsHref: `https://pdsls.dev/at://${m.community()?.did}/social.colibri.beta.category/${category().rkey}`,
								}}
							/>
						)}
					</Show>
				</>
			);
		}),
	},
});
