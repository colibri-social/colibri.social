import { type Accessor, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { type BadgeDefinition, UserBadge } from "../Badge/Badge";
import { SectionLabel } from "../List/List";
import { ActivityIcon } from "../Profile/ActivityIcon";
import { RoleBadge } from "../Roles/RoleBadge";
import { hasStatusContent, StatusText } from "../StatusField/StatusText";
import type { Member, MemberGroup } from "./MemberList";
import { MemberRow, type MemberRowVariant } from "./MemberRow";
import type {
	MemberListRow as FlatMemberRow,
	StableMemberRow,
} from "./member-list-model";

type HeaderRow = Extract<FlatMemberRow, { kind: "header" }>;

type MemberEntry = Extract<FlatMemberRow, { kind: "member" }>;

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
	status?: JSX.Element;
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

const memberStatusText = (member: Member): JSX.Element =>
	hasStatusContent({
		text: member.status,
		emoji: member.statusEmoji,
		customEmoji: member.statusCustomEmoji,
	}) ? (
		<StatusText
			text={member.status}
			emoji={member.statusEmoji}
			customEmoji={member.statusCustomEmoji}
		/>
	) : undefined;

const memberStatus = (member: Member): JSX.Element =>
	member.activity ? (
		<MemberStatusLine
			activity={member.activity}
			status={memberStatusText(member)}
		/>
	) : (
		memberStatusText(member)
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

const MemberGroupHeaderRow = (props: {
	row: Accessor<HeaderRow>;
	variant: MemberRowVariant;
}) => (
	<div
		data-member-group-header={props.row().group.kind}
		class={cx(
			"pb-2",
			!props.row().first && (props.variant === "mobile" ? "pt-6" : "pt-4"),
		)}
	>
		{/* biome-ignore lint/a11y/useSemanticElements: SectionLabel renders block content, which a heading element may not contain */}
		<div
			role="heading"
			aria-level={2}
			aria-label={`${props.row().group.label}, ${props.row().group.members.length}`}
		>
			<MemberGroupLabel group={props.row().group} variant={props.variant} />
		</div>
	</div>
);

const MemberEntryRow = (
	props: MemberListHandlers & {
		row: Accessor<MemberEntry>;
		variant: MemberRowVariant;
	},
) => {
	const mobile = () => props.variant === "mobile";
	return (
		<div
			class={cx(
				mobile() && "overflow-hidden bg-popover-highlight",
				mobile() && props.row().first && "rounded-t-surface",
				mobile() && props.row().last && "rounded-b-surface",
			)}
		>
			<MemberListEntry
				member={props.row().member}
				offline={props.row().group.kind === "offline"}
				variant={props.variant}
				onOpen={props.onOpen}
				onMemberContextMenu={props.onMemberContextMenu}
				onMemberMenu={props.onMemberMenu}
				wrapMember={props.wrapMember}
				badgeOf={props.badgeOf}
			/>
		</div>
	);
};

export const MemberListFlatRow = (
	props: MemberListHandlers & {
		stable: StableMemberRow;
		variant: MemberRowVariant;
	},
) => (
	<div data-member-key={props.stable.key}>
		{props.stable.current.kind === "header" ? (
			<MemberGroupHeaderRow
				row={props.stable.row as Accessor<HeaderRow>}
				variant={props.variant}
			/>
		) : (
			<MemberEntryRow
				row={props.stable.row as Accessor<MemberEntry>}
				variant={props.variant}
				onOpen={props.onOpen}
				onMemberContextMenu={props.onMemberContextMenu}
				onMemberMenu={props.onMemberMenu}
				wrapMember={props.wrapMember}
				badgeOf={props.badgeOf}
			/>
		)}
	</div>
);
