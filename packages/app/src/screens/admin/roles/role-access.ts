import { createMemo } from "solid-js";
import { rankOf } from "../../../data/member-permissions";
import { isDefaultRole, roleIdentity } from "../../../data/roles";
import { useData } from "../../../data/store";
import type { RoleView } from "../../../data/types";

export const ROLE_MANAGE = "role.manage";

export const useRoleAccess = (spaceKey: () => string) => {
	const data = useData();
	const community = createMemo(() => data.spaceByKey(spaceKey()));
	const space = createMemo(() => {
		const current = community();
		return current ? data.space(current) : undefined;
	});
	const roles = createMemo(() => space()?.roles.value() ?? []);
	const loading = () =>
		data.communities.loading() || (!!space() && !!space()?.roles.loading());
	const missing = () => !data.communities.loading() && !community();
	const isOwner = () => !!community()?.viewer.isOwner;
	const canManage = () =>
		isOwner() || !!community()?.viewer.permissions?.includes(ROLE_MANAGE);
	const rank = createMemo(() =>
		rankOf(community()?.viewer.roles ?? [], roles(), isOwner()),
	);
	const editable = (role: RoleView) =>
		canManage() && !role.protected && role.position < rank();
	const canGrant = (permission: string) =>
		isOwner() || !!community()?.viewer.permissions?.includes(permission);
	return {
		data,
		community,
		space,
		roles,
		loading,
		missing,
		canManage,
		rank,
		editable,
		canGrant,
	};
};

export const spaceRoleOf = (role: RoleView, editable: boolean) => ({
	...roleIdentity(role),
	id: role.rkey,
	protected: role.protected || isDefaultRole(role),
	locked: !editable,
});
