import type { APIRoute } from "astro";
import { client, scopes } from "../../utils/atproto/oauth";
import { isAtIdentifierString } from '@atproto/lex'

export const GET = (async ({ request }) => {
	try {
		const reqUrl = new URL(request.url);

		if (!reqUrl.searchParams.has("handle")) {
			return new Response("No handle given", {
				status: 400,
			});
		}

		const handle = reqUrl.searchParams.get("handle")!;

		if (!isAtIdentifierString(handle)) {
			return new Response("Bad handle", {
				status: 400,
			});
		}

		const url = await client.authorize(handle, {
			scope: scopes.join(" "),
			state: JSON.stringify("{}"),
			redirect_uri: import.meta.env.DEV ? `http://127.0.0.1:4321/auth/callback` : `${import.meta.env.SITE}/auth/callback` as any
		});

		console.log(url);

		return new Response(null, {
			status: 302,
			headers: new Headers({
				'location': url.toString()
			})
		});
	} catch (e) {
		return new Response("Internal Server Error while logging in: " + e, {
			status: 500,
		});
	}
}) satisfies APIRoute;
