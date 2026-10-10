import {
	type Accessor,
	batch,
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	Match,
	onCleanup,
	onMount,
	Switch,
	untrack,
} from "solid-js";
import {
	type CustomItemComponentProps,
	Virtualizer,
	type VirtualizerHandle,
	WindowVirtualizer,
	type WindowVirtualizerHandle,
} from "virtua/solid";
import { cx } from "../../utils/cx";
import { createFocusRetention } from "../../utils/focus-retention";
import {
	captureVirtualAnchor,
	findScrollParent,
	resolveVirtualAnchor,
} from "../../utils/virtual-anchor";
import type { MemberGroup } from "./MemberList";
import {
	MemberGroupLabel,
	MemberListEntry,
	type MemberListHandlers,
} from "./MemberListParts";
import type { MemberRowVariant } from "./MemberRow";
import {
	flattenMemberGroups,
	type MemberListRow,
	sameKeys,
	sameMemberRow,
} from "./member-list-model";

const BUFFER_PX = 400;

type StableRow = {
	key: string;
	row: Accessor<MemberListRow>;
	current: MemberListRow;
	set: (row: MemberListRow) => void;
};

type ScrollTarget = { element: HTMLElement } | { element: null };

type HeaderRow = Extract<MemberListRow, { kind: "header" }>;

type MemberEntry = Extract<MemberListRow, { kind: "member" }>;

export type VirtualMemberListProps = MemberListHandlers & {
	groups: MemberGroup[];
	variant: MemberRowVariant;
	class?: string;
};

const rowHeight: Record<MemberRowVariant, number> = {
	desktop: 44,
	mobile: 56,
};

