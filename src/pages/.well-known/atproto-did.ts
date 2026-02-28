import { SAME_TLD_DID } from "astro:env/server";

export const GET = () => {
	if (SAME_TLD_DID) {
		return new Response(SAME_TLD_DID, {
			status: 200,
			statusText: "OK",
			headers: new Headers({
				"content-type": "text/plain",
			}),
		});
	} else {
		return new Response(null, {
			status: 404,
		});
	}
};
