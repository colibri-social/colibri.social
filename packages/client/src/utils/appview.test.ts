import { describe, expect, it } from "vitest";
import {
	appViewHostFor,
	DEFAULT_APPVIEW_URL,
	didWebForHost,
	getAppViewDid,
	getAppViewHost,
	getAppViewHostFromDid,
	resolveStoredAppViewUrl,
} from "./appview";

describe("didWebForHost", () => {
	it("percent-encodes the port separator", () => {
		expect(didWebForHost("api.colibri.social")).toBe(
			"did:web:api.colibri.social",
		);
		expect(didWebForHost("appview.example.com:8443")).toBe(
			"did:web:appview.example.com%3A8443",
		);
	});

	it("names loopback by hostname, which a pds accepts as an audience", () => {
		expect(didWebForHost("127.0.0.1:3000")).toBe("did:web:localhost%3A3000");
		expect(didWebForHost("127.0.0.1")).toBe("did:web:localhost");
		expect(didWebForHost("[::1]:3000")).toBe("did:web:localhost%3A3000");
	});

	it("leaves a host that merely starts with those digits alone", () => {
		expect(didWebForHost("127.0.0.1.example.com")).toBe(
			"did:web:127.0.0.1.example.com",
		);
	});
});

describe("getAppViewDid", () => {
	it("names the appview by a did the authorization server can resolve", () => {
		expect(getAppViewDid()).toBe(
			didWebForHost(new URL(DEFAULT_APPVIEW_URL).host),
		);
		expect(getAppViewDid()).toBe("did:web:spaces-api.colibri.social");
	});
});

describe("resolveStoredAppViewUrl", () => {
	it("keeps a host the user chose", () => {
		expect(resolveStoredAppViewUrl("https://appview.example.com")).toBe(
			"https://appview.example.com",
		);
	});

	it("falls back for a host that no longer serves this client", () => {
		expect(resolveStoredAppViewUrl("https://api.colibri.social")).toBe(
			DEFAULT_APPVIEW_URL,
		);
	});

	it("falls back for anything unusable", () => {
		for (const value of [undefined, null, "", "not a url", 7]) {
			expect(resolveStoredAppViewUrl(value)).toBe(DEFAULT_APPVIEW_URL);
		}
	});
});

describe("appViewHostFor", () => {
	it("dials the appview a community names as its managing app", () => {
		expect(appViewHostFor("did:web:hub.example.com", "ws")).toBe(
			getAppViewHostFromDid("did:web:hub.example.com", "ws"),
		);
	});

	it("falls back to the configured appview when no managing app is named", () => {
		expect(appViewHostFor(undefined, "http")).toBe(getAppViewHost("http"));
	});

	it("falls back when the managing app is not a did:web", () => {
		expect(appViewHostFor("did:plc:2hnjxkqm6bpuvvpjbztkxxxx", "http")).toBe(
			getAppViewHost("http"),
		);
	});
});
