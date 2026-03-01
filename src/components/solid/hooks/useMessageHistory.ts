import { APPVIEW_DOMAIN } from "astro:env/client";
import { batch, createSignal } from "solid-js";
import type { IndexedMessageData } from "@/utils/sdk";

const PAGE_SIZE = 50;

/**
 * Manages upward pagination of message history for a single channel.
 *
 * The API returns messages newest-first. Each call moves the cursor back in
 * time by using the `created_at` of the oldest message we have fetched so far
 * as the `before` parameter.
 *
 * All multi-signal updates use batch() so that SolidJS only schedules a single
 * re-render per logical state transition, preventing skeleton flicker.
 */
export function useMessageHistory(channel: () => string) {
	const [pages, setPages] = createSignal<Array<IndexedMessageData>>([]);
	const [loading, setLoading] = createSignal(false);
	const [reachedTop, setReachedTop] = createSignal(false);

	// Plain boolean — not a signal. Guards against concurrent fetches without
	// causing any reactive updates.
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
				// Nothing older exists — we are at the top. Update both signals
				// atomically so consumers never see loading=false, reachedTop=false.
				batch(() => {
					setReachedTop(true);
					setLoading(false);
				});
				return;
			}

			// The API returns newest-first; reverse to chronological order so we
			// can prepend correctly.
			const chronological = [...fetched].reverse();

			// Compute the deduplicated page array before entering batch so the
			// batch itself is as short as possible.
			const existingRkeys = new Set(pages().map((m) => m.rkey));
			const novel = chronological.filter((m) => !existingRkeys.has(m.rkey));
			const hitTop = fetched.length < PAGE_SIZE;

			// Single atomic update: pages, reachedTop, and loading all change
			// together, producing exactly one re-render.
			batch(() => {
				setPages((prev) => [...novel, ...prev]);
				if (hitTop) setReachedTop(true);
				setLoading(false);
			});
		} catch (err) {
			console.error("[useMessageHistory] Failed to fetch messages:", err);
			// Still clear loading on error so the UI doesn't get stuck.
			setLoading(false);
		} finally {
			inflight = false;
		}
	};

	/**
	 * Resets all state atomically. Call whenever the channel param changes.
	 * Using batch() here prevents the 3-render cascade that caused skeleton
	 * flicker (pages=[] render, loading=false render, reachedTop=false render).
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
	 */
	const fetchUntilMessage = async (targetRkey: string): Promise<boolean> => {
		while (!reachedTop()) {
			if (pages().some((m) => m.rkey === targetRkey)) return true;
			// eslint-disable-next-line no-await-in-loop
			await fetchOlderMessages();
		}
		return pages().some((m) => m.rkey === targetRkey);
	};

	return {
		/** Reactive accessor for the array of historically loaded messages, oldest-first. */
		pages,
		/** True while a fetch is in progress. */
		loading,
		/** True once the oldest message in the channel has been loaded. */
		reachedTop,
		fetchOlderMessages,
		fetchUntilMessage,
		reset,
	};
}
