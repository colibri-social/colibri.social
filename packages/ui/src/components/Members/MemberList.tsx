import { For, type JSX } from "solid-js";
import { cx } from "../../utils/cx";
import type { Presence } from "../Avatar/Avatar";
import { SectionLabel } from "../List/List";
import { MemberRow, type MemberRowVariant } from "./MemberRow";

export type Member = {
	id: string;
	name: string;
	avatarSrc?: string;
	avatarColor?: string;
	presence: Presence;
	status?: string;
	roleColor?: string;
	hoistedRoleId?: string;
	bot?: boolean;
	owner?: boolean;
};

export type HoistedRole = {
	id: string;
	name: string;
};

export type MemberGroupKind = "role" | "online" | "bots" | "offline";

export type MemberGroup = {
	id: string;
	label: string;
	kind: MemberGroupKind;
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

export const memberGroupHeaderClass =
	"min-h-[18px] px-2 [&_*]:leading-[18px] [&_*]:font-normal";

export type MemberListProps = {
	groups: MemberGroup[];
	variant?: MemberRowVariant;
	onOpen?: (member: Member) => void;
	onMemberContextMenu?: (member: Member, event: MouseEvent) => void;
	class?: string;
};

export const MemberList = (props: MemberListProps) => {
	const variant = () => props.variant ?? "desktop";

	const Row = (rowProps: { member: Member; offline: boolean }) => (
		<MemberRow
			variant={variant()}
			name={rowProps.member.name}
			avatarSrc={rowProps.member.avatarSrc}
			avatarColor={rowProps.member.avatarColor}
			presence={rowProps.member.presence}
			status={rowProps.member.status}
			roleColor={rowProps.member.roleColor}
			bot={rowProps.member.bot}
			owner={rowProps.member.owner}
			offline={rowProps.offline}
			onOpen={props.onOpen ? () => props.onOpen?.(rowProps.member) : undefined}
			onContextMenu={
				props.onMemberContextMenu
					? (event) => {
							event.preventDefault();
							props.onMemberContextMenu?.(rowProps.member, event);
						}
					: undefined
			}
		/>
	);

	const rows = (group: MemberGroup): JSX.Element => (
		<For each={group.members}>
			{(member) => <Row member={member} offline={group.kind === "offline"} />}
		</For>
	);

	return (
		<div
			data-member-list=""
			data-variant={variant()}
			class={cx(
				"flex flex-col",
				variant() === "mobile" ? "gap-6" : "gap-4 px-2 py-4",
				props.class,
			)}
		>
			<For each={props.groups}>
				{(group) => (
					<section
						aria-label={`${group.label}, ${group.members.length}`}
						data-member-group={group.kind}
						class={cx(
							"flex flex-col",
							variant() === "mobile" ? "gap-2" : "gap-2",
						)}
					>
						<SectionLabel
							class={
								variant() === "desktop" ? memberGroupHeaderClass : undefined
							}
							label={group.label}
							count={group.members.length}
						/>
						<div
							class={cx(
								"flex flex-col",
								variant() === "mobile" &&
									"overflow-hidden rounded-control bg-secondary",
							)}
						>
							{rows(group)}
						</div>
					</section>
				)}
			</For>
		</div>
	);
};
