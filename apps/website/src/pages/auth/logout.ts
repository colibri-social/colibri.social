import type { APIRoute } from "astro";

export const GET = (async ({ session }) => {
	try {
		session?.destroy();

		return new Response(null, {
			status: 302,
			headers: new Headers({
				location: `/`,
			}),
		});
	} catch (err) {
		console.error(err);

		return new Response("An error occurred.", {
			status: 500,
		});
	}
}) satisfies APIRoute;
