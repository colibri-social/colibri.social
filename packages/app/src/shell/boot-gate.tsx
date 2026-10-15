import {
	createEffect,
	createSignal,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import type { DataStore } from "../data/store";
import { LaunchScreen } from "./launch/LaunchScreen";

const SKELETON_SELECTOR =
	"[data-skeleton],[data-skeleton-group],[data-skeleton-text],[data-session-loading]";
export const SETTLED_FRAMES = 2;
const BOOT_FALLBACK_MS = 15_000;
export const CROSSFADE_MS = 150;

export const ColdStart = (props: {
	store: DataStore;
	children: JSX.Element;
}) => {
	let host: HTMLDivElement | undefined;
	const [settled, setSettled] = createSignal(false);
	const [removed, setRemoved] = createSignal(false);
	onMount(() => {
		let frames = 0;
		let frame = 0;
		const check = () => {
			const store = props.store;
			const failed = !!store.communities.error();
			const quiet =
				failed ||
				(store.bootReady() &&
					!!host?.querySelector("[data-space-rail]") &&
					!host?.querySelector(SKELETON_SELECTOR));
			frames = quiet ? frames + 1 : 0;
			if (frames >= SETTLED_FRAMES) {
				setSettled(true);
				return;
			}
			frame = requestAnimationFrame(check);
		};
		frame = requestAnimationFrame(check);
		const fallback = setTimeout(() => setSettled(true), BOOT_FALLBACK_MS);
		onCleanup(() => {
			cancelAnimationFrame(frame);
			clearTimeout(fallback);
		});
	});
	const finish = () => setRemoved(true);
	createEffect(() => {
		if (!settled()) return;
		const timer = setTimeout(finish, CROSSFADE_MS * 2);
		onCleanup(() => clearTimeout(timer));
	});
	return (
		<>
			<div
				ref={host}
				class="contents"
				data-boot-content=""
				inert={!settled() || undefined}
			>
				{props.children}
			</div>
			<Show when={!removed()}>
				<div
					data-boot-overlay=""
					aria-hidden={settled() || undefined}
					class="fixed inset-0 z-[200] bg-background transition-opacity ease-out motion-reduce:transition-none"
					style={{
						opacity: settled() ? 0 : 1,
						"transition-duration": `calc(${CROSSFADE_MS}ms * var(--motion-scale, 1))`,
						"pointer-events": settled() ? "none" : undefined,
					}}
					onTransitionEnd={finish}
				>
					<LaunchScreen />
				</div>
			</Show>
		</>
	);
};
