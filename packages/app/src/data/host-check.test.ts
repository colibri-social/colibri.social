import { describe, expect, it } from "vitest";
import { checkSpacesSupport } from "./host-check";

const server = (responses: Record<string, Response | Error>) => {
	const calls: string[] = [];
	const fetcher = (async (input: string | URL | Request) => {
		const url = String(input);
		calls.push(url);
		const method = url.split("/xrpc/")[1] ?? "";
		const response = responses[method];
		if (!response) throw new TypeError("unexpected request");
		if (response instanceof Error) throw response;
		return response;
	}) as typeof fetch;
	return { calls, fetcher };
};

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

describe("checking a server for Spaces support", () => {
	it("accepts a server that knows the simplespace methods", async () => {
		const { calls, fetcher } = server({
			"com.atproto.server.describeServer": json(200, { did: "did:web:pds" }),
			"com.atproto.simplespace.getSpace": json(400, {
				error: "InvalidRequest",
			}),
		});

		await expect(
			checkSpacesSupport(" https://PDS.example.com/ ", fetcher),
		).resolves.toBe(true);
		expect(calls[0]).toBe(
			"https://pds.example.com/xrpc/com.atproto.server.describeServer",
		);
	});

	it("rejects a server without simplespace", async () => {
		const { fetcher } = server({
			"com.atproto.server.describeServer": json(200, { did: "did:web:pds" }),
			"com.atproto.simplespace.getSpace": json(501, {
				error: "MethodNotImplemented",
			}),
		});

		await expect(checkSpacesSupport("bsky.social", fetcher)).resolves.toBe(
			false,
		);
	});

	it("rejects an address that isn't a server", async () => {
		const { fetcher } = server({
			"com.atproto.server.describeServer": new TypeError("offline"),
		});

		await expect(checkSpacesSupport("nope.example", fetcher)).resolves.toBe(
			false,
		);
	});
});
