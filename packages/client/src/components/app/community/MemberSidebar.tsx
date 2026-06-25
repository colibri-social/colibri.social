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
import User from "../user";
import { MemberContextMenu } from "./MemberContextMenu";
import CrownIcon from "~icons/ph/crown-fill";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/Tooltip";
import { displayableNameFn } from "../user/DisplayableName";

type MembersByRoles = Array<{
	role: Role;
	members: Array<Member>;
}>;

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

	const membersByRoles = (): MembersByRoles => {
		const result: MembersByRoles = community()
			.assignableRoles.slice()
			.filter((x) => !!x.hoisted)
			.filter((x) => !x.protected)
			.sort((a, b) => b.position - a.position)
			.map((x) => ({ role: x, members: [] }));

		const noRoleOnlineIdx = result.push({
			role: {
				name: "Online",
				channelOverrides: [],
				permissions: [],
				position: 0,
				uri: "",
			},
			members: [],
		});

		const offlineIdx = result.push({
			role: {
				name: "Offline",
				channelOverrides: [],
				permissions: [],
				position: 0,
				uri: "",
			},
			members: [],
		});

		for (const member of community().members) {
			const sortedMemberRoles = [...member.roles]
				.sort(
					(a, b) =>
						result.findIndex((y) => y.role.uri === a) -
						result.findIndex((z) => z.role.uri === b),
				)
				.map((x) => community().roles.find((y) => y.uri === x))
				.filter((x) => x !== undefined);

			const highestMemberRole = sortedMemberRoles.find(
				(x) => x.hoisted && !x.protected,
			);

			let resultIndex = !highestMemberRole
				? -5
				: result.findIndex((x) => x.role.uri === highestMemberRole.uri);

			if (member.data.onlineState === "offline") {
				resultIndex = offlineIdx - 1;
			}

			if (resultIndex < 0) {
				resultIndex = noRoleOnlineIdx - 1;
			}

			result[resultIndex].members.push(member);
		}

		for (const entry of result) {
			entry.members = entry.members.sort((a, b) =>
				displayableNameFn(a).localeCompare(displayableNameFn(b)),
			);
		}

		return result.sort((a, b) => b.role.position - a.role.position);
	};

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

	return (
		<div
			class="min-w-72 flex w-72 h-full flex-col p-4 border-l z-50 gap-3 border-border overflow-y-auto bg-background"
			classList={{
				"absolute top-0 right-0 h-full drop-shadow-black drop-shadow-2xl":
					displayMembersAsSheet(),
				hidden: !preferences().membersListVisible,
			}}
		>
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
	);
};
