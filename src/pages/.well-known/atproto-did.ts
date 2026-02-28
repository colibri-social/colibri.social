import { SAME_TLD_DID } from "astro:env/server";

export const GET = () => {
	if (SAME_TLD_DID) {
		return new Response(SAME_TLD_DID);
	} else {
		return new Response(null, {
			status: 404,
		});
	}
};
