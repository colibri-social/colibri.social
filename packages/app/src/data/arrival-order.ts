import type { MessageView, SpaceRef } from "./types";

export type ArrivalOrder = {
	confirm: (channel: SpaceRef, rkey: string) => void;
	arrive: (channel: SpaceRef, rkey: string) => void;
	order: (
		channel: SpaceRef,
		messages: readonly MessageView[],
	) => readonly MessageView[];
};

const SEQ_WIDTH = 10;

export const createArrivalOrder = (): ArrivalOrder => {
	const anchors = new Map<SpaceRef, string>();
	const placements = new Map<SpaceRef, Map<string, string>>();
	let seq = 0;

	const keyOf = (held: Map<string, string>, message: MessageView) => {
		return held.get(message.rkey) ?? message.rkey;
	};

	return {
		confirm: (channel, rkey) => {
			const current = anchors.get(channel);

			if (!current || rkey > current) anchors.set(channel, rkey);
		},
		arrive: (channel, rkey) => {
			const anchor = anchors.get(channel);

			if (!anchor || rkey >= anchor) return;

			let held = placements.get(channel);

			if (!held) {
				held = new Map();
				placements.set(channel, held);
			}

			if (held.has(rkey)) return;

			seq += 1;
			held.set(rkey, `${anchor}~${String(seq).padStart(SEQ_WIDTH, "0")}`);
		},
		order: (channel, messages) => {
			const held = placements.get(channel);

			if (!held || held.size === 0) return messages;

			if (!messages.some((message) => held.has(message.rkey))) {
				return messages;
			}

			return messages
				.map((message, index) => ({
					message,
					index,
					key: keyOf(held, message),
				}))
				.sort((left, right) =>
					left.key < right.key
						? -1
						: left.key > right.key
							? 1
							: left.index - right.index,
				)
				.map((entry) => entry.message);
		},
	};
};

export const withArrivalOrder = (
	messages: () => readonly MessageView[],
	arrivals: ArrivalOrder,
	channel: SpaceRef,
): (() => readonly MessageView[]) => {
	let lastMessages: readonly MessageView[] | undefined;
	let lastResult: readonly MessageView[] = [];

	return () => {
		const current = messages();

		if (current === lastMessages) return lastResult;

		lastMessages = current;
		lastResult = arrivals.order(channel, current);

		return lastResult;
	};
};
