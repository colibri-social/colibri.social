import { type Component, onCleanup, onMount } from "solid-js";
import { namespace } from "../../atproto/cache/keys";
import {
	configureSnapshotWriter,
	flushSnapshotWriter,
	foldLabelEvent,
	foldMessageEvent,
	resetSnapshotWriter,
} from "../../atproto/cache/messages-writer";
import {
	cacheEnabled,
	readMessages,
	writeMessages,
} from "../../atproto/cache/store";
import { frameIs } from "../../atproto/sync-frames";
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

	const onHidden = () => {
		if (document.visibilityState === "hidden") flushSnapshotWriter();
	};

	onMount(() => {
		if (!cacheEnabled()) return;

		configureSnapshotWriter({
			namespace: () => namespace(getAppViewDid(), user.did),
			read: readMessages,
			write: writeMessages,
			onError: (err) => {
				log.warn("could not fold an event into a snapshot", {
					code: classifyThrown(err).code,
				});
			},
		});

		const unsubscribe = socket.onEvent((event) => {
			if (frameIs(event, "messageEvent")) {
				foldMessageEvent(event, PAGE_SIZE);
				return;
			}
			if (frameIs(event, "labelEvent")) foldLabelEvent(event);
		});

		const flushTimer = setInterval(flushSnapshotWriter, FLUSH_INTERVAL_MS);
		document.addEventListener("visibilitychange", onHidden);
		window.addEventListener("pagehide", flushSnapshotWriter);

		onCleanup(() => {
			unsubscribe();
			clearInterval(flushTimer);
			document.removeEventListener("visibilitychange", onHidden);
			window.removeEventListener("pagehide", flushSnapshotWriter);
			flushSnapshotWriter();
			resetSnapshotWriter();
		});
	});

	return null;
};
