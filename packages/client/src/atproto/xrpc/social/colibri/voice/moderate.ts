import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export type VoiceModerationAction =
	| "mute"
	| "unmute"
	| "deafen"
	| "undeafen"
	| "disconnect";

export const moderate: XrpcRequest<
	[string, string, string, VoiceModerationAction],
	Promise<{ did: string } | undefined>
> = async (fetch, community, channel, target, action) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.voice.moderate?community=${encodeURIComponent(community)}&channel=${encodeURIComponent(channel)}&target=${encodeURIComponent(target)}&action=${encodeURIComponent(action)}`,
			{ method: "POST" },
		);
		return await readJson<{ did: string }>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
