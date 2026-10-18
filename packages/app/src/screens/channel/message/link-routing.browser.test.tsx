import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChannelView } from "../../../data/types";
import { listenForAppLinks } from "../../../native/deep-links";
import type { Route } from "../../../shell/layers";
import {
	type ChatContextValue,
	createChatRichTextResolvers,
} from "./chat-context";

const INVITE = "https://colibri.social/invite/abc123";

const resolversWith = (onExternalLink = vi.fn()) => ({
	onExternalLink,
	resolvers: createChatRichTextResolvers({
		onExternalLink,
	} as unknown as ChatContextValue),
});

const stopListening: (() => void)[] = [];

afterEach(() => {
	for (const stop of stopListening.splice(0)) stop();
});

describe("chat link routing", () => {
	it("renders app links as internal and leaves other links external", () => {
		const { resolvers } = resolversWith();
		expect(resolvers.linkTarget?.(INVITE)).toEqual({
			kind: "internal",
			href: INVITE,
		});
		expect(resolvers.linkTarget?.("social.colibri:/invite/abc123")).toEqual({
			kind: "internal",
			href: "social.colibri:/invite/abc123",
		});
		expect(resolvers.linkTarget?.("https://example.com/invite/abc")).toBe(
			undefined,
		);
		expect(resolvers.linkTarget?.("https://colibri.social/about")).toBe(
			undefined,
		);
	});

	it("opens an app link in place", () => {
		const routes: Route[] = [];
		stopListening.push(listenForAppLinks((route) => routes.push(route)));
		const { resolvers, onExternalLink } = resolversWith();
		const event = new MouseEvent("click", { cancelable: true });
		resolvers.onNavigate?.(INVITE, event);
		expect(event.defaultPrevented).toBe(true);
		expect(routes).toEqual([
			{ root: { tab: "spaces" }, layers: [{ kind: "join", code: "abc123" }] },
		]);
		expect(onExternalLink).not.toHaveBeenCalled();
	});
});

describe("thread links", () => {
	const HQ = "did:plc:colibrihqspace2a4b6c8d";
	const TEXT = "social.colibri.beta.channel.text";
	const threadLink = (space: string) =>
		`https://colibri.social/app/c/${space}/${TEXT}/dev/t/spring-tuning`;
	const channel = (slug: string, name: string, category?: string) =>
		({
			space: `at://${HQ}/space/${TEXT}/${slug}`,
			name,
			category,
			viewer: { canRead: true },
		}) as unknown as ChannelView;
	const resolvers = createChatRichTextResolvers({
		community: () => ({ did: HQ }),
		channels: () =>
			new Map([
				["dev", channel("dev", "dev", "build")],
				["general", channel("general", "general", "build")],
				["general-2", channel("general-2", "general", "social")],
			]),
		categoryName: (rkey: string) =>
			rkey === "build" ? "Build" : rkey === "social" ? "Social" : undefined,
		threadNameIn: (parent: string, thread: string) =>
			parent === "dev" && thread === "spring-tuning"
				? "Spring tuning"
				: undefined,
	} as unknown as ChatContextValue);

	it("turns a thread link in this Space into a thread chip", () => {
		expect(resolvers.linkTarget?.(threadLink(HQ))).toEqual({
			kind: "thread",
			channel: "dev",
			thread: "spring-tuning",
		});
		expect(resolvers.linkTarget?.(`${threadLink(HQ)}/full`)).toEqual({
			kind: "thread",
			channel: "dev",
			thread: "spring-tuning",
		});
		expect(resolvers.threadName?.("dev", "spring-tuning")).toBe(
			"Spring tuning",
		);
	});

	it("keeps a thread link to another Space as an app link", () => {
		const other = threadLink("did:plc:elsewhere");
		expect(resolvers.linkTarget?.(other)).toEqual({
			kind: "internal",
			href: other,
		});
	});

	it("names the category only when channel names repeat", () => {
		expect(resolvers.channel?.("dev")).toMatchObject({
			name: "dev",
			category: undefined,
		});
		expect(resolvers.channel?.("general")).toMatchObject({
			name: "general",
			category: "Build",
		});
		expect(resolvers.channel?.("general-2")).toMatchObject({
			name: "general",
			category: "Social",
		});
	});
});
