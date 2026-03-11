import { Agent } from "@atproto/api";
import type { APIRoute } from "astro";
import { ColibriSDK } from "@/utils/sdk";
import { client } from "../../utils/atproto/oauth";

export const GET = (async ({ request, session }) => {
	try {
		const params = new URL(request.url).searchParams;

		const callbackResult = await client.callback(params, {
			redirect_uri: import.meta.env.DEV
				? "http://127.0.0.1:4321/auth/callback"
				: undefined,
		});

		const agent = new Agent(callbackResult.session);
		const sdk = new ColibriSDK(agent);

		const { status, communities, emoji } = await sdk.getActorData(
			agent.did!,
			true,
		);

		// Make Authenticated API calls
		const profile = await agent.getProfile({ actor: agent.did! });

		// Check if user ever signed up to Bluesky by inspecting their profile fields.
		// A DID that has never used Bluesky will have no displayName, description, avatar, and banner.
		const hasBlueskyProfile =
			profile.data.displayName !== undefined ||
			profile.data.description !== undefined ||
			profile.data.avatar !== undefined ||
			profile.data.banner !== undefined;

		if (!hasBlueskyProfile) {
			console.info(
				`User ${agent.did} has no Bluesky profile. Creating basic profile from handle.`,
			);
			await agent.com.atproto.repo.putRecord({
				repo: agent.did!,
				collection: "app.bsky.actor.profile",
				rkey: "self",
				record: {
					$type: "app.bsky.actor.profile",
					displayName: profile.data.handle,
					description: "",
				},
			});
		}

		// Check for profile data
		session?.set("user", {
			status,
			avatar: profile.data.avatar,
			banner: profile.data.banner,
			communities,
			description: profile.data.description,
			displayName: profile.data.displayName,
			identity: profile.data.handle,
			sub: callbackResult.session.sub,
			emoji,
		});

		const redirect = await session?.get("redirectAfterLogin");

		if (redirect) {
			session?.delete("redirectAfterLogin");

			return new Response(null, {
				status: 302,
				headers: new Headers({
					location: redirect,
				}),
			});
		}

		return new Response(JSON.stringify(callbackResult), {
			status: 302,
			headers: new Headers({
				location: `/app`,
			}),
		});
	} catch (err) {
		console.error(err);

		return new Response("An error occurred.", {
			status: 500,
		});
	}
}) satisfies APIRoute;
