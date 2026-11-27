import { setLogLevel } from "@colibri-social/lib";

setLogLevel("error");

const RESIZE_LOOP =
	"ResizeObserver loop completed with undelivered notifications.";

const reportError = console.error.bind(console);

console.error = (...args: unknown[]) => {
	const [first] = args;

	if (first instanceof Error && first.message === RESIZE_LOOP) return;

	reportError(...args);
};

const SOLID_OWNERLESS =
	"computations created outside a `createRoot` or `render`";

const reportWarning = console.warn.bind(console);

console.warn = (...args: unknown[]) => {
	if (typeof args[0] === "string" && args[0].startsWith(SOLID_OWNERLESS)) {
		return;
	}

	reportWarning(...args);
};
