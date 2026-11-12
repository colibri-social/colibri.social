import {
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
import { createAnchorHolds } from "../../utils/live-anchor";
import {
	captureVirtualAnchor,
	findScrollParent,
	resolveVirtualAnchor,
} from "../../utils/virtual-anchor";
import type { MemberGroup } from "./MemberList";
import { MemberListFlatRow, type MemberListHandlers } from "./MemberListParts";
import type { MemberRowVariant } from "./MemberRow";
import {
	createStableMemberRows,
	flattenMemberGroups,
	type StableMemberRow,
	sameKeys,
} from "./member-list-model";

const BUFFER_PX = 400;

type ScrollTarget = { element: HTMLElement } | { element: null };

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
	const stableRows = createStableMemberRows();
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
		const rows = stableRows(flat);
		keys = nextKeys;
		return { rows, indexOf };
	});

	const holds = createAnchorHolds(
		(target) =>
			target.closest<HTMLElement>("[data-member-key]")?.dataset.memberKey,
	);

	const keepMounted = createMemo(() => {
		const { indexOf } = model();
		const indexes = new Set<number>();
		for (const key of [focusedKey(), touchedKey(), ...holds.held()]) {
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
		holds.attach(root);
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

	const renderRow = (stable: StableMemberRow): JSX.Element => (
		<MemberListFlatRow
			stable={stable}
			variant={props.variant}
			onOpen={props.onOpen}
			onMemberContextMenu={props.onMemberContextMenu}
			onMemberMenu={props.onMemberMenu}
			wrapMember={props.wrapMember}
			badgeOf={props.badgeOf}
		/>
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
