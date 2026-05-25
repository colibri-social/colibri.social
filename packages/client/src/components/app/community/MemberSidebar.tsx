import { For, Show } from "solid-js";
import { Member } from "../../../atproto/xrpc/social/colibri/community/listMembers";
import { Role } from "../../../atproto/xrpc/social/colibri/community/listRoles";
import { useCommunityContext } from "../../../contexts/Community";
import createMediaQuery from "../../../utils/create-media-query";
import User from "../user";
import twemoji from "@twemoji/api";

type MembersByRoles = Array<{
	role: Role;
	members: Array<Member>;
}>;

export const MemberSidebar = () => {
	const community = useCommunityContext();

	const membersByRoles = (): MembersByRoles => {
		const result: MembersByRoles = community()
			.roles.slice()
			.sort((a, b) => a.position - b.position)
			.map((x) => ({ role: x, members: [] }));

		for (const member of community().members) {
			const sortedMemberRoles = member.roles.sort(
				(a, b) =>
					result.findIndex((y) => y.role.uri === a) -
					result.findIndex((z) => z.role.uri === b),
			);

			const highestMemberRole = sortedMemberRoles[0];
			const resultIndex = result.findIndex(
				(x) => x.role.uri === highestMemberRole,
			);

			if (resultIndex < 0) continue;

			result[resultIndex].members.push(member);
		}

		return result;
	};

	// TODO: Still needed elsewhere, refactor
	const displayMembersAsSheet = createMediaQuery("(max-width: 1280px)");

	return (
		<div
			class="min-w-72 flex w-72 h-full flex-col p-4 border-l gap-3 border-border overflow-y-auto bg-background"
			classList={{
				"absolute top-0 right-0 h-full drop-shadow-black drop-shadow-2xl":
					displayMembersAsSheet(),
				// hidden: !globalContext.uiStates.membersListVisible, TODO: Toggleable
			}}
		>
			<For each={membersByRoles()}>
				{(role, _) => (
					<>
						<span>
							{role.role.name} ({role.members.length})
						</span>
						<For each={role.members}>
							{(member, _) => (
								<User.ProfilePopover
									user={member}
									class="data-expanded:[&>div]:bg-muted!"
								>
									<div class="flex flex-row gap-2 rounded-sm px-2 py-1 hover:bg-card items-center cursor-pointer h-12 flex-1">
										<User.Avatar user={member} />
										<div class="flex flex-col w-[calc(100%-36px-8px)]">
											<span class="font-medium leading-5 overflow-hidden text-ellipsis">
												<User.DisplayableName user={member} />
											</span>
											<Show
												when={
													member.data.status &&
													member.data.onlineState !== "offline"
												}
											>
												<span class="text-sm w-full leading-5 flex flex-row items-center gap-2">
													<Show when={member.data.status!.emoji}>
														<span
															class="[&>img]:min-w-4 [&>img]:min-h-4 [&>img]:w-4 [&>img]:h-4 [&>img]inline"
															innerHTML={twemoji.parse(
																member.data.status!.emoji!,
															)}
														/>
													</Show>
													<span class="w-full overflow-hidden text-ellipsis whitespace-nowrap">
														{member.data.status!.text}
													</span>
												</span>
											</Show>
										</div>
									</div>
								</User.ProfilePopover>
							)}
						</For>
					</>
				)}
			</For>
		</div>
	);
};
