import { type JSX, Show } from "solid-js";
import { type BadgeDefinition, UserBadge } from "../Badge/Badge";
import { SectionLabel } from "../List/List";
import { ActivityIcon } from "../Profile/ActivityIcon";
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
	badgeOf?: (member: Member) => BadgeDefinition | undefined;
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

export const MemberStatusLine = (props: {
	activity: NonNullable<Member["activity"]>;
	status?: string;
}) => (
	<span data-member-activity="" class="flex min-w-0 items-center gap-1">
		<ActivityIcon
			kind={props.activity.kind}
			class="size-3.5 text-primary-highlight"
		/>
		<Show
			when={props.status}
			fallback={
				<>
					<span class="min-w-0 truncate">{props.activity.summary}</span>
					<Show when={(props.activity.more ?? 0) > 0}>
						<span class="shrink-0">+{props.activity.more}</span>
					</Show>
				</>
			}
		>
			{(status) => (
				<>
					<span aria-hidden="true" class="shrink-0">
						·
					</span>
					<span class="min-w-0 truncate">{status()}</span>
				</>
			)}
		</Show>
	</span>
);

const memberStatus = (member: Member): JSX.Element =>
	member.activity ? (
		<MemberStatusLine activity={member.activity} status={member.status} />
	) : (
		member.status
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
		status={memberStatus(props.member)}
		statusShowWhileOffline={props.member.statusShowWhileOffline}
		role={props.member.role}
		bot={props.member.bot}
		owner={props.member.owner}
		badge={
			<Show when={props.badgeOf?.(props.member)}>
				{(definition) => (
					<UserBadge definition={definition()} describe={false} />
				)}
			</Show>
		}
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
