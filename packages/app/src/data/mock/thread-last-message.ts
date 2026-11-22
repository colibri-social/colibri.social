import type { social } from "@colibri-social/lexicons";
import type { MessageView } from "../types";

type ServedSummary = social.colibri.beta.channel.defs.ChannelSummary;

const attachmentKind = (mimeType: string | undefined) => {
	if (mimeType === undefined) return undefined;
	return mimeType.startsWith("image/") || mimeType.startsWith("video/")
		? "image"
		: "file";
};

export const mockThreadLastMessage = (
	message: MessageView | undefined,
): { lastMessage?: ServedSummary } => {
	if (!message) return { lastMessage: undefined };
	const kind = attachmentKind(message.attachments[0]?.mimeType);
	return {
		lastMessage: {
			channel: message.channel,
			rkey: message.rkey,
			author: message.author.did,
			text: message.text,
			...(message.facets?.length ? { facets: message.facets } : {}),
			...(kind ? { attachmentKind: kind } : {}),
			attachmentCount: message.attachments.length,
			forward: !!message.forward,
			createdAt: message.createdAt,
		} as ServedSummary,
	};
};
