import { describe, expect, it } from "vitest";
import { DISCOVERY_ENABLED } from "./features";
import { parsePath, pathAt, type Route, rootPath } from "./layers";

const DID = "did:plc:hq";
const TEXT = "social.colibri.beta.channel.text";

describe("paths", () => {
	it("round-trips Space management pages with their parents", () => {
		const route = parsePath(`/app/c/${DID}/manage/role/r1`);
		expect(route.layers).toEqual([
			{ kind: "admin", space: DID, page: "overview" },
			{ kind: "admin", space: DID, page: "roles" },
			{ kind: "admin", space: DID, page: "role", id: "r1" },
		]);
		expect(pathAt(route, 3)).toBe(`/app/c/${DID}/manage/role/r1`);
		expect(pathAt(route, 1)).toBe(`/app/c/${DID}/manage/overview`);
		expect(parsePath(`/app/c/${DID}/manage/channel/general`).layers).toEqual([
			{ kind: "admin", space: DID, page: "channel", id: "general" },
		]);
		expect(parsePath(`/app/c/${DID}/manage/nope`).layers).toEqual([
			{ kind: "notFound", path: `/app/c/${DID}/manage/nope` },
		]);
		expect(
			parsePath(`/app/c/${DID}/manage/bridge-connect/matrix`).layers.map(
				(layer) => (layer.kind === "admin" ? layer.page : layer.kind),
			),
		).toEqual(["overview", "bridges", "bridge-new", "bridge-connect"]);
	});

	it("round-trips create and invite paths", () => {
		for (const path of ["/app/new", "/app/invite/abc123"]) {
			const route = parsePath(path);
			expect(route.root.tab).toBe("spaces");
			expect(pathAt(route, 1)).toBe(path);
		}
	});

	it.skipIf(DISCOVERY_ENABLED)("treats the discover path as unknown", () => {
		expect(parsePath("/app/discover").layers).toEqual([
			{ kind: "notFound", path: "/app/discover" },
		]);
	});

	it.skipIf(!DISCOVERY_ENABLED)("round-trips the discover path", () => {
		const route = parsePath("/app/discover");
		expect(route.root.tab).toBe("spaces");
		expect(pathAt(route, 1)).toBe("/app/discover");
	});

	it("opens home on the sign-in return path", () => {
		expect(parsePath("/app/login")).toEqual({
			root: { tab: "spaces" },
			layers: [],
		});
		expect(parsePath("/app/login/extra").layers[0]?.kind).toBe("notFound");
	});

	it("opens shared invite links from the web origin", () => {
		expect(parsePath("/invite/abc123")).toEqual({
			root: { tab: "spaces" },
			layers: [{ kind: "join", code: "abc123" }],
		});
	});

	it("round-trips every layer depth", () => {
		const route: Route = {
			root: { tab: "spaces", space: DID },
			layers: [
				{ kind: "chat", space: DID, channel: "general", channelType: TEXT },
				{ kind: "members", space: DID, channel: "general", channelType: TEXT },
			],
		};
		expect(pathAt(route, 0)).toBe(`/app/c/${DID}`);
		expect(pathAt(route, 1)).toBe(`/app/c/${DID}/${TEXT}/general`);
		expect(pathAt(route, 2)).toBe(`/app/c/${DID}/${TEXT}/general/members`);
		expect(parsePath(`/app/c/${DID}/${TEXT}/general/members`)).toEqual(route);
	});

	it("matches the current client's thread paths", () => {
		expect(parsePath(`/app/c/${DID}/${TEXT}/general/t/abc`).layers[1]).toEqual({
			kind: "thread",
			space: DID,
			channel: "general",
			channelType: TEXT,
			thread: "abc",
		});
	});

	it("round-trips thread drafts with and without an anchor", () => {
		const chat = {
			kind: "chat" as const,
			space: DID,
			channel: "general",
			channelType: TEXT,
		};
		const anchored: Route = {
			root: { tab: "spaces", space: DID },
			layers: [chat, { ...chat, kind: "threadDraft", anchor: "3l2abc" }],
		};
		expect(pathAt(anchored, 2)).toBe(
			`/app/c/${DID}/${TEXT}/general/t/new/3l2abc`,
		);
		expect(parsePath(pathAt(anchored, 2))).toEqual(anchored);
		const blank: Route = {
			root: { tab: "spaces", space: DID },
			layers: [chat, { ...chat, kind: "threadDraft" }],
		};
		expect(pathAt(blank, 2)).toBe(`/app/c/${DID}/${TEXT}/general/t/new`);
		expect(parsePath(pathAt(blank, 2))).toEqual(blank);
	});

	it("round-trips the thread list and a thread opened from it", () => {
		const target = { space: DID, channel: "general", channelType: TEXT };
		const route: Route = {
			root: { tab: "spaces", space: DID },
			layers: [
				{ kind: "chat", ...target },
				{ kind: "threads", ...target },
				{ kind: "thread", ...target, thread: "abc", via: "threads" },
			],
		};
		expect(pathAt(route, 2)).toBe(`/app/c/${DID}/${TEXT}/general/threads`);
		expect(pathAt(route, 3)).toBe(
			`/app/c/${DID}/${TEXT}/general/threads/t/abc`,
		);
		expect(parsePath(pathAt(route, 3))).toEqual(route);
		expect(parsePath(pathAt(route, 2))).toEqual({
			...route,
			layers: route.layers.slice(0, 2),
		});
	});

	it("parses tab roots", () => {
		expect(parsePath("/app/inbox")).toEqual({
			root: { tab: "inbox" },
			layers: [],
		});
		expect(rootPath({ tab: "settings" })).toBe("/app/settings");
	});

	it("parses the profile editor over the Profile tab", () => {
		const route = parsePath("/app/profile/edit");
		expect(route).toEqual({
			root: { tab: "profile" },
			layers: [{ kind: "editProfile" }],
		});
		expect(pathAt(route, 0)).toBe("/app/profile");
		expect(pathAt(route, 1)).toBe("/app/profile/edit");
	});

	it("opens the Spaces tab at the app roots", () => {
		for (const path of ["/", "/app", "/app/"]) {
			expect(parsePath(path)).toEqual({ root: { tab: "spaces" }, layers: [] });
		}
	});

	it("routes unknown paths to a not found layer that keeps the URL", () => {
		for (const path of [
			"/nope/x",
			"/app/nope",
			"/app/c/not-a-did",
			"/app/inbox/extra",
			"/app/new/extra",
			"/invite/abc/extra",
			`/app/c/${DID}/${TEXT}/general/bogus`,
			`/app/c/${DID}/${TEXT}/general/t/abc/bogus`,
			`/app/c/${DID}/${TEXT}/general/threads/x/abc`,
			`/app/c/${DID}/${TEXT}`,
			"/app/%E0%A4%A",
		]) {
			const route = parsePath(path);
			expect(route).toEqual({
				root: { tab: "spaces" },
				layers: [{ kind: "notFound", path }],
			});
			expect(pathAt(route, 1)).toBe(path);
		}
	});

	it("keeps settings sub-pages on the Settings tab", () => {
		expect(parsePath("/app/settings/appearance")).toEqual({
			root: { tab: "settings" },
			layers: [],
		});
	});

	it("encodes unusual channel keys", () => {
		const route = parsePath(`/app/c/${DID}/${TEXT}/c%2Fd`);
		expect(route.layers[0]).toMatchObject({ channel: "c/d" });
		expect(pathAt(route, 1)).toBe(`/app/c/${DID}/${TEXT}/c%2Fd`);
	});
});
