import { Agent } from "@atproto/api";
import type { APIRoute } from "astro";
import { client } from "@/utils/atproto/oauth";
import { type CategoryData, type ChannelData, ColibriSDK } from "@/utils/sdk";

export type CommunityInfo = {
	categories: Array<CategoryData>;
	channels: Array<ChannelData>;
};

export const GET = (async ({ params, session }) => {
	try {
		const user = (await session!.get("user"))!;

		if (!session || !user) {
			return new Response(
				JSON.stringify({ error: "Not logged in", data: null }),
				{
					status: 400,
					statusText: "Not logged in!",
					headers: new Headers({
						"content-type": "application/json",
					}),
				},
			);
		}

		const oauthSession = await client.restore(user.sub!);
		const agent = new Agent(oauthSession);
		const sdk = new ColibriSDK(agent);

		const communityData = await sdk.getCommunityData(
			agent.did!,
			params.community!,
		);
		const categories = await sdk.getCategories(
			agent.did!,
			communityData.categoryOrder,
		);

		const channelData: Array<ChannelData> = [];

		for (const category of categories) {
			const channels = await sdk.getChannels(agent.did!, category.channelOrder);
			channelData.push(...channels);
		}

		const data = {
			categories,
			channels: channelData,
		};

		return new Response(JSON.stringify({ error: null, data }), {
			status: 200,
			statusText: "Success",
			headers: new Headers({
				"content-type": "application/json",
			}),
		});
	} catch (e) {
		console.error(e);
		return new Response(
			JSON.stringify({ error: "Internal server error", data: null }),
			{
				status: 500,
				statusText: "Internal server error",
				headers: new Headers({
					"content-type": "application/json",
				}),
			},
		);
	}
}) satisfies APIRoute;
