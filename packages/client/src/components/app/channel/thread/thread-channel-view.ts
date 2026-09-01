import { asSpaceRef, SPACE_TYPES } from "../../../../atproto/lexicons";
import type { ChannelView, ThreadView } from "../../../../atproto/views";

export const threadAsChannelView = (thread: ThreadView): ChannelView => ({
	space: asSpaceRef(thread.space),
	type: SPACE_TYPES.channelThread,
	name: thread.name,
	viewer: {
		canRead: thread.viewer.canRead,
		canPost: thread.viewer.canPost,
	},
	...(thread.private === undefined ? {} : { private: thread.private }),
	...(thread.visibleToRoles === undefined
		? {}
		: { visibleToRoles: thread.visibleToRoles }),
	...(thread.visibleToMembers === undefined
		? {}
		: { visibleToMembers: thread.visibleToMembers }),
});
