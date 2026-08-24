import { createSignal, type ParentComponent, Show } from "solid-js";
import { toast } from "somoto";
import BellIcon from "~icons/ph/bell";
import BellSlashIcon from "~icons/ph/bell-slash";
import CheckIcon from "~icons/ph/check";
import GearIcon from "~icons/ph/gear";
import LinkSimpleIcon from "~icons/ph/link-simple";
import PhoneCallIcon from "~icons/ph/phone-call";
import PhoneSlashIcon from "~icons/ph/phone-slash";
import TrashIcon from "~icons/ph/trash";
import { buildColibriChannelUrl } from "../../../atproto/colibri-channel-url";
import { colibri, SPACE_TYPES } from "../../../atproto/lexicons";
import { clientForManagingApp } from "../../../atproto/xrpc";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import type { Channel } from "../../../contexts/community-payload";
import { useMutes } from "../../../contexts/Mutes";
import { useNotifications } from "../../../contexts/Notifications";
import { useUserContext } from "../../../contexts/User";
import {
	ConnectionState,
	useVoiceChatContext,
} from "../../../contexts/VoiceChat";
import { classifyThrown } from "../../../errors/classify";
import { showError } from "../../../errors/show-error";
import { createLongPress } from "../../../utils/create-long-press";
import { createLogger } from "../../../utils/logger";
import { useIsTouch } from "../../../utils/touch";
import { Button } from "../../ui/Button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "../../ui/ContextMenu";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "../../ui/Dialog";
import { handoffDrawer, MenuDrawer, MenuDrawerItem } from "../../ui/MenuDrawer";

const log = createLogger("community");