export const VirtualMemberList = (props: VirtualMemberListProps) => {
	let root: HTMLDivElement | undefined;
	let handle: VirtualizerHandle | WindowVirtualizerHandle | undefined;
	const [target, setTarget] = createSignal<ScrollTarget>();
	const [startMargin, setStartMargin] = createSignal(0);
	const [focusedKey, setFocusedKey] = createSignal<string>();
	const [touchedKey, setTouchedKey] = createSignal<string>();
	const retainFocus = createFocusRetention();
	const rowsByKey = new Map<string, StableRow>();
	let keys: string[] = [];

	const container = () =>
		(root?.firstElementChild as HTMLElement | null) ?? undefined;

	const scrollTop = () => {
		const element = untrack(target)?.element;
		if (element) return element.scrollTop;
		return window.scrollY;
	};

	const anchorMargin = () => {
		const element = untrack(target)?.element;
		if (element) return untrack(startMargin);
		const box = container()?.getBoundingClientRect();
		return box ? box.top + window.scrollY : 0;
	};

	const scrollToTop = (value: number) => {
		const element = untrack(target)?.element;
		if (element) element.scrollTop = value;
		else window.scrollTo({ top: value, behavior: "instant" });
	};

	const preserveAnchor = (previous: string[]) => {
		const measure = handle;
		if (!measure) return;
		const top = scrollTop();
		if (top <= 0) return;
		const margin = anchorMargin();
		const anchor = captureVirtualAnchor(measure, previous, top, margin);
		if (!anchor) return;
		queueMicrotask(() => {
			const next = resolveVirtualAnchor(
				anchor,
				(key) => model().indexOf.get(key),
				measure,
				margin,
			);
			if (next === undefined || Math.abs(next - scrollTop()) < 0.5) return;
			scrollToTop(next);
		});
	};

	const model = createMemo(() => {
		const flat = flattenMemberGroups(props.groups);
		const nextKeys = flat.map((row) => row.key);
		const indexOf = new Map(nextKeys.map((key, index) => [key, index]));
		if (keys.length > 0 && !sameKeys(keys, nextKeys)) {
			const previous = keys;
			untrack(() => preserveAnchor(previous));
		}
		const rows = flat.map((row) => {
			const existing = rowsByKey.get(row.key);
			if (existing) {
				if (!sameMemberRow(existing.current, row)) {
					existing.current = row;
					existing.set(row);
				}
				return existing;
			}
			const [read, write] = createSignal(row, { equals: sameMemberRow });
			const stable: StableRow = {
				key: row.key,
				row: read,
				current: row,
				set: write,
			};
			rowsByKey.set(row.key, stable);
			return stable;
		});
		for (const key of rowsByKey.keys()) {
			if (!indexOf.has(key)) rowsByKey.delete(key);
		}
		keys = nextKeys;
		return { rows, indexOf };
	});

	const keepMounted = createMemo(() => {
		const { indexOf } = model();
		const indexes = new Set<number>();
		for (const key of [focusedKey(), touchedKey()]) {
			if (key === undefined) continue;
			const index = indexOf.get(key);
			if (index !== undefined) indexes.add(index);
		}
		return [...indexes].sort((a, b) => a - b);
	});

	const measureStartMargin = () => {
		const element = untrack(target)?.element;
		const list = container();
		if (!element || !list) return;
		const value =
			list.getBoundingClientRect().top -
			element.getBoundingClientRect().top -
			element.clientTop +
			element.scrollTop;
		if (Math.abs(value - untrack(startMargin)) > 0.5) setStartMargin(value);
	};

	onMount(() => {
		if (!root) return;
		setTarget({ element: findScrollParent(root) ?? null });
	});

	createEffect(() => {
		const element = target()?.element;
		if (!element || !root) return;
		measureStartMargin();
		const resize = new ResizeObserver(measureStartMargin);
		resize.observe(element);
		resize.observe(root);
		element.addEventListener("scroll", measureStartMargin, { passive: true });
		onCleanup(() => {
			resize.disconnect();
			element.removeEventListener("scroll", measureStartMargin);
		});
	});

	const keyFromEvent = (event: Event) =>
		(event.target as Element | null)?.closest?.<HTMLElement>(
			"[data-member-key]",
		)?.dataset.memberKey;

	const onFocusIn = (event: FocusEvent) => {
		const key = keyFromEvent(event);
		if (key === undefined) return;
		batch(() => {
			setFocusedKey(key);
			setTouchedKey(key);
		});
	};

	const onFocusOut = (event: FocusEvent) => {
		if (retainFocus(event)) return;
		const next = event.relatedTarget as Node | null;
		if (next && root?.contains(next)) return;
		setFocusedKey(undefined);
	};

	const onTouch = (event: Event) => {
		const key = keyFromEvent(event);
		if (key !== undefined) setTouchedKey(key);
	};

	const MemberItem = (item: CustomItemComponentProps) => (
		<div
			ref={item.ref}
			style={item.style}
			data-member-list-item=""
			data-index={item.index}
		>
			{item.children}
		</div>
	);

	const HeaderRow = (rowProps: { row: Accessor<HeaderRow> }) => (
		<div
			data-member-group-header={rowProps.row().group.kind}
			class={cx(
				"pb-2",
				!rowProps.row().first && (props.variant === "mobile" ? "pt-6" : "pt-4"),
			)}
		>
			{/* biome-ignore lint/a11y/useSemanticElements: SectionLabel renders block content, which a heading element may not contain */}
			<div
				role="heading"
				aria-level={3}
				aria-label={`${rowProps.row().group.label}, ${rowProps.row().group.members.length}`}
			>
				<MemberGroupLabel
					group={rowProps.row().group}
					variant={props.variant}
				/>
			</div>
		</div>
	);

	const MemberEntryRow = (rowProps: { row: Accessor<MemberEntry> }) => {
		const mobile = () => props.variant === "mobile";
		return (
			<div
				class={cx(
					mobile() && "overflow-hidden bg-secondary",
					mobile() && rowProps.row().first && "rounded-t-control",
					mobile() && rowProps.row().last && "rounded-b-control",
				)}
			>
				<MemberListEntry
					member={rowProps.row().member}
					offline={rowProps.row().group.kind === "offline"}
					variant={props.variant}
					onOpen={props.onOpen}
					onMemberContextMenu={props.onMemberContextMenu}
				/>
			</div>
		);
	};

	const renderRow = (stable: StableRow): JSX.Element => (
		<div data-member-key={stable.key}>
			{stable.current.kind === "header" ? (
				<HeaderRow row={stable.row as Accessor<HeaderRow>} />
			) : (
				<MemberEntryRow row={stable.row as Accessor<MemberEntry>} />
			)}
		</div>
	);

	return (
		<div
			ref={root}
			data-member-list=""
			data-variant={props.variant}
			data-virtual=""
			class={cx(props.variant === "desktop" && "px-2 py-4", props.class)}
			onFocusIn={onFocusIn}
			onFocusOut={onFocusOut}
			onPointerDown={onTouch}
			onContextMenu={onTouch}
		>
			<Switch>
				<Match when={target()?.element}>
					{(element) => (
						<Virtualizer
							ref={(value) => {
								handle = value;
							}}
							data={model().rows}
							scrollRef={element()}
							startMargin={startMargin()}
							bufferSize={BUFFER_PX}
							itemSize={rowHeight[props.variant]}
							keepMounted={keepMounted()}
							item={MemberItem}
						>
							{renderRow}
						</Virtualizer>
					)}
				</Match>
				<Match when={target() && !target()?.element}>
					<WindowVirtualizer
						ref={(value) => {
							handle = value;
						}}
						data={model().rows}
						bufferSize={BUFFER_PX}
						itemSize={rowHeight[props.variant]}
					>
						{renderRow}
					</WindowVirtualizer>
				</Match>
			</Switch>
		</div>
	);
};
