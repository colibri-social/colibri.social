import { type Accessor, createEffect, createRoot, on } from "solid-js";
import type { LiveStatus } from "./remote/live";

export const RESUME_AFTER_MS = 5_000;
export const CATCH_UP_CONCURRENCY = 2;
export const CLOCK_TICK_MS = 5_000;
export const CLOCK_JUMP_MS = 15_000;

type Listenable = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export type ResumeEnvironment = {
	document: Listenable;
	window: Listenable;
	visible: () => boolean;
	now: () => number;
	every?: (ms: number, tick: () => void) => () => void;
};

const browserResumeEnvironment = (): ResumeEnvironment | null => {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return null;
	}
	return {
		document,
		window,
		visible: () => document.visibilityState === "visible",
		now: () => Date.now(),
		every: (ms, tick) => {
			const timer = setInterval(tick, ms);
			return () => clearInterval(timer);
		},
	};
};

export const watchResume = (options: {
	onResume: () => void;
	onSuspend?: () => void;
	afterMs?: number;
	environment?: ResumeEnvironment | null;
}): (() => void) => {
	const environment =
		options.environment === undefined
			? browserResumeEnvironment()
			: options.environment;
	if (!environment) return () => {};
	const afterMs = options.afterMs ?? RESUME_AFTER_MS;
	let hiddenAt: number | undefined = environment.visible()
		? undefined
		: environment.now();

	const suspend = () => {
		if (hiddenAt !== undefined) return;
		hiddenAt = environment.now();
		options.onSuspend?.();
	};
	const wake = () => {
		if (hiddenAt === undefined || !environment.visible()) return;
		const away = environment.now() - hiddenAt;
		hiddenAt = undefined;
		if (away >= afterMs) options.onResume();
	};
	const onVisibility = () => {
		if (environment.visible()) wake();
		else suspend();
	};

	environment.document.addEventListener("visibilitychange", onVisibility);
	environment.document.addEventListener("freeze", suspend);
	environment.document.addEventListener("resume", wake);
	environment.window.addEventListener("pagehide", suspend);
	environment.window.addEventListener("pageshow", wake);
	return () => {
		environment.document.removeEventListener("visibilitychange", onVisibility);
		environment.document.removeEventListener("freeze", suspend);
		environment.document.removeEventListener("resume", wake);
		environment.window.removeEventListener("pagehide", suspend);
		environment.window.removeEventListener("pageshow", wake);
	};
};

export const watchWake = (options: {
	onWake: () => void;
	environment?: ResumeEnvironment | null;
}): (() => void) => {
	const environment =
		options.environment === undefined
			? browserResumeEnvironment()
			: options.environment;
	if (!environment) return () => {};
	const stopResume = watchResume({
		onResume: options.onWake,
		environment,
	});
	let lastTickAt = environment.now();
	const stopTicking = environment.every?.(CLOCK_TICK_MS, () => {
		const at = environment.now();
		const gap = at - lastTickAt;
		lastTickAt = at;
		if (gap > CLOCK_TICK_MS + CLOCK_JUMP_MS) options.onWake();
	});
	return () => {
		stopResume();
		stopTicking?.();
	};
};

export type CatchUpTask = () => Promise<unknown>;

export const createCatchUpQueue = (options: { concurrency?: number } = {}) => {
	const concurrency = Math.max(1, options.concurrency ?? CATCH_UP_CONCURRENCY);
	let generation = 0;
	const run = async (tasks: readonly CatchUpTask[]) => {
		const mine = ++generation;
		let next = 0;
		const worker = async () => {
			while (mine === generation && next < tasks.length) {
				const task = tasks[next];
				next += 1;
				await task?.().catch(() => undefined);
			}
		};
		await Promise.all(
			Array.from({ length: Math.min(concurrency, tasks.length) }, worker),
		);
	};
	return {
		run,
		cancel: () => {
			generation += 1;
		},
	};
};

export type ResumeTarget = {
	catchUp: () => void;
	pauseCatchUp: () => void;
};

export type ResumeLive = {
	status: Accessor<LiveStatus>;
};

export const installResumeSync = (
	store: ResumeTarget,
	live?: ResumeLive,
	environment?: ResumeEnvironment | null,
): (() => void) =>
	createRoot((dispose) => {
		const stopWatching = watchResume({
			onResume: store.catchUp,
			onSuspend: store.pauseCatchUp,
			environment,
		});
		if (live) {
			createEffect(
				on(
					live.status,
					(status, previous) => {
						if (status === "open" && previous === "reconnecting") {
							store.catchUp();
						}
					},
					{ defer: true },
				),
			);
		}
		return () => {
			stopWatching();
			dispose();
		};
	});
