import type { APIRoute } from "astro";
import { client, scopes } from "../../utils/atproto/oauth";
import { isAtIdentifierString } from '@atproto/lex'

export const GET = (async () => {
	try {
		const handle = 'did:plc:w64dlsa4zwjv2wljlvmymldc'; // Temporary, users will need to provide their own later. Also a DID because the aka didn't work (bruh)
		const state = {
			dev: import.meta.env.DEV
		}; // Arbitrary

		if (!isAtIdentifierString(handle)) {
			return new Response("Bad handle", {
				status: 400,
			});
		}

		const url = await client.authorize(handle, {
			scope: scopes.join(" "),
			state: JSON.stringify(state),
			redirect_uri: `${import.meta.env.SITE}/auth/callback` as any
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
