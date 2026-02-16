import { isAtIdentifierString } from "@atproto/lex";
import type { APIRoute } from "astro";
import { client, scopes } from "../../utils/atproto/oauth";
import { ColibriSDK } from "@/utils/sdk";
import { Agent } from "@atproto/api";

export const GET = (async ({ request, session }) => {
	try {
		if (!session || !session?.has("user")) {
			return new Response("Forbidden", {
				status: 403,
			});
		}

		const community = new URL(request.url).searchParams.get("community");
		const category = new URL(request.url).searchParams.get("category");

		if (!category) {
			return new Response("No community given", {
				status: 400,
			});
		}

		const user = (await session.get("user"))!;
		const oauthSession = await client.restore(user.sub!);
		const agent = new Agent(oauthSession);
		const sdk = new ColibriSDK(agent);

		const channel = await sdk.createChannelData(agent.did!, category, 'text');
		await sdk.addChannelToCategory(agent.did!, category, channel);

		return new Response(null, {
			status: 302,
			headers: new Headers({
				location: `/community/${community}/${category}/${channel}`,
			}),
		});
	} catch (e) {
		return new Response("Internal Server Error while logging in: " + e, {
			status: 500,
		});
	}
}) satisfies APIRoute;
