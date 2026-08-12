import {
	type Component,
	createEffect,
	createSignal,
	onCleanup,
	Show,
} from "solid-js";
import { pendingCount } from "../../atproto/outbox/outbox";
import { communityRefreshStale } from "../../contexts/community-refresh-state";
import { useSocketContext } from "../../contexts/Socket";
import { StatusPill } from "../ui/StatusPill";

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

	const degraded = () =>
		socket.status() === "reconnecting" || communityRefreshStale();

	const label = () => {
		if (offline()) return "You're offline";
		if (visible() && socket.status() === "reconnecting") return "Reconnecting…";
		if (visible() && communityRefreshStale()) return "Showing saved data";
		return undefined;
	};

	createEffect(() => {
		if (degraded()) {
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
		<Show when={label()}>
			{(text) => (
				<StatusPill
					spinner={!offline() && socket.status() === "reconnecting"}
					class="fixed top-[calc(1rem+var(--titlebar-height)+var(--safe-area-top))] left-1/2 -translate-x-1/2 z-50"
				>
					{text()}
					<Show when={pendingCount() > 0}>
						{` · ${pendingCount()} waiting to send`}
					</Show>
				</StatusPill>
			)}
		</Show>
	);
};
