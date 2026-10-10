import { Popover as KobaltePopover } from "@kobalte/core/popover";
import { CheckReadIcon } from "@solar-icons/solid/bold/check-read";
import { DangerCircleIcon } from "@solar-icons/solid/bold/danger-circle";
import { MentionCircleIcon } from "@solar-icons/solid/bold/mention-circle";
import { ReplyIcon } from "@solar-icons/solid/bold/reply";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { createEffect, type JSX, on, onCleanup, Show } from "solid-js";
import { cx } from "../../utils/cx";
import {
	nameColorClass,
	nameColorStyle,
	useNameColor,
} from "../../utils/name-color";
import {
	formatFullTimestamp,
	formatShortTime,
	isSameDay,
	type TimeInput,
} from "../../utils/time";
import { MentionChip, TeamBadge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { MarkAllReadIcon, MarkReadIcon } from "../ContextMenu/menu-entries";
import { IconButton } from "../IconButton/IconButton";
import { RoleBadge } from "../Roles/RoleBadge";
import { Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import { SpaceIcon } from "../Space/SpaceIcon";
import {
	channelLabel,
	type InboxFilter,
	type InboxNotification,
	type InboxSpace,
	kindLabel,
} from "./inbox-data";
import { collapseOut } from "./inbox-presence";
import { firstRovingCell, focusPastRows } from "./inbox-roving";

export const InboxTitle = KobaltePopover.Title;

export const focusFirstRow = (content: HTMLElement) =>
	firstRovingCell(
		content.querySelector<HTMLElement>("[data-inbox-list]") ?? undefined,
	) ?? undefined;

export const focusFirstRowFrom = (element: HTMLElement) => {
	const dialog = element.closest<HTMLElement>("[data-inbox-popover]");
	if (dialog) focusFirstRow(dialog)?.focus();
};

export const shortStamp = (
	value: TimeInput,
	now: TimeInput = new Date(),
	locale?: string,
) => {
	if (isSameDay(value, now)) return formatShortTime(value, locale);
	const date = value instanceof Date ? value : new Date(value);
	const reference = now instanceof Date ? now : new Date(now);
	const yesterday = new Date(
		reference.getFullYear(),
		reference.getMonth(),
		reference.getDate() - 1,
	);
	if (isSameDay(date, yesterday)) return "Yesterday";
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		year:
			date.getFullYear() === reference.getFullYear() ? undefined : "numeric",
	}).format(date);
};

export const Stamp = (props: {
	value: TimeInput;
	now?: TimeInput;
	locale?: string;
	class?: string;
}) => (
	<time
		class={cx(
			"shrink-0 text-xs leading-4 whitespace-nowrap text-muted-foreground tabular-nums",
			props.class,
		)}
		title={formatFullTimestamp(props.value, props.locale)}
	>
		{shortStamp(props.value, props.now, props.locale)}
	</time>
);

export const KindIcon = (props: { notification: InboxNotification }) => (
	<Show
		when={props.notification.kind === "reply"}
		fallback={<MentionCircleIcon aria-hidden="true" class="size-4 shrink-0" />}
	>
		<ReplyIcon aria-hidden="true" class="size-4 shrink-0" />
	</Show>
);

export const NotificationText = (props: {
	notification: InboxNotification;
	class?: string;
}) => (
	<span
		data-inbox-text=""
		class={cx(
			"text-sm leading-[19px] text-foreground [overflow-wrap:anywhere]",
			props.class,
		)}
	>
		<Show when={props.notification.kind !== "reply" && props.notification}>
			{(notification) => (
				<>
					<MentionChip
						kind={notification().kind === "roleMention" ? "role" : "user"}
						roleColor={notification().mentionRoleColor}
					>
						{notification().mentionLabel ?? "@you"}
					</MentionChip>{" "}
				</>
			)}
		</Show>
		{props.notification.text}
	</span>
);

export const AuthorName = (props: { notification: InboxNotification }) => {
	const nameColor = useNameColor(() => ({
		userColor: props.notification.nameColor,
		roleColor: props.notification.role?.color,
		context: "chat",
	}));
	return (
		<span class="flex min-w-0 items-center gap-1.5">
			<span
				data-author-name=""
				class={cx(
					"truncate text-sm leading-4 font-semibold",
					nameColor() && nameColorClass,
				)}
				style={nameColorStyle(nameColor())}
			>
				{props.notification.author}
			</span>
			<Show when={props.notification.role?.badge && props.notification.role}>
				{(role) => <RoleBadge role={role()} interactive={false} />}
			</Show>
			<Show when={props.notification.team}>
				<TeamBadge describe={false} />
			</Show>
		</span>
	);
};

export const UnreadDot = (props: { unread: boolean; class?: string }) => (
	<span
		aria-hidden="true"
		data-inbox-unread-dot={props.unread ? "" : undefined}
		class={cx(
			"size-2 shrink-0 rounded-full",
			props.unread ? "bg-primary" : "bg-transparent",
			props.class,
		)}
	/>
);

