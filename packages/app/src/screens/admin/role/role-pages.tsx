import {
	type MemberIdentityData,
	RoleMembers,
	RolePermissionList,
} from "@colibri-social/ui";
import { createMemo, onMount, Show } from "solid-js";
import { defineContract, slot } from "../../../screen/define";
import { usePlatform } from "../../../screen/platform";
import type { AdminArgs } from "../../../shell/registry";
import { type Navigator, useStack } from "../../../shell/stack";
import { adminDraft, adminDraftKey, provideAdminDraft } from "../admin-draft";
import { AdminNavHeader } from "../desktop/page-header";

export type RoleDraft = {
	name: () => string;
	permissions: () => readonly string[];
	setPermissions: (value: string[]) => void;
	canGrant: (permission: string) => boolean;
	disabled: () => boolean;
	holders: () => readonly MemberIdentityData[];
	candidates: () => readonly MemberIdentityData[];
	canManage: () => boolean;
	addHolders: (ids: string[]) => Promise<void>;
	removeHolder: (id: string) => Promise<void>;
};

const roleDraftKey = (space: string, id: string) =>
	adminDraftKey("role", space, id);

export const provideRoleDraft = (space: string, id: string, draft: RoleDraft) =>
	provideAdminDraft(roleDraftKey(space, id), draft);

export const openRolePage = (
	stack: Navigator,
	space: string,
	id: string,
	page: "role-permissions" | "role-members",
) => stack.push({ kind: "admin", space, page, id });

const useRoleDraft = (args: AdminArgs) => {
	const stack = useStack();
	const id = args.id ?? "";
	const draft = createMemo(() =>
		adminDraft<RoleDraft>(roleDraftKey(args.space, id)),
	);
	onMount(() => {
		if (draft()) return;
		stack.replaceTop({ kind: "admin", space: args.space, page: "role", id });
	});
	return { draft, back: () => stack.pop() };
};

export const adminRolePermissions = defineContract({
	id: "adminRolePermissions",
	model: (args: AdminArgs) => useRoleDraft(args),
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				onNavigate={m.back}
				title="Permissions"
			/>
		)),
		Body: slot((m) => (
			<Show when={m.draft()}>
				{(draft) => (
					<RolePermissionList
						value={draft().permissions()}
						onChange={draft().setPermissions}
						canGrant={draft().canGrant}
						disabled={draft().disabled()}
					/>
				)}
			</Show>
		)),
	},
});

export const adminRoleMembers = defineContract({
	id: "adminRoleMembers",
	model: (args: AdminArgs) => useRoleDraft(args),
	slots: {
		Header: slot((m) => (
			<AdminNavHeader safeTop kind="back" onNavigate={m.back} title="Members" />
		)),
		Body: slot((m) => (
			<Show when={m.draft()}>
				{(draft) => (
					<RoleMembers
						platform={usePlatform()()}
						roleName={draft().name()}
						members={draft().holders()}
						candidates={draft().candidates()}
						canManage={draft().canManage()}
						onAdd={draft().addHolders}
						onRemove={(member) => draft().removeHolder(member.id)}
					/>
				)}
			</Show>
		)),
	},
});
