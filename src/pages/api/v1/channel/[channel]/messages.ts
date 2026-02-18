import { Agent } from "@atproto/api";
import type { APIRoute } from "astro";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK, type MessageData } from "@/utils/sdk";

export type ChannelInfo = {
	messages: Array<MessageData>;
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

		const messages = await sdk.getMessagesForChannel(
			agent.did!,
			params.channel!,
		);

		const data = {
			messages,
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
