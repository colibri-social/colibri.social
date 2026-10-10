import {
	type Accessor,
	batch,
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	on,
	onCleanup,
	onMount,
	Show,
	untrack,
} from "solid-js";
import {
	type CustomContainerComponentProps,
	type CustomItemComponentProps,
	Virtualizer,
	type VirtualizerHandle,
} from "virtua/solid";
import { cx } from "../../utils/cx";
import { createFocusRetention } from "../../utils/focus-retention";
import type { GroupableMessage } from "../../utils/message-groups";
import { motionScale, prefersReducedMotion } from "../../utils/motion";
import { createSlot } from "../../utils/slot";
import type { TimeInput } from "../../utils/time";
import {
	captureVirtualAnchor,
	resolveVirtualAnchor,
	type VirtualAnchor,
} from "../../utils/virtual-anchor";
import { NewMessagesDivider } from "../Thread/Thread";
import { DayDivider } from "./DayDivider";
import { JumpCard, type JumpCardMode } from "./JumpCard";
import { type ChatPlatform, chatLayoutVars } from "./layout";
import { JUMP_FADE_MS, JUMP_HIGHLIGHT_MS } from "./MessageRow";
import { MessageRowSkeleton } from "./MessageSkeletons";
import {
	MessageListItemContext,
	type MessageListItemState,
} from "./message-list-context";
import {
	appendedCount,
	buildMessageEntries,
	classifyChange,
	describeArrivals,
	type ListChange,
	type MessageListEntry,
	sameEntry,
} from "./message-list-model";

export const PIN_THRESHOLD_PX = 80;
export const JUMP_BUTTON_SHOW_PX = 200;
export const PREFETCH_MIN_PX = 400;
export const SKELETON_ROWS = 12;
const INITIAL_TAIL = 40;
const JUMP_WINDOW = 20;
const BUFFER_PX = 600;
const SETTLE_MAX_FRAMES = 30;
const SMOOTH_MAX_VIEWPORTS = 3;
const SCROLL_QUIET_MS = 150;
const SCROLL_START_MS = 300;
const JUMP_START_INSET = 16;

export type MessageListJumpOptions = {
	align?: "start" | "center" | "end";
	smooth?: boolean;
	highlight?: boolean;
	focus?: boolean;
};

export type MessageListHandle = {
	scrollToBottom: (options?: { smooth?: boolean }) => void;
	jumpTo: (key: string, options?: MessageListJumpOptions) => boolean;
	focusMessage: (key: string) => boolean;
	isAtBottom: () => boolean;
	scrollElement: () => HTMLElement | undefined;
};

export type MessageListProps<T extends GroupableMessage> = {
	messages: readonly T[];
	getKey: (message: T) => string;
	children: (entry: Accessor<MessageListEntry<T>>) => JSX.Element;
	label: string;
	platform?: ChatPlatform;
	unreadAfter?: string;
	unreadLabel?: string;
	isOwnMessage?: (message: T) => boolean;
	getAuthorName?: (message: T) => string;
	now?: TimeInput;
	locale?: string;
	hasOlder?: boolean;
	loadingOlder?: boolean;
	onLoadOlder?: () => void;
	hasNewer?: boolean;
	loadingNewer?: boolean;
	onLoadNewer?: () => void;
	onJumpToLatest?: () => void;
	onAtBottomChange?: (atBottom: boolean) => void;
	header?: JSX.Element;
	empty?: JSX.Element;
	keepMounted?: readonly string[];
	ref?: (handle: MessageListHandle) => void;
	class?: string;
};

type Row<T extends GroupableMessage> = {
	key: string;
	entry: Accessor<MessageListEntry<T>>;
	current: MessageListEntry<T>;
	set: (entry: MessageListEntry<T>) => void;
};

type Model<T extends GroupableMessage> = {
	rows: Row<T>[];
	keys: string[];
	indexOf: Map<string, number>;
	shift: boolean;
	firstUnread?: string;
};

