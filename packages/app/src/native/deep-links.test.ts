import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type LinkOutcome,
	listenForLinkOutcomes,
} from "../data/supporter-link";
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

	it("reads emoji pack links in both schemes and on the web", () => {
		expect(appPathFromLink("social.colibri:/emoji/did:plc:abc/3kowls")).toBe(
			"/app/emoji/did:plc:abc/3kowls",
		);
		expect(
			appPathFromLink("social.colibri.spaces://emoji/did%3Aplc%3Aabc/3kowls"),
		).toBe("/app/emoji/did:plc:abc/3kowls");
		expect(
			appPathFromLink("https://spaces.colibri.social/emoji/did:plc:abc/3kowls"),
		).toBe("/app/emoji/did:plc:abc/3kowls");
		expect(appPathFromLink("social.colibri:/emoji/lou.gg/3kowls")).toBe(
			undefined,
		);
		expect(
			routeFromLink("https://colibri.social/emoji/did:plc:abc/3kowls"),
		).toEqual({
			root: { tab: "spaces" },
			layers: [{ kind: "pack", did: "did:plc:abc", rkey: "3kowls" }],
		});
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

describe("message links", () => {
	const chat = "/app/c/did:plc:hq/social.colibri.beta.channel.text/general";

	it("returns the message for web and scheme links", () => {
		for (const link of [
			`https://colibri.social${chat}/m/3kmsg`,
			"social.colibri:/channel/did:plc:hq/social.colibri.beta.channel.text/general/m/3kmsg",
		]) {
			expect(routeFromLink(link)?.layers).toEqual([
				{
					kind: "chat",
					space: "did:plc:hq",
					channel: "general",
					channelType: "social.colibri.beta.channel.text",
					message: "3kmsg",
				},
			]);
		}
	});

	it("returns the thread and message for thread message links", () => {
		const route = routeFromLink(
			"social.colibri:/channel/did:plc:hq/social.colibri.beta.channel.text/general/t/3kthread/m/3kmsg",
		);
		expect(route?.layers.at(-1)).toMatchObject({
			kind: "thread",
			thread: "3kthread",
			message: "3kmsg",
		});
	});

	it("rejects message links with a missing record key", () => {
		expect(routeFromLink(`https://colibri.social${chat}/m`)).toBe(undefined);
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

describe("Open Collective returns", () => {
	it("hands the outcome to the link listener", () => {
		const seen: LinkOutcome[] = [];
		const stop = listenForLinkOutcomes((outcome) => seen.push(outcome));
		expect(
			openAppLink("social.colibri:/oc/callback?oc=linked&account=lou"),
		).toBe(true);
		expect(seen).toEqual([{ status: "linked", account: "lou" }]);
		stop();
	});

	it("ignores an oc link without an outcome", () => {
		expect(openAppLink("social.colibri:/oc/callback")).toBe(false);
	});
});
