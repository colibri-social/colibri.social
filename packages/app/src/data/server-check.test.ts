import { afterEach, describe, expect, it, vi } from "vitest";
import { checkServer } from "./server-check";

const URL_BASE = "https://chat.example.com";

const DID_DOC = {
	id: "did:web:chat.example.com",
	service: [
		{
			id: "#colibri_appview",
			type: "ColibriAppView",
			serviceEndpoint: URL_BASE,
		},
	],
};

const respond = (routes: Record<string, unknown>) => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string) => {
			const path = new URL(input).pathname;

			if (!(path in routes)) return new Response("", { status: 404 });

			const body = routes[path];

			if (body instanceof Error) throw body;

			return Response.json(body);
		}),
	);
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("checkServer", () => {
	it("reads calls and federation support from describeServer", async () => {
		respond({
			"/.well-known/did.json": DID_DOC,
			"/xrpc/social.colibri.beta.server.describeServer": {
				features: ["voice", "federation"],
			},
		});

		await expect(checkServer(URL_BASE)).resolves.toEqual({
			status: "ok",
			url: URL_BASE,
			host: "chat.example.com",
			features: { calls: true, otherServers: true },
		});
	});

	it("marks a server without the federation feature", async () => {
		respond({
			"/.well-known/did.json": DID_DOC,
			"/xrpc/social.colibri.beta.server.describeServer": { features: [] },
		});

		await expect(checkServer(URL_BASE)).resolves.toMatchObject({
			status: "ok",
			features: { calls: false, otherServers: false },
		});
	});

	it("rejects a site without a Colibri service", async () => {
		respond({ "/.well-known/did.json": { id: "did:web:example.com" } });

		await expect(checkServer(URL_BASE)).resolves.toEqual({
			status: "notColibri",
		});
	});

	it("reports a network failure as unreachable", async () => {
		respond({ "/.well-known/did.json": new TypeError("Failed to fetch") });

		await expect(checkServer(URL_BASE)).resolves.toEqual({
			status: "unreachable",
		});
	});
});
