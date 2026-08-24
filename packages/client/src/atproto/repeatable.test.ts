import { describe, expect, it, vi } from "vitest";

vi.mock("../notifications/environment", () => ({
	isTauriRuntime: () => false,
}));
vi.mock("../utils/logger", () => ({
	createLogger: () => ({
		debug: () => {},
		info: () => {},
		warn: () => {},
		error: () => {},
	}),
}));

vi.stubGlobal("window", {
	location: { hostname: "colibri.social", host: "colibri.social", port: "" },
});

const { isRepeatable, isWrite, isXrpc, methodOf, preflightFetch } =
	await import("./auth");

describe("isRepeatable", () => {
	it("repeats a plain GET", () => {
		expect(isRepeatable("https://pds.example/xrpc/thing")).toBe(true);
		expect(isRepeatable("https://pds.example/x", { method: "GET" })).toBe(true);
		expect(isRepeatable(new URL("https://pds.example/x"))).toBe(true);
	});

	it("refuses a token request, so a spent refresh token is never replayed", () => {
		expect(
			isRepeatable("https://pds.example/oauth/token", {
				method: "POST",
				body: new URLSearchParams({ grant_type: "refresh_token" }),
			}),
		).toBe(false);
	});

	it("refuses a multipart write, so a community is never created twice", () => {
		expect(
			isRepeatable("https://api.example/xrpc/social.colibri.community.create", {
				method: "POST",
				body: new FormData(),
			}),
		).toBe(false);
	});

	it("refuses any body regardless of method", () => {
		expect(isRepeatable("https://x.example/y", { body: "raw" })).toBe(false);
		expect(
			isRepeatable("https://x.example/y", { method: "PUT", body: "raw" }),
		).toBe(false);
	});

	it("refuses an unsafe method even with no body", () => {
		expect(isRepeatable("https://x.example/y", { method: "POST" })).toBe(false);
		expect(isRepeatable("https://x.example/y", { method: "DELETE" })).toBe(
			false,
		);
	});

	it("refuses a Request object it cannot safely resend", () => {
		expect(isRepeatable(new Request("https://x.example/y"))).toBe(false);
	});

	it("refuses every Request, which is what the OAuth client always sends", () => {
		expect(
			isRepeatable(
				new Request("https://pds.example/oauth/token", {
					method: "POST",
					body: "grant_type=refresh_token",
				}),
			),
		).toBe(false);
	});
});

describe("methodOf", () => {
	it("reads the method off a Request when there is no init", () => {
		expect(
			methodOf(new Request("https://x.example/y", { method: "POST" })),
		).toBe("POST");
	});

	it("prefers an explicit init method", () => {
		expect(methodOf("https://x.example/y", { method: "delete" })).toBe(
			"DELETE",
		);
	});

	it("defaults to GET", () => {
		expect(methodOf("https://x.example/y")).toBe("GET");
	});
});

describe("isWrite", () => {
	it("sees a write carried on a Request, not just on init", () => {
		expect(
			isWrite(
				new Request("https://api.example/xrpc/create", {
					method: "POST",
					body: new FormData(),
				}),
			),
		).toBe(true);
	});

	it("does not call a read a write", () => {
		expect(isWrite("https://api.example/xrpc/get")).toBe(false);
		expect(isWrite(new Request("https://api.example/xrpc/get"))).toBe(false);
	});
});

describe("isXrpc", () => {
	it("recognises an xrpc path however the input is shaped", () => {
		expect(
			isXrpc("https://api.example/xrpc/social.colibri.actor.getProfile"),
		).toBe(true);
		expect(isXrpc(new URL("https://api.example/xrpc/x"))).toBe(true);
		expect(isXrpc(new Request("https://api.example/xrpc/x"))).toBe(true);
	});

	it("does not claim an oauth endpoint", () => {
		expect(isXrpc("https://pds.example/oauth/token")).toBe(false);
		expect(
			isXrpc("https://pds.example/.well-known/oauth-authorization-server"),
		).toBe(false);
	});
});

describe("preflightFetch", () => {
	it("does not let a connection failure escape as a TypeError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Failed to fetch");
			}),
		);

		const failure = await preflightFetch("https://pds.example/oauth/token", {
			method: "POST",
			body: new URLSearchParams({ grant_type: "refresh_token" }),
		}).then(
			() => undefined,
			(err: unknown) => err,
		);

		expect(failure).toBeInstanceOf(Error);
		expect(failure).not.toBeInstanceOf(TypeError);
		expect((failure as Error).name).toBe("TransportFailure");
		expect((failure as Error).cause).toBeInstanceOf(TypeError);

		vi.unstubAllGlobals();
	});
});
