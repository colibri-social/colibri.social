import { KEYBOARD_INSET_EVENT } from "@colibri-social/ui";
import { type JSX, onCleanup, onMount, Show } from "solid-js";
import {
	installKeyboardInset,
	KEYBOARD_PROGRESS_EVENT,
	readProgress,
} from "./keyboard-inset";

const EDITABLE =
	"input, textarea, [contenteditable]:not([contenteditable='false'])";

const REVEAL_GROUP = "form, [data-onboarding-screen]";

const REVEAL_MARGIN = 16;

type Follow = { offset: number; to: number; closing: boolean };

const overlayTop = () =>
	Number.parseFloat(
		getComputedStyle(document.documentElement).getPropertyValue(
			"--overlay-top",
		),
	) || 0;

const focusedEditable = (scope: HTMLElement) => {
	const active = document.activeElement;
	return active instanceof HTMLElement &&
		scope.contains(active) &&
		active.matches(EDITABLE)
		? active
		: undefined;
};

const revealTarget = (scope: HTMLElement, active: HTMLElement) => {
	const group = active.closest<HTMLElement>(REVEAL_GROUP);
	return group && scope.contains(group) ? group : active;
};

const MobileGateShell = (props: { children: JSX.Element }) => {
	let element: HTMLDivElement | undefined;
	let content: HTMLDivElement | undefined;
	onCleanup(installKeyboardInset({ shell: () => element }));
	onMount(() => {
		const shell = element;
		const body = content;
		if (!shell || !body) return;
		let follow: Follow | undefined;
		let lifted = 0;

		const shift = (bottomEdge: number) => {
			const active = focusedEditable(shell);
			if (!active) return 0;
			const box = revealTarget(shell, active).getBoundingClientRect();
			const room = Math.max(0, box.top - overlayTop() - REVEAL_MARGIN);
			const fits = box.height + REVEAL_MARGIN * 2 <= bottomEdge - overlayTop();
			const anchor = fits ? box : active.getBoundingClientRect();
			const needed = anchor.bottom + REVEAL_MARGIN - bottomEdge;
			return Math.min(Math.max(needed, 0), room);
		};

		const place = (offset: number) => {
			const lift = Math.round(offset);
			body.style.transform = lift ? `translate3d(0, ${-lift}px, 0)` : "";
		};

		const finish = () => {
			follow = undefined;
			body.style.willChange = "";
			place(0);
		};

		const settle = () => {
			if (follow?.closing) return;
			const pending = follow;
			finish();
			const bottom = shell.getBoundingClientRect().bottom;
			const offset = pending ? pending.offset : shift(bottom);
			if (offset > 0) shell.scrollTop += offset;
			lifted = shell.scrollTop;
		};

		const onProgress = (event: Event) => {
			const progress = readProgress((event as CustomEvent<unknown>).detail);
			if (!progress) return;
			if (progress.phase === "start") {
				if (progress.to >= progress.from) {
					const offset = shift(window.innerHeight - progress.to);
					follow = { offset, to: progress.to, closing: false };
				} else {
					const offset = lifted;
					lifted = 0;
					shell.scrollTop = 0;
					follow = { offset, to: progress.from, closing: true };
					place(offset);
				}
				body.style.willChange = "transform";
				return;
			}
			if (!follow || follow.to <= 0) return;
			const ratio = Math.min(Math.max(progress.inset / follow.to, 0), 1);
			if (follow.closing && ratio === 0) {
				finish();
				return;
			}
			place(follow.offset * ratio);
		};

		const onInset = (event: Event) => {
			const detail = (event as CustomEvent<unknown>).detail;
			const inset = typeof detail === "number" ? detail : Number(detail);
			if (follow?.closing && !(inset > 0)) finish();
		};

		const onScroll = () => {
			if (!follow) lifted = shell.scrollTop;
		};

		shell.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener(KEYBOARD_PROGRESS_EVENT, onProgress);
		window.addEventListener(KEYBOARD_INSET_EVENT, onInset);
		const observer = new ResizeObserver(settle);
		observer.observe(shell);
		onCleanup(() => {
			shell.removeEventListener("scroll", onScroll);
			window.removeEventListener(KEYBOARD_PROGRESS_EVENT, onProgress);
			window.removeEventListener(KEYBOARD_INSET_EVENT, onInset);
			observer.disconnect();
		});
	});
	return (
		<div
			ref={element}
			data-gate-shell=""
			class="h-[calc(100dvh-var(--shell-keyboard-inset,0px))] w-full overflow-y-auto overscroll-contain"
		>
			<div ref={content} data-gate-content="">
				{props.children}
			</div>
		</div>
	);
};

export const GateShell = (props: {
	platform: "mobile" | "desktop";
	children: JSX.Element;
}) => (
	<Show when={props.platform === "mobile"} fallback={props.children}>
		<MobileGateShell>{props.children}</MobileGateShell>
	</Show>
);