export const srKindPrefix = (notification: InboxNotification) =>
	`${notification.read ? "" : "Unread. "}${kindLabel(notification)}.`;

export type MarkReadButtonProps = {
	notification: InboxNotification;
	onMarkRead: (id: string) => void;
	class?: string;
};

export const MarkReadButton = (props: MarkReadButtonProps) => (
	<Show when={!props.notification.read}>
		<IconButton
			data-inbox-cell=""
			data-inbox-mark-read=""
			tabIndex={-1}
			variant="ghost"
			size="md"
			label="Mark as read"
			icon={<MarkReadIcon />}
			onClick={(event) => {
				const row =
					event.currentTarget.closest<HTMLElement>("[data-inbox-row]");
				const list =
					row?.closest<HTMLElement>("[data-inbox-list]") ?? undefined;
				const handoff = focusPastRows(list, (candidate) => candidate === row);
				if (handoff !== "moved")
					row?.querySelector<HTMLElement>("[data-inbox-open]")?.focus();
				props.onMarkRead(props.notification.id);
			}}
			class={cx(
				"opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100",
				"transition-opacity duration-[calc(120ms*var(--motion-scale))] ease-(--ease-out-quick)",
				props.class,
			)}
		/>
	</Show>
);

export type InboxRowProps = {
	notification: InboxNotification;
	space?: InboxSpace;
	now?: TimeInput;
	locale?: string;
	showSpace?: boolean;
	onOpen: (id: string) => void;
	onMarkRead: (id: string) => void;
	exiting?: boolean;
	onExited?: (id: string) => void;
	class?: string;
};

export const InboxRow = (props: InboxRowProps) => {
	let row: HTMLLIElement | undefined;
	const id = props.notification.id;
	createEffect(
		on(
			() => props.exiting,
			(exiting) => {
				if (exiting && row) collapseOut(row, () => props.onExited?.(id));
			},
		),
	);
	onCleanup(() => {
		if (!props.exiting) return;
		const exited = props.onExited;
		queueMicrotask(() => exited?.(id));
	});

	return (
		<li
			ref={row}
			data-inbox-row=""
			data-inbox-id={props.notification.id}
			data-inbox-kind={props.notification.kind}
			data-read={props.notification.read ? "" : undefined}
			data-inbox-exiting={props.exiting ? "" : undefined}
			inert={props.exiting}
			aria-hidden={props.exiting ? "true" : undefined}
			class={cx(
				"group/row relative flex list-none rounded-control",
				"hover:bg-popover-highlight focus-within:bg-popover-highlight",
				props.class,
			)}
		>
			<button
				type="button"
				data-inbox-cell=""
				data-inbox-open=""
				tabIndex={-1}
				onClick={() => props.onOpen(props.notification.id)}
				class="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-control py-2.5 pr-12 pl-2 text-left outline-none focus-ring-inset scroll-my-2"
			>
				<UnreadDot unread={!props.notification.read} class="mt-[13px]" />
				<Show when={props.showSpace !== false && props.space}>
					{(space) => (
						<SpaceIcon
							name={space().name}
							src={space().iconSrc}
							class="size-8 rounded-control-sm text-xs"
						/>
					)}
				</Show>
				<span class="flex min-w-0 flex-1 flex-col gap-1">
					<span class="sr-only">{srKindPrefix(props.notification)}</span>
					<span class="flex min-w-0 items-center gap-2 text-xs leading-4 text-muted-foreground">
						<KindIcon notification={props.notification} />
						<span class="min-w-0 flex-1 truncate">
							<Show when={props.showSpace !== false && props.space}>
								{(space) => (
									<>
										<span class="font-semibold text-foreground">
											{space().name}
										</span>
										<span aria-hidden="true"> · </span>
									</>
								)}
							</Show>
							{channelLabel(props.notification)}
						</span>
						<Stamp
							value={props.notification.timestamp}
							now={props.now}
							locale={props.locale}
						/>
					</span>
					<Show when={props.notification.replyTo}>
						{(quote) => (
							<span
								data-inbox-reply-quote=""
								class="truncate border-l-2 border-border pl-2 text-xs leading-4 text-muted-foreground"
							>
								{quote()}
							</span>
						)}
					</Show>
					<AuthorName notification={props.notification} />
					<NotificationText
						notification={props.notification}
						class="line-clamp-2"
					/>
				</span>
			</button>
			<MarkReadButton
				notification={props.notification}
				onMarkRead={props.onMarkRead}
				class="absolute top-2 right-2"
			/>
		</li>
	);
};

export type InboxHeaderProps = {
	unread: number;
	onMarkAllRead: () => void;
	onOpenSettings?: () => void;
	class?: string;
};

