import type { RoleBadgeValue } from "@colibri-social/ui";
import type { RoleDraft, RolePatch } from "../../../data/role-store";
import { roleBadge } from "../../../data/roles";
import type { RoleView } from "../../../data/types";

export const ROLE_NAME_MAX = 32;
export const DEFAULT_ROLE_NAME = "New Role";

export type RoleForm = {
	name: string;
	color?: string;
	badge?: RoleBadgeValue;
	hoisted: boolean;
	mentionable: boolean;
	permissions: string[];
};

export const formOf = (role: RoleView | undefined): RoleForm => ({
	name: role?.name ?? DEFAULT_ROLE_NAME,
	color: role?.color,
	badge: role ? roleBadge(role) : undefined,
	hoisted: !!role?.hoisted,
	mentionable: !!role?.mentionable,
	permissions: [...(role?.permissions ?? [])],
});

export const sameBadge = (a?: RoleBadgeValue, b?: RoleBadgeValue) => {
	if (!a || !b) return a === b;
	if (a.kind === "image" || b.kind === "image") {
		return a.kind === "image" && b.kind === "image" && a.url === b.url;
	}
	return a.name === b.name && (a.color ?? "") === (b.color ?? "");
};

export const samePermissions = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((entry) => b.includes(entry));

export const roleNameError = (name: string) => {
	const trimmed = name.trim();
	if (!trimmed) return "Give the role a name.";
	if (trimmed.length > ROLE_NAME_MAX) {
		return `Role names can be at most ${ROLE_NAME_MAX} characters.`;
	}
	return undefined;
};

export const rolePatch = (before: RoleForm, after: RoleForm): RolePatch => {
	const patch: RolePatch = {};
	if (after.name.trim() !== before.name) patch.name = after.name.trim();
	if ((after.color ?? "") !== (before.color ?? "")) {
		patch.color = after.color ?? "";
	}
	if (!sameBadge(before.badge, after.badge)) {
		if (after.badge?.kind === "icon") {
			patch.badge = { icon: after.badge.name, color: after.badge.color };
		} else if (!after.badge) {
			patch.removeBadge = true;
		}
	}
	if (after.hoisted !== before.hoisted) patch.hoisted = after.hoisted;
	if (after.mentionable !== before.mentionable) {
		patch.mentionable = after.mentionable;
	}
	if (!samePermissions(after.permissions, before.permissions)) {
		patch.permissions = after.permissions;
	}
	return patch;
};

export const draftOf = (form: RoleForm): RoleDraft => {
	const draft: RoleDraft = {
		name: form.name.trim(),
		permissions: form.permissions,
		hoisted: form.hoisted,
		mentionable: form.mentionable,
	};
	if (form.color) draft.color = form.color;
	if (form.badge?.kind === "icon") {
		draft.badge = { icon: form.badge.name, color: form.badge.color };
	}
	return draft;
};

export const deleteDescription = (count: number) =>
	`${
		count > 0
			? `This role will be removed from ${count} member${count === 1 ? "" : "s"}. `
			: ""
	}This action cannot be undone.`;
