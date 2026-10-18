import { rankOf } from "../member-permissions";
import type {
	CreateRoleInput,
	DataSource,
	LiveEvent,
	MemberRolesInput,
	UpdateRoleInput,
} from "../source";
import type { Did, RoleView } from "../types";
import { withLatency } from "./latency";
import { tidFor } from "./refs";
import type { SpaceRecord } from "./world";

const ICON_BADGE = "social.colibri.beta.community.defs#roleIconBadge";
const IMAGE_BADGE = "social.colibri.beta.community.defs#roleImageBadgeView";
const ROLE_NAME_MAX = 32;
const BADGE_IMAGE_MAX_BYTES = 256 * 1024;
const BADGE_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
];

type RoleOps = Pick<
	DataSource,
	| "setMemberRoles"
	| "createRole"
	| "updateRole"
	| "deleteRole"
	| "putRoleBadgeImage"
>;

export const createRoleOps = (options: {
	spaceOf: (community: Did) => SpaceRecord;
	viewerDid: Did;
	emit: (event: LiveEvent) => void;
}): RoleOps => {
	const { spaceOf, viewerDid, emit } = options;

	const viewerRank = (space: SpaceRecord) =>
		rankOf(
			space.view.viewer.roles ?? [],
			space.roles,
			!!space.view.viewer.isOwner,
		);

	const requireManage = (space: SpaceRecord) => {
		const viewer = space.view.viewer;
		if (!viewer.isOwner && !viewer.permissions?.includes("role.manage")) {
			throw new Error("Not allowed to manage roles");
		}
	};

	const manageable = (space: SpaceRecord, role: RoleView) =>
		!role.protected && role.position < viewerRank(space);

	const roleOf = (space: SpaceRecord, rkey: string) => {
		const role = space.roles.find((entry) => entry.rkey === rkey);
		if (!role) throw new Error(`Unknown role ${rkey}`);
		return role;
	};

	const checkName = (name: string) => {
		const trimmed = name.trim();
		if (!trimmed) throw new Error("A role needs a name");
		if (trimmed.length > ROLE_NAME_MAX) {
			throw new Error("Role names can be at most 32 characters");
		}
		if (/\bfail\b/i.test(trimmed))
			throw new Error("The role couldn't be saved");
		return trimmed;
	};

	const sortRoles = (space: SpaceRecord) =>
		space.roles.sort((a, b) => b.position - a.position);

	const refreshViewer = (space: SpaceRecord) => {
		const viewer = space.view.viewer;
		const roles = viewer.roles ?? [];
		const permissions = viewer.isOwner
			? (viewer.permissions ?? [])
			: [
					...new Set(
						space.roles
							.filter((role) => roles.includes(role.rkey))
							.flatMap((role) => role.permissions),
					),
				];
		space.view = {
			...space.view,
			viewer: {
				...viewer,
				roles: roles.filter((rkey) =>
					space.roles.some((role) => role.rkey === rkey),
				),
				permissions,
			},
		};
	};

	const recount = (space: SpaceRecord) => {
		const counts = new Map<string, number>();
		for (const member of space.members) {
			for (const rkey of member.roles ?? []) {
				counts.set(rkey, (counts.get(rkey) ?? 0) + 1);
			}
		}
		for (const [index, role] of space.roles.entries()) {
			const memberCount = counts.get(role.rkey) ?? 0;
			if (role.memberCount !== memberCount) {
				space.roles[index] = { ...role, memberCount };
			}
		}
	};

	const replaceRole = (space: SpaceRecord, next: RoleView) => {
		const index = space.roles.findIndex((role) => role.rkey === next.rkey);
		if (index < 0) space.roles.push(next);
		else space.roles[index] = next;
		sortRoles(space);
	};

	const announce = (
		space: SpaceRecord,
		event: "create" | "update" | "delete",
		role: RoleView,
	) => emit({ $type: "roleEvent", event, community: space.did, role });

	const setMemberRoles = (input: MemberRolesInput) =>
		withLatency(() => {
			const space = spaceOf(input.community);
			const member = space.members.find(
				(entry) => entry.actor.did === input.subject,
			);
			if (!member) throw new Error(`Unknown member ${input.subject}`);
			const before = new Set(member.roles ?? []);
			const after = new Set(input.roles);
			const changed = [
				...[...before].filter((rkey) => !after.has(rkey)),
				...[...after].filter((rkey) => !before.has(rkey)),
			];
			if (changed.length > 0) requireManage(space);
			for (const rkey of changed) {
				if (!manageable(space, roleOf(space, rkey))) {
					throw new Error("That role is above your own");
				}
			}
			member.roles = [...input.roles];
			if (input.subject === viewerDid) {
				space.view = {
					...space.view,
					viewer: { ...space.view.viewer, roles: [...input.roles] },
				};
				refreshViewer(space);
			}
			recount(space);
			emit({
				$type: "memberRolesEvent",
				community: space.did,
				subject: input.subject,
				roles: [...input.roles],
			});
			for (const rkey of changed)
				announce(space, "update", roleOf(space, rkey));
		});

	const createRole = (input: CreateRoleInput) =>
		withLatency(() => {
			const space = spaceOf(input.community);
			requireManage(space);
			const name = checkName(input.name);
			const lowest = space.roles.reduce(
				(min, role) => Math.min(min, role.position),
				Number.POSITIVE_INFINITY,
			);
			const position =
				input.position ?? (Number.isFinite(lowest) ? lowest - 1 : 0);
			if (position >= viewerRank(space)) {
				throw new Error("New roles must sit below your own");
			}
			const role: RoleView = {
				rkey: tidFor(Date.now(), space.roles.length),
				name,
				permissions: [...new Set(input.permissions)],
				position,
				memberCount: 0,
			};
			if (input.color) role.color = input.color;
			if (input.badge) {
				role.badge = { $type: ICON_BADGE, ...input.badge } as never;
			}
			if (input.hoisted) role.hoisted = true;
			if (input.mentionable) role.mentionable = true;
			replaceRole(space, role);
			announce(space, "create", role);
			return role;
		});

	const updateRole = (input: UpdateRoleInput) =>
		withLatency(() => {
			const space = spaceOf(input.community);
			requireManage(space);
			const current = roleOf(space, input.role);
			if (current.protected) throw new Error("This role can't be changed");
			if (!manageable(space, current)) {
				throw new Error("That role is above your own");
			}
			if (input.position !== undefined && input.position >= viewerRank(space)) {
				throw new Error("Roles can't move above your own");
			}
			const next: RoleView = { ...current };
			if (input.name !== undefined) next.name = checkName(input.name);
			if (input.color !== undefined) {
				if (input.color) next.color = input.color;
				else delete next.color;
			}
			if (input.badge) {
				next.badge = { $type: ICON_BADGE, ...input.badge } as never;
			} else if (input.removeBadge) {
				delete next.badge;
			}
			if (input.permissions) {
				next.permissions = [...new Set(input.permissions)];
			}
			if (input.position !== undefined) next.position = input.position;
			if (input.hoisted !== undefined) next.hoisted = input.hoisted;
			if (input.mentionable !== undefined) {
				next.mentionable = input.mentionable;
			}
			replaceRole(space, next);
			refreshViewer(space);
			announce(space, "update", next);
			return next;
		});

	const deleteRole = (input: { community: Did; role: string }) =>
		withLatency(() => {
			const space = spaceOf(input.community);
			requireManage(space);
			const role = roleOf(space, input.role);
			if (role.protected) throw new Error("This role can't be deleted");
			if (!manageable(space, role)) {
				throw new Error("That role is above your own");
			}
			space.roles.splice(space.roles.indexOf(role), 1);
			for (const member of space.members) {
				if (member.roles?.includes(role.rkey)) {
					member.roles = member.roles.filter((rkey) => rkey !== role.rkey);
				}
			}
			refreshViewer(space);
			announce(space, "delete", role);
		});

	const putRoleBadgeImage = (input: {
		community: Did;
		role: string;
		file: File;
	}) =>
		withLatency(() => {
			const space = spaceOf(input.community);
			requireManage(space);
			const current = roleOf(space, input.role);
			if (!manageable(space, current)) {
				throw new Error("That role is above your own");
			}
			if (!BADGE_IMAGE_TYPES.includes(input.file.type)) {
				throw new Error("Badges must be PNG, JPEG, GIF or WebP images");
			}
			if (input.file.size > BADGE_IMAGE_MAX_BYTES) {
				throw new Error("Badge images can be at most 256 KB");
			}
			const next: RoleView = {
				...current,
				badge: {
					$type: IMAGE_BADGE,
					image: URL.createObjectURL(input.file),
				} as never,
			};
			replaceRole(space, next);
			announce(space, "update", next);
			return next;
		});

	return {
		setMemberRoles,
		createRole,
		updateRole,
		deleteRole,
		putRoleBadgeImage,
	};
};
