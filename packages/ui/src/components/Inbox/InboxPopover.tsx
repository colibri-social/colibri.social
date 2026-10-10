import { Popover as KobaltePopover } from "@kobalte/core/popover";
import { InboxIcon } from "@solar-icons/solid/bold/inbox";
import { MentionCircleIcon } from "@solar-icons/solid/bold/mention-circle";
import { ReplyIcon } from "@solar-icons/solid/bold/reply";
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	type JSX,
	Match,
	on,
	Show,
	Switch,
} from "solid-js";
import { cx } from "../../utils/cx";
import { revealLayer, topLayerAttrs } from "../../utils/nested-layers";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import { CountBadge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { MarkAllReadIcon } from "../ContextMenu/menu-entries";
import { IconButton } from "../IconButton/IconButton";
import { Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import { SpaceIcon } from "../Space/SpaceIcon";
import { SpaceRailAction } from "../SpaceRail/SpaceRail";
import {
	focusFirstRow,
	focusFirstRowFrom,
	InboxEmpty,
	InboxError,
	InboxHeader,
	InboxLoading,
	InboxRow,
	InboxRowSkeleton,
} from "./InboxParts";
import {
	countFor,
	groupByDay,
	type InboxFilter,
	type InboxNotification,
	type InboxPopoverProps,
	matchesFilter,
	unreadCount,
} from "./inbox-data";
import { collapseOut, createExitPresence } from "./inbox-presence";
import { createRoving, focusPastRows, syncRoving } from "./inbox-roving";

type InboxPopoverFrameProps = {
	unread: number;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	class?: string;
	initialFocus?: (content: HTMLElement) => HTMLElement | undefined;
	children: JSX.Element;
};

const createOpenState = (props: {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
}) => {
	const [inner, setInner] = createSignal(props.defaultOpen ?? false);
	const open = () => props.open ?? inner();
	const setOpen = (value: boolean) => {
		setInner(value);
		props.onOpenChange?.(value);
	};
	return [open, setOpen] as const;
};

const InboxPopoverFrame = (props: InboxPopoverFrameProps) => {
	const [open, setOpen] = createOpenState(props);
	const overflowPadding = usePopperOverflowPadding(16);
	const contentId = createUniqueId();
	let button: HTMLButtonElement | undefined;
	let returnFocus = false;

	return (
		<>
			<SpaceRailAction
				ref={(element) => {
					button = element;
				}}
				label="Inbox"
				icon={<InboxIcon />}
				aria-haspopup="dialog"
				aria-expanded={open()}
				aria-controls={open() ? contentId : undefined}
				badge={
					<CountBadge
						data-inbox-rail-count=""
						count={props.unread}
						class="shadow-[0_0_0_3px_var(--background)]"
					/>
				}
				badgeLabel={
					props.unread > 0
						? `${props.unread} unread`
						: "No unread notifications"
				}
				onClick={() => setOpen(!open())}
			/>
			<KobaltePopover
				open={open()}
				onOpenChange={setOpen}
				anchorRef={() => button}
				placement="right-start"
				gutter={8}
				modal={false}
				overflowPadding={overflowPadding()}
			>
				<KobaltePopover.Portal>
					<KobaltePopover.Content
						{...topLayerAttrs}
						ref={revealLayer}
						id={contentId}
						data-inbox-popover=""
						onOpenAutoFocus={(event) => {
							const target = props.initialFocus?.(
								event.currentTarget as HTMLElement,
							);
							if (!target) return;
							event.preventDefault();
							target.focus({ preventScroll: true });
						}}
						onCloseAutoFocus={(event) => {
							event.preventDefault();
							if (returnFocus) button?.focus();
							returnFocus = false;
						}}
						onEscapeKeyDown={() => {
							returnFocus = true;
						}}
						onInteractOutside={(event) => {
							const anchor = button?.closest("[data-rail-action]");
							if (anchor?.contains(event.target as Node))
								event.preventDefault();
						}}
						class={cx(
							"z-50 flex max-h-[min(640px,var(--kb-popper-content-available-height))] max-w-[calc(100vw-32px-var(--safe-area-left,0px)-var(--safe-area-right,0px))] flex-col overflow-hidden",
							"rounded-surface border border-border bg-popover text-foreground shadow-overlay outline-none",
							"origin-(--kb-popover-content-transform-origin)",
							"data-closed:animate-[ui-modal-out_calc(var(--duration-exit)*var(--motion-scale))_var(--ease-exit)_both]",
							props.class,
						)}
					>
						{props.children}
					</KobaltePopover.Content>
				</KobaltePopover.Portal>
			</KobaltePopover>
		</>
	);
};

type SplitView =
	| { kind: "filter"; filter: InboxFilter }
	| {
			kind: "space";
			spaceId: string;
	  };

const sameView = (a: SplitView, b: SplitView) =>
	a.kind === "filter"
		? b.kind === "filter" && a.filter === b.filter
		: b.kind === "space" && a.spaceId === b.spaceId;

const FILTER_VIEWS: {
	filter: InboxFilter;
	label: string;
	icon: () => JSX.Element;
	markReadLabel?: string;
}[] = [
	{ filter: "all", label: "All", icon: () => <InboxIcon /> },
	{
		filter: "mentions",
		label: "Mentions",
		icon: () => <MentionCircleIcon />,
		markReadLabel: "Mark mentions as read",
	},
	{
		filter: "replies",
		label: "Replies",
		icon: () => <ReplyIcon />,
		markReadLabel: "Mark replies as read",
	},
];

const SidebarItem = (props: {
	label: string;
	icon: JSX.Element;
	count: number;
	current: boolean;
	onSelect: () => void;
	markReadLabel?: string;
	onMarkRead?: () => void;
}) => {
	const category = () => props.markReadLabel !== undefined;
	const markable = () => category() && props.count > 0;
	return (
		<li data-inbox-row="" class="group/view relative flex list-none">
			<button
				type="button"
				data-inbox-cell=""
				data-inbox-view=""
				tabIndex={-1}
				aria-current={props.current ? "true" : undefined}
				onClick={() => props.onSelect()}
				class={cx(
					"flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control-sm px-2 text-left text-sm font-semibold outline-none focus-ring-inset",
					"transition-[background-color] duration-[calc(120ms*var(--motion-scale))] ease-(--ease-out-quick)",
					props.current
						? "bg-secondary text-foreground"
						: "text-muted-foreground hover:bg-popover-highlight hover:text-foreground",
				)}
			>
				<span class="flex size-5 shrink-0 items-center justify-center [&>svg]:size-5">
					{props.icon}
				</span>
				<span class="min-w-0 flex-1 truncate" title={props.label}>
					{props.label}
				</span>
				<CountBadge
					count={props.count}
					class={cx(
						"tabular-nums",
						markable() &&
							"group-hover/view:opacity-0 group-focus-within/view:opacity-0",
					)}
				/>
			</button>
			<Show when={category()}>
				<IconButton
					data-inbox-cell=""
					data-inbox-category-read=""
					tabIndex={-1}
					hidden={!markable()}
					disabled={!markable()}
					variant="ghost"
					size="sm"
					label={props.markReadLabel ?? ""}
					icon={<MarkAllReadIcon />}
					onClick={(event) => {
						event.currentTarget
							.closest<HTMLElement>("[data-inbox-row]")
							?.querySelector<HTMLElement>("[data-inbox-view]")
							?.focus();
						props.onMarkRead?.();
					}}
					class={cx(
						"absolute top-1 right-1 opacity-0 group-hover/view:opacity-100 group-focus-within/view:opacity-100 focus-visible:opacity-100",
						"transition-opacity duration-[calc(120ms*var(--motion-scale))] ease-(--ease-out-quick)",
					)}
				/>
			</Show>
		</li>
	);
};

const InboxDay = (props: {
	label: string;
	exiting: boolean;
	children: JSX.Element;
}) => {
	let day: HTMLLIElement | undefined;
	createEffect(
		on(
			() => props.exiting,
			(exiting) => {
				if (exiting && day) collapseOut(day);
			},
		),
	);
	return (
		<li
			ref={day}
			data-inbox-day-group=""
			data-inbox-exiting={props.exiting ? "" : undefined}
			class="flex list-none flex-col"
		>
			<h3
				data-inbox-day=""
				class="sticky top-0 z-10 m-0 bg-popover px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground"
			>
				{props.label}
			</h3>
			<ul class="m-0 flex flex-col gap-0.5 px-2">{props.children}</ul>
		</li>
	);
};

export const InboxPopover = (props: InboxPopoverProps) => {
	const [open, setOpen] = createOpenState(props);
	const [view, setView] = createSignal<SplitView>({
		kind: "filter",
		filter: "all",
	});
	let list: HTMLUListElement | undefined;
	let sidebar: HTMLElement | undefined;
	const roving = createRoving(() => list);
	const sidebarRoving = createRoving(() => sidebar);
	const status = () => props.status ?? "ready";
	const unread = () => unreadCount(props.notifications);

	const activeSpace = () => {
		const current = view();
		return current.kind === "space"
			? props.spaces.find((space) => space.id === current.spaceId)
			: undefined;
	};

	const pending = createMemo(() =>
		props.notifications.filter((item) => !item.read),
	);
	const presence = createExitPresence(
		pending,
		(item: InboxNotification) => item.id,
		(removed) => {
			const handoff = focusPastRows(list, (row) =>
				removed.has(row.dataset.inboxId ?? ""),
			);
			if (handoff === "lost")
				sidebar
					?.querySelector<HTMLElement>('[data-inbox-view][aria-current="true"]')
					?.focus();
		},
	);

	const visible = createMemo(() => {
		const current = view();
		return presence
			.rendered()
			.filter((item) =>
				current.kind === "filter"
					? matchesFilter(item, current.filter)
					: item.spaceId === current.spaceId,
			);
	});
	const days = createMemo(() => groupByDay(visible(), props.now, props.locale));
	const dayKeys = createMemo(() => days().map((day) => day.key));
	const dayFor = (key: number) => days().find((day) => day.key === key);
	const spaceOf = (id: string) => props.spaces.find((space) => space.id === id);
	const spaceUnread = (id: string) =>
		unreadCount(props.notifications.filter((item) => item.spaceId === id));
	const inboxSpaces = createMemo(() =>
		props.spaces.filter(
			(space) =>
				activeSpace()?.id === space.id ||
				pending().some((item) => item.spaceId === space.id),
		),
	);
	const viewTitle = () => {
		const current = view();
		if (current.kind === "space") return activeSpace()?.name ?? "";
		return FILTER_VIEWS.find((entry) => entry.filter === current.filter)?.label;
	};

	const emptyFilter = () => {
		const current = view();
		return current.kind === "filter" ? current.filter : "all";
	};
	const spacesLabelId = createUniqueId();

	createEffect(
		on(visible, () => queueMicrotask(() => syncRoving(list)), { defer: true }),
	);

	const openNotification = (id: string) => {
		props.onOpenNotification(id);
		setOpen(false);
	};

	const markCategoryRead = (filter: InboxFilter) => {
		if (filter !== "all") props.onMarkCategoryRead(filter);
	};

	const select = (next: SplitView) => {
		if (sameView(view(), next)) return;
		presence.clear();
		setView(next);
		list?.parentElement?.scrollTo({ top: 0 });
	};

	return (
		<InboxPopoverFrame
			unread={unread()}
			open={open()}
			onOpenChange={setOpen}
			initialFocus={focusFirstRow}
			class="w-[680px]"
		>
			<InboxHeader
				unread={unread()}
				onMarkAllRead={props.onMarkAllRead}
				onOpenSettings={props.onOpenSettings}
				class="border-b border-border"
			/>
			<div class="flex min-h-0 flex-1">
				<nav
					ref={(element) => {
						sidebar = element;
						queueMicrotask(() => syncRoving(element));
					}}
					aria-label="Inbox views"
					onKeyDown={sidebarRoving.onKeyDown}
					onFocusIn={sidebarRoving.onFocusIn}
					class="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto overscroll-contain border-r border-border p-2"
				>
					<ul class="m-0 flex flex-col gap-0.5 p-0">
						<For each={FILTER_VIEWS}>
							{(entry) => (
								<SidebarItem
									label={entry.label}
									icon={entry.icon()}
									count={countFor(props.notifications, entry.filter)}
									current={sameView(view(), {
										kind: "filter",
										filter: entry.filter,
									})}
									onSelect={() =>
										select({ kind: "filter", filter: entry.filter })
									}
									markReadLabel={entry.markReadLabel}
									onMarkRead={() => markCategoryRead(entry.filter)}
								/>
							)}
						</For>
					</ul>
					<Show when={status() === "ready" && inboxSpaces().length > 0}>
						<p
							id={spacesLabelId}
							class="m-0 mt-3 px-2 pb-1 text-xs font-semibold text-muted-foreground"
						>
							Spaces
						</p>
						<ul
							aria-labelledby={spacesLabelId}
							class="m-0 flex flex-col gap-0.5 p-0"
						>
							<For each={inboxSpaces()}>
								{(space) => (
									<SidebarItem
										label={space.name}
										icon={
											<SpaceIcon
												name={space.name}
												src={space.iconSrc}
												class="size-5 rounded-[5px] text-[9px]"
											/>
										}
										count={spaceUnread(space.id)}
										current={sameView(view(), {
											kind: "space",
											spaceId: space.id,
										})}
										onSelect={() =>
											select({ kind: "space", spaceId: space.id })
										}
									/>
								)}
							</For>
						</ul>
					</Show>
					<Show when={status() === "loading"}>
						<div aria-hidden="true" class="mt-3 flex flex-col gap-2 px-2">
							<SkeletonText size="xs" leading={16} width={48} />
							<For each={[0, 1, 2]}>
								{() => (
									<span class="flex h-7 items-center gap-2">
										<Skeleton class="size-5 rounded-[5px]" />
										<SkeletonText size="sm" leading={16} width="70%" />
									</span>
								)}
							</For>
						</div>
					</Show>
				</nav>
				<section
					aria-label={`${viewTitle()} notifications`}
					class="flex min-w-0 flex-1 flex-col"
				>
					<Show when={activeSpace()}>
						{(space) => (
							<div class="flex shrink-0 items-center gap-2 border-b border-border py-2 pr-2 pl-4">
								<p
									class="m-0 min-w-0 flex-1 truncate text-sm font-semibold"
									title={space().name}
								>
									{space().name}
								</p>
								<Button
									variant="tertiary"
									icon={<MarkAllReadIcon />}
									disabled={spaceUnread(space().id) === 0}
									onClick={(event) => {
										focusFirstRowFrom(event.currentTarget);
										props.onMarkSpaceRead(space().id);
									}}
									class="h-8 pr-3 pl-2.5 [&_svg]:size-4"
								>
									Mark Space as read
								</Button>
							</div>
						)}
					</Show>
					<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
						<Switch>
							<Match when={status() === "loading"}>
								<InboxLoading class="p-2">
									<SkeletonText
										size="xs"
										leading={24}
										width={64}
										class="px-2"
									/>
									<For each={[2, 1, 2, 1, 1, 2]}>
										{(lines) => <InboxRowSkeleton lines={lines} />}
									</For>
								</InboxLoading>
							</Match>
							<Match when={status() === "error"}>
								<InboxError onRetry={props.onRetry} />
							</Match>
							<Match when={visible().length === 0}>
								<InboxEmpty
									filter={emptyFilter()}
									spaceName={activeSpace()?.name}
									onOpenSettings={props.onOpenSettings}
								/>
							</Match>
							<Match when={visible().length > 0}>
								<ul
									ref={(element) => {
										list = element;
										queueMicrotask(() => syncRoving(element));
									}}
									data-inbox-list=""
									onKeyDown={roving.onKeyDown}
									onFocusIn={roving.onFocusIn}
									class="m-0 flex flex-col p-0 pb-2"
								>
									<For each={dayKeys()}>
										{(key) => {
											const notifications = () =>
												dayFor(key)?.notifications ?? [];
											return (
												<InboxDay
													label={dayFor(key)?.label ?? ""}
													exiting={
														notifications().length > 0 &&
														notifications().every((item) =>
															presence.isExiting(item.id),
														)
													}
												>
													<For each={notifications()}>
														{(notification) => (
															<InboxRow
																notification={notification}
																space={spaceOf(notification.spaceId)}
																showSpace={view().kind === "filter"}
																now={props.now}
																locale={props.locale}
																onOpen={openNotification}
																onMarkRead={props.onMarkRead}
																exiting={presence.isExiting(notification.id)}
																onExited={presence.release}
																class="[&_[data-inbox-open]]:scroll-mt-9"
															/>
														)}
													</For>
												</InboxDay>
											);
										}}
									</For>
								</ul>
							</Match>
						</Switch>
					</div>
				</section>
			</div>
		</InboxPopoverFrame>
	);
};
