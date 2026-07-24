import type { APIRoute } from "astro";
import { addToWaitlist } from "@/lib/waitlist";

export const prerender = false;

const json = (body: unknown, status: number) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

export const POST: APIRoute = async ({ request }) => {
	let payload: { did?: unknown; handle?: unknown; email?: unknown };
	try {
		payload = await request.json();
	} catch {
		return json({ error: "Invalid JSON body." }, 400);
	}

	const did = typeof payload.did === "string" ? payload.did : "";
	const email = typeof payload.email === "string" ? payload.email : "";
	const handle =
		typeof payload.handle === "string" ? payload.handle : undefined;

	if (!did.startsWith("did:") || !email.includes("@")) {
		return json({ error: "A valid did and email are required." }, 400);
	}

	try {
		const result = await addToWaitlist({ did, handle, email });
		if (result === "unavailable") {
			return json({ error: "The waitlist is temporarily unavailable." }, 503);
		}
		return json({ ok: true, alreadyOnList: result === "exists" }, 200);
	} catch (err) {
		console.error("[waitlist] failed to store entry", err);
		return json({ error: "Couldn't save your spot." }, 500);
	}
};
