import { describe, expect, it } from "vitest";
import {
	createRenderedMessages,
	type NotificationAlertContext,
	RENDERED_MESSAGE_LIMIT,
	RENDERED_MESSAGE_TTL_MS,
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
	preferencesLoaded: true,
	viewing: undefined,
	visible: true,
	doNotDisturb: false,
	spaceMuted: false,
	spaceLevel: "all",
	channelMuted: false,
	threadMuted: false,
	authorBlocked: false,
	renderedOnScreen: false,
	voiceChannel: undefined,
	now: NOW,
	...overrides,
});

const VOICE = "at://did:plc:hq/space/social.colibri.beta.channel.voice/lounge";

describe("shouldAlertNotification", () => {
	it("stays quiet until preferences have loaded", () => {
		expect(
			shouldAlertNotification(
				view({ kind: "mention" }),
				context({ preferencesLoaded: false }),
			),
		).toBe(false);
	});

	it("stays quiet for a voice channel message while the viewer isn't in that call", () => {
		expect(shouldAlertNotification(view({ channel: VOICE }), context())).toBe(
			false,
		);
		expect(
			shouldAlertNotification(
				view({ channel: VOICE, kind: "mention" }),
				context({
					voiceChannel:
						"at://did:plc:hq/space/social.colibri.beta.channel.voice/standup",
				}),
			),
		).toBe(false);
	});

	it("alerts for a voice channel message while the viewer is in that call", () => {
		expect(
			shouldAlertNotification(
				view({ channel: VOICE }),
				context({ voiceChannel: VOICE }),
			),
		).toBe(true);
	});

	it("keeps alerting for text channels while the viewer is in a call", () => {
		expect(
			shouldAlertNotification(view(), context({ voiceChannel: VOICE })),
		).toBe(true);
	});

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

	it("stays quiet for every kind of notification from a blocked author", () => {
		const blocked = context({ authorBlocked: true });

		expect(shouldAlertNotification(view(), blocked)).toBe(false);
		expect(shouldAlertNotification(view({ kind: "mention" }), blocked)).toBe(
			false,
		);
		expect(shouldAlertNotification(view({ kind: "reply" }), blocked)).toBe(
			false,
		);
		expect(
			shouldAlertNotification(view({ kind: "mention" }), {
				...blocked,
				visible: false,
			}),
		).toBe(false);
	});
});

describe("rendered messages", () => {
	it("stays quiet for a message already rendered on screen", () => {
		expect(
			shouldAlertNotification(
				view({ kind: "mention" }),
				context({ visible: false, renderedOnScreen: true }),
			),
		).toBe(false);
	});

	it("remembers a rendered message per conversation", () => {
		const rendered = createRenderedMessages(() => NOW);

		rendered.record(CHANNEL, "m1");

		expect(rendered.has(CHANNEL, "m1")).toBe(true);
		expect(rendered.has(THREAD, "m1")).toBe(false);
		expect(rendered.has(CHANNEL, "m2")).toBe(false);
	});

	it("forgets a rendered message once its time is up", () => {
		let now = NOW;
		const rendered = createRenderedMessages(() => now);

		rendered.record(CHANNEL, "m1");
		now += RENDERED_MESSAGE_TTL_MS - 1;
		rendered.record(CHANNEL, "m2");

		expect(rendered.has(CHANNEL, "m1")).toBe(true);

		now += 1;

		expect(rendered.has(CHANNEL, "m1")).toBe(false);
		expect(rendered.has(CHANNEL, "m2")).toBe(true);
	});

	it("drops the oldest entries past the limit", () => {
		const rendered = createRenderedMessages(() => NOW);

		for (let index = 0; index <= RENDERED_MESSAGE_LIMIT; index += 1) {
			rendered.record(CHANNEL, `m${index}`);
		}

		expect(rendered.has(CHANNEL, "m0")).toBe(false);
		expect(rendered.has(CHANNEL, "m1")).toBe(true);
		expect(rendered.has(CHANNEL, `m${RENDERED_MESSAGE_LIMIT}`)).toBe(true);
	});
});
