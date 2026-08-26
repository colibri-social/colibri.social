import { COLLECTIONS } from "../atproto/lexicons";
import { spaceRecordUri } from "../atproto/space-ref";

export type NotificationActivation = {
	channelUri: string;
	messageUri?: string;
};

type Handler = (activation: NotificationActivation) => void;

const handlers = new Set<Handler>();

export const onNotificationActivation = (handler: Handler): (() => void) => {
	handlers.add(handler);
	return () => handlers.delete(handler);
};

export const emitNotificationActivation = (
	activation: NotificationActivation,
): void => {
	for (const handler of [...handlers]) handler(activation);
};

const text = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

export const parsePushActivation = (
	data: unknown,
): NotificationActivation | undefined => {
	if (typeof data !== "object" || data === null) return undefined;
	const fields = data as Record<string, unknown>;

	const channelUri = text(fields.channelUri) ?? text(fields.channel);
	if (!channelUri) return undefined;

	const messageAuthor = text(fields.messageAuthor);
	const messageRkey = text(fields.messageRkey);
	const messageUri =
		text(fields.messageUri) ??
		(messageAuthor && messageRkey
			? spaceRecordUri(
					channelUri,
					messageAuthor,
					COLLECTIONS.message,
					messageRkey,
				)
			: undefined);

	return { channelUri, messageUri };
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
