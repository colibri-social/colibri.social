import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import type { EmbedEmitter, EmbedEventListener } from "./types";

const log = createLogger("embed");

export const createEmbedEmitter = (): EmbedEmitter => {
	const listeners = new Set<EmbedEventListener>();

	return {
		emit: (body) => {
			if (listeners.size === 0) return;
			const event = { version: 1 as const, ...body };
			for (const listener of listeners) {
				try {
					listener(event);
				} catch (e) {
					const failure = classifyThrown(e);
					log.warn("an event listener threw", {
						code: failure.code,
						kind: body.kind,
					});
				}
			}
		},
		on: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
};
