import { describe, expect, it } from "vitest";
import type { MessageView, ProfileView } from "../../../data/types";
import { authorGroupKey, toChatMessage } from "./types";

const BRIDGE = "did:plc:matrixbridge";

const bridged = (remoteId: string): ProfileView => ({
	did: BRIDGE,
	handle: "matrix.bridge.colibri.social",
	displayName: remoteId,
	isBot: false,
	syncBluesky: false,
	bridge: { registration: "3lbridgereg22", platform: "matrix", remoteId },
});

const view = (
	rkey: string,
	author: ProfileView,
	createdAt: string,
): MessageView =>
	({
		uri: `at://${author.did}/social.colibri.beta.message/${rkey}`,
		rkey,
		author,
		text: rkey,
		createdAt,
		labels: [],
	}) as unknown as MessageView;

describe("authorGroupKey", () => {
	it("uses the DID for a Colibri account", () => {
		expect(authorGroupKey({ did: "did:plc:lou" })).toBe("did:plc:lou");
	});

	it("adds the registration and remote id for a bridged person", () => {
		expect(authorGroupKey(bridged("@max:matrix.org"))).toBe(
			`${BRIDGE} 3lbridgereg22 @max:matrix.org`,
		);
	});
});

describe("toChatMessage", () => {
	it("keeps the plain DID as author and gives each bridged person a group key", () => {
		const messages = [
			toChatMessage(
				view("a", bridged("@max:matrix.org"), "2026-10-18T09:00:00.000Z"),
			),
			toChatMessage(
				view("b", bridged("@june:matrix.org"), "2026-10-18T09:01:00.000Z"),
			),
			toChatMessage(
				view("c", bridged("@june:matrix.org"), "2026-10-18T09:02:00.000Z"),
			),
		];
		expect(messages.map((message) => message.author)).toEqual([
			BRIDGE,
			BRIDGE,
			BRIDGE,
		]);
		const [max, june, juneAgain] = messages.map((message) => message.groupKey);
		expect(max).not.toBe(june);
		expect(june).toBe(juneAgain);
	});
});
