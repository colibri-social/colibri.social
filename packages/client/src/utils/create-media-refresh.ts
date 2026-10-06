import { type Accessor, createEffect, onCleanup } from "solid-js";

const createMediaRefresh = (
	dueAt: Accessor<number | undefined>,
	refresh: () => void | Promise<void>,
): void => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let running = false;

	const run = async () => {
		if (running) return;
		running = true;
		try {
			await refresh();
		} finally {
			running = false;
		}
	};

	const runIfDue = () => {
		const at = dueAt();
		if (at !== undefined && at <= Date.now()) void run();
	};

	createEffect(() => {
		const at = dueAt();
		if (timer) clearTimeout(timer);
		timer = undefined;
		if (at === undefined) return;
		timer = setTimeout(runIfDue, Math.max(0, at - Date.now()));
	});

	if (typeof document !== "undefined") {
		const onVisible = () => {
			if (document.visibilityState === "visible") runIfDue();
		};
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("focus", runIfDue);
		onCleanup(() => {
			document.removeEventListener("visibilitychange", onVisible);
			window.removeEventListener("focus", runIfDue);
		});
	}

	onCleanup(() => {
		if (timer) clearTimeout(timer);
	});
};

export default createMediaRefresh;
