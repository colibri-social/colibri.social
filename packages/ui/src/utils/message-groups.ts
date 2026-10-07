import { isSameDay, type TimeInput } from "./time";

export const MESSAGE_GROUP_WINDOW_MS = 5 * 60_000;

export type GroupableMessage = {
	author: string;
	timestamp: TimeInput;
	reply?: boolean;
	forward?: boolean;
	failed?: boolean;
	system?: boolean;
};

export type GroupedMessage<T extends GroupableMessage> = {
	message: T;
	continuation: boolean;
	hasContinuation: boolean;
	newDay: boolean;
	last: boolean;
};

export type GroupMessagesOptions = {
	windowMs?: number;
};

const timeOf = (value: TimeInput) =>
	value instanceof Date ? value.getTime() : new Date(value).getTime();

const breaksGroup = (message: GroupableMessage) =>
	!!message.failed || !!message.system;

const joins = (
	previous: GroupableMessage | undefined,
	current: GroupableMessage,
	windowMs: number,
) => {
	if (!previous) return false;
	if (previous.author !== current.author) return false;
	if (!isSameDay(previous.timestamp, current.timestamp)) return false;
	if (
		Math.abs(timeOf(current.timestamp) - timeOf(previous.timestamp)) >= windowMs
	)
		return false;
	if (breaksGroup(previous) || breaksGroup(current)) return false;
	return true;
};

export const groupMessages = <T extends GroupableMessage>(
	messages: readonly T[],
	options: GroupMessagesOptions = {},
): GroupedMessage<T>[] => {
	const windowMs = options.windowMs ?? MESSAGE_GROUP_WINDOW_MS;
	return messages.map((message, index) => {
		const previous = messages[index - 1];
		const next = messages[index + 1];
		const sameRun = joins(previous, message, windowMs);
		return {
			message,
			continuation: sameRun && !message.reply && !message.forward,
			hasContinuation:
				!!next &&
				joins(message, next, windowMs) &&
				!next.reply &&
				!next.forward,
			newDay: !!previous && !isSameDay(previous.timestamp, message.timestamp),
			last: index === messages.length - 1,
		};
	});
};
