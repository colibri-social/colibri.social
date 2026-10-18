import { batch, createSignal } from "solid-js";
import {
	type GroupableMessage,
	type GroupedMessage,
	type GroupMessagesOptions,
	groupMessages,
} from "../../utils/message-groups";

export type MessageListEntry<T extends GroupableMessage> = GroupedMessage<T> & {
	key: string;
	position: number;
	unreadStart: boolean;
};

export const buildMessageEntries = <T extends GroupableMessage>(
	messages: readonly T[],
	getKey: (message: T) => string,
	unreadAfter?: string,
	options?: GroupMessagesOptions,
): MessageListEntry<T>[] => {
	const grouped = groupMessages(messages, options);
	let unreadIndex = -1;
	if (unreadAfter !== undefined) {
		const lastRead = messages.findIndex(
			(message) => getKey(message) === unreadAfter,
		);
		if (lastRead !== -1 && lastRead < messages.length - 1)
			unreadIndex = lastRead + 1;
	}
	return grouped.map((entry, index) => ({
		...entry,
		key: getKey(entry.message),
		position: index + 1,
		unreadStart: index === unreadIndex,
		continuation: entry.continuation && index !== unreadIndex,
		hasContinuation: entry.hasContinuation && index + 1 !== unreadIndex,
	}));
};

export type EntryCell<T extends GroupableMessage> = {
	entry: MessageListEntry<T>;
	write: (next: MessageListEntry<T>) => void;
};

export const createEntryCell = <T extends GroupableMessage>(
	initial: MessageListEntry<T>,
): EntryCell<T> => {
	const entry = {} as MessageListEntry<T>;
	const field = <K extends keyof MessageListEntry<T>>(name: K) => {
		const [read, write] = createSignal(initial[name]);
		Object.defineProperty(entry, name, { get: read, enumerable: true });
		return (next: MessageListEntry<T>) => {
			write(() => next[name]);
		};
	};
	const writers = [
		field("message"),
		field("key"),
		field("position"),
		field("continuation"),
		field("hasContinuation"),
		field("newDay"),
		field("last"),
		field("unreadStart"),
	];
	return {
		entry,
		write: (next) =>
			batch(() => {
				for (const write of writers) write(next);
			}),
	};
};

export type ListChange = "none" | "append" | "prepend" | "reset" | "mixed";

const matchesAt = (
	previous: readonly string[],
	next: readonly string[],
	offset: number,
) => {
	for (let index = 0; index < previous.length; index++) {
		if (previous[index] !== next[index + offset]) return false;
	}
	return true;
};

export const classifyChange = (
	previous: readonly string[],
	next: readonly string[],
): ListChange => {
	if (previous.length === next.length && matchesAt(previous, next, 0))
		return "none";
	if (previous.length === 0 || next.length === 0) return "reset";
	if (next.length > previous.length) {
		if (matchesAt(previous, next, 0)) return "append";
		if (matchesAt(previous, next, next.length - previous.length))
			return "prepend";
	}
	const kept = new Set(next);
	return previous.some((key) => kept.has(key)) ? "mixed" : "reset";
};

export const appendedCount = (
	previous: readonly string[],
	next: readonly string[],
) => Math.max(0, next.length - previous.length);

export const describeArrivals = (names: readonly (string | undefined)[]) => {
	const count = names.length;
	const first = names[0];
	const sameAuthor =
		first !== undefined && names.every((name) => name === first);
	if (count === 1) return first ? `New message from ${first}` : "New message";
	return sameAuthor
		? `${count} new messages from ${first}`
		: `${count} new messages`;
};
