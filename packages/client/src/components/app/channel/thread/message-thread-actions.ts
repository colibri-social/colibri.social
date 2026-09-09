import { isForwardable } from "../../../../atproto/forward";
import { asDid, asRecordKey, asSpaceRef } from "../../../../atproto/lexicons";
import { isThreadSpace } from "../../../../atproto/space-ref";
import type { MessageView, SpaceRecordRef } from "../../../../atproto/views";
import { useChannelContext } from "../../../../contexts/Channel";
import { usePermissions } from "../../../../contexts/Community";
import { useThreads } from "../../../../contexts/Threads";
import { useUserContext } from "../../../../contexts/User";
import { suggestThreadName } from "./thread-name";

export const anchorOf = (message: MessageView): SpaceRecordRef => ({
	space: asSpaceRef(message.channel),
	did: asDid(message.author.did),
	rkey: asRecordKey(message.rkey),
});

export const useMessageThreadActions = () => {
	const channel = useChannelContext();
	const threads = useThreads();
	const user = useUserContext();
	const { canCreateThread, canMoveMessages } = usePermissions();

	const inThread = () => isThreadSpace(channel.channelSpace());

	const canOpenThread = (message: MessageView): boolean =>
		!inThread() && canCreateThread(user.did) && !message.legacy;

	const canSelect = (message: MessageView): boolean =>
		!message.legacy && canMoveMessages(user.did);

	const canForward = (message: MessageView): boolean => isForwardable(message);

	const openThreadFrom = (message: MessageView): void => {
		threads.openDraft({
			channel: message.channel,
			anchor: anchorOf(message),
			anchorMessage: message,
			suggestedName: suggestThreadName(message.text),
		});
	};

	const select = (message: MessageView): void => {
		channel.beginSelection(message);
	};

	return { canOpenThread, canSelect, canForward, openThreadFrom, select };
};
