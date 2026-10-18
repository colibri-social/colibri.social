import { afterEach, describe, expect, it, vi } from "vitest";
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
