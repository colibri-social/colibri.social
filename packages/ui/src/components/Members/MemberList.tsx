import { createMemo, For, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import type { Presence } from "../Avatar/Avatar";
import type { BadgeDefinition } from "../Badge/Badge";
import type { CustomEmoji } from "../EmojiPicker/EmojiPicker";
import type { RoleIdentity } from "../Roles/RoleBadge";
import { MemberListFlatRow } from "./MemberListParts";
import type { MemberRowVariant } from "./MemberRow";
import {
	countMemberRows,
	createStableMemberRows,
	flattenMemberGroups,
} from "./member-list-model";
import { VirtualMemberList } from "./VirtualMemberList";

export type Member = {
	id: string;
	name: string;
	avatarSrc?: string;
	avatarColor?: string;
	presence: Presence;
	status?: string;
	statusEmoji?: string;
	statusCustomEmoji?: CustomEmoji;
	statusShowWhileOffline?: boolean;
	role?: RoleIdentity;
	hoistedRoleId?: string;
	bot?: boolean;
	owner?: boolean;
	activity?: MemberActivity;
};

export type MemberActivity = {
	kind: string;
	summary: string;
	more?: number;
};

export type HoistedRole = RoleIdentity & {
	id: string;
};

export type MemberGroupKind = "role" | "online" | "bots" | "offline";

export type MemberGroup = {
	id: string;
	label: string;
	kind: MemberGroupKind;
	role?: RoleIdentity;
	members: Member[];
};

const byName = (a: Member, b: Member) =>
	a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

export const groupMembers = (
	members: Member[],
	roles: HoistedRole[] = [],
): MemberGroup[] => {
	const online = members.filter((member) => member.presence !== "offline");
	const offline = members.filter((member) => member.presence === "offline");
	const placed = new Set<string>();
	const groups: MemberGroup[] = [];

	for (const role of roles) {
		const inRole = online
			.filter((member) => !member.bot && member.hoistedRoleId === role.id)
			.sort(byName);
		for (const member of inRole) placed.add(member.id);
		if (inRole.length > 0)
			groups.push({
				id: `role:${role.id}`,
				label: role.name,
				kind: "role",
				role,
				members: inRole,
			});
	}

	const rest = online
		.filter((member) => !member.bot && !placed.has(member.id))
		.sort(byName);
	if (rest.length > 0)
		groups.push({
			id: "online",
			label: "Online",
			kind: "online",
			members: rest,
		});

	const bots = online.filter((member) => member.bot).sort(byName);
	if (bots.length > 0)
		groups.push({ id: "bots", label: "Bots", kind: "bots", members: bots });

	if (offline.length > 0)
		groups.push({
			id: "offline",
			label: "Offline",
			kind: "offline",
			members: [...offline].sort(byName),
		});

	return groups;
};

export { memberGroupHeaderClass } from "./MemberListParts";

export const MEMBER_VIRTUALIZE_AFTER = 150;

export type MemberListProps = {
	groups: MemberGroup[];
	variant?: MemberRowVariant;
	onOpen?: (member: Member, event: MouseEvent) => void;
	onMemberContextMenu?: (member: Member, event: MouseEvent) => void;
	onMemberMenu?: (member: Member, event: Event) => void;
	wrapMember?: (member: Member, row: JSX.Element) => JSX.Element;
	badgeOf?: (member: Member) => BadgeDefinition | undefined;
	virtualizeAfter?: number;
	class?: string;
};

const StaticMemberList = (
	props: Omit<MemberListProps, "variant"> & { variant: MemberRowVariant },
) => {
	const stableRows = createStableMemberRows();
	const rows = createMemo(() => stableRows(flattenMemberGroups(props.groups)));

	return (
		<div
			data-member-list=""
			data-variant={props.variant}
			class={cx(props.variant === "desktop" && "px-2 py-4", props.class)}
		>
			<For each={rows()}>
				{(stable) => (
					<MemberListFlatRow
						stable={stable}
						variant={props.variant}
						onOpen={props.onOpen}
						onMemberContextMenu={props.onMemberContextMenu}
						onMemberMenu={props.onMemberMenu}
						wrapMember={props.wrapMember}
						badgeOf={props.badgeOf}
					/>
				)}
			</For>
		</div>
	);
};

export const MemberList = (props: MemberListProps) => {
	const variant = () => props.variant ?? "desktop";
	const threshold = () => props.virtualizeAfter ?? MEMBER_VIRTUALIZE_AFTER;
	const virtual = createMemo<boolean>((previous) => {
		const rows = countMemberRows(props.groups);
		return previous ? rows > threshold() / 2 : rows > threshold();
	}, false);

	return (
		<Show
			when={virtual()}
			fallback={
				<StaticMemberList
					groups={props.groups}
					variant={variant()}
					onOpen={props.onOpen}
					onMemberContextMenu={props.onMemberContextMenu}
					onMemberMenu={props.onMemberMenu}
					wrapMember={props.wrapMember}
					badgeOf={props.badgeOf}
					class={props.class}
				/>
			}
		>
			<VirtualMemberList
				groups={props.groups}
				variant={variant()}
				onOpen={props.onOpen}
				onMemberContextMenu={props.onMemberContextMenu}
				onMemberMenu={props.onMemberMenu}
				wrapMember={props.wrapMember}
				badgeOf={props.badgeOf}
				class={props.class}
			/>
		</Show>
	);
};
