import { describe, expect, it, vi } from "vitest";
import { parseSignupPdsUrl, signupHostLabel, supportsSignup } from "./signup";

const respond = (routes: Record<string, unknown>) =>
	vi.fn(async (input: string) => {
		const body = routes[input];
		return body === undefined
			? new Response("not found", { status: 404 })
			: Response.json(body);
	}) as unknown as typeof fetch;

describe("parseSignupPdsUrl", () => {
	it("keeps only the origin of an http or https URL", () => {
		expect(parseSignupPdsUrl(" https://pds.example/xrpc/ ")).toBe(
			"https://pds.example",
		);
		expect(parseSignupPdsUrl("http://localhost:2583")).toBe(
			"http://localhost:2583",
		);
	});

	it("ignores missing or unusable values", () => {
		expect(parseSignupPdsUrl(undefined)).toBeUndefined();
		expect(parseSignupPdsUrl("")).toBeUndefined();
		expect(parseSignupPdsUrl("not a url")).toBeUndefined();
		expect(parseSignupPdsUrl("ftp://pds.example")).toBeUndefined();
	});
});

describe("signupHostLabel", () => {
	it("shows the host without the scheme", () => {
		expect(signupHostLabel("https://pds.example")).toBe("pds.example");
	});
});

describe("supportsSignup", () => {
	it("follows the PDS to its authorization server and looks for create", async () => {
		const fetchImpl = respond({
			"https://pds.example/.well-known/oauth-protected-resource": {
				authorization_servers: ["https://auth.example"],
			},
			"https://auth.example/.well-known/oauth-authorization-server": {
				prompt_values_supported: ["none", "login", "create"],
			},
		});
		await expect(
			supportsSignup("https://pds.example", fetchImpl),
		).resolves.toBe(true);
	});

	it("says no when the server doesn't offer create", async () => {
		const fetchImpl = respond({
			"https://pds.example/.well-known/oauth-protected-resource": {
				authorization_servers: ["https://pds.example"],
			},
			"https://pds.example/.well-known/oauth-authorization-server": {
				prompt_values_supported: ["login", "consent"],
			},
		});
		await expect(
			supportsSignup("https://pds.example", fetchImpl),
		).resolves.toBe(false);
	});

	it("says no when the metadata can't be loaded", async () => {
		await expect(
			supportsSignup("https://pds.example", respond({})),
		).resolves.toBe(false);
	});
});
