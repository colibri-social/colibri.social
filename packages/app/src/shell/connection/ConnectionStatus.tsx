import {
	ConnectionCard,
	type ConnectionCardProps,
	type ConnectionCardState,
} from "@colibri-social/ui";
import {
	type Accessor,
	createEffect,
	createSignal,
	on,
	onCleanup,
} from "solid-js";
import type { LiveStatus } from "../../data/remote/live";

export const CONNECTION_GRACE_MS = 2_500;
export const RETRY_FEEDBACK_MS = 4_000;

export const createOnline = (): Accessor<boolean> => {
	const [online, setOnline] = createSignal(
		typeof navigator === "undefined" || navigator.onLine !== false,
	);
	const up = () => setOnline(true);
	const down = () => setOnline(false);
	window.addEventListener("online", up);
	window.addEventListener("offline", down);
	onCleanup(() => {
		window.removeEventListener("online", up);
		window.removeEventListener("offline", down);
	});
	return online;
};

const createTimeout = () => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const stop = () => {
		if (timer === undefined) return;
		clearTimeout(timer);
		timer = undefined;
	};
	const start = (ms: number, run: () => void) => {
		stop();
		timer = setTimeout(() => {
			timer = undefined;
			run();
		}, ms);
	};
	onCleanup(stop);
	return { start, stop, pending: () => timer !== undefined };
};

export type ConnectionStatusProps = {
	status: LiveStatus;
	online?: boolean;
	onRetry: () => void;
	retryAt?: number;
	platform: ConnectionCardProps["platform"];
};

export const ConnectionStatus = (props: ConnectionStatusProps) => {
	const browserOnline = createOnline();
	const online = () => props.online ?? browserOnline();
	const [settled, setSettled] = createSignal(false);
	const [retrying, setRetrying] = createSignal(false);
	const grace = createTimeout();
	const feedback = createTimeout();

	const degraded = () =>
		props.status === "reconnecting" || props.status === "unreachable";

	createEffect(() => {
		if (!degraded()) {
			grace.stop();
			setSettled(false);
			return;
		}
		if (settled() || grace.pending()) return;
		grace.start(CONNECTION_GRACE_MS, () => setSettled(true));
	});

	createEffect(
		on(
			() => props.status,
			(status) => {
				if (status === "unreachable") return;
				feedback.stop();
				setRetrying(false);
			},
		),
	);

	const state = (): ConnectionCardState | undefined => {
		if (!online()) return "offline";
		if (!settled()) return undefined;
		if (props.status === "unreachable") return "unreachable";
		if (props.status === "reconnecting") return "reconnecting";
		return undefined;
	};

	const retry = () => {
		setRetrying(true);
		feedback.start(RETRY_FEEDBACK_MS, () => setRetrying(false));
		props.onRetry();
	};

	return (
		<ConnectionCard
			state={state() ?? "reconnecting"}
			visible={state() !== undefined}
			platform={props.platform}
			retryAt={props.retryAt}
			retrying={retrying()}
			onRetry={retry}
		/>
	);
};
