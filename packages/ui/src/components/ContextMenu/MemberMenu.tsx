import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { ShieldUserIcon } from "@solar-icons/solid/bold/shield-user";
import { UserBlockRoundedIcon } from "@solar-icons/solid/bold/user-block-rounded";
import { UserCircleIcon } from "@solar-icons/solid/bold/user-circle";
import { UserMinusRoundedIcon } from "@solar-icons/solid/bold/user-minus-rounded";
import { createMemo, type JSX, untrack } from "solid-js";
import {
	DropdownMenu,
	type DropdownMenuCheckboxEntry,
	type DropdownMenuEntry,
	type DropdownMenuPlacement,
} from "../DropdownMenu/DropdownMenu";
import { RoleColorDot } from "../Roles/RoleBadge";
import {
	type DeveloperMenuActions,
	developerEntry,
	EntryContextMenu,
	sectionEntries,
	type TargetContextMenuProps,
} from "./menu-entries";

export type MemberMenuRole = {
	id: string;
	name: string;
	color?: string;
	assigned: boolean;
	manageable: boolean;
};

export type MemberMenuActions = DeveloperMenuActions & {
	onViewProfile?: () => void;
	roles?: MemberMenuRole[];
	onRoleChange?: (id: string, assigned: boolean) => void;
	onKick?: () => void;
	onBan?: () => void;
	onCopyDid?: () => void;
};

export const canEditMemberRoles = (actions: MemberMenuActions) =>
	!!actions.onRoleChange &&
	(actions.roles ?? []).some((role) => role.manageable);

export const assignedRoleCount = (actions: MemberMenuActions) =>
	(actions.roles ?? []).filter((role) => role.assigned).length;

const roleEntry = (
	id: string,
	actions: MemberMenuActions,
): DropdownMenuCheckboxEntry => {
	const role = () => actions.roles?.find((entry) => entry.id === id);
	return {
		kind: "checkbox",
		get label() {
			return role()?.name ?? "";
		},
		get icon() {
			return <RoleColorDot color={role()?.color} />;
		},
		get checked() {
			return !!role()?.assigned;
		},
		get disabled() {
			return !role()?.manageable;
		},
		onChange: (checked) => actions.onRoleChange?.(id, checked),
	};
};

export const memberMenuEntries = (
	name: string,
	actions: MemberMenuActions,
): DropdownMenuEntry[] =>
	sectionEntries([
		{
			items: [
				actions.onViewProfile && {
					label: "View profile",
					get icon() {
						return <UserCircleIcon />;
					},
					onSelect: actions.onViewProfile,
				},
				canEditMemberRoles(actions) && {
					kind: "submenu",
					label: "Roles",
					get icon() {
						return <ShieldUserIcon />;
					},
					items: (actions.roles ?? []).map((role) =>
						roleEntry(role.id, actions),
					),
				},
			],
		},
		{
			items: [
				actions.onKick && {
					label: `Kick ${name}`,
					get icon() {
						return <UserMinusRoundedIcon />;
					},
					tone: "destructive",
					onSelect: actions.onKick,
				},
				actions.onBan && {
					label: `Ban ${name}`,
					get icon() {
						return <UserBlockRoundedIcon />;
					},
					tone: "destructive",
					onSelect: actions.onBan,
				},
			],
		},
		{
			items: [
				actions.onCopyDid && {
					label: "Copy DID",
					get icon() {
						return <CopyIcon />;
					},
					onSelect: actions.onCopyDid,
				},
				developerEntry(actions),
			],
		},
	]);

export type MemberContextMenuProps = MemberMenuActions &
	TargetContextMenuProps & { name: string };

const menuShape = (props: MemberMenuActions & { name: string }) =>
	[
		props.name,
		!!props.onViewProfile,
		canEditMemberRoles(props),
		(props.roles ?? []).map((role) => role.id).join("\n"),
		!!props.onKick,
		!!props.onBan,
		!!props.onCopyDid,
		!!props.developerMode,
		!!props.onCopyAtUri,
		!!props.onShowOnPdsls,
	].join("|");

export const MemberContextMenu = (props: MemberContextMenuProps) => {
	const shape = createMemo(() => menuShape(props));
	return (
		<EntryContextMenu
			label={`${props.name} options`}
			entries={() => {
				shape();
				return untrack(() => memberMenuEntries(props.name, props));
			}}
			disabled={props.disabled}
			onOpenChange={props.onOpenChange}
			class={props.class}
		>
			{props.children}
		</EntryContextMenu>
	);
};

export type MemberDropdownMenuProps = MemberMenuActions & {
	name: string;
	trigger: JSX.Element;
	triggerClass?: string;
	triggerProps?: Record<string, unknown>;
	placement?: DropdownMenuPlacement;
	onOpenChange?: (open: boolean) => void;
};

export const MemberDropdownMenu = (props: MemberDropdownMenuProps) => {
	const shape = createMemo(() => menuShape(props));
	const entries = createMemo(() => {
		shape();
		return untrack(() => memberMenuEntries(props.name, props));
	});
	return (
		<DropdownMenu
			platform="desktop"
			label={`${props.name} options`}
			items={entries()}
			trigger={props.trigger}
			triggerClass={props.triggerClass}
			triggerProps={props.triggerProps}
			placement={props.placement ?? "bottom-end"}
			onOpenChange={props.onOpenChange}
		/>
	);
};
