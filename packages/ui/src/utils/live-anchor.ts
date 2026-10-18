import {
	type Accessor,
	createEffect,
	createSignal,
	onCleanup,
	untrack,
} from "solid-js";
import {
	clipBox,
	overlapsBox,
	type ScrollOrigin,
	scrollOrigins,
} from "./anchor-scroll";
import { findScrollParent } from "./virtual-anchor";

export const ANCHOR_ROOT_ATTRIBUTES = [
	"data-message-key",
	"data-member-key",
] as const;

export const ANCHOR_HOLD_EVENT = "anchor-hold";

export type AnchorHoldDetail = {
	release: (callback: () => void) => void;
};

export type AnchorPathStep = { tag: string; index: number };

type Offset = { x: number; y: number; width: number; height: number };

type Locator = {
	scope: Element;
	selector: string;
	path: AnchorPathStep[];
	offset?: Offset;
};

const ROOT_SELECTOR = ANCHOR_ROOT_ATTRIBUTES.map((name) => `[${name}]`).join(
	", ",
);

export const anchorRootOf = (element: Element) =>
	element.closest<HTMLElement>(ROOT_SELECTOR) ?? undefined;

export const anchorRootSelector = (root: Element) => {
	for (const name of ANCHOR_ROOT_ATTRIBUTES) {
		const value = root.getAttribute(name);
		if (value !== null) return `[${name}="${CSS.escape(value)}"]`;
	}
	return undefined;
};

const sameTagIndex = (node: Element) => {
	let index = 0;
	let sibling = node.previousElementSibling;
	while (sibling) {
		if (sibling.tagName === node.tagName) index++;
		sibling = sibling.previousElementSibling;
	}
	return index;
};

export const anchorPath = (root: Element, element: Element) => {
	const steps: AnchorPathStep[] = [];
	let node: Element | null = element;
	while (node && node !== root) {
		steps.unshift({ tag: node.tagName, index: sameTagIndex(node) });
		node = node.parentElement;
	}
	return node === root ? steps : undefined;
};

export const resolveAnchorPath = (
	root: Element,
	path: readonly AnchorPathStep[],
) => {
	let node: Element = root;
	for (const step of path) {
		let seen = 0;
		let next: Element | undefined;
		for (const child of node.children) {
			if (child.tagName !== step.tag) continue;
			if (seen === step.index) {
				next = child;
				break;
			}
			seen++;
		}
		if (!next) return undefined;
		node = next;
	}
	return node instanceof HTMLElement ? node : undefined;
};

export type LiveAnchorOptions = {
	element: () => HTMLElement | undefined;
	active: () => boolean;
	onLost: () => void;
};

export type LiveAnchor = {
	anchor: Accessor<HTMLElement | undefined>;
	rect: (element?: HTMLElement) => DOMRect | undefined;
};

export const createLiveAnchor = (options: LiveAnchorOptions): LiveAnchor => {
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	let locator: Locator | undefined;
	let fallback = false;
	let last: DOMRect | undefined;
	let origins: ScrollOrigin[] = [];

	const remember = (element: HTMLElement, current: DOMRect) => {
		last = current;
		if (!locator || fallback) return;
		const root = element.closest(locator.selector);
		if (!root) return;
		const box = root.getBoundingClientRect();
		locator.offset = {
			x: current.x - box.x,
			y: current.y - box.y,
			width: current.width,
			height: current.height,
		};
	};

	const rect = (element?: HTMLElement) => {
		if (!element?.isConnected) return last;
		const box = element.getBoundingClientRect();
		const offset = locator?.offset;
		if (fallback && offset) {
			last = new DOMRect(
				box.x + offset.x,
				box.y + offset.y,
				offset.width,
				offset.height,
			);
			return last;
		}
		remember(element, box);
		return box;
	};

	const relocate = () => {
		const current = untrack(anchor);
		if (!locator || (current?.isConnected && !fallback)) return;
		if (!locator.scope.isConnected) {
			options.onLost();
			return;
		}
		const root = locator.scope.querySelector<HTMLElement>(locator.selector);
		if (!root) {
			options.onLost();
			return;
		}
		const found = resolveAnchorPath(root, locator.path);
		const next = found ?? root;
		fallback = !found;
		if (next === current) return;
		origins = scrollOrigins(next);
		setAnchor(next);
	};

	const checkVisible = (event: Event) => {
		const current = untrack(anchor);
		if (!current) return;
		const target =
			event.target === document ? document.scrollingElement : event.target;
		if (!origins.some((origin) => origin.element === target)) return;
		const box = rect(current);
		if (!box || !overlapsBox(box, clipBox(origins))) options.onLost();
	};

	createEffect(() => {
		const element = options.element();
		const active = options.active();
		if (!element || !active) {
			setAnchor((current) =>
				!element || element.isConnected || !current?.isConnected
					? element
					: current,
			);
			return;
		}
		untrack(() => {
			fallback = false;
			last = element.isConnected ? element.getBoundingClientRect() : undefined;
			origins = element.isConnected ? scrollOrigins(element) : [];
			setAnchor(element);

			const root = anchorRootOf(element);
			const selector = root && anchorRootSelector(root);
			const path = root && anchorPath(root, element);
			const scope = findScrollParent(element) ?? document.body;
			locator =
				selector && path
					? { scope, selector, path, offset: undefined }
					: undefined;
			if (last) remember(element, last);

			const releases: (() => void)[] = [];
			element.dispatchEvent(
				new CustomEvent<AnchorHoldDetail>(ANCHOR_HOLD_EVENT, {
					bubbles: true,
					detail: { release: (callback) => releases.push(callback) },
				}),
			);

			const observer = locator ? new MutationObserver(relocate) : undefined;
			observer?.observe(scope, { childList: true, subtree: true });
			document.addEventListener("scroll", checkVisible, {
				capture: true,
				passive: true,
			});

			onCleanup(() => {
				observer?.disconnect();
				document.removeEventListener("scroll", checkVisible, {
					capture: true,
				});
				for (const release of releases) release();
				locator = undefined;
				fallback = false;
				origins = [];
			});
		});
	});

	return { anchor, rect };
};

export const createAnchorHolds = (
	keyOf: (target: Element) => string | undefined,
) => {
	const [held, setHeld] = createSignal<readonly string[]>([]);
	const counts = new Map<string, number>();

	const sync = () => setHeld([...counts.keys()]);

	const onHold = (event: Event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const key = keyOf(target);
		if (key === undefined) return;
		counts.set(key, (counts.get(key) ?? 0) + 1);
		sync();
		let released = false;
		(event as CustomEvent<AnchorHoldDetail>).detail.release(() => {
			if (released) return;
			released = true;
			const next = (counts.get(key) ?? 1) - 1;
			if (next > 0) counts.set(key, next);
			else counts.delete(key);
			sync();
		});
	};

	const attach = (element: Element) => {
		element.addEventListener(ANCHOR_HOLD_EVENT, onHold);
		onCleanup(() => element.removeEventListener(ANCHOR_HOLD_EVENT, onHold));
	};

	return { held, attach };
};
