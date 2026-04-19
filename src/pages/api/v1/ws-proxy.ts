// src/pages/api/ws-proxy.ts
import type { APIRoute } from "astro";
import { WebSocket } from "ws";

export const GET: APIRoute = ({ request }) => {
	const url = new URL(request.url);
	const target = url.searchParams.get("target");

	console.log(request);

	if (!target) {
		return new Response("Missing target", { status: 400 });
	}

	const targetUrl = new URL(target);

	const stream = new ReadableStream({
		start(controller) {
			const upstream = new WebSocket(target, {
				headers: {
					Host: targetUrl.host,
					Origin: `https://${targetUrl.host}`,
				},
			});

			upstream.on("unexpected-response", (_req, res) => {
				console.error(`[ws-proxy] ${target} responded with ${res.statusCode}`);
				console.error(`[ws-proxy] Response headers:`, res.headers);
				let body = "";
				res.on("data", (chunk: Buffer) => (body += chunk.toString()));
				res.on("end", () => {
					console.error(`[ws-proxy] Response body:`, body);
				});
				controller.enqueue(`event: error\ndata: ${res.statusCode}\n\n`);
				controller.close();
			});

			upstream.on("message", (data) => {
				controller.enqueue(`data: ${data}\n\n`);
			});

			upstream.on("error", (err) => {
				console.error(`[ws-proxy] WebSocket error:`, err);
				controller.enqueue(`event: error\ndata: ${err.message}\n\n`);
				controller.close();
			});

			upstream.on("close", (code, reason) => {
				console.error(`[ws-proxy] WebSocket closed: ${code} ${reason}`);
				controller.close();
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
};
