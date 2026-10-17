import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Route } from "../shell/layers";
import {
	appPathFromLink,
	listenForAppLinks,
	openAppLink,
	PENDING_LINK_TTL_MS,
	routeFromLink,
} from "./deep-links";

const memoryStorage = () => {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
	};
};

describe("appPathFromLink", () => {
	it("reads invite links in both schemes", () => {
		expect(appPathFromLink("social.colibri:/invite/abc123")).toBe(
			"/app/invite/abc123",
		);
		expect(appPathFromLink("social.colibri.spaces://invite/abc123")).toBe(
			"/app/invite/abc123",
		);
	});

	it("reads channel links", () => {
		expect(
			appPathFromLink(
				"social.colibri:/channel/did:plc:hq/social.colibri.beta.channel.text/general",
			),
		).toBe("/app/c/did:plc:hq/social.colibri.beta.channel.text/general");
	});

	it("reads web links on Colibri hosts", () => {
		expect(appPathFromLink("https://colibri.social/invite/abc123")).toBe(
			"/app/invite/abc123",
		);
		expect(
			appPathFromLink(
				"https://spaces.colibri.social/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
			),
		).toBe("/app/c/did:plc:hq/social.colibri.beta.channel.text/general");
	});

	it("ignores links it doesn't know", () => {
		expect(appPathFromLink("social.colibri:/oauth/callback?code=1")).toBe(
			undefined,
		);
		expect(appPathFromLink("social.colibri:/channel/hq/text/general")).toBe(
			undefined,
		);
		expect(appPathFromLink("https://example.com/invite/abc")).toBe(undefined);
		expect(appPathFromLink("not a link")).toBe(undefined);
	});
});

describe("routeFromLink", () => {
	it("opens the join screen for an invite", () => {
		expect(routeFromLink("social.colibri:/invite/abc123")).toEqual({
			root: { tab: "spaces" },
			layers: [{ kind: "join", code: "abc123" }],
		});
	});

	it("opens the channel for a channel link", () => {
		const route = routeFromLink(
			"social.colibri:/channel/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		expect(route?.layers.at(-1)).toMatchObject({
			kind: "chat",
			space: "did:plc:hq",
			channel: "general",
		});
	});
});

describe("app link delivery", () => {
	beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
	afterEach(() => vi.unstubAllGlobals());

	it("hands links straight to a listening shell", () => {
		const routes: Route[] = [];
		const stop = listenForAppLinks((route) => routes.push(route));
		expect(openAppLink("social.colibri:/invite/abc123")).toBe(true);
		stop();
		expect(routes).toHaveLength(1);
	});

	it("keeps a link that arrives before sign-in for the shell", () => {
		expect(openAppLink("social.colibri:/invite/abc123", () => 1_000)).toBe(
			true,
		);
		const routes: Route[] = [];
		const stop = listenForAppLinks(
			(route) => routes.push(route),
			() => 2_000,
		);
		stop();
		expect(routes).toEqual([
			{ root: { tab: "spaces" }, layers: [{ kind: "join", code: "abc123" }] },
		]);
		const again: Route[] = [];
		listenForAppLinks((route) => again.push(route))();
		expect(again).toEqual([]);
	});

	it("drops a kept link after a day", () => {
		openAppLink("social.colibri:/invite/abc123", () => 0);
		const routes: Route[] = [];
		listenForAppLinks(
			(route) => routes.push(route),
			() => PENDING_LINK_TTL_MS + 1,
		)();
		expect(routes).toEqual([]);
	});

	it("reports links it can't route", () => {
		expect(openAppLink("social.colibri:/oauth/callback")).toBe(false);
	});
});
