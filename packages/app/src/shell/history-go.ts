type GoRequest = { delta: number; silent: boolean };

const queue: GoRequest[] = [];
let inFlight: GoRequest | undefined;
let installed = false;
const programmatic = new WeakSet<Event>();

export const isProgrammaticPop = (event: Event) => programmatic.has(event);

const idleCallbacks: (() => void)[] = [];

export const historyBusy = () => !!inFlight || queue.length > 0;

export const whenHistoryIdle = (run: () => void) => {
	if (!historyBusy()) {
		run();
		return;
	}
	idleCallbacks.push(run);
};

const pump = () => {
	if (inFlight) return;
	const next = queue.shift();
	if (!next) {
		for (const run of idleCallbacks.splice(0)) run();
		return;
	}
	inFlight = next;
	window.history.go(next.delta);
};

const onPop = (event: PopStateEvent) => {
	const request = inFlight;
	if (!request) return;
	inFlight = undefined;
	programmatic.add(event);
	if (request.silent) event.stopImmediatePropagation();
	queueMicrotask(pump);
};

const install = () => {
	if (installed) return;
	installed = true;
	window.addEventListener("popstate", onPop, true);
};

if (typeof window !== "undefined") install();

export const historyGo = (
	delta: number,
	options: { silent?: boolean } = {},
) => {
	if (delta === 0) return;
	install();
	queue.push({ delta, silent: !!options.silent });
	pump();
};
