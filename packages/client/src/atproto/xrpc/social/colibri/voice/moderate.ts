import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type VoiceModerationAction =
	| "mute"
	| "unmute"
	| "deafen"
	| "undeafen"
	| "disconnect";

export const moderate: XrpcRequest<
	[string, string, string, VoiceModerationAction],
	Promise<XrpcResult<{ did: string }>>
> = async (fetch, community, channel, target, action) => {
	return request<{ did: string }>(fetch, {
		lxm: "social.colibri.voice.moderate",
		route: `/xrpc/social.colibri.voice.moderate?community=${encodeURIComponent(community)}&channel=${encodeURIComponent(channel)}&target=${encodeURIComponent(target)}&action=${encodeURIComponent(action)}`,
		init: { method: "POST" },
	});
};
