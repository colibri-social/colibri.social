import { Agent } from "@atproto/api";
import type { APIRoute } from "astro";
import { client } from "@/utils/atproto/oauth";

export const POST = (async ({ request, session }) => {
	const user = await session?.get("user");

	if (!user) {
		return new Response(JSON.stringify({ error: "Forbidden" }), {
			status: 403,
			headers: { "content-type": "application/json" },
		});
	}

	const mimeType =
		request.headers.get("content-type") ?? "application/octet-stream";
	const arrayBuffer = await request.arrayBuffer();
	const blob = new Blob([arrayBuffer], { type: mimeType });

	const oauthSession = await client.restore(user.sub!);
	const agent = new Agent(oauthSession);

	const result = await agent.com.atproto.repo.uploadBlob(blob);

	return new Response(JSON.stringify(result.data.blob), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}) satisfies APIRoute;
