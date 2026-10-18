import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { ListGroup, ToggleRow } from "../List/List";

export type RolePermission = {
	key: string;
	name: string;
	description: string;
	dangerous?: boolean;
};

export type RolePermissionGroup = {
	id: string;
	label: string;
	permissions: readonly RolePermission[];
};

export const ROLE_PERMISSION_GROUPS: readonly RolePermissionGroup[] = [
	{
		id: "space",
		label: "Space",
		permissions: [
			{
				key: "community.manage",
				name: "Manage Space",
				description:
					"Edit the Space's name, description, icon, banner and join settings.",
				dangerous: true,
			},
			{
				key: "community.delete",
				name: "Delete Space",
				description: "Delete the Space and everything in it.",
				dangerous: true,
			},
		],
	},
	{
		id: "approvals",
		label: "Approvals",
		permissions: [
			{
				key: "approval.manage",
				name: "Manage approvals",
				description: "Approve or reject pending membership requests.",
			},
		],
	},
	{
		id: "categories",
		label: "Categories",
		permissions: [
			{
				key: "category.create",
				name: "Create categories",
				description: "Create new categories.",
			},
			{
				key: "category.update",
				name: "Edit categories",
				description: "Rename and reorder categories.",
			},
			{
				key: "category.delete",
				name: "Delete categories",
				description: "Delete categories.",
			},
		],
	},
	{
		id: "channels",
		label: "Channels",
		permissions: [
			{
				key: "channel.create",
				name: "Create channels",
				description: "Create new channels.",
			},
			{
				key: "channel.update",
				name: "Edit channels",
				description: "Rename channels and change their settings.",
			},
			{
				key: "channel.delete",
				name: "Delete channels",
				description: "Delete channels.",
			},
		],
	},
	{
		id: "members",
		label: "Members",
		permissions: [
			{
				key: "member.kick",
				name: "Kick members",
				description: "Remove members from the Space.",
				dangerous: true,
			},
			{
				key: "member.ban",
				name: "Ban members",
				description: "Ban members from the Space.",
				dangerous: true,
			},
			{
				key: "member.unban",
				name: "Unban members",
				description: "Lift bans on previously banned members.",
			},
		],
	},
	{
		id: "roles",
		label: "Roles",
		permissions: [
			{
				key: "role.manage",
				name: "Manage roles",
				description:
					"Create, edit and assign roles. Only works for roles below this role's position.",
				dangerous: true,
			},
		],
	},
	{
		id: "moderation",
		label: "Moderation",
		permissions: [
			{
				key: "label.apply",
				name: "Apply labels",
				description:
					"Apply and remove moderation labels on messages and other content.",
			},
			{
				key: "moderation.viewLog",
				name: "View moderation log",
				description: "See the Space's history of kicks, bans and unbans.",
			},
		],
	},
	{
		id: "invitations",
		label: "Invitations",
		permissions: [
			{
				key: "invitation.create",
				name: "Create invitations",
				description: "Create invite links.",
			},
			{
				key: "invitation.delete",
				name: "Delete invitations",
				description: "Revoke existing invite links.",
			},
		],
	},
	{
		id: "voice",
		label: "Voice",
		permissions: [
			{
				key: "voice.moderate",
				name: "Moderate voice",
				description: "Mute, deafen and disconnect members in voice channels.",
			},
		],
	},
	{
		id: "mentions",
		label: "Mentions",
		permissions: [
			{
				key: "mention.roles",
				name: "Mention all roles",
				description: "Mention roles that aren't marked as mentionable.",
			},
		],
	},
	{
		id: "threads",
		label: "Threads",
		permissions: [
			{
				key: "thread.create",
				name: "Create threads",
				description: "Open threads beside a channel.",
			},
			{
				key: "thread.manage",
				name: "Manage threads",
				description: "Rename, move and delete threads opened by anyone.",
			},
			{
				key: "thread.move",
				name: "Move messages",
				description:
					"Move other people's messages into another thread or channel.",
			},
		],
	},
];

export type RolePermissionListProps = {
	value: readonly string[];
	onChange: (value: string[]) => void;
	groups?: readonly RolePermissionGroup[];
	canGrant?: (key: string) => boolean;
	disabled?: boolean;
	class?: string;
};

export const togglePermission = (
	value: readonly string[],
	key: string,
	on: boolean,
) => {
	const rest = value.filter((entry) => entry !== key);
	return on ? [...rest, key] : rest;
};

export const RolePermissionList = (props: RolePermissionListProps) => {
	const granted = (key: string) => props.value.includes(key);
	const allowed = (key: string) => props.canGrant?.(key) ?? true;

	return (
		<div
			data-role-permissions=""
			class={cx("flex w-full flex-col gap-6", props.class)}
		>
			<For each={props.groups ?? ROLE_PERMISSION_GROUPS}>
				{(group) => (
					<ListGroup label={group.label}>
						<For each={group.permissions}>
							{(permission) => (
								<ToggleRow
									name={permission.key}
									checked={granted(permission.key)}
									disabled={props.disabled || !allowed(permission.key)}
									onChange={(on) =>
										props.onChange(
											togglePermission(props.value, permission.key, on),
										)
									}
									title={
										<span
											data-permission={permission.key}
											data-dangerous={permission.dangerous || undefined}
											class="flex min-w-0 items-center gap-1.5"
										>
											<span class="truncate">{permission.name}</span>
											<Show when={permission.dangerous}>
												<span
													role="img"
													aria-label="Sensitive permission"
													title="Sensitive permission"
													class="flex size-4 shrink-0 items-center justify-center text-destructive [&>svg]:size-4"
												>
													<DangerTriangleIcon />
												</span>
											</Show>
										</span>
									}
									description={
										<>
											{permission.description}
											<Show when={!allowed(permission.key)}>
												{" "}
												You can't grant a permission you don't have.
											</Show>
										</>
									}
								/>
							)}
						</For>
					</ListGroup>
				)}
			</For>
		</div>
	);
};