export const ChannelContextMenu: ParentComponent<{
	channel: Channel;
	onOpenSettings: () => void;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const notifications = useNotifications();
	const mutes = useMutes();
	const [voiceData, { connect, disconnect }] = useVoiceChatContext();
	const { canUpdateChannel: _canUpdateChannel, canDeleteChannel: _canDelete } =
		usePermissions();

	const muted = () => mutes.isChannelMuted(props.channel.space);

	const toggleMute = () =>
		void (muted()
			? mutes.unmuteChannel(props.channel.space)
			: mutes.muteChannel(props.channel.space));

	const isVoice = () => props.channel.type === SPACE_TYPES.channelVoice;

	const isConnectedHere = () =>
		voiceData.connection.uri === props.channel.space &&
		voiceData.connection.state !== ConnectionState.Disconnected;

	const toggleConnection = () =>
		isConnectedHere()
			? disconnect()
			: connect(props.channel.space, {
					channelName: props.channel.name,
					communityName: community().community.name,
					managingApp: community().community.managingApp,
				});

	const canUpdate = () => _canUpdateChannel(user.did);
	const canDelete = () => _canDelete(user.did);
	const isTouch = useIsTouch();

	const copyChannelLink = () => {
		const url = buildColibriChannelUrl(props.channel.space);
		if (!url) return;
		void navigator.clipboard.writeText(url);
		toast.success("Channel link copied to clipboard!");
	};

	const [confirmOpen, setConfirmOpen] = createSignal(false);
	const [deleting, setDeleting] = createSignal(false);
	const [menuOpen, setMenuOpen] = createSignal(false);

	const handleDelete = async () => {
		setDeleting(true);
		try {
			const client = clientForManagingApp(
				user.atproto.agent,
				community().community.managingApp,
			);
			const res = await client.call(colibri.channel.delete.main, {
				body: { channel: props.channel.space },
			});
			if (!res.ok) {
				log.error("deleting a channel failed", { code: res.error.code });
				showError(res.error, { fallbackTitle: "Failed to delete channel." });
				return;
			}
			setConfirmOpen(false);
		} catch (err) {
			log.error("deleting a channel failed", {
				code: classifyThrown(err).code,
			});
			showError(err, { fallbackTitle: "Failed to delete channel." });
		} finally {
			setDeleting(false);
		}
	};

	return (
		<>
			<Show when={isTouch()}>
				<div
					style={{ display: "contents" }}
					ref={(el) =>
						createLongPress(el, {
							enabled: () => isTouch(),
							onLongPress: () => setMenuOpen(true),
						})
					}
				>
					{props.children}
				</div>
				<MenuDrawer
					open={menuOpen()}
					onOpenChange={setMenuOpen}
					title={props.channel.name}
				>
					<Show when={isVoice()}>
						<MenuDrawerItem
							onClick={() =>
								handoffDrawer(() => setMenuOpen(false), toggleConnection)
							}
						>
							<Show when={isConnectedHere()} fallback={<PhoneCallIcon />}>
								<PhoneSlashIcon />
							</Show>
							<span>{isConnectedHere() ? "Leave Voice" : "Join Voice"}</span>
						</MenuDrawerItem>
					</Show>
					<Show when={!isVoice()}>
						<MenuDrawerItem
							onClick={() => {
								setMenuOpen(false);
								void notifications.markChannelAsRead(props.channel.space);
							}}
						>
							<CheckIcon />
							<span>Mark as read</span>
						</MenuDrawerItem>
						<MenuDrawerItem
							onClick={() => {
								setMenuOpen(false);
								toggleMute();
							}}
						>
							<Show when={muted()} fallback={<BellSlashIcon />}>
								<BellIcon />
							</Show>
							<span>{muted() ? "Unmute Channel" : "Mute Channel"}</span>
						</MenuDrawerItem>
					</Show>
					<MenuDrawerItem
						onClick={() =>
							handoffDrawer(() => setMenuOpen(false), copyChannelLink)
						}
					>
						<LinkSimpleIcon />
						<span>Copy Channel Link</span>
					</MenuDrawerItem>
					<Show when={canUpdate()}>
						<MenuDrawerItem
							onClick={() =>
								handoffDrawer(() => setMenuOpen(false), props.onOpenSettings)
							}
						>
							<GearIcon />
							<span>Settings</span>
						</MenuDrawerItem>
					</Show>
					<Show when={canDelete()}>
						<MenuDrawerItem
							destructive
							onClick={() =>
								handoffDrawer(
									() => setMenuOpen(false),
									() => setConfirmOpen(true),
								)
							}
						>
							<TrashIcon />
							<span>Delete Channel</span>
						</MenuDrawerItem>
					</Show>
				</MenuDrawer>
			</Show>
			<Show when={!isTouch()}>
				<ContextMenu>
					<ContextMenuTrigger>{props.children}</ContextMenuTrigger>
					<ContextMenuPortal>
						<ContextMenuContent class="min-w-44">
							<Show when={isVoice()}>
								<ContextMenuItem onClick={toggleConnection}>
									<Show when={isConnectedHere()} fallback={<PhoneCallIcon />}>
										<PhoneSlashIcon />
									</Show>
									<span>
										{isConnectedHere() ? "Leave Voice" : "Join Voice"}
									</span>
								</ContextMenuItem>
							</Show>
							<Show when={!isVoice()}>
								<ContextMenuItem
									onClick={() =>
										void notifications.markChannelAsRead(props.channel.space)
									}
								>
									<CheckIcon />
									<span>Mark as read</span>
								</ContextMenuItem>
								<ContextMenuItem onClick={toggleMute}>
									<Show when={muted()} fallback={<BellSlashIcon />}>
										<BellIcon />
									</Show>
									<span>{muted() ? "Unmute Channel" : "Mute Channel"}</span>
								</ContextMenuItem>
							</Show>
							<ContextMenuItem onClick={copyChannelLink}>
								<LinkSimpleIcon />
								<span>Copy Channel Link</span>
							</ContextMenuItem>
							<Show when={canUpdate() || canDelete()}>
								<ContextMenuSeparator />
							</Show>
							<Show when={canUpdate()}>
								<ContextMenuItem onClick={() => props.onOpenSettings()}>
									<GearIcon />
									<span>Settings</span>
								</ContextMenuItem>
							</Show>
							<Show when={canDelete()}>
								<ContextMenuItem
									variant="destructive"
									onClick={() => setConfirmOpen(true)}
								>
									<TrashIcon />
									<span>Delete Channel</span>
								</ContextMenuItem>
							</Show>
						</ContextMenuContent>
					</ContextMenuPortal>
				</ContextMenu>
			</Show>

			<Dialog open={confirmOpen()} onOpenChange={setConfirmOpen}>
				<DialogPortal>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Delete #{props.channel.name}?</DialogTitle>
						</DialogHeader>
						<p class="text-sm text-muted-foreground">
							This permanently deletes the channel. Messages members wrote here
							stay in their own repos, but nobody except their authors will be
							able to read them afterward. This cannot be undone.
						</p>
						<DialogFooter class="flex-col sm:flex-row gap-2">
							<Button
								class="ml-auto"
								variant="secondary"
								onClick={() => setConfirmOpen(false)}
							>
								Cancel
							</Button>
							<Button
								variant="destructive"
								onClick={handleDelete}
								disabled={deleting()}
							>
								Delete Channel
							</Button>
						</DialogFooter>
					</DialogContent>
				</DialogPortal>
			</Dialog>
		</>
	);
};
