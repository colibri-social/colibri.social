import twemoji from "@twemoji/api";
import { createMemo, For, Show } from "solid-js";
import type { Member } from "../../../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../../../atproto/xrpc/social/colibri/community/listRoles";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import createMediaQuery from "../../../utils/create-media-query";
import { createMobilePane } from "../../../utils/mobile-pane";
import { createSwipe } from "../../../utils/create-swipe";
import User from "../user";
import { MemberContextMenu } from "./MemberContextMenu";
import CrownIcon from "~icons/ph/crown-fill";
import CaretLeftIcon from "~icons/ph/caret-left";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/Tooltip";
import { groupMembersByRoles } from "../../../utils/group-members-by-roles";

const MemberRow = (props: {
	member: Member;
	communityUri: string;
	roles: Role[];
}) => {
	const community = useCommunityContext();

	return (
		<MemberContextMenu member={props.member}>
			<User.ProfilePopover
				user={props.member}
				class="data-expanded:[&>div]:bg-muted!"
			>
				<div
					class="group/member flex flex-row gap-2 rounded-sm px-2 py-1 hover:bg-card items-center cursor-pointer h-12 flex-1"
					onPointerDown={(e) => e.button !== 0 && e.stopPropagation()}
				>
					<User.Avatar user={props.member} />
					<div class="flex flex-col w-[calc(100%-36px-8px)]">
						<span class="font-medium leading-5 overflow-hidden text-ellipsis flex flex-row items-center gap-2">
							<User.DisplayableName user={props.member} />
							<Show when={community().ownerDid() === props.member.did}>
								<Tooltip>
									<TooltipTrigger>
										<CrownIcon class="text-yellow-400 w-4 h-4" />
									</TooltipTrigger>
									<TooltipContent>Community Owner</TooltipContent>
								</Tooltip>
							</Show>
						</span>
						<Show
							when={
								props.member.data.status &&
								props.member.data.onlineState !== "offline"
							}
						>
							<span class="text-sm w-full leading-5 flex flex-row items-center gap-2">
								<Show when={props.member.data.status!.emoji}>
									<span
										class="[&>img]:min-w-4 [&>img]:min-h-4 [&>img]:w-4 [&>img]:h-4 [&>img]inline"
										innerHTML={twemoji.parse(props.member.data.status!.emoji!)}
									/>
								</Show>
								<span class="w-full overflow-hidden text-ellipsis whitespace-nowrap">
									{props.member.data.status!.text}
								</span>
							</span>
						</Show>
					</div>
				</div>
			</User.ProfilePopover>
		</MemberContextMenu>
	);
};

export const MemberSidebar = () => {
	const community = useCommunityContext();

	const membersByRoles = () =>
		groupMembersByRoles({
			members: community().members,
			assignableRoles: community().assignableRoles,
			roles: community().roles,
		});

	// Flatten the grouped roster into a single list keyed by member DID. Because
	// DIDs are stable primitives, `<For>` reorders existing rows in place when a
	// member's roles change instead of recreating them — which keeps an open
	// context menu / profile popover (and the Kobalte body pointer-lock) alive
	// across the server's `roles_updated` event.
	const layout = createMemo(() => {
		const groups = membersByRoles().filter((g) => g.members.length > 0);
		const members: Member[] = [];
		const headers: Record<string, { label: string; count: number }> = {};

		for (const group of groups) {
			group.members.forEach((member, index) => {
				if (index === 0) {
					headers[member.did] = {
						label: group.role.name,
						count: group.members.length,
					};
				}
				members.push(member);
			});
		}

		return { members, headers };
	});

	const displayMembersAsSheet = createMediaQuery("(max-width: 1280px)");
	const { preferences } = useUserPreferences();
	const { isMobile, currentPane, popPane, pushDeeper } = createMobilePane();

	return (
		<div
			ref={(el) =>
				createSwipe(el, {
					enabled: () => isMobile(),
					onSwipeRight: () => popPane(),
					onSwipeLeft: () => pushDeeper(),
				})
			}
			class="flex flex-col border-border bg-background"
			classList={{
				"min-w-72 w-72 h-full border-l z-50": !isMobile(),
				"absolute top-0 right-0 h-full drop-shadow-black drop-shadow-2xl":
					!isMobile() && displayMembersAsSheet(),
				hidden: !isMobile() && !preferences().membersListVisible,
				"absolute inset-0 w-full h-full z-30 transition-transform duration-200 ease-out motion-reduce:transition-none":
					isMobile(),
				"translate-x-full": isMobile() && currentPane() !== "members",
			}}
		>
			<Show when={isMobile()}>
				<div class="sticky top-0 left-0 border-b border-border bg-background h-12 min-h-12 p-2 w-full flex flex-row items-center gap-1">
					<button
						type="button"
						onClick={() => popPane()}
						class="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted/50 cursor-pointer"
						aria-label="Back"
					>
						<CaretLeftIcon width={20} height={20} />
					</button>
					<span class="font-medium">Members</span>
				</div>
			</Show>
			<div class="flex flex-col gap-3 p-4 overflow-y-auto flex-1">
				<For each={layout().members}>
					{(member) => {
						const header = () => layout().headers[member.did];

						return (
							<>
								<Show when={header()}>
									{(h) => (
										<span class="text-sm text-muted-foreground not-first-of-type:mt-4">
											{h().label} — {h().count}
										</span>
									)}
								</Show>
								<MemberRow
									member={member}
									communityUri={community().community.uri}
									roles={community().assignableRoles}
								/>
							</>
						);
					}}
				</For>
			</div>
		</div>
	);
};
