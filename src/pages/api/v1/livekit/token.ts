import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from "astro:env/server";
import type { APIRoute } from "astro";
import { AccessToken } from "livekit-server-sdk";

async function getAuthenticatedUser(
	_context: Parameters<APIRoute>[0],
): Promise<App.SessionData["user"] | undefined> {
	return await _context.session?.get("user");
}

export const GET: APIRoute = async (context) => {
	if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
		console.error(
			"[livekit/token] LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not set.",
		);
		return json({ error: "Server misconfiguration" }, 500);
	}

	const user = await getAuthenticatedUser(context);
	if (!user) {
		return json({ error: "Unauthorized" }, 401);
	}

	const url = new URL(context.request.url);
	const room = url.searchParams.get("room")?.trim();
	const identity = url.searchParams.get("identity")?.trim();

	if (!room || !identity) {
		return json(
			{ error: "'room' and 'identity' query params are required" },
			400,
		);
	}

	const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
		identity,
		// TODO(launch): Refresh tokens on client every 10 minutes
		ttl: import.meta.env.DEV ? "24h" : "15min",
	});

	at.addGrant({
		room,
		roomJoin: true,
		canPublish: true,
		canSubscribe: true,
	});

	const token = await at.toJwt();

	return json({ token }, 200, {
		"Cache-Control": "no-store",
	});
};

function json(
	body: unknown,
	status: number,
	extraHeaders?: Record<string, string>,
) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			...extraHeaders,
		},
	});
}
