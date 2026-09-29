import { COLLECTIONS } from "../atproto/lexicons";
import { isThreadSpace, spaceRecordUri } from "../atproto/space-ref";

export type NotificationActivation = {
	channelUri: string;
	threadUri?: string;
	messageUri?: string;
};

type Handler = (activation: NotificationActivation) => void;

const handlers = new Set<Handler>();

let pending: NotificationActivation | undefined;

export const onNotificationActivation = (handler: Handler): (() => void) => {
	handlers.add(handler);
	const buffered = pending;
	pending = undefined;
	if (buffered) handler(buffered);
	return () => handlers.delete(handler);
};

const spaceOfRecord = (recordUri: string): string | undefined => {
	if (!recordUri.startsWith("at://")) return undefined;
	const [authority, marker, type, skey] = recordUri.slice(5).split("/");
	if (marker !== "space" || !authority || !type || !skey) return undefined;
	return `at://${authority}/${marker}/${type}/${skey}`;
};

export const withMessageThread = (
	activation: NotificationActivation,
): NotificationActivation => {
	if (activation.threadUri || !activation.messageUri) return activation;
	const space = spaceOfRecord(activation.messageUri);
	if (!space || !isThreadSpace(space)) return activation;
	return { ...activation, threadUri: space };
};

export const emitNotificationActivation = (
	incoming: NotificationActivation,
): void => {
	const activation = withMessageThread(incoming);
	if (handlers.size === 0) {
		pending = activation;
		return;
	}
	for (const handler of [...handlers]) handler(activation);
};

export const discardPendingNotificationActivation = (): void => {
	pending = undefined;
};

const text = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

export const parsePushActivation = (
	data: unknown,
): NotificationActivation | undefined => {
	if (typeof data !== "object" || data === null) return undefined;
	const fields = data as Record<string, unknown>;

	const reported = text(fields.channelUri) ?? text(fields.channel);
	if (!reported) return undefined;

	const threadUri =
		text(fields.threadUri) ??
		text(fields.thread) ??
		(isThreadSpace(reported) ? reported : undefined);
	const channelUri = reported;
	const messageSpace = threadUri ?? channelUri;

	const messageAuthor = text(fields.messageAuthor);
	const messageRkey = text(fields.messageRkey);
	const messageUri =
		text(fields.messageUri) ??
		(messageAuthor && messageRkey
			? spaceRecordUri(
					messageSpace,
					messageAuthor,
					COLLECTIONS.message,
					messageRkey,
				)
			: undefined);

	return threadUri
		? { channelUri, threadUri, messageUri }
		: { channelUri, messageUri };
};

const FOCUS_PARAM = "m";

let capturedMessageUri: string | undefined;

export const captureNotificationActivationFromUrl = (): void => {
	if (typeof window === "undefined") return;

	try {
		const url = new URL(window.location.href);
		const messageUri = url.searchParams.get(FOCUS_PARAM);
		if (!messageUri) return;

		capturedMessageUri = messageUri;
		url.searchParams.delete(FOCUS_PARAM);
		window.history.replaceState(
			window.history.state,
			"",
			`${url.pathname}${url.search}${url.hash}`,
		);
	} catch {}
};

export const takeCapturedFocusMessageUri = (): string | undefined => {
	const captured = capturedMessageUri;
	capturedMessageUri = undefined;
	return captured;
};
