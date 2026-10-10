import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { CheckIcon } from "@solar-icons/solid/bold/check";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { DangerCircleIcon } from "@solar-icons/solid/bold/danger-circle";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import { MenuDotsVerticalIcon } from "@solar-icons/solid/bold/menu-dots-vertical";
import {
	type Accessor,
	createSignal,
	type JSX,
	onCleanup,
	Show,
} from "solid-js";
import { copyText } from "../../utils/clipboard";
import { cx } from "../../utils/cx";
import { createExitHold } from "../../utils/exit-hold";
import { formatFullTimestamp } from "../../utils/time";
import { Avatar } from "../Avatar/Avatar";
import { Button } from "../Button/Button";
import { inviteMenuEntries } from "../ContextMenu/InviteMenu";
import { shareOrCopy } from "../CopyField/CopyField";
import {
	DropdownMenu,
	type DropdownMenuEntry,
} from "../DropdownMenu/DropdownMenu";
import { IconButton } from "../IconButton/IconButton";
import { Modal, ModalContent } from "../Modal/Modal";
import { AvatarSkeleton, Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import { Table, type TableColumn } from "../Table/Table";
import { TableText } from "../Table/TableText";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";
import { InviteSettingsForm } from "./InviteSettings";
import { InviteStateBadge } from "./InviteStateBadge";
import {
	describeInviteUses,
	formatInviteUses,
	type InviteSummary,
	inviteExpiryLabel,
	inviteState,
	inviteUsesRatio,
} from "./invite-links";
import {
	DEFAULT_INVITE_SETTINGS,
	INVITE_ACCESS_COPY,
	type InviteRequest,
	type InviteSettingsValue,
	inviteRequestFrom,
	type SpaceJoinMode,
} from "./invite-settings";

const COPIED_MS = 1500;

export type InviteTableProps = {
	invites: readonly InviteSummary[];
	loading?: boolean;
	now?: Date;
	spaceName?: string;
	joinMode?: SpaceJoinMode;
	onCopy?: (invite: InviteSummary) => void;
	onShare?: (invite: InviteSummary) => void;
	onDelete?: (invite: InviteSummary) => Promise<void> | void;
	onCreate?: (request: InviteRequest) => Promise<void> | void;
	maxHeight?: string;
	class?: string;
};

const createNow = (fixed: () => Date | undefined): Accessor<Date> => {
	const [tick, setTick] = createSignal(new Date());
	const timer = setInterval(() => setTick(new Date()), 60_000);
	onCleanup(() => clearInterval(timer));
	return () => fixed() ?? tick();
};

type InviteTableController = ReturnType<typeof createInviteTable>;

const createInviteTable = (props: InviteTableProps) => {
	const now = createNow(() => props.now);
	const [copiedCode, setCopiedCode] = createSignal<string>();
	const [announcement, setAnnouncement] = createSignal("");
	const [pendingDelete, setPendingDelete] = createSignal<{
		invite: InviteSummary;
		index: number;
	}>();
	const [deleting, setDeleting] = createSignal(false);
	const [deleteError, setDeleteError] = createSignal<string>();
	const [creating, setCreating] = createSignal(false);
	const [createOpen, setCreateOpen] = createSignal(false);
	const [createError, setCreateError] = createSignal<string>();
	const [settings, setSettings] = createSignal<InviteSettingsValue>(
		DEFAULT_INVITE_SETTINGS,
	);
	let root: HTMLElement | undefined;
	let closing:
		| { invite: InviteSummary; index: number; deleted: boolean }
		| undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	onCleanup(() => clearTimeout(timer));

	const announce = (message: string) => {
		setAnnouncement("");
		queueMicrotask(() => setAnnouncement(message));
	};

	const stateOf = (invite: InviteSummary) => inviteState(invite, now());

	const copy = async (invite: InviteSummary, anchor?: HTMLElement) => {
		if (!(await copyText(invite.url, anchor))) {
			announce("The invite link couldn't be copied");
			return;
		}
		clearTimeout(timer);
		setCopiedCode(invite.code);
		timer = setTimeout(() => setCopiedCode(undefined), COPIED_MS);
		announce("Invite link copied");
		props.onCopy?.(invite);
	};

	const share = async (invite: InviteSummary, anchor?: HTMLElement) => {
		if (props.onShare) {
			props.onShare(invite);
			return;
		}
		const result = await shareOrCopy(
			{
				title: props.spaceName ? `Join ${props.spaceName} on Colibri` : "",
				url: invite.url,
			},
			anchor,
		);
		if (result === "copied") announce("Invite link copied");
		if (result === "failed") announce("The invite link couldn't be shared");
	};

	const indexOf = (invite: InviteSummary) =>
		props.invites.findIndex((entry) => entry.code === invite.code);

	const closeDelete = (deleted: boolean) => {
		const pending = pendingDelete();
		if (pending) closing = { ...pending, deleted };
		setPendingDelete(undefined);
	};

	const requestDelete = (invite: InviteSummary) => {
		closing = undefined;
		setDeleteError(undefined);
		setPendingDelete({ invite, index: indexOf(invite) });
	};

	const confirmDelete = async () => {
		const pending = pendingDelete();
		if (!pending || deleting() || !props.onDelete) return;
		setDeleting(true);
		setDeleteError(undefined);
		try {
			await props.onDelete(pending.invite);
			closeDelete(true);
			announce(`Invite link ${pending.invite.code} deleted`);
		} catch {
			setDeleteError("The invite link couldn't be deleted. Try again.");
		} finally {
			setDeleting(false);
		}
	};

	const create = async () => {
		if (creating() || !props.onCreate) return;
		setCreating(true);
		setCreateError(undefined);
		try {
			await props.onCreate(inviteRequestFrom(settings()));
			setCreateOpen(false);
			announce("Invite link created");
		} catch {
			setCreateError("The invite link couldn't be created. Try again.");
		} finally {
			setCreating(false);
		}
	};

	const entries = (
		invite: InviteSummary,
		anchor: () => HTMLElement | undefined,
	): DropdownMenuEntry[] => {
		const active = stateOf(invite) === "active";
		return inviteMenuEntries({
			onCopyLink: active ? () => void copy(invite, anchor()) : undefined,
			onShare: active ? () => void share(invite, anchor()) : undefined,
			onDelete: props.onDelete ? () => requestDelete(invite) : undefined,
		});
	};

	const hasActions = (invite: InviteSummary) =>
		stateOf(invite) === "active" || !!props.onDelete;

	const focusAfterDelete = (event: Event) => {
		const closed = closing;
		closing = undefined;
		if (!root || !closed) return;
		if (!closed.deleted) {
			const menu = root.querySelector<HTMLElement>(
				`[data-invite-menu="${CSS.escape(closed.invite.code)}"]`,
			);
			if (!menu) return;
			event.preventDefault();
			menu.focus();
			return;
		}
		const rows = [...root.querySelectorAll<HTMLElement>("[data-table-row]")];
		const row = rows[Math.min(Math.max(closed.index, 0), rows.length - 1)];
		const target =
			row?.querySelector<HTMLElement>("[data-invite-focus]") ??
			row?.querySelector<HTMLElement>("[data-invite-menu]") ??
			root.querySelector<HTMLElement>("[data-invite-create]");
		if (!target) return;
		event.preventDefault();
		target.focus();
	};

	const setRoot = (element: HTMLElement) => {
		root = element;
	};

	return {
		now,
		stateOf,
		copiedCode,
		announcement,
		copy,
		share,
		entries,
		hasActions,
		requestDelete,
		pendingDelete,
		cancelDelete: () => closeDelete(false),
		confirmDelete,
		deleting,
		deleteError,
		createOpen,
		setCreateOpen: (open: boolean) => {
			setCreateError(undefined);
			setCreateOpen(open);
		},
		creating,
		createError,
		settings,
		setSettings: (value: InviteSettingsValue) => {
			setCreateError(undefined);
			setSettings(value);
		},
		create,
		focusAfterDelete,
		setRoot,
		props,
	};
};

const CopyGlyph = (props: { copied: boolean }) => (
	<span class="inline-grid place-items-center [&>svg]:col-start-1 [&>svg]:row-start-1">
		<CopyIcon
			aria-hidden="true"
			class={cx(
				"transition-[opacity,scale,filter] duration-200 ease-(--ease-out-quick) motion-reduce:transition-none",
				props.copied && "scale-25 opacity-0 blur-[4px]",
			)}
		/>
		<CheckIcon
			aria-hidden="true"
			class={cx(
				"transition-[opacity,scale,filter] duration-200 ease-(--ease-out-quick) motion-reduce:transition-none",
				!props.copied && "scale-25 opacity-0 blur-[4px]",
			)}
		/>
	</span>
);

const CopyInviteButton = (props: {
	controller: InviteTableController;
	invite: InviteSummary;
	class?: string;
}) => {
	const copied = () => props.controller.copiedCode() === props.invite.code;
	const active = () => props.controller.stateOf(props.invite) === "active";
	return (
		<Show when={active()}>
			<IconButton
				variant="ghost"
				size="md"
				data-invite-focus=""
				data-copied={copied() || undefined}
				label={
					copied()
						? `Copied invite link ${props.invite.code}`
						: `Copy invite link ${props.invite.code}`
				}
				icon={<CopyGlyph copied={copied()} />}
				onClick={(event) =>
					void props.controller.copy(props.invite, event.currentTarget)
				}
				class={props.class}
			/>
		</Show>
	);
};

const InviteMenuButton = (props: {
	controller: InviteTableController;
	invite: InviteSummary;
	class?: string;
}) => {
	let anchor: HTMLElement | undefined;
	return (
		<Show when={props.controller.hasActions(props.invite)}>
			<DropdownMenu
				platform="desktop"
				label={`Invite ${props.invite.code} options`}
				items={props.controller.entries(props.invite, () => anchor)}
				triggerAs={IconButton}
				triggerProps={{
					variant: "ghost",
					size: "md",
					label: `More actions for invite ${props.invite.code}`,
					icon: <MenuDotsVerticalIcon />,
					"data-invite-menu": props.invite.code,
					ref: (element: HTMLElement) => {
						anchor = element;
					},
					class: props.class,
				}}
			/>
		</Show>
	);
};

const ExpiryText = (props: {
	invite: InviteSummary;
	now: Date;
	class?: string;
	prefix?: boolean;
}) => {
	const label = () => inviteExpiryLabel(props.invite, props.now, props.prefix);
	return (
		<Show
			when={props.invite.expiresAt}
			fallback={<span class={props.class}>{label()}</span>}
		>
			{(expiresAt) => (
				<Tooltip placement="top">
					<TooltipTrigger
						as="time"
						dateTime={expiresAt()}
						class={cx("cursor-default", props.class)}
					>
						{label()}
					</TooltipTrigger>
					<TooltipContent>{formatFullTimestamp(expiresAt())}</TooltipContent>
				</Tooltip>
			)}
		</Show>
	);
};

const UsesText = (props: { invite: InviteSummary; class?: string }) => (
	<span class={cx("tabular-nums", props.class)}>
		<span class="sr-only">{describeInviteUses(props.invite)}</span>
		<span aria-hidden="true">{formatInviteUses(props.invite)}</span>
	</span>
);

const UsesMeter = (props: { invite: InviteSummary; class?: string }) => (
	<Show when={props.invite.maxUses !== undefined}>
		<span
			aria-hidden="true"
			data-uses-meter=""
			class={cx(
				"relative block h-1 overflow-hidden rounded-full bg-secondary-highlight",
				props.class,
			)}
		>
			<span
				class="absolute inset-y-0 left-0 rounded-full bg-primary-fill"
				style={{ width: `${inviteUsesRatio(props.invite) * 100}%` }}
			/>
		</span>
	</Show>
);

const ErrorNote = (props: { children: JSX.Element }) => (
	<div
		role="alert"
		class="flex items-start gap-2 rounded-control bg-destructive/10 px-3 py-2 text-sm text-destructive"
	>
		<DangerCircleIcon class="mt-px size-4 shrink-0" aria-hidden="true" />
		<span class="min-w-0 flex-1 text-pretty">{props.children}</span>
	</div>
);

const EmptyState = (props: { controller: InviteTableController }) => (
	<div
		data-invite-empty=""
		class="flex flex-col items-center gap-2 rounded-control border border-dashed border-control-border px-4 py-8 text-center"
	>
		<span class="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground [&>svg]:size-5">
			<LinkIcon aria-hidden="true" />
		</span>
		<p class="m-0 text-sm font-semibold text-foreground">No invite links yet</p>
		<p class="m-0 max-w-80 text-sm text-pretty text-muted-foreground">
			Create a link to invite people to this Space. You choose how long it works
			and how often it can be used.
		</p>
		<Show when={props.controller.props.onCreate}>
			<Button
				class="mt-2"
				icon={<AddCircleIcon />}
				data-invite-create=""
				onClick={() => props.controller.setCreateOpen(true)}
			>
				Create invite link
			</Button>
		</Show>
	</div>
);

const InviteTableFrame = (props: {
	controller: InviteTableController;
	children: JSX.Element;
	class?: string;
}) => {
	const c = props.controller;
	const empty = () => !c.props.loading && c.props.invites.length === 0;
	const pending = createExitHold(
		() => c.pendingDelete(),
		() => !!c.pendingDelete(),
	);

	return (
		<section
			ref={c.setRoot}
			aria-label="Invite links"
			data-invite-list=""
			aria-busy={c.props.loading || undefined}
			class={cx("flex w-full min-w-0 flex-col gap-4", props.class)}
		>
			<div class="flex min-w-0 items-center justify-between gap-4">
				<div class="flex min-w-0 flex-col">
					<h3 class="m-0 text-base font-semibold text-balance">
						Invite links
						<Show when={!c.props.loading && c.props.invites.length > 0}>
							<span class="ml-2 text-sm font-semibold text-muted-foreground tabular-nums">
								{c.props.invites.length}
							</span>
						</Show>
					</h3>
					<p
						data-invite-access={c.props.joinMode ?? "open"}
						class="m-0 text-sm text-pretty text-muted-foreground"
					>
						{INVITE_ACCESS_COPY[c.props.joinMode ?? "open"]}
					</p>
				</div>
				<Show when={c.props.onCreate && !empty()}>
					<Button
						icon={<AddCircleIcon />}
						class="shrink-0"
						data-invite-create=""
						disabled={c.props.loading}
						onClick={() => c.setCreateOpen(true)}
					>
						Create invite link
					</Button>
				</Show>
			</div>
			<Show when={!empty()} fallback={<EmptyState controller={c} />}>
				{props.children}
			</Show>
			<Modal
				open={!!c.pendingDelete()}
				onOpenChange={(open) => {
					if (!open && !c.deleting()) c.cancelDelete();
				}}
			>
				<ModalContent
					title="Delete invite link?"
					description={
						<>
							People can no longer join with{" "}
							<span class="font-semibold text-foreground">
								{pending.value()?.invite.code}
							</span>
							. Members who already joined stay in the Space.
						</>
					}
					onCloseAutoFocus={c.focusAfterDelete}
					footer={
						<>
							<Button
								variant="secondary"
								disabled={c.deleting()}
								onClick={() => c.cancelDelete()}
							>
								Cancel
							</Button>
							<Button
								variant="destructive"
								loading={c.deleting()}
								onClick={() => void c.confirmDelete()}
							>
								Delete invite link
							</Button>
						</>
					}
				>
					<pending.Marker />
					<Show when={c.deleteError()}>
						<ErrorNote>{c.deleteError()}</ErrorNote>
					</Show>
				</ModalContent>
			</Modal>
			<Modal open={c.createOpen()} onOpenChange={c.setCreateOpen}>
				<ModalContent
					title="Create invite link"
					description="Choose how long the link works and how often it can be used."
					class="md:w-[440px]"
				>
					<InviteSettingsForm
						platform="desktop"
						value={c.settings()}
						onChange={c.setSettings}
						onGenerate={() => void c.create()}
						generating={c.creating()}
						error={c.createError()}
					/>
				</ModalContent>
			</Modal>
			<span
				role="status"
				aria-live="polite"
				data-invite-announcer=""
				class="sr-only"
			>
				{c.announcement()}
			</span>
		</section>
	);
};

export const InviteTable = (props: InviteTableProps) => {
	const c = createInviteTable(props);
	const columns: TableColumn<InviteSummary>[] = [
		{
			id: "code",
			header: "Invite link",
			cell: (invite) => (
				<span class="flex min-w-0 items-center gap-2">
					<TableText
						text={invite.code}
						class={cx(
							"text-sm font-semibold",
							c.stateOf(invite) === "active" && "text-foreground",
						)}
					/>
					<InviteStateBadge state={c.stateOf(invite)} />
				</span>
			),
		},
		{
			id: "creator",
			header: "Created by",
			width: "32%",
			fold: {
				into: "code",
				below: "xl",
				cell: (invite) => <>by {invite.creator.handle}</>,
			},
			cell: (invite) => (
				<span class="flex min-w-0 items-center gap-2">
					<Avatar
						size="xs"
						name={invite.creator.handle}
						src={invite.creator.avatar}
						class="shrink-0"
					/>
					<TableText text={invite.creator.handle} />
				</span>
			),
			skeleton: () => (
				<span class="flex items-center gap-2">
					<AvatarSkeleton size="xs" />
					<SkeletonText size="sm" width={110} />
				</span>
			),
		},
		{
			id: "uses",
			header: "Uses",
			width: "5.5rem",
			cell: (invite) => (
				<span class="flex flex-col gap-1">
					<UsesText invite={invite} />
					<UsesMeter invite={invite} class="w-full max-w-16" />
				</span>
			),
		},
		{
			id: "expires",
			header: "Expires",
			width: "7.5rem",
			truncate: true,
			cell: (invite) => <ExpiryText invite={invite} now={c.now()} />,
		},
	];

	return (
		<InviteTableFrame controller={c} class={props.class}>
			<Table
				label="Invite links"
				rows={props.invites}
				columns={columns}
				rowKey={(invite) => invite.code}
				rowState={(invite) => ({ dimmed: c.stateOf(invite) !== "active" })}
				actions={(invite) => (
					<>
						<CopyInviteButton controller={c} invite={invite} />
						<InviteMenuButton controller={c} invite={invite} />
					</>
				)}
				actionsSkeleton={() => (
					<>
						<Skeleton class="size-8 rounded-control-sm" />
						<Skeleton class="size-8 rounded-control-sm" />
					</>
				)}
				contextMenu={(invite, anchor) => c.entries(invite, () => anchor)}
				contextMenuLabel={(invite) => `Invite ${invite.code} options`}
				loading={props.loading}
				loadingLabel="Loading invite links"
				maxHeight={props.maxHeight ?? "min(60dvh, 520px)"}
			/>
		</InviteTableFrame>
	);
};
