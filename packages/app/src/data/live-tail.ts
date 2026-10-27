import type {
	Did,
	MessageView,
	ReactionEmojiRef,
	ReactionView,
	SpaceRef,
} from "./types";

export const TAIL_PER_CHANNEL = 50;
export const TAIL_TOTAL = 2_000;

export type Tail = {
	messages: readonly MessageView[];
	cursor?: string;
	after?: string;
	epoch?: string;
};

export type Reaction = {
	rkey: string;
	emoji: string;
	customEmoji?: ReactionEmojiRef;
	actor: Did;
	add: boolean;
	viewer: Did;
};

export const placeMessage = (
	list: readonly MessageView[],
	message: MessageView,
): MessageView[] => {
	const index = list.findIndex((entry) => entry.rkey === message.rkey);
	if (index >= 0) {
		const next = list.slice();
		next[index] = message;
		return next;
	}
	const next = list.slice();
	const at = next.findIndex((entry) => entry.rkey > message.rkey);
	if (at < 0) next.push(message);
	else next.splice(at, 0, message);
	return next;
};

export const reactTo = (
	message: MessageView,
	reaction: Omit<Reaction, "rkey">,
): MessageView => {
	const { emoji, customEmoji, actor, add, viewer } = reaction;
	const reactions = message.reactions.slice();
	const index = reactions.findIndex((entry) => entry.emoji === emoji);
	const current = reactions[index];
	if (add) {
		if (current?.reactors.includes(actor)) return message;
		if (actor === viewer && current?.viewerReacted) return message;
		const next: ReactionView = current
			? {
					...current,
					count: current.count + 1,
					reactors: [...current.reactors, actor],
				}
			: {
					emoji,
					count: 1,
					reactors: [actor],
					...(customEmoji ? { customEmoji } : {}),
				};
		if (!next.customEmoji && customEmoji) next.customEmoji = customEmoji;
		if (actor === viewer) next.viewerReacted = true;
		if (current) reactions[index] = next;
		else {
			const at = reactions.findIndex(
				(entry) => entry.emoji.localeCompare(emoji) > 0,
			);
			if (at < 0) reactions.push(next);
			else reactions.splice(at, 0, next);
		}
	} else {
		const ownReaction = actor === viewer && current?.viewerReacted;
		if (!current?.reactors.includes(actor) && !ownReaction) return message;
		const next = {
			...current,
			count: current.count - 1,
			reactors: current.reactors.filter((did) => did !== actor),
			viewerReacted: actor === viewer ? false : current.viewerReacted,
		};
		if (next.count <= 0) reactions.splice(index, 1);
		else reactions[index] = next;
	}
	return { ...message, reactions };
};

export const reactIn = (list: readonly MessageView[], reaction: Reaction) => {
	let changed = false;
	const next = list.map((message) => {
		if (message.rkey !== reaction.rkey) return message;
		const reacted = reactTo(message, reaction);
		if (reacted !== message) changed = true;
		return reacted;
	});
	return changed ? next : list;
};

const trimmed = (tail: Tail, limit: number): Tail => {
	if (tail.messages.length <= limit) return tail;
	const messages = tail.messages.slice(-limit);
	const after = tail.messages[tail.messages.length - limit - 1]?.rkey;
	return {
		...tail,
		messages,
		cursor: messages[0]?.rkey,
		...(after ? { after } : {}),
	};
};

export const createLiveTails = (
	options: {
		perChannel?: number;
		total?: number;
		onEvict?: (ref: SpaceRef) => void;
	} = {},
) => {
	const perChannel = options.perChannel ?? TAIL_PER_CHANNEL;
	const total = options.total ?? TAIL_TOTAL;
	const tails = new Map<SpaceRef, Tail>();
	let count = 0;

	const drop = (ref: SpaceRef) => {
		const current = tails.get(ref);
		if (!current) return undefined;
		tails.delete(ref);
		count -= current.messages.length;
		return current;
	};

	const put = (ref: SpaceRef, tail: Tail) => {
		drop(ref);
		const kept = trimmed(tail, perChannel);
		tails.set(ref, kept);
		count += kept.messages.length;
		for (const oldest of tails.keys()) {
			if (count <= total || oldest === ref) break;
			drop(oldest);
			options.onEvict?.(oldest);
		}
	};

	const edit = (
		ref: SpaceRef,
		change: (messages: readonly MessageView[]) => readonly MessageView[],
	) => {
		const current = tails.get(ref);
		if (!current) return;
		const messages = change(current.messages);
		if (messages !== current.messages) put(ref, { ...current, messages });
	};

	return {
		peek: (ref: SpaceRef) => tails.get(ref),
		has: (ref: SpaceRef) => tails.has(ref),
		take: drop,
		put,
		append: (
			ref: SpaceRef,
			message: MessageView,
			start?: { epoch: string; after: string },
		) => {
			const current = tails.get(ref);
			if (current) {
				put(ref, {
					...current,
					messages: placeMessage(current.messages, message),
				});
				return;
			}
			put(ref, { messages: [message], cursor: message.rkey, ...start });
		},
		update: (ref: SpaceRef, message: MessageView) =>
			edit(ref, (messages) =>
				messages.some((entry) => entry.rkey === message.rkey)
					? placeMessage(messages, message)
					: messages,
			),
		remove: (ref: SpaceRef, rkey: string) =>
			edit(ref, (messages) =>
				messages.some((entry) => entry.rkey === rkey)
					? messages.filter((entry) => entry.rkey !== rkey)
					: messages,
			),
		react: (ref: SpaceRef, reaction: Reaction) =>
			edit(ref, (messages) => reactIn(messages, reaction)),
		dropWhere: (match: (ref: SpaceRef) => boolean) => {
			for (const ref of [...tails.keys()]) if (match(ref)) drop(ref);
		},
		clear: () => {
			tails.clear();
			count = 0;
		},
		size: () => count,
	};
};

export type LiveTails = ReturnType<typeof createLiveTails>;
