import {
	type Component,
	createEffect,
	createSignal,
	onCleanup,
	Show,
} from "solid-js";
import SpinnerIcon from "~icons/ph/spinner-gap";
import { pendingCount } from "../../atproto/outbox/outbox";
import { useSocketContext } from "../../contexts/Socket";

const GRACE_MS = 2_500;

export const AppReconnectingIndicator: Component = () => {
	const socket = useSocketContext();
	const [visible, setVisible] = createSignal(false);
	const [offline, setOffline] = createSignal(
		typeof navigator !== "undefined" && navigator.onLine === false,
	);
	let timer: ReturnType<typeof setTimeout> | undefined;

	createEffect(() => {
		const online = () => setOffline(false);
		const gone = () => setOffline(true);
		window.addEventListener("online", online);
		window.addEventListener("offline", gone);
		onCleanup(() => {
			window.removeEventListener("online", online);
			window.removeEventListener("offline", gone);
		});
	});

	createEffect(() => {
		if (socket.status() === "reconnecting") {
			if (timer === undefined && !visible()) {
				timer = setTimeout(() => {
					timer = undefined;
					setVisible(true);
				}, GRACE_MS);
			}
			return;
		}
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
		setVisible(false);
	});

	onCleanup(() => {
		if (timer !== undefined) clearTimeout(timer);
	});

	return (
		<Show when={offline() || visible()}>
			<div class="fixed top-[calc(1rem+var(--safe-area-top))] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground shadow-md">
				<Show when={!offline()}>
					<SpinnerIcon class="animate-spin" />
				</Show>
				<span>
					{offline() ? "You're offline" : "Reconnecting…"}
					<Show when={pendingCount() > 0}>
						{` · ${pendingCount()} waiting to send`}
					</Show>
				</span>
			</div>
		</Show>
	);
};
