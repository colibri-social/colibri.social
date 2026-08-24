import { createLogger, isVerboseLogging } from "./logger";

const log = createLogger("voice-port");

type PostMessage = typeof MessagePort.prototype.postMessage;

type Marked = { colibriWatched?: boolean };

const NOOP = (): void => {};

export const watchPortErrors = (): (() => void) => {
	if (!isVerboseLogging() || typeof MessagePort === "undefined") return NOOP;

	const original = MessagePort.prototype.postMessage;
	if ((original as unknown as Marked).colibriWatched) return NOOP;

	const apply = original as unknown as (
		this: MessagePort,
		...args: Array<unknown>
	) => void;

	function watched(this: MessagePort, ...args: Array<unknown>): void {
		try {
			apply.apply(this, args);
		} catch (err) {
			log.error("port.postMessage threw", {
				reason: err instanceof Error ? err.message : String(err),
				stack: new Error().stack,
			});
			throw err;
		}
	}

	(watched as unknown as Marked).colibriWatched = true;
	MessagePort.prototype.postMessage = watched as unknown as PostMessage;

	return () => {
		if (
			MessagePort.prototype.postMessage === (watched as unknown as PostMessage)
		) {
			MessagePort.prototype.postMessage = original;
		}
	};
};
