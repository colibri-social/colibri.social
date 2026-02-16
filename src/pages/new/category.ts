import { Agent } from "@atproto/api";
import type { APIRoute } from "astro";
import { ColibriSDK } from "@/utils/sdk";
import { client } from "../../utils/atproto/oauth";

export const GET = (async ({ request, session }) => {
	try {
		if (!session || !session?.has("user")) {
			return new Response("Forbidden", {
				status: 403,
			});
		}

		const community = new URL(request.url).searchParams.get("community");

		if (!community) {
			return new Response("No community given", {
				status: 400,
			});
		}

		const user = (await session.get("user"))!;
		const oauthSession = await client.restore(user.sub!);
		const agent = new Agent(oauthSession);
		const sdk = new ColibriSDK(agent);

		const category = await sdk.createCategoryData(
			agent.did!,
			community,
			"New Category",
		);
		await sdk.addCategoryToCommunity(agent.did!, community, category);

		return new Response(null, {
			status: 302,
			headers: new Headers({
				location: `/community/${community}/${category}`,
			}),
		});
	} catch (e) {
		return new Response(`Internal Server Error while creating category: ${e}`, {
			status: 500,
		});
	}
}) satisfies APIRoute;