export const InboxHeader = (props: InboxHeaderProps) => (
	<div
		data-inbox-header=""
		class={cx("flex shrink-0 items-center gap-2 py-2 pr-2 pl-4", props.class)}
	>
		<div class="flex min-w-0 flex-1 items-baseline gap-2">
			<InboxTitle class="m-0 text-lg leading-6 font-bold text-foreground">
				Inbox
			</InboxTitle>
			<span
				data-inbox-unread-summary=""
				class="truncate text-sm text-muted-foreground tabular-nums"
			>
				{props.unread > 0 ? `${props.unread} unread` : "All read"}
			</span>
		</div>
		<Button
			variant="tertiary"
			icon={<MarkAllReadIcon />}
			disabled={props.unread === 0}
			onClick={(event) => {
				focusFirstRowFrom(event.currentTarget);
				props.onMarkAllRead();
			}}
			class="h-8 pr-3 pl-2.5 [&_svg]:size-4"
		>
			Mark all as read
		</Button>
		<Show when={props.onOpenSettings}>
			{(open) => (
				<IconButton
					variant="ghost"
					size="md"
					label="Notification settings"
					icon={<SettingsIcon />}
					onClick={() => open()()}
				/>
			)}
		</Show>
	</div>
);

const EMPTY_COPY: Record<InboxFilter, { title: string; body: string }> = {
	all: {
		title: "You're all caught up",
		body: "Mentions and replies from your Spaces show up here.",
	},
	mentions: {
		title: "No mentions",
		body: "When someone mentions you or one of your roles, it shows up here.",
	},
	replies: {
		title: "No replies",
		body: "When someone replies to one of your messages, it shows up here.",
	},
};

export const emptyCopy = (filter: InboxFilter, spaceName?: string) =>
	spaceName
		? {
				title: "Nothing from this Space",
				body: `Mentions and replies from ${spaceName} show up here.`,
			}
		: EMPTY_COPY[filter];

const StateIcon = (props: { children: JSX.Element; tone?: "danger" }) => (
	<span
		aria-hidden="true"
		class={cx(
			"flex size-10 items-center justify-center rounded-full bg-secondary [&>svg]:size-5",
			props.tone === "danger" ? "text-destructive" : "text-muted-foreground",
		)}
	>
		{props.children}
	</span>
);

export const InboxEmpty = (props: {
	filter: InboxFilter;
	spaceName?: string;
	onOpenSettings?: () => void;
	class?: string;
}) => (
	<div
		data-inbox-empty=""
		class={cx(
			"flex flex-col items-center gap-2 px-6 py-10 text-center",
			props.class,
		)}
	>
		<StateIcon>
			<CheckReadIcon />
		</StateIcon>
		<p class="m-0 text-sm font-semibold text-balance text-foreground">
			{emptyCopy(props.filter, props.spaceName).title}
		</p>
		<p class="m-0 max-w-72 text-sm text-pretty text-muted-foreground">
			{emptyCopy(props.filter, props.spaceName).body}
		</p>
		<Show when={props.onOpenSettings}>
			{(open) => (
				<Button
					variant="secondary"
					onClick={() => open()()}
					class="mt-2 h-8 px-4"
				>
					Open notification settings
				</Button>
			)}
		</Show>
	</div>
);

export const InboxError = (props: { onRetry?: () => void; class?: string }) => (
	<div
		data-inbox-error=""
		role="alert"
		class={cx(
			"flex flex-col items-center gap-2 px-6 py-10 text-center",
			props.class,
		)}
	>
		<StateIcon tone="danger">
			<DangerCircleIcon />
		</StateIcon>
		<p class="m-0 text-sm font-semibold text-balance text-foreground">
			Couldn't load your inbox
		</p>
		<p class="m-0 max-w-72 text-sm text-pretty text-muted-foreground">
			Check your connection and try again.
		</p>
		<Show when={props.onRetry}>
			{(retry) => (
				<Button
					variant="secondary"
					onClick={() => retry()()}
					class="mt-2 h-8 px-4"
				>
					Try again
				</Button>
			)}
		</Show>
	</div>
);

export const InboxLoading = (props: {
	children: JSX.Element;
	class?: string;
}) => (
	<div
		data-inbox-loading=""
		role="status"
		aria-label="Loading notifications"
		class={cx("flex flex-col", props.class)}
	>
		{props.children}
	</div>
);

export const InboxRowSkeleton = (props: {
	space?: boolean;
	lines?: number;
	class?: string;
}) => (
	<div
		aria-hidden="true"
		data-inbox-row-skeleton=""
		class={cx("flex items-start gap-2.5 py-2.5 pr-12 pl-2", props.class)}
	>
		<span class="mt-[13px] size-2 shrink-0" />
		<Show when={props.space ?? true}>
			<Skeleton class="size-8 shrink-0 rounded-control-sm" />
		</Show>
		<span class="flex min-w-0 flex-1 flex-col gap-1">
			<SkeletonText size="xs" leading={16} width="64%" />
			<SkeletonText size="sm" leading={16} width={96} />
			<SkeletonText
				size="sm"
				leading={19}
				lines={props.lines ?? 1}
				width={(props.lines ?? 1) > 1 ? "100%" : "78%"}
			/>
		</span>
	</div>
);
