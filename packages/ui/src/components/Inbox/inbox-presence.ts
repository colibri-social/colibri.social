import { createComputed, createMemo, createSignal, on } from "solid-js";
import { playKeyframes } from "../../utils/motion";

const EXIT_DURATION_MS = 180;
const EXIT_EASING = "cubic-bezier(0.2, 0, 0, 1)";

export const collapseOut = (element: HTMLElement, onDone?: () => void) => {
	const height = element.offsetHeight;
	element.style.overflow = "clip";
	const animation = playKeyframes(
		element,
		[
			{ height: `${height}px`, opacity: 1 },
			{ height: "0px", opacity: 0 },
		],
		{ duration: EXIT_DURATION_MS, easing: EXIT_EASING, fill: "forwards" },
	);
	if (!animation) {
		onDone?.();
		return;
	}
	const finish = () => onDone?.();
	animation.finished.then(finish, finish);
};

export const createExitPresence = <T>(
	items: () => T[],
	key: (item: T) => string,
	onRemove?: (keys: Set<string>) => void,
) => {
	const [exiting, setExiting] = createSignal<T[]>([]);

	createComputed(
		on(items, (next, previous) => {
			const present = new Set(next.map(key));
			const removed = (previous ?? []).filter(
				(item) => !present.has(key(item)),
			);
			const current = exiting();
			const kept = current.filter((item) => !present.has(key(item)));
			if (removed.length === 0 && kept.length === current.length) return;
			if (removed.length > 0) onRemove?.(new Set(removed.map(key)));
			const known = new Set(kept.map(key));
			setExiting([...kept, ...removed.filter((item) => !known.has(key(item)))]);
		}),
	);

	const exitingKeys = createMemo(() => new Set(exiting().map(key)));
	const rendered = createMemo(() => [...items(), ...exiting()]);

	return {
		rendered,
		isExiting: (id: string) => exitingKeys().has(id),
		release: (id: string) => {
			if (!exitingKeys().has(id)) return;
			setExiting((current) => current.filter((item) => key(item) !== id));
		},
		clear: () => {
			if (exiting().length > 0) setExiting([]);
		},
	};
};
