import { isThreadSpace, parseSpace } from "@colibri-social/lib";
import { createActivationBus } from "../notifications/activation";
import type { OsActivation } from "../notifications/types";

export const NOTIFICATION_LINK_PATH = "/notification";

const text = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

export const messageRecord = (
	uri: string | undefined,
): { space: string; rkey: string } | undefined => {
	if (!uri?.startsWith("at://")) return undefined;
	const segments = uri.slice("at://".length).split("/");
	if (segments.length !== 7) return undefined;
	const space = `at://${segments.slice(0, 4).join("/")}`;
	const rkey = segments[6];
	if (!rkey || !parseSpace(space)) return undefined;
	return { space, rkey };
};

export const parsePushActivation = (
	data: unknown,
): OsActivation | undefined => {
	if (typeof data !== "object" || data === null) return undefined;
	const fields = data as Record<string, unknown>;
	const channel = text(fields.channelUri) ?? text(fields.channel);
	if (!channel || !parseSpace(channel) || isThreadSpace(channel)) {
		return undefined;
	}
	const record = messageRecord(text(fields.messageUri) ?? text(fields.message));
	const thread =
		text(fields.threadUri) ??
		text(fields.thread) ??
		(record && isThreadSpace(record.space) ? record.space : undefined);
	const activation: OsActivation = { channel };
	if (thread && isThreadSpace(thread)) activation.thread = thread;
	if (record) activation.rkey = record.rkey;
	return activation;
};

const linkPath = (url: URL) =>
	url.host ? `/${url.host}${url.pathname}` : url.pathname;

export const isNotificationLink = (url: string): boolean => {
	try {
		return linkPath(new URL(url)) === NOTIFICATION_LINK_PATH;
	} catch {
		return false;
	}
};

export const parseNotificationLink = (
	url: string,
): OsActivation | undefined => {
	if (!isNotificationLink(url)) return undefined;
	const params = new URL(url).searchParams;
	return parsePushActivation({
		channelUri: params.get("channel"),
		threadUri: params.get("thread"),
		messageUri: params.get("message"),
	});
};

export const pushActivations = createActivationBus();

export const openPushActivation = (data: unknown): boolean => {
	const activation = parsePushActivation(data);
	if (activation) pushActivations.emit(activation);
	return !!activation;
};

export const openNotificationLink = (url: string): boolean => {
	if (!isNotificationLink(url)) return false;
	const activation = parseNotificationLink(url);
	if (activation) pushActivations.emit(activation);
	return true;
};