const skeletonPattern = [
	{ lines: 1 },
	{ lines: 1, continuation: true },
	{ lines: 2 },
	{ lines: 1, reply: true },
	{ lines: 1, continuation: true },
	{ lines: 3 },
];

const SkeletonBlock = (props: {
	platform: ChatPlatform;
	position: "top" | "bottom";
}) => (
	<div
		aria-hidden="true"
		data-message-list-skeleton={props.position}
		class="flex flex-col"
	>
		<For each={Array.from({ length: SKELETON_ROWS }, (_, index) => index)}>
			{(index) => {
				const shape = skeletonPattern[index % skeletonPattern.length];
				return (
					<MessageRowSkeleton
						platform={props.platform}
						lines={shape?.lines}
						continuation={shape?.continuation}
						reply={shape?.reply}
						nameWidth={64 + ((index * 37) % 60)}
					/>
				);
			}}
		</For>
	</div>
);

export const ANNOUNCE_INTERVAL_MS = 3000;

type JumpRequestOptions = MessageListJumpOptions & { context?: boolean };

const OPEN_AT_UNREAD: JumpRequestOptions = {
	align: "start",
	highlight: false,
	smooth: false,
	context: true,
};

export const openingContext = (viewport: number) =>
	Math.round(Math.min(120, Math.max(48, viewport * 0.15)));

