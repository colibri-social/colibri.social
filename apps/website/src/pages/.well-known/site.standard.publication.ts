import { PUBLICATION_URI } from "@/lib/blog/config";

export const GET = () =>
	new Response(PUBLICATION_URI, {
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
