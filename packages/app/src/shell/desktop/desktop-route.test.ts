import { describe, expect, it } from "vitest";
import { type Layer, layerPath } from "../layers";
import {
	desktopRoute,
	parseDesktopPath,
	routeLayers,
	visibleLayers,
} from "./desktop-route";

const SPACE = "did:plc:hq";
const OTHER = "did:plc:owls";
const target = { space: SPACE, channel: "general" };

const route = (layers: Layer[]) => desktopRoute({ tab: "spaces" }, layers);

describe("desktop route", () => {
	it("opens the inbox modal over the open channel and from its own path", () => {
		const over = route([{ kind: "chat", ...target }, { kind: "inbox" }]);
		expect(over.chat).toMatchObject({ channel: "general" });
		expect(over.modal).toEqual([{ kind: "inbox" }]);
		expect(layerPath({ kind: "inbox" })).toBe("/app/inbox");
		const parsed = parseDesktopPath("/app/inbox");
		expect(desktopRoute(parsed.root, parsed.layers).modal).toEqual([
			{ kind: "inbox" },
		]);
		const closed = route([
			{ kind: "chat", ...target },
			{ kind: "inbox" },
			{ kind: "chat", space: OTHER, channel: "art" },
		]);
		expect(closed.modal).toEqual([]);
	});

	it("keeps one chat and replaces it when another channel opens", () => {
		const result = route([
			{ kind: "chat", ...target },
			{ kind: "thread", ...target, thread: "t1" },
			{ kind: "chat", space: OTHER, channel: "art" },
		]);
		expect(result.chat).toEqual({ kind: "chat", space: OTHER, channel: "art" });
		expect(result.pane).toBeUndefined();
		expect(result.root.space).toBe(OTHER);
	});

	it("keeps the thread pane when the same chat is pushed again", () => {
		const result = route([
			{ kind: "chat", ...target },
			{ kind: "thread", ...target, thread: "t1" },
			{ kind: "chat", ...target },
		]);
		expect(result.pane).toMatchObject({ kind: "thread", thread: "t1" });
	});

	it("closes a full thread when its channel is pushed again", () => {
		const result = route([
			{ kind: "chat", ...target },
			{ kind: "thread", ...target, thread: "t1", presentation: "full" },
			{ kind: "chat", ...target },
		]);
		expect(result.pane).toBeUndefined();
		expect(result.chat).toEqual({ kind: "chat", ...target });
	});

	it("replaces one thread pane with the next", () => {
		const result = route([
			{ kind: "chat", ...target },
			{ kind: "thread", ...target, thread: "t1" },
			{ kind: "threadDraft", ...target },
		]);
		expect(result.pane).toEqual({ kind: "threadDraft", ...target });
		expect(routeLayers(result)).toHaveLength(2);
	});

	it("closes the threads overlay when a thread opens from it", () => {
		const result = route([
			{ kind: "chat", ...target },
			{ kind: "threads", ...target },
			{ kind: "thread", ...target, thread: "t1", via: "threads" },
		]);
		expect(result.overlay).toBeUndefined();
		expect(result.pane).toEqual({ kind: "thread", ...target, thread: "t1" });
	});

	it("opens a chat for a deep-linked thread", () => {
		const result = route([{ kind: "thread", ...target, thread: "t1" }]);
		expect(result.chat).toEqual({ kind: "chat", ...target });
	});

	it("turns the members layer into an open sidebar", () => {
		const result = route([
			{ kind: "chat", ...target },
			{ kind: "members", ...target },
		]);
		expect(result.membersOpen).toBe(true);
		expect(routeLayers(result)).toEqual([{ kind: "chat", ...target }]);
	});

	it("stacks modal pages above the channel and drops them on navigation", () => {
		const open = route([
			{ kind: "chat", ...target },
			{ kind: "admin", space: SPACE, page: "overview" },
			{ kind: "admin", space: SPACE, page: "roles" },
		]);
		expect(open.modal).toHaveLength(2);
		expect(visibleLayers(open)).toEqual([
			{ kind: "chat", ...target },
			{ kind: "admin", space: SPACE, page: "roles" },
		]);
		const closed = route([
			...routeLayers(open),
			{ kind: "chat", space: OTHER, channel: "art" },
		]);
		expect(closed.modal).toEqual([]);
	});

	it("maps edit profile and the settings tabs to the settings modal", () => {
		expect(route([{ kind: "editProfile" }]).modal).toEqual([
			{ kind: "settings", page: "profile" },
		]);
		expect(desktopRoute({ tab: "settings" }, []).modal).toEqual([
			{ kind: "settings" },
		]);
		expect(desktopRoute({ tab: "profile" }, []).modal).toEqual([
			{ kind: "settings", page: "profile" },
		]);
	});

	it("parses settings pages", () => {
		expect(parseDesktopPath("/app/settings/appearance").layers).toEqual([
			{ kind: "settings", page: "appearance" },
		]);
		expect(parseDesktopPath("/app/settings").root.tab).toBe("settings");
	});

	it("keeps chat and pane visible under the top modal page", () => {
		const base = route([
			{ kind: "chat", ...target },
			{ kind: "thread", ...target, thread: "t1" },
		]);
		expect(visibleLayers(base).map((layer) => layer.kind)).toEqual([
			"chat",
			"thread",
		]);
	});
});

describe("full thread presentation", () => {
	it("hides the channel behind a full thread and shows it beside a split one", () => {
		const full = route([
			{ kind: "chat", ...target },
			{ kind: "thread", ...target, thread: "t1", presentation: "full" },
		]);
		expect(visibleLayers(full).map((layer) => layer.kind)).toEqual(["thread"]);
		const split = route([
			{ kind: "chat", ...target },
			{ kind: "thread", ...target, thread: "t1" },
		]);
		expect(visibleLayers(split).map((layer) => layer.kind)).toEqual([
			"chat",
			"thread",
		]);
	});

	it("round-trips the full segment and keeps it in the route", () => {
		const path = `/app/c/${SPACE}/social.colibri.beta.channel.text/general/t/t1/full`;
		const parsed = parseDesktopPath(path);
		expect(parsed.layers.at(-1)).toMatchObject({
			kind: "thread",
			thread: "t1",
			presentation: "full",
		});
		const result = desktopRoute(parsed.root, parsed.layers);
		expect(result.pane).toMatchObject({ presentation: "full" });
		expect(
			parseDesktopPath(path.replace("/full", "")).layers.at(-1),
		).not.toHaveProperty("presentation");
	});
});
