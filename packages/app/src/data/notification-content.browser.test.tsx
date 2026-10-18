import { describe, expect, it } from "vitest";
import { describeNotification } from "./notification-content";
import type { NotificationView } from "./types";

const COMMUNITY = "did:plc:communityxxxxxxxxxxxxxxxxxxx";
const CHANNEL = `at://${COMMUNITY}/social.colibri.beta.channel.text/3lkchannelaaaa`;

const dataWithNickname = (nickname: string) =>
	({
		spaceByKey: () => ({ name: "Protocol Nerds" }),
		space: () => ({
			channelBySlug: () => ({ name: "general" }),
			memberByDid: () => ({ nickname }),
		}),
		threadsOf: () => ({ value: () => [] }),
	}) as unknown as Parameters<typeof describeNotification>[0];

const view = (author: Partial<NotificationView["author"]>) =>
	({
		id: "1",
		kind: "mention",
		author: {
			did: COMMUNITY,
			handle: "community.test",
			displayName: "Remote Ruth",
			isBot: false,
			syncBluesky: false,
			...author,
		},
		channel: CHANNEL,
		community: COMMUNITY,
		indexedAt: "2026-10-18T00:00:00.000Z",
	}) as unknown as NotificationView;

describe("describeNotification", () => {
	it("uses the bridged author's name over the community's nickname", () => {
		const content = describeNotification(
			dataWithNickname("Community bot"),
			view({
				bridge: {
					registration: "3lkbridgeaaaa",
					platform: "chat",
					remoteId: "ruth-1",
				},
			}),
		);
		expect(content.authorName).toBe("Remote Ruth");
	});

	it("keeps a member's nickname for a regular author", () => {
		const content = describeNotification(
			dataWithNickname("Ruthie"),
			view({ displayName: "Ruth" }),
		);
		expect(content.authorName).toBe("Ruthie");
	});
});
