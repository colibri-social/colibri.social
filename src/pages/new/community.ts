import { Agent } from "@atproto/api";
import type { APIRoute } from "astro";
import { ColibriSDK } from "@/utils/sdk";
import { client } from "../../utils/atproto/oauth";

export const GET = (async ({ session }) => {
	try {
		if (!session || !session?.has("user")) {
			return new Response("Forbidden", {
				status: 403,
			});
		}

		const user = (await session.get("user"))!;
		const oauthSession = await client.restore(user.sub!);
		const agent = new Agent(oauthSession);
		const sdk = new ColibriSDK(agent);

		const community = await sdk.createCommunityData(
			agent.did!,
			"New Community",
			"This is my new community!",
		);

		return new Response(null, {
			status: 302,
			headers: new Headers({
				location: `/community/${community}`,
			}),
		});
	} catch (e) {
		return new Response(
			`Internal Server Error while creating community: ${e}`,
			{
				status: 500,
			},
		);
	}
}) satisfies APIRoute;
