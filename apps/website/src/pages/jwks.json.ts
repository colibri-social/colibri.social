import { getClient } from "../utils/atproto/oauth";

export const GET = async () => {
	const client = await getClient();

	return new Response(JSON.stringify(client.jwks), {
		status: 200,
		statusText: "OK",
		headers: new Headers({
			"content-type": "application/json",
		}),
	});
};
