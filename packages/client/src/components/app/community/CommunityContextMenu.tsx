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
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "../../ui/ContextMenu";
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

	const [leaveOpen, setLeaveOpen] = createSignal(false);

	const muted = () => mutes.isCommunityMuted(props.community.uri);

	return (
		<>
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
			<LeaveCommunityModal
				open={leaveOpen}
				setOpen={setLeaveOpen}
				communityName={props.community.name}
				communityUri={props.community.uri}
			/>
		</>
	);
};
