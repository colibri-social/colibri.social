const RESIZE_LOOP =
	"ResizeObserver loop completed with undelivered notifications.";

const reportError = console.error.bind(console);

console.error = (...args: unknown[]) => {
	const [first] = args;

	if (first instanceof Error && first.message === RESIZE_LOOP) return;

	reportError(...args);
};
