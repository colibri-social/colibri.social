import { client } from "../utils/atproto/oauth";

export const GET = () => {
	return new Response(JSON.stringify(client.jwks), {
		status: 200,
		statusText: "OK",
		headers: new Headers({
			'content-type': 'application/json'
		})
	});
}
