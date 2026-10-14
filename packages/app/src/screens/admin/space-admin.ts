import { createMemo } from "solid-js";
import { spaceKey } from "../../data/ids";
import { type DataStore, useData } from "../../data/store";
import type { CommunityView, Did } from "../../data/types";
import type { Navigator } from "../../shell/stack";

export const SPACE_PERMISSIONS = {
	manage: "community.manage",
	delete: "community.delete",
	approvals: "approval.manage",
	unban: "member.unban",
	roles: "role.manage",
	createInvite: "invitation.create",
	deleteInvite: "invitation.delete",
} as const;

export const canInSpace = (
	community: CommunityView | undefined,
	permission: string,
) => {
	const viewer = community?.viewer;
	return !!viewer?.isOwner || !!viewer?.permissions?.includes(permission);
};

export const useAdminSpace = (space: string) => {
	const data = useData();
	const community = createMemo(() => data.spaceByKey(space));
	const missing = () => !data.communities.loading() && !community();
	return {
		data,
		community,
		missing,
		can: (permission: string) => canInSpace(community(), permission),
	};
};

export const moveOffSpace = (data: DataStore, stack: Navigator, did: Did) => {
	const inside = stack
		.mounted()
		.findIndex((layer) => "space" in layer && layer.space === did);
	if (inside >= 0) stack.popTo(0);
	const root = stack.root();
	if (root.tab !== "spaces") return;
	if (root.space && root.space !== did && data.spaceByKey(root.space)) return;
	const next = data.communities.value()?.find((entry) => entry.did !== did);
	stack.setRoot({
		tab: "spaces",
		space: next ? spaceKey(next) : undefined,
	});
};
