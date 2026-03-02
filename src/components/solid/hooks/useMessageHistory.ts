import { APPVIEW_DOMAIN } from "astro:env/client";
import { batch, createSignal, type Accessor } from "solid-js";
import type { IndexedMessageData } from "@/utils/sdk";

const PAGE_SIZE = 50;

/**
 * Manages upward pagination of message history for a single channel.
 *
 * The API returns messages newest-first. Each call moves the cursor back in
 * time by using the `created_at` of the oldest message we have fetched so far
 * as the `before` parameter.
 *
 * @param channel
 */
export function useMessageHistory(channel: Accessor<string>) {
	const [pages, setPages] = createSignal<Array<IndexedMessageData>>([]);
	const [loading, setLoading] = createSignal(false);
	const [reachedTop, setReachedTop] = createSignal(false);

	let inflight = false;

	/**
	 * Fetches the next page of messages older than the current oldest message.
	 * Safe to call multiple times — concurrent calls are dropped.
	 */
	const fetchOlderMessages = async (): Promise<void> => {
		if (inflight || reachedTop()) return;

		inflight = true;
		setLoading(true);

		try {
			const currentPages = pages();
			const oldest = currentPages[0];
			const before = oldest?.created_at;

			const url = new URL(`https://${APPVIEW_DOMAIN}/api/messages`);
			url.searchParams.set("channel", channel());
			url.searchParams.set("limit", String(PAGE_SIZE));
			if (before) {
				url.searchParams.set("before", before);
			}

			const response = await fetch(url.toString());
			const fetched: Array<IndexedMessageData> = await response.json();

			if (fetched.length === 0) {
				batch(() => {
					setReachedTop(true);
					setLoading(false);
				});
				return;
			}

			const chronological = [...fetched].reverse();

			const existingRkeys = new Set(pages().map((m) => m.rkey));
			const novel = chronological.filter((m) => !existingRkeys.has(m.rkey));
			const hitTop = fetched.length < PAGE_SIZE;

			batch(() => {
				setPages((prev) => [...novel, ...prev]);
				if (hitTop) setReachedTop(true);
				setLoading(false);
			});
		} catch (err) {
			console.error("[useMessageHistory] Failed to fetch messages:", err);
			setLoading(false);
		} finally {
			inflight = false;
		}
	};

	/**
	 * Resets all state atomically. Call whenever the channel param changes.
	 */
	const reset = (): void => {
		inflight = false;
		batch(() => {
			setPages([]);
			setLoading(false);
			setReachedTop(false);
		});
	};

	/**
	 * Keeps fetching pages until the message identified by targetRkey appears
	 * in the fetched history, or we reach the top of the channel.
	 *
	 * Used when the user clicks "jump to reply" and the referenced message is
	 * not yet loaded.
	 *
	 * @param targetRkey The record key of the message to jump to.
	 */
	const fetchUntilMessage = async (targetRkey: string): Promise<boolean> => {
		while (!reachedTop()) {
			if (pages().some((m) => m.rkey === targetRkey)) return true;
			await fetchOlderMessages();
		}
		return pages().some((m) => m.rkey === targetRkey);
	};

	return {
		pages,
		loading,
		reachedTop,
		fetchOlderMessages,
		fetchUntilMessage,
		reset,
	};
}
