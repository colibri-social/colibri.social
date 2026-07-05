import { createSignal, type ParentComponent, Show } from "solid-js";
import { toast } from "somoto";
import BellIcon from "~icons/ph/bell";
import BellSlashIcon from "~icons/ph/bell-slash";
import CheckIcon from "~icons/ph/check";
import GearIcon from "~icons/ph/gear";
import TrashIcon from "~icons/ph/trash";
import type { Channel } from "../../../atproto/xrpc/social/colibri/community/listChannels";
import { usePermissions } from "../../../contexts/Community";
import { useMutes } from "../../../contexts/Mutes";
import { useNotifications } from "../../../contexts/Notifications";
import { useUserContext } from "../../../contexts/User";
import { createLongPress } from "../../../utils/create-long-press";
import { useIsMobile } from "../../../utils/mobile-pane";
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

/**
 * Right-click context menu for a channel in the sidebar. "Settings" is
 * delegated to the parent (which owns a single controlled `ChannelSettingsModal`
 * shared with the hover gear button); "Delete" confirms then deletes.
 */
export const ChannelContextMenu: ParentComponent<{
	channel: Channel;
	onOpenSettings: () => void;
}> = (props) => {
	const user = useUserContext();
	const notifications = useNotifications();
	const mutes = useMutes();
	const { canUpdateChannel: _canUpdateChannel, canDeleteChannel: _canDelete } =
		usePermissions();

	const muted = () => mutes.isChannelMuted(props.channel.uri);

	const canUpdate = () => _canUpdateChannel(user.did);
	const canDelete = () => _canDelete(user.did);
	const isMobile = useIsMobile();

	const [confirmOpen, setConfirmOpen] = createSignal(false);
	const [deleting, setDeleting] = createSignal(false);
	const [menuOpen, setMenuOpen] = createSignal(false);

	const toggleMute = () =>
		void (muted()
			? mutes.unmuteChannel(props.channel.uri)
			: mutes.muteChannel(props.channel.uri));

	const handleDelete = async () => {
		setDeleting(true);
		try {
			await user.xrpc.social.colibri.channel.delete(props.channel.uri);
			setConfirmOpen(false);
		} catch {
			toast.error("Failed to delete channel.");
		} finally {
			setDeleting(false);
		}
	};

	return (
		<>
			<Show when={isMobile()}>
				<div
					style={{ display: "contents" }}
					ref={(el) =>
						createLongPress(el, {
							enabled: () => isMobile(),
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
					<MenuDrawerItem
						onClick={() => {
							setMenuOpen(false);
							void notifications.markChannelAsRead(props.channel.uri);
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
			<Show when={!isMobile()}>
				<ContextMenu>
					<ContextMenuTrigger>{props.children}</ContextMenuTrigger>
					<ContextMenuPortal>
						<ContextMenuContent class="min-w-44">
							<ContextMenuItem
								onClick={() =>
									void notifications.markChannelAsRead(props.channel.uri)
								}
							>
								<CheckIcon />
								<span>Mark as read</span>
							</ContextMenuItem>
							<ContextMenuItem
								onClick={() =>
									void (muted()
										? mutes.unmuteChannel(props.channel.uri)
										: mutes.muteChannel(props.channel.uri))
								}
							>
								<Show when={muted()} fallback={<BellSlashIcon />}>
									<BellIcon />
								</Show>
								<span>{muted() ? "Unmute Channel" : "Mute Channel"}</span>
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
							This permanently deletes the channel and all of its messages. This
							cannot be undone.
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
