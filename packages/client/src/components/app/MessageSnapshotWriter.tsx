import { type Component, onCleanup, onMount } from "solid-js";
import { namespace } from "../../atproto/cache/keys";
import {
	applyMessageEvent,
	isOpenChannel,
} from "../../atproto/cache/messages-writer";
import type { MessagesSnapshot } from "../../atproto/cache/schema";
import {
	cacheEnabled,
	readMessages,
	writeMessages,
} from "../../atproto/cache/store";
import { PAGE_SIZE } from "../../contexts/Channel";
import { useSocketContext } from "../../contexts/Socket";
import { useUserContext } from "../../contexts/User";
import { classifyThrown } from "../../errors/classify";
import { getAppViewDid } from "../../utils/appview";
import { createLogger } from "../../utils/logger";

const log = createLogger("messages-writer");

const FLUSH_INTERVAL_MS = 5000;

export const MessageSnapshotWriter: Component = () => {
	const socket = useSocketContext();
	const user = useUserContext();

	const pending = new Map<string, MessagesSnapshot>();
	const chains = new Map<string, Promise<void>>();
	let flushTimer: ReturnType<typeof setInterval> | undefined;

	const ns = () => namespace(getAppViewDid(), user.did);

	const flush = () => {
		if (pending.size === 0) return;
		const batch = [...pending.entries()];
		pending.clear();
		for (const [uri, snap] of batch) {
			void writeMessages(ns(), uri, snap);
		}
	};

	const onHidden = () => {
		if (document.visibilityState === "hidden") flush();
	};

	onMount(() => {
		if (!cacheEnabled()) return;

		const unsubscribe = socket.onEvent((event) => {
			if (event.type !== "message_event") return;
			const data = event.data;
			if (!data?.channel) return;

			const uri = data.channel;
			if (isOpenChannel(uri)) return;

			const fold = async () => {
				try {
					const current = pending.get(uri) ?? (await readMessages(ns(), uri));
					if (!current) return;
					if (isOpenChannel(uri)) return;
					const next = applyMessageEvent(current, data, PAGE_SIZE);
					if (next) pending.set(uri, next);
				} catch (err) {
					log.warn("could not fold an event into a snapshot", {
						code: classifyThrown(err).code,
					});
				}
			};

			const chain = (chains.get(uri) ?? Promise.resolve()).then(fold);
			chains.set(uri, chain);
			void chain.finally(() => {
				if (chains.get(uri) === chain) chains.delete(uri);
			});
		});

		flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
		document.addEventListener("visibilitychange", onHidden);
		window.addEventListener("pagehide", flush);

		onCleanup(() => {
			unsubscribe();
			if (flushTimer) clearInterval(flushTimer);
			document.removeEventListener("visibilitychange", onHidden);
			window.removeEventListener("pagehide", flush);
			flush();
		});
	});

	return null;
};
