import type { CreateRoleInput, DataSource, UpdateRoleInput } from "./source";
import type { CommunityView, Did, MemberView, RoleView } from "./types";

export type RoleDraft = Omit<CreateRoleInput, "community">;
export type RolePatch = Omit<UpdateRoleInput, "community" | "role">;

export type RoleActions = {
	createRole: (draft: RoleDraft) => Promise<RoleView>;
	updateRole: (rkey: string, patch: RolePatch) => Promise<RoleView>;
	deleteRole: (rkey: string) => Promise<void>;
	reorderRoles: (ids: readonly string[]) => Promise<void>;
	setRoleBadgeImage: (rkey: string, file: File) => Promise<RoleView>;
};

type Updatable<T> = {
	value: () => T | undefined;
	update: (change: (current: T) => T) => void;
};

export const sortRoles = (roles: readonly RoleView[]) =>
	[...roles].sort((a, b) => b.position - a.position);

export const upsertRole = (roles: readonly RoleView[], next: RoleView) => {
	const exists = roles.some((role) => role.rkey === next.rkey);
	return sortRoles(
		exists
			? roles.map((role) => (role.rkey === next.rkey ? next : role))
			: [...roles, next],
	);
};

export const withoutRole = (roles: readonly RoleView[], rkey: string) =>
	roles.filter((role) => role.rkey !== rkey);

export const stripRole = (members: readonly MemberView[], rkey: string) =>
	members.map((member) =>
		member.roles?.includes(rkey)
			? { ...member, roles: member.roles.filter((entry) => entry !== rkey) }
			: member,
	);

export const viewerFrom = (
	view: CommunityView,
	roles: readonly RoleView[],
	viewerRoles: readonly string[] = view.viewer.roles ?? [],
): CommunityView => {
	const held = viewerRoles.filter((rkey) =>
		roles.some((role) => role.rkey === rkey),
	);
	const permissions = view.viewer.isOwner
		? (view.viewer.permissions ?? [])
		: [
				...new Set(
					roles
						.filter((role) => held.includes(role.rkey))
						.flatMap((role) => role.permissions),
				),
			];
	return { ...view, viewer: { ...view.viewer, roles: held, permissions } };
};

export const reorderedPositions = (
	ordered: readonly RoleView[],
	ceiling: number,
) => {
	const top = Math.min(ordered.length, ceiling - 1);
	return ordered.map((_, index) => top - index);
};

export const countChange = (
	roles: readonly RoleView[],
	before: readonly string[],
	after: readonly string[],
) =>
	roles.map((role) => {
		const had = before.includes(role.rkey);
		const has = after.includes(role.rkey);
		if (had === has) return role;
		return {
			...role,
			memberCount: Math.max(0, (role.memberCount ?? 0) + (has ? 1 : -1)),
		};
	});

export const createRoleActions = (options: {
	source: DataSource;
	community: Did;
	roles: Updatable<RoleView[]>;
	members: Updatable<MemberView[]>;
	syncViewer: () => void;
}): RoleActions => {
	const { source, community, roles, members, syncViewer } = options;

	const settle = (role: RoleView) => {
		roles.update((list) => upsertRole(list, role));
		syncViewer();
		return role;
	};

	const restore = (previous: RoleView[] | undefined) => {
		if (previous) roles.update(() => previous);
		syncViewer();
	};

	const createRole = async (draft: RoleDraft) => {
		const created = await source.createRole({ ...draft, community });
		return settle(created);
	};

	const updateRole = async (rkey: string, patch: RolePatch) => {
		const previous = roles.value();
		const current = previous?.find((role) => role.rkey === rkey);
		if (current) {
			const optimistic: RoleView = { ...current };
			if (patch.name !== undefined) optimistic.name = patch.name;
			if (patch.color !== undefined) {
				if (patch.color) optimistic.color = patch.color;
				else delete optimistic.color;
			}
			if (patch.permissions) optimistic.permissions = patch.permissions;
			if (patch.position !== undefined) optimistic.position = patch.position;
			if (patch.hoisted !== undefined) optimistic.hoisted = patch.hoisted;
			if (patch.mentionable !== undefined) {
				optimistic.mentionable = patch.mentionable;
			}
			if (patch.removeBadge && !patch.badge) delete optimistic.badge;
			roles.update((list) => upsertRole(list, optimistic));
			syncViewer();
		}
		try {
			return settle(
				await source.updateRole({ ...patch, community, role: rkey }),
			);
		} catch (error) {
			restore(previous);
			throw error;
		}
	};

	const deleteRole = async (rkey: string) => {
		const previousRoles = roles.value();
		const previousMembers = members.value();
		roles.update((list) => withoutRole(list, rkey));
		members.update((list) => stripRole(list, rkey));
		syncViewer();
		try {
			await source.deleteRole({ community, role: rkey });
		} catch (error) {
			if (previousMembers) members.update(() => previousMembers);
			restore(previousRoles);
			throw error;
		}
	};

	const reorderRoles = async (ids: readonly string[]) => {
		const previous = roles.value();
		if (!previous) return;
		const byKey = new Map(previous.map((role) => [role.rkey, role]));
		const ordered = ids
			.map((id) => byKey.get(id))
			.filter((role): role is RoleView => !!role && !role.protected);
		const ceiling = previous
			.filter((role) => role.protected)
			.reduce(
				(max, role) => Math.max(max, role.position),
				Number.NEGATIVE_INFINITY,
			);
		const positions = reorderedPositions(
			ordered,
			Number.isFinite(ceiling) ? ceiling : ordered.length + 1,
		);
		const changes = ordered
			.map((role, index) => ({ role, position: positions[index] as number }))
			.filter(({ role, position }) => role.position !== position);
		if (changes.length === 0) return;
		const moved = new Map(
			changes.map(({ role, position }) => [role.rkey, position]),
		);
		roles.update((list) =>
			sortRoles(
				list.map((role) => {
					const position = moved.get(role.rkey);
					return position === undefined ? role : { ...role, position };
				}),
			),
		);
		try {
			const saved = await Promise.all(
				changes.map(({ role, position }) =>
					source.updateRole({ community, role: role.rkey, position }),
				),
			);
			roles.update((list) => saved.reduce(upsertRole, list));
		} catch (error) {
			restore(previous);
			throw error;
		}
	};

	const setRoleBadgeImage = async (rkey: string, file: File) =>
		settle(await source.putRoleBadgeImage({ community, role: rkey, file }));

	return {
		createRole,
		updateRole,
		deleteRole,
		reorderRoles,
		setRoleBadgeImage,
	};
};
