import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	type MediaLinkRefresher,
	mediaLinkTarget,
} from "../../data/media-link";
import type { MessageView } from "../../data/types";

const log = createLogger("thread-intro");

const linkIn = (view: MessageView | undefined, target: string) =>
	[...(view?.attachments ?? []), ...(view?.forward?.attachments ?? [])].find(
		(attachment) => mediaLinkTarget(attachment.url) === target,
	)?.url;

export const createAnchorLinkRefresher = (options: {
	live: () => MediaLinkRefresher | undefined;
	reload: () => Promise<void>;
	current: () => MessageView | undefined;
}): MediaLinkRefresher => {
	const tried = new Set<string>();
	return {
		refresh: async (url) => {
			const live = options.live();
			if (live) return live.refresh(url);
			if (tried.has(url)) return false;
			tried.add(url);
			try {
				await options.reload();
			} catch (thrown: unknown) {
				log.warn("anchor media refresh failed", {
					code: classifyThrown(thrown, { method: "thread.getThread" }).code,
				});
				return false;
			}
			const next = linkIn(options.current(), mediaLinkTarget(url));
			return next !== undefined && next !== url;
		},
		retry: (url) => {
			tried.delete(url);
			options.live()?.retry(url);
		},
	};
};
