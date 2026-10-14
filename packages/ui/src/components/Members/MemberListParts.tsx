import { type JSX, Show } from "solid-js";
import { SectionLabel } from "../List/List";
import { RoleBadge } from "../Roles/RoleBadge";
import type { Member, MemberGroup } from "./MemberList";
import { MemberRow, type MemberRowVariant } from "./MemberRow";

export const memberGroupHeaderClass =
	"min-h-[18px] px-2 [&_*]:leading-[18px] [&_*]:font-normal";

export type MemberListHandlers = {
	onOpen?: (member: Member, event: MouseEvent) => void;
	onMemberContextMenu?: (member: Member, event: MouseEvent) => void;
	onMemberMenu?: (member: Member, event: Event) => void;
	wrapMember?: (member: Member, row: JSX.Element) => JSX.Element;
};

export const MemberGroupLabel = (props: {
	group: MemberGroup;
	variant: MemberRowVariant;
}) => (
	<SectionLabel
		class={props.variant === "desktop" ? memberGroupHeaderClass : undefined}
		label={
			<span class="inline-flex max-w-full items-center gap-1.5 align-top">
				<Show when={props.group.role?.badge && props.group.role}>
					{(role) => <RoleBadge role={role()} />}
				</Show>
				<span class="truncate">{props.group.label}</span>
			</span>
		}
		count={props.group.members.length}
	/>
);

const MemberListRow = (
	props: MemberListHandlers & {
		member: Member;
		offline: boolean;
		variant: MemberRowVariant;
	},
) => (
	<MemberRow
		variant={props.variant}
		name={props.member.name}
		seed={props.member.id}
		avatarSrc={props.member.avatarSrc}
		avatarColor={props.member.avatarColor}
		presence={props.member.presence}
		status={props.member.status}
		statusShowWhileOffline={props.member.statusShowWhileOffline}
		role={props.member.role}
		bot={props.member.bot}
		owner={props.member.owner}
		offline={props.offline}
		onOpen={
			props.onOpen ? (event) => props.onOpen?.(props.member, event) : undefined
		}
		onContextMenu={
			props.onMemberContextMenu
				? (event) => {
						event.preventDefault();
						props.onMemberContextMenu?.(props.member, event);
					}
				: undefined
		}
		onMenu={
			props.onMemberMenu
				? (event) => props.onMemberMenu?.(props.member, event)
				: undefined
		}
	/>
);

export const MemberListEntry = (
	props: MemberListHandlers & {
		member: Member;
		offline: boolean;
		variant: MemberRowVariant;
	},
) => {
	const row = () => <MemberListRow {...props} />;
	return (
		<Show when={props.wrapMember} fallback={row()}>
			{(wrap) => wrap()(props.member, row())}
		</Show>
	);
};
