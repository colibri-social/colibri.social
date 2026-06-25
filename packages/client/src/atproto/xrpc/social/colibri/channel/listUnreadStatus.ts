import type { XrpcRequest } from "../../..";

export type ChannelUnreadStatus = {
	channelUri: string;
	hasUnreadMessages: boolean;
	unreadPingCount: number;
};

type Response = {
	channels: ChannelUnreadStatus[];
};

export const listUnreadStatus: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.listUnreadStatus?community=${community}&auth=${auth}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
