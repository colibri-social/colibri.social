import type { APIRoute } from "astro";
import { client, scopes } from "../../utils/atproto/oauth";
import { isAtIdentifierString } from '@atproto/lex'

export const GET = (async () => {
	try {
		const handle = 'did:plc:w64dlsa4zwjv2wljlvmymldc'; // Temporary, users will need to provide their own later. Also a DID because the aka didn't work (bruh)
		const state = '434321'; // Arbitrary

		if (!isAtIdentifierString(handle)) {
			return new Response("Bad handle", {
				status: 400,
			});
		}

		console.log(import.meta.env.DEV ? `http://127.0.0.1:4321/auth/callback` : `${import.meta.env.SITE}/auth/callback` as any);

		const url = await client.authorize(handle, {
			scope: scopes.join(" "),
			state,
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
