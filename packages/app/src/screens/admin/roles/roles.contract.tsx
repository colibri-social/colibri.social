import {
	ListGroup,
	SpaceRoleList,
	SpaceRoleListSkeleton,
	StatusScreen,
	ToggleRow,
	toast,
} from "@colibri-social/ui";
import { AddIcon } from "@solar-icons/solid/bold/add";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import { defineContract, slot } from "../../../screen/define";
import { NEW_ENTRY } from "../../../shell/layers";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { AdminNavHeader } from "../desktop/page-header";
import { spaceRoleOf, useRoleAccess } from "./role-access";

export const adminRoles = defineContract({
	id: "adminRoles",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const access = useRoleAccess(() => args.space);
		const listed = createMemo(() =>
			access.roles().map((role) => spaceRoleOf(role, access.editable(role))),
		);
		const editableCount = () =>
			access.roles().filter((role) => access.editable(role)).length;
		const open = (rkey: string) =>
			stack.push({ kind: "admin", space: args.space, page: "role", id: rkey });
		const canManageSpace = () => {
			const viewer = access.community()?.viewer;
			return (
				!!viewer?.isOwner || !!viewer?.permissions?.includes("community.manage")
			);
		};
		const [overridePending, setOverridePending] = createSignal<boolean>();
		const overrideColors = () =>
			overridePending() ?? !!access.community()?.overrideUserNameColors;
		const setOverrideColors = async (on: boolean) => {
			const community = access.community();
			if (!community) return;
			setOverridePending(on);
			try {
				await access.data.community.update({
					community: community.did,
					overrideUserNameColors: on,
				});
			} catch {
				toast.error("Couldn't update name colors");
			} finally {
				setOverridePending(undefined);
			}
		};
		const reorder = async (ids: string[]) => {
			try {
				await access.space()?.reorderRoles(ids);
			} catch (error) {
				toast.error("Couldn't reorder roles");
				throw error;
			}
		};
		return {
			...access,
			stack,
			listed,
			canReorder: () => access.canManage() && editableCount() > 1,
			canManageSpace,
			overrideColors,
			setOverrideColors,
			open,
			create: () => open(NEW_ENTRY),
			reorder,
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				onNavigate={() => m.stack.pop()}
				title="Roles"
				action={
					m.canManage() && !m.missing()
						? {
								type: "icon",
								label: "Create role",
								icon: <AddIcon />,
								onClick: m.create,
							}
						: undefined
				}
			/>
		)),
		NameColors: slot((m) => (
			<Show when={!m.missing() && !m.loading()}>
				<ListGroup>
					<ToggleRow
						title="Override user name colors"
						description="Always shows a white color for online users without a role"
						checked={m.overrideColors()}
						onChange={(on) => void m.setOverrideColors(on)}
						disabled={!m.canManageSpace()}
					/>
				</ListGroup>
			</Show>
		)),
		List: slot((m) => (
			<Switch>
				<Match when={m.missing()}>
					<StatusScreen
						tone="destructive"
						icon={<DangerTriangleIcon />}
						title="This Space isn't available"
						description="It may have been deleted, or you're no longer a member."
					/>
				</Match>
				<Match when={m.loading()}>
					<SpaceRoleListSkeleton />
				</Match>
				<Match when={true}>
					<SpaceRoleList
						roles={m.listed()}
						canReorder={m.canReorder()}
						onReorder={m.canReorder() ? m.reorder : undefined}
						onOpen={(role) => m.open(role.id)}
					/>
				</Match>
			</Switch>
		)),
	},
});
