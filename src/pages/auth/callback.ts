import type { APIRoute } from "astro";
import { client } from "../../utils/atproto/oauth";
import { Agent } from "@atproto/api";

export const GET = (async ({ request, session }) => {
	try {
		const params = new URL(request.url).searchParams;

		const callbackResult = await client.callback(params);

    // Process successful authentication here
		console.log('authorize() was called with state:', callbackResult.state);

		console.log('User authenticated as:', callbackResult.session.did);

		// const parsedState: { dev: boolean } = JSON.parse(callbackResult.state ?? "{ dev: false }");

		// if (parsedState.dev && !import.meta.env.DEV) {
		// 	return new Response(JSON.stringify(callbackResult), {
		// 		status: 302,
		// 		headers: new Headers({
		// 			'location': `http://localhost:4321/auth/callback`
		// 		})
		// 	});
		// }

		const agent = new Agent(callbackResult.session);

    // Make Authenticated API calls
    const profile = await agent.getProfile({ actor: agent.did! })
		console.log('Bsky profile:', profile.data);

		session?.set('user', {
			status: '(empty)',
			avatar: profile.data.avatar,
			banner: profile.data.banner,
			communities: [],
			description: profile.data.description,
			displayName: profile.data.displayName,
			identity: profile.data.handle
		});

		return new Response(JSON.stringify(callbackResult), {
			status: 302,
			headers: new Headers({
				'location': `/`
			})
		});
  } catch (err) {
		console.error(err);

		return new Response("An error occurred.", {
			status: 500,
		});
  }
}) satisfies APIRoute;
