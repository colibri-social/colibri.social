import type { Community } from "@colibri-social/lib";
import { useNavigate } from "@solidjs/router";
import { createSignal, type ParentComponent, Show } from "solid-js";
import BellIcon from "~icons/ph/bell";
import BellSlashIcon from "~icons/ph/bell-slash";
import ChecksIcon from "~icons/ph/checks";
import GearIcon from "~icons/ph/gear";
import SignOutIcon from "~icons/ph/sign-out";
import { communityUriToUrlCompatible } from "../../../atproto/community-uri-to-url-compatible";
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

/**
 * Right-click context menu for a community in the sidebar. Ownership comes
 * straight off the community record (`isOwner`, populated by
 * `actor.listCommunities` at load) so "Leave" can be hidden for owners with no
 * follow-up fetch. "Settings" navigates to the community with a flag the header
 * honours to open the real settings modal in its proper context.
 */
export const CommunityContextMenu: ParentComponent<{
	community: Community;
}> = (props) => {
	const notifications = useNotifications();
	const mutes = useMutes();
	const navigate = useNavigate();
	const isTouch = useIsTouch();

	const [leaveOpen, setLeaveOpen] = createSignal(false);
	const [menuOpen, setMenuOpen] = createSignal(false);

	const muted = () => mutes.isCommunityMuted(props.community.uri);

	const markRead = () =>
		void notifications.markCommunityAsRead(props.community.uri);
	const toggleMute = () =>
		void (muted()
			? mutes.unmuteCommunity(props.community.uri)
			: mutes.muteCommunity(props.community.uri));
	const openSettings = () =>
		navigate(
			`/app/c/${communityUriToUrlCompatible(props.community.uri)}?settings=open`,
		);

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
					<Show when={props.community.isOwner}>
						<MenuDrawerItem
							onClick={() =>
								handoffDrawer(() => setMenuOpen(false), openSettings)
							}
						>
							<GearIcon />
							<span>Settings</span>
						</MenuDrawerItem>
					</Show>
					<Show when={!props.community.isOwner}>
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
									void notifications.markCommunityAsRead(props.community.uri)
								}
							>
								<ChecksIcon />
								<span>Mark everything as read</span>
							</ContextMenuItem>
							<ContextMenuItem
								onClick={() =>
									void (muted()
										? mutes.unmuteCommunity(props.community.uri)
										: mutes.muteCommunity(props.community.uri))
								}
							>
								<Show when={muted()} fallback={<BellSlashIcon />}>
									<BellIcon />
								</Show>
								<span>{muted() ? "Unmute Community" : "Mute Community"}</span>
							</ContextMenuItem>
							<Show when={props.community.isOwner}>
								<ContextMenuItem
									onClick={() =>
										navigate(
											`/app/c/${communityUriToUrlCompatible(props.community.uri)}?settings=open`,
										)
									}
								>
									<GearIcon />
									<span>Settings</span>
								</ContextMenuItem>
							</Show>
							<Show when={!props.community.isOwner}>
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
				communityUri={props.community.uri}
			/>
		</>
	);
};
