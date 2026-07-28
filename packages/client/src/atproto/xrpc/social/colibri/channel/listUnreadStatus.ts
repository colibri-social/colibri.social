import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export type ChannelUnreadStatus = {
	channelUri: string;
	hasUnreadMessages: boolean;
	unreadPingCount: number;
};

type Response = {
	channels: ChannelUnreadStatus[];
};

export const listUnreadStatus: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.listUnreadStatus?community=${community}`,
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