export const MessageList = <T extends GroupableMessage>(
	props: MessageListProps<T>,
) => {
	const platform = () => props.platform ?? "desktop";
	const header = createSlot(() => props.header);
	const empty = createSlot(() => props.empty);
	const [scroller, setScroller] = createSignal<HTMLDivElement>();
	let content: HTMLDivElement | undefined;
	let top: HTMLDivElement | undefined;
	let feed: HTMLDivElement | undefined;
	let handle: VirtualizerHandle | undefined;

	const [pinned, setPinnedSignal] = createSignal(true);
	const [jumpVisible, setJumpVisible] = createSignal(false);
	const [unseen, setUnseen] = createSignal(0);
	const [startMargin, setStartMargin] = createSignal(0);
	const [focusedKey, setFocusedKey] = createSignal<string>();
	const [touchedKey, setTouchedKey] = createSignal<string>();
	const [activeKey, setActiveKey] = createSignal<string>();
	const [jumpKey, setJumpKey] = createSignal<string>();
	const [jumpedKey, setJumpedKey] = createSignal<string>();
	const [settling, setSettling] = createSignal(true);

	let distance = 0;
	let autoScroll = false;
	let autoScrollDone: ((interrupted: boolean) => void) | undefined;
	let autoScrollTimer: ReturnType<typeof setTimeout> | undefined;
	let highlightTimer: ReturnType<typeof setTimeout> | undefined;
	let pendingJump: { key: string; options: JumpRequestOptions } | undefined;
	let olderRequested = false;
	let newerRequested = false;
	let lastClientHeight = 0;
	let lastTopHeight = -1;
	let settleFrame = 0;
	let pinOnArrival = false;
	let awaitingUnread = false;
	let openAtTop = false;
	let touching = false;
	let announceQueue: (string | undefined)[] = [];
	let announceTimer: ReturnType<typeof setTimeout> | undefined;
	let announceCooling = false;
	const [announcement, setAnnouncement] = createSignal("");
	const [pillsAnimate, setPillsAnimate] = createSignal(false);

	const setPinned = (value: boolean) => {
		setPinnedSignal(value);
		if (value) setUnseen(0);
	};

	const rowsByKey = new Map<string, Row<T>>();
	let keys: string[] = [];

	const model = createMemo<Model<T>>(() => {
		const entries = buildMessageEntries(
			props.messages,
			props.getKey,
			props.unreadAfter,
		);
		const nextKeys = entries.map((entry) => entry.key);
		const change = classifyChange(keys, nextKeys);
		const previous = keys;
		const indexOf = new Map(nextKeys.map((key, index) => [key, index]));
		const unreadIndex = entries.findIndex((entry) => entry.unreadStart);
		const firstUnread = entries[unreadIndex]?.key;
		const appended =
			change === "append" ? props.messages.slice(previous.length) : [];
		untrack(() =>
			prepareChange(change, previous, nextKeys, indexOf, firstUnread, appended),
		);
		const rows = entries.map((entry) => {
			const existing = rowsByKey.get(entry.key);
			if (existing) {
				if (!sameEntry(existing.current, entry)) {
					existing.current = entry;
					existing.set(entry);
				}
				return existing;
			}
			const [read, write] = createSignal(entry, { equals: sameEntry });
			const row: Row<T> = {
				key: entry.key,
				entry: read,
				current: entry,
				set: write,
			};
			rowsByKey.set(entry.key, row);
			return row;
		});
		for (const key of rowsByKey.keys()) {
			if (!indexOf.has(key)) rowsByKey.delete(key);
		}
		keys = nextKeys;
		return {
			rows,
			keys: nextKeys,
			indexOf,
			shift: change === "prepend",
			firstUnread,
		};
	});

	const lastKey = () => {
		const all = model().keys;
		return all[all.length - 1];
	};

	const activeResolved = createMemo(() => {
		const key = activeKey();
		if (key !== undefined && model().indexOf.has(key)) return key;
		return lastKey();
	});

	const setSize = () =>
		props.hasOlder || props.hasNewer ? -1 : model().keys.length;

	const keepMounted = createMemo(() => {
		const { indexOf, keys: all } = model();
		const indexes = new Set<number>();
		const wanted = [
			focusedKey(),
			touchedKey(),
			jumpKey(),
			...(props.keepMounted ?? []),
		];
		for (const key of wanted) {
			if (key === undefined) continue;
			const index = indexOf.get(key);
			if (index !== undefined) indexes.add(index);
		}
		if (settling()) {
			const target = jumpKey();
			const center = target === undefined ? undefined : indexOf.get(target);
			const from =
				center === undefined
					? Math.max(0, all.length - INITIAL_TAIL)
					: Math.max(0, center - JUMP_WINDOW);
			const to =
				center === undefined
					? all.length - 1
					: Math.min(all.length - 1, center + JUMP_WINDOW);
			for (let index = from; index <= to; index++) indexes.add(index);
		}
		return [...indexes].sort((a, b) => a - b);
	});

	const measureDistance = () => {
		const element = scroller();
		if (!element) return 0;
		return Math.max(
			0,
			element.scrollHeight - element.scrollTop - element.clientHeight,
		);
	};

	const stickToBottom = () => {
		const element = scroller();
		if (!element) return;
		const max = element.scrollHeight - element.clientHeight;
		if (element.scrollTop < max - 0.5) element.scrollTop = max;
	};

	const bottomPadding = () => {
		if (!content || !feed) return 0;
		return content.offsetHeight - feed.offsetTop - feed.offsetHeight;
	};

	const refreshStartMargin = () => {
		if (!feed) return;
		const margin = feed.offsetTop;
		if (margin !== untrack(startMargin)) setStartMargin(margin);
	};

	const updateJumpVisibility = () => {
		setJumpVisible((visible) => {
			if (props.hasNewer) return true;
			if (distance > JUMP_BUTTON_SHOW_PX) return true;
			if (distance < PIN_THRESHOLD_PX) return false;
			return visible;
		});
	};

	const maybeLoad = () => {
		const element = scroller();
		if (!element || untrack(settling)) return;
		const prefetch = Math.max(PREFETCH_MIN_PX, element.clientHeight);
		const aboveFirst = element.scrollTop - untrack(startMargin);
		if (
			props.hasOlder &&
			!props.loadingOlder &&
			!olderRequested &&
			aboveFirst < prefetch
		) {
			olderRequested = true;
			props.onLoadOlder?.();
		}
		if (
			props.hasNewer &&
			!props.loadingNewer &&
			!newerRequested &&
			measureDistance() - bottomPadding() < prefetch
		) {
			newerRequested = true;
			props.onLoadNewer?.();
		}
	};

	const finishAutoScroll = (interrupted = false) => {
		if (!autoScroll) return;
		autoScroll = false;
		clearTimeout(autoScrollTimer);
		const done = autoScrollDone;
		autoScrollDone = undefined;
		distance = measureDistance();
		setPinned(!props.hasNewer && distance <= PIN_THRESHOLD_PX);
		done?.(interrupted);
		updateJumpVisibility();
		maybeLoad();
	};

	const armAutoScroll = (delay: number) => {
		clearTimeout(autoScrollTimer);
		autoScrollTimer = setTimeout(() => finishAutoScroll(), delay);
	};

	const startAutoScroll = (done?: (interrupted: boolean) => void) => {
		if (autoScroll) finishAutoScroll(true);
		autoScroll = true;
		autoScrollDone = done;
		armAutoScroll(SCROLL_START_MS);
	};

	const releaseJump = () => {
		clearTimeout(highlightTimer);
		batch(() => {
			setJumpedKey(undefined);
			setJumpKey(undefined);
		});
	};

	const elementFor = (key: string) =>
		feed?.querySelector<HTMLElement>(
			`[data-message-key="${CSS.escape(key)}"]`,
		) ?? undefined;

	const focusKey = (key: string) => {
		const index = model().indexOf.get(key);
		if (index === undefined) return false;
		batch(() => {
			setActiveKey(key);
			setFocusedKey(key);
		});
		const element = elementFor(key);
		if (!element) return false;
		element.focus({ preventScroll: true });
		handle?.scrollToIndex(index, { align: "nearest" });
		return true;
	};

	const onJumpSettled = (key: string, options: MessageListJumpOptions) => {
		if (options.focus) focusKey(key);
		if (options.highlight === false) {
			setJumpKey(undefined);
			return;
		}
		setJumpedKey(key);
		clearTimeout(highlightTimer);
		highlightTimer = setTimeout(
			releaseJump,
			(JUMP_HIGHLIGHT_MS + JUMP_FADE_MS) * motionScale(),
		);
	};

	const performJump = (key: string, options: JumpRequestOptions) => {
		const element = scroller();
		const index = model().indexOf.get(key);
		if (index === undefined || !handle || !element) {
			pendingJump = { key, options };
			return false;
		}
		pendingJump = undefined;
		releaseJump();
		const atPresent = index === model().keys.length - 1 && !props.hasNewer;
		batch(() => {
			setPinned(false);
			setJumpKey(key);
			setActiveKey(key);
		});
		const viewport = element.clientHeight;
		const itemTop = untrack(startMargin) + handle.getItemOffset(index);
		const smooth =
			options.smooth ??
			(!prefersReducedMotion() &&
				!untrack(settling) &&
				Math.abs(itemTop - element.scrollTop) <
					viewport * SMOOTH_MAX_VIEWPORTS);
		const align =
			options.align ??
			(atPresent
				? "end"
				: handle.getItemSize(index) > viewport * 0.8
					? "start"
					: "center");
		startAutoScroll((interrupted) => {
			if (!interrupted) onJumpSettled(key, options);
			else if (untrack(jumpKey) === key) setJumpKey(undefined);
		});
		handle.scrollToIndex(index, {
			align,
			smooth,
			offset:
				align === "start"
					? -(options.context ? openingContext(viewport) : JUMP_START_INSET)
					: align === "end"
						? bottomPadding()
						: 0,
		});
		return true;
	};

	const scrollToBottom = (options: { smooth?: boolean } = {}) => {
		const element = scroller();
		if (!element) return;
		setUnseen(0);
		pendingJump = undefined;
		releaseJump();
		if (props.hasNewer) {
			pinOnArrival = true;
			props.onJumpToLatest?.();
			return;
		}
		setPinned(true);
		const last = model().keys.length - 1;
		const smooth =
			options.smooth ??
			(!prefersReducedMotion() &&
				measureDistance() < element.clientHeight * SMOOTH_MAX_VIEWPORTS);
		if (!smooth || last < 0 || !handle) {
			if (autoScroll) finishAutoScroll(true);
			stickToBottom();
			if (handle && last >= 0)
				handle.scrollToIndex(last, { align: "end", offset: bottomPadding() });
			return;
		}
		startAutoScroll((interrupted) => {
			if (interrupted) return;
			setPinned(true);
			stickToBottom();
		});
		handle.scrollToIndex(last, {
			align: "end",
			smooth: true,
			offset: bottomPadding(),
		});
	};

	const beginSettle = () => {
		cancelAnimationFrame(settleFrame);
		setSettling(true);
		let frames = 0;
		let stable = 0;
		let lastHeight = -1;
		const step = () => {
			const element = scroller();
			if (!element) return;
			const waiting =
				pendingJump !== undefined && model().indexOf.has(pendingJump.key);
			if (waiting && pendingJump && handle && handle.viewportSize > 0) {
				const request = pendingJump;
				performJump(request.key, { ...request.options, smooth: false });
			}
			if (openAtTop) element.scrollTop = untrack(startMargin);
			else if (untrack(pinned) && untrack(jumpKey) === undefined)
				stickToBottom();
			const height = element.scrollHeight;
			stable = height === lastHeight && !waiting ? stable + 1 : 0;
			lastHeight = height;
			frames++;
			if (stable >= 1 || frames >= SETTLE_MAX_FRAMES) {
				openAtTop = false;
				setSettling(false);
				distance = measureDistance();
				updateJumpVisibility();
				requestAnimationFrame(() => setPillsAnimate(true));
				maybeLoad();
				return;
			}
			settleFrame = requestAnimationFrame(step);
		};
		settleFrame = requestAnimationFrame(step);
	};

	const chooseOpening = () => {
		awaitingUnread = false;
		openAtTop = false;
		if (pendingJump && model().indexOf.has(pendingJump.key)) return;
		const unread = model().firstUnread;
		if (unread !== undefined) {
			pendingJump = { key: unread, options: OPEN_AT_UNREAD };
			setPinned(false);
			return;
		}
		const cursorOlder =
			props.unreadAfter !== undefined &&
			model().keys.length > 0 &&
			!model().indexOf.has(props.unreadAfter) &&
			!!props.hasOlder;
		if (cursorOlder) {
			awaitingUnread = true;
			openAtTop = true;
			setPinned(false);
			return;
		}
		setPinned(!props.hasNewer);
	};

	const restoreAnchor = (anchor: VirtualAnchor) => {
		const element = scroller();
		if (!element || !handle) return;
		const target = resolveVirtualAnchor(
			anchor,
			(key) => model().indexOf.get(key),
			handle,
			untrack(startMargin),
		);
		if (target !== undefined && Math.abs(target - element.scrollTop) > 0.5)
			element.scrollTop = target;
	};

	const restoreFocusNear = (index: number) => {
		const active = document.activeElement;
		if (active && active !== document.body && active.isConnected) return;
		const all = model().keys;
		const key = all[Math.min(index, all.length - 1)];
		setFocusedKey(undefined);
		if (key !== undefined) focusKey(key);
	};

	function prepareChange(
		change: ListChange,
		previous: string[],
		next: string[],
		indexOf: Map<string, number>,
		firstUnread: string | undefined,
		appended: readonly T[],
	) {
		if (change === "none") return;
		if (awaitingUnread && firstUnread !== undefined) {
			awaitingUnread = false;
			pendingJump = { key: firstUnread, options: OPEN_AT_UNREAD };
		}
		olderRequested = false;
		newerRequested = false;
		const focused = focusedKey();
		if (focused !== undefined && !indexOf.has(focused)) {
			const oldIndex = previous.indexOf(focused);
			queueMicrotask(() => restoreFocusNear(oldIndex));
		}
		const element = scroller();
		const request = pendingJump;
		if (request && change !== "reset" && indexOf.has(request.key)) {
			queueMicrotask(() => {
				if (pendingJump === request) performJump(request.key, request.options);
			});
			return;
		}
		if (pinOnArrival && !props.hasNewer && next.length > 0) {
			pinOnArrival = false;
			setPinned(true);
			queueMicrotask(beginSettle);
			return;
		}
		if (change === "append") {
			if (!pinned() && !props.hasNewer)
				setUnseen((count) => count + appendedCount(previous, next));
			if (pinned() && !props.hasNewer) queueArrivals(appended);
			queueMicrotask(maybeLoad);
			return;
		}
		if (change === "prepend") {
			queueMicrotask(maybeLoad);
			return;
		}
		if (change === "reset") {
			setUnseen(0);
			if (!element) return;
			queueMicrotask(() => {
				if (pendingJump && model().indexOf.has(pendingJump.key)) {
					beginSettle();
					return;
				}
				if (jumpKey() !== undefined) return;
				chooseOpening();
				beginSettle();
			});
			return;
		}
		if (pinned() || !handle || !element) return;
		const anchor = captureVirtualAnchor(
			handle,
			previous,
			element.scrollTop,
			startMargin(),
		);
		if (anchor) queueMicrotask(() => restoreAnchor(anchor));
	}

	const flushAnnouncements = () => {
		announceTimer = undefined;
		if (announceQueue.length === 0) {
			announceCooling = false;
			return;
		}
		const text = describeArrivals(announceQueue);
		announceQueue = [];
		setAnnouncement("");
		requestAnimationFrame(() => setAnnouncement(text));
		announceCooling = true;
		announceTimer = setTimeout(flushAnnouncements, ANNOUNCE_INTERVAL_MS);
	};

	function queueArrivals(messages: readonly T[]) {
		const others = messages.filter((message) => !props.isOwnMessage?.(message));
		if (others.length === 0) return;
		for (const message of others)
			announceQueue.push(props.getAuthorName?.(message));
		if (!announceCooling) flushAnnouncements();
	}

	const onScroll = () => {
		distance = measureDistance();
		if (autoScroll) armAutoScroll(SCROLL_QUIET_MS);
		else setPinned(!props.hasNewer && distance <= PIN_THRESHOLD_PX);
		updateJumpVisibility();
		maybeLoad();
	};

	const interrupt = () => {
		awaitingUnread = false;
		if (autoScroll) finishAutoScroll(true);
	};

	const followsBottom = () => untrack(pinned) && !autoScroll && !touching;

	const onTouchStart = () => {
		touching = true;
		interrupt();
	};

	const onTouchEnd = () => {
		touching = false;
	};

	const onScrollerResize = () => {
		const element = scroller();
		if (!element) return;
		const height = element.clientHeight;
		if (lastClientHeight && height !== lastClientHeight) {
			if (followsBottom()) stickToBottom();
			else if (!untrack(pinned) && !untrack(settling) && !autoScroll)
				element.scrollTop += lastClientHeight - height;
		}
		lastClientHeight = height;
	};

	const onTopResize = () => {
		if (!top) return;
		const height = top.offsetHeight;
		const delta = lastTopHeight < 0 ? 0 : height - lastTopHeight;
		lastTopHeight = height;
		refreshStartMargin();
		const element = scroller();
		if (!element || delta === 0) return;
		if (followsBottom()) {
			stickToBottom();
			return;
		}
		if (!untrack(settling) && !autoScroll) element.scrollTop += delta;
	};

	const onFeedHeightChange = () => {
		refreshStartMargin();
		if (followsBottom()) stickToBottom();
	};

	const pageFrom = (index: number, direction: 1 | -1) => {
		const element = scroller();
		if (!element || !handle) return index + direction;
		const target = handle.findItemIndex(
			untrack(startMargin) +
				handle.getItemOffset(index) +
				direction * element.clientHeight * 0.9,
		);
		return target === index ? index + direction : target;
	};

	const onFeedKeyDown = (event: KeyboardEvent) => {
		const target = event.target as HTMLElement | null;
		const key = target?.dataset?.messageKey;
		if (key === undefined || !target?.matches("[data-message]")) return;
		const index = model().indexOf.get(key);
		if (index === undefined) return;
		let next: number;
		switch (event.key) {
			case "ArrowUp":
				next = index - 1;
				break;
			case "ArrowDown":
				next = index + 1;
				break;
			case "PageUp":
				next = pageFrom(index, -1);
				break;
			case "PageDown":
				next = pageFrom(index, 1);
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = model().keys.length - 1;
				break;
			default:
				return;
		}
		event.preventDefault();
		interrupt();
		const clamped = Math.max(0, Math.min(model().keys.length - 1, next));
		if (clamped === index) {
			if (next < 0) maybeLoad();
			return;
		}
		const nextKey = model().keys[clamped];
		if (nextKey !== undefined) focusKey(nextKey);
	};

	const keyFromEvent = (event: Event) =>
		(event.target as Element | null)?.closest?.<HTMLElement>(
			"[data-message-key]",
		)?.dataset.messageKey;

	const onFocusIn = (event: FocusEvent) => {
		const key = keyFromEvent(event);
		if (key === undefined) return;
		batch(() => {
			setFocusedKey(key);
			setTouchedKey(key);
			setActiveKey(key);
		});
	};

	const retainFocus = createFocusRetention();

	const onFocusOut = (event: FocusEvent) => {
		if (retainFocus(event)) return;
		const next = event.relatedTarget as Node | null;
		if (next && feed?.contains(next)) return;
		setFocusedKey(undefined);
	};

	const onTouch = (event: Event) => {
		const key = keyFromEvent(event);
		if (key !== undefined) setTouchedKey(key);
	};

	const FeedContainer = (container: CustomContainerComponentProps) => (
		<div
			ref={(element: HTMLDivElement) => {
				feed = element;
				if (typeof container.ref === "function") container.ref(element);
			}}
			style={container.style}
			role="feed"
			aria-label={props.label}
			aria-busy={props.loadingOlder || props.loadingNewer || undefined}
			data-message-feed=""
			onKeyDown={onFeedKeyDown}
			onFocusIn={onFocusIn}
			onFocusOut={onFocusOut}
			onPointerDown={onTouch}
			onContextMenu={onTouch}
		>
			{container.children}
		</div>
	);

	const FeedItem = (item: CustomItemComponentProps) => (
		<div
			ref={item.ref}
			style={item.style}
			data-message-list-item=""
			data-index={item.index}
		>
			{item.children}
		</div>
	);

	const renderRow = (row: Row<T>) => {
		const state: MessageListItemState = {
			key: row.key,
			position: () => row.entry().position,
			setSize,
			active: () => activeResolved() === row.key,
			jumped: () => jumpedKey() === row.key,
		};
		return (
			<MessageListItemContext.Provider value={state}>
				<Show when={row.entry().newDay}>
					<DayDivider
						date={row.entry().message.timestamp}
						now={props.now}
						locale={props.locale}
						class="mt-(--chat-group-gap)"
					/>
				</Show>
				<Show when={row.entry().unreadStart}>
					<NewMessagesDivider
						label={props.unreadLabel}
						class="mt-(--chat-group-gap) px-(--chat-row-padding)"
					/>
				</Show>
				{props.children(row.entry)}
			</MessageListItemContext.Provider>
		);
	};

	const api: MessageListHandle = {
		scrollToBottom,
		jumpTo: (key, options = {}) => {
			if (untrack(settling) && !model().indexOf.has(key)) {
				pendingJump = { key, options };
				return false;
			}
			return performJump(key, options);
		},
		focusMessage: focusKey,
		isAtBottom: () => untrack(pinned),
		scrollElement: () => scroller(),
	};
	props.ref?.(api);

	createEffect(
		on(
			() => props.hasNewer,
			(hasNewer) => {
				if (hasNewer) setPinned(false);
				else if (!autoScroll && measureDistance() <= PIN_THRESHOLD_PX)
					setPinned(true);
				updateJumpVisibility();
			},
			{ defer: true },
		),
	);

	createEffect(
		on(
			() => [props.loadingOlder, props.loadingNewer] as const,
			([older, newer]) => {
				if (!older) olderRequested = false;
				if (!newer) newerRequested = false;
				queueMicrotask(maybeLoad);
			},
			{ defer: true },
		),
	);

	createEffect(
		on(pinned, (value) => {
			props.onAtBottomChange?.(value);
			if (!value) announceQueue = [];
		}),
	);

	createEffect(
		on(
			() => [props.hasOlder, model().keys.length === 0] as const,
			() => queueMicrotask(onTopResize),
			{ defer: true },
		),
	);

	onMount(() => {
		const element = scroller();
		if (!element) return;
		lastClientHeight = element.clientHeight;
		const resize = new ResizeObserver((entries) => {
			for (const entry of entries) {
				if (entry.target === element) onScrollerResize();
				else if (entry.target === top) onTopResize();
			}
		});
		resize.observe(element);
		if (top) resize.observe(top);
		const mutations = new MutationObserver(onFeedHeightChange);
		if (feed) mutations.observe(feed, { attributeFilter: ["style"] });
		element.addEventListener("scroll", onScroll, { passive: true });
		element.addEventListener("wheel", interrupt, { passive: true });
		element.addEventListener("touchstart", onTouchStart, { passive: true });
		element.addEventListener("touchend", onTouchEnd, { passive: true });
		element.addEventListener("touchcancel", onTouchEnd, { passive: true });
		queueMicrotask(() => {
			refreshStartMargin();
			chooseOpening();
			beginSettle();
		});
		onCleanup(() => {
			resize.disconnect();
			mutations.disconnect();
			element.removeEventListener("scroll", onScroll);
			element.removeEventListener("wheel", interrupt);
			element.removeEventListener("touchstart", onTouchStart);
			element.removeEventListener("touchend", onTouchEnd);
			element.removeEventListener("touchcancel", onTouchEnd);
			cancelAnimationFrame(settleFrame);
			clearTimeout(autoScrollTimer);
			clearTimeout(highlightTimer);
			clearTimeout(announceTimer);
		});
	});

	const jumpMode = (): JumpCardMode =>
		props.hasNewer ? "present" : unseen() > 0 ? "new" : "bottom";

	return (
		<div
			data-message-list=""
			data-platform={platform()}
			class={cx("relative flex min-h-0 flex-1 flex-col", props.class)}
			style={chatLayoutVars(platform())}
		>
			<div
				ref={setScroller}
				data-message-list-scroller=""
				class={cx(
					"min-h-0 flex-1 overflow-x-clip overscroll-y-contain [overflow-anchor:none]",
					model().keys.length === 0 ? "overflow-y-hidden" : "overflow-y-auto",
				)}
			>
				<div
					ref={content}
					data-message-list-content=""
					class="relative flex min-h-full flex-col justify-end"
					style={{ opacity: settling() ? 0 : undefined }}
				>
					<div ref={top} data-message-list-top="" class="flex flex-col">
						<Show
							when={props.hasOlder}
							fallback={
								<>
									<Show when={header.has()}>{header()}</Show>
									<Show
										when={
											model().keys.length === 0 &&
											!props.loadingOlder &&
											empty.has()
										}
									>
										{empty()}
									</Show>
								</>
							}
						>
							<SkeletonBlock platform={platform()} position="top" />
						</Show>
					</div>
					<Virtualizer
						ref={(value) => {
							handle = value;
						}}
						data={model().rows}
						shift={model().shift}
						scrollRef={scroller()}
						startMargin={startMargin()}
						bufferSize={BUFFER_PX}
						keepMounted={keepMounted()}
						as={FeedContainer}
						item={FeedItem}
					>
						{renderRow}
					</Virtualizer>
					<div data-message-list-bottom="" class="flex flex-col pb-2">
						<Show when={props.hasNewer}>
							<SkeletonBlock platform={platform()} position="bottom" />
						</Show>
					</div>
				</div>
			</div>
			<JumpCard
				visible={jumpVisible()}
				animate={pillsAnimate()}
				mode={jumpMode()}
				count={unseen()}
				platform={platform()}
				onJump={() => scrollToBottom()}
			/>
			<div role="status" class="sr-only" data-message-list-announcer="">
				{announcement()}
			</div>
		</div>
	);
};
