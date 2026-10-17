import { describe, expect, it } from "vitest";
import {
	type NotificationAlertContext,
	STALE_ALERT_MS,
	shouldAlertNotification,
} from "./notification-alerts";
import type { NotificationView } from "./types";

const NOW = Date.parse("2026-10-15T12:00:00.000Z");
const CHANNEL =
	"at://did:plc:hq/space/social.colibri.beta.channel.text/general";
const THREAD = "at://did:plc:hq/space/social.colibri.beta.channel.thread/plans";

const view = (overrides: Record<string, unknown> = {}): NotificationView =>
	({
		id: "n1",
		kind: "message",
		author: { did: "did:plc:ada", handle: "ada.test" },
		channel: CHANNEL,
		community: "did:plc:hq",
		indexedAt: new Date(NOW - 500).toISOString(),
		...overrides,
	}) as unknown as NotificationView;

const context = (
	overrides: Partial<NotificationAlertContext> = {},
): NotificationAlertContext => ({
	viewer: "did:plc:me",
	viewing: undefined,
	visible: true,
	doNotDisturb: false,
	spaceMuted: false,
	spaceLevel: "all",
	channelMuted: false,
	threadMuted: false,
	now: NOW,
	...overrides,
});

describe("shouldAlertNotification", () => {
	it("alerts for a fresh message with the default level", () => {
		expect(shouldAlertNotification(view(), context())).toBe(true);
	});

	it("alerts while the app is hidden", () => {
		expect(shouldAlertNotification(view(), context({ visible: false }))).toBe(
			true,
		);
	});

	it("alerts for the channel on screen while the app is hidden", () => {
		expect(
			shouldAlertNotification(
				view(),
				context({ visible: false, viewing: CHANNEL }),
			),
		).toBe(true);
	});

	it("stays quiet in do not disturb", () => {
		expect(
			shouldAlertNotification(
				view({ kind: "mention" }),
				context({ doNotDisturb: true }),
			),
		).toBe(false);
	});

	it("skips the viewer's own messages", () => {
		expect(
			shouldAlertNotification(
				view({
					kind: "reply",
					author: { did: "did:plc:me", handle: "me.test" },
				}),
				context(),
			),
		).toBe(false);
	});

	it("skips the channel on screen", () => {
		expect(shouldAlertNotification(view(), context({ viewing: CHANNEL }))).toBe(
			false,
		);
	});

	it("skips the thread on screen but alerts for its parent channel", () => {
		const threaded = view({ thread: THREAD });
		expect(
			shouldAlertNotification(threaded, context({ viewing: THREAD })),
		).toBe(false);
		expect(
			shouldAlertNotification(threaded, context({ viewing: CHANNEL })),
		).toBe(true);
		expect(shouldAlertNotification(view(), context({ viewing: THREAD }))).toBe(
			true,
		);
	});

	it("skips notifications that are already seen", () => {
		expect(
			shouldAlertNotification(
				view({ seenAt: new Date(NOW).toISOString() }),
				context(),
			),
		).toBe(false);
	});

	it("skips stale events replayed after a reconnect", () => {
		const old = view({
			indexedAt: new Date(NOW - STALE_ALERT_MS - 1).toISOString(),
		});
		expect(shouldAlertNotification(old, context())).toBe(false);
	});

	it("skips everything from a muted Space", () => {
		expect(
			shouldAlertNotification(
				view({ kind: "mention" }),
				context({ spaceMuted: true }),
			),
		).toBe(false);
	});

	it("skips everything when the Space level is nothing", () => {
		expect(
			shouldAlertNotification(
				view({ kind: "reply" }),
				context({ spaceLevel: "nothing" }),
			),
		).toBe(false);
	});

	it("keeps only mentions and replies on the mentions level", () => {
		const level = context({ spaceLevel: "mentionsAndReplies" });
		expect(shouldAlertNotification(view(), level)).toBe(false);
		expect(shouldAlertNotification(view({ kind: "mention" }), level)).toBe(
			true,
		);
		expect(shouldAlertNotification(view({ kind: "reply" }), level)).toBe(true);
	});

	it("lets mentions and replies through a muted channel", () => {
		const muted = context({ channelMuted: true });
		expect(shouldAlertNotification(view(), muted)).toBe(false);
		expect(shouldAlertNotification(view({ kind: "mention" }), muted)).toBe(
			true,
		);
	});

	it("lets mentions and replies through a muted thread", () => {
		const muted = context({ threadMuted: true });
		const threaded = view({ thread: THREAD });
		expect(shouldAlertNotification(threaded, muted)).toBe(false);
		expect(shouldAlertNotification({ ...threaded, kind: "reply" }, muted)).toBe(
			true,
		);
	});
});
