import { useNavigate } from "@solidjs/router";
import { createSignal, type ParentComponent, Show } from "solid-js";
import BellIcon from "~icons/ph/bell";
import BellSlashIcon from "~icons/ph/bell-slash";
import ChecksIcon from "~icons/ph/checks";
import GearIcon from "~icons/ph/gear";
import SignOutIcon from "~icons/ph/sign-out";
import type { CommunityView } from "../../../atproto/views";
import { useMutes } from "../../../contexts/Mutes";
import { useNotifications } from "../../../contexts/Notifications";
import { createLongPress } from "../../../utils/create-long-press";
import { useIsTouch } from "../../../utils/touch";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "../../ui/ContextMenu";
import { handoffDrawer, MenuDrawer, MenuDrawerItem } from "../../ui/MenuDrawer";
import { LeaveCommunityModal } from "./LeaveCommunityModal";

export const CommunityContextMenu: ParentComponent<{
	community: CommunityView;
}> = (props) => {
	const notifications = useNotifications();
	const mutes = useMutes();
	const navigate = useNavigate();
	const isTouch = useIsTouch();

	const [leaveOpen, setLeaveOpen] = createSignal(false);
	const [menuOpen, setMenuOpen] = createSignal(false);

	const muted = () => mutes.isCommunityMuted(props.community.did);

	const markRead = () =>
		void notifications.markCommunityAsRead(props.community.did);
	const toggleMute = () =>
		void (muted()
			? mutes.unmuteCommunity(props.community.did)
			: mutes.muteCommunity(props.community.did));
	const openSettings = () =>
		navigate(`/app/c/${props.community.did}?settings=open`);

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
					title={props.community.name}
				>
					<MenuDrawerItem
						onClick={() => {
							setMenuOpen(false);
							markRead();
						}}
					>
						<ChecksIcon />
						<span>Mark everything as read</span>
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
						<span>{muted() ? "Unmute Community" : "Mute Community"}</span>
					</MenuDrawerItem>
					<Show when={props.community.viewer.isOwner}>
						<MenuDrawerItem
							onClick={() =>
								handoffDrawer(() => setMenuOpen(false), openSettings)
							}
						>
							<GearIcon />
							<span>Settings</span>
						</MenuDrawerItem>
					</Show>
					<Show when={!props.community.viewer.isOwner}>
						<MenuDrawerItem
							destructive
							onClick={() =>
								handoffDrawer(
									() => setMenuOpen(false),
									() => setLeaveOpen(true),
								)
							}
						>
							<SignOutIcon />
							<span>Leave Community</span>
						</MenuDrawerItem>
					</Show>
				</MenuDrawer>
			</Show>
			<Show when={!isTouch()}>
				<ContextMenu>
					<ContextMenuTrigger>{props.children}</ContextMenuTrigger>
					<ContextMenuPortal>
						<ContextMenuContent class="min-w-52">
							<ContextMenuItem
								onClick={() =>
									void notifications.markCommunityAsRead(props.community.did)
								}
							>
								<ChecksIcon />
								<span>Mark everything as read</span>
							</ContextMenuItem>
							<ContextMenuItem
								onClick={() =>
									void (muted()
										? mutes.unmuteCommunity(props.community.did)
										: mutes.muteCommunity(props.community.did))
								}
							>
								<Show when={muted()} fallback={<BellSlashIcon />}>
									<BellIcon />
								</Show>
								<span>{muted() ? "Unmute Community" : "Mute Community"}</span>
							</ContextMenuItem>
							<Show when={props.community.viewer.isOwner}>
								<ContextMenuItem
									onClick={() =>
										navigate(`/app/c/${props.community.did}?settings=open`)
									}
								>
									<GearIcon />
									<span>Settings</span>
								</ContextMenuItem>
							</Show>
							<Show when={!props.community.viewer.isOwner}>
								<ContextMenuSeparator />
								<ContextMenuItem
									variant="destructive"
									onClick={() => setLeaveOpen(true)}
								>
									<SignOutIcon />
									<span>Leave Community</span>
								</ContextMenuItem>
							</Show>
						</ContextMenuContent>
					</ContextMenuPortal>
				</ContextMenu>
			</Show>
			<LeaveCommunityModal
				open={leaveOpen}
				setOpen={setLeaveOpen}
				communityName={props.community.name}
				community={props.community.did}
			/>
		</>
	);
};
