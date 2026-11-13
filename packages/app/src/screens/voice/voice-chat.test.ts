import { describe, expect, it } from "vitest";
import type { ChannelView } from "../../data/types";
import { canSeeVoiceChat } from "./voice-chat";

const channel = (
	permissions?: string[],
	type = "social.colibri.beta.channel.voice",
): ChannelView => ({
	space: "at://did:plc:space/space/social.colibri.beta.channel.voice/lounge",
	type,
	name: "Lounge",
	viewer: {
		canRead: true,
		canPost: true,
		...(permissions ? { permissions } : {}),
	},
});

const access = (overrides: Partial<Parameters<typeof canSeeVoiceChat>[0]>) =>
	canSeeVoiceChat({
		channel: channel(["voice.chat"]),
		isOwner: false,
		guest: false,
		callPermissions: undefined,
		...overrides,
	});

describe("canSeeVoiceChat", () => {
	it("shows the chat when the channel grants voice.chat", () => {
		expect(access({})).toBe(true);
	});

	it("shows the chat when the channel names no permissions", () => {
		expect(access({ channel: channel() })).toBe(true);
	});

	it("hides the chat when the channel leaves voice.chat out", () => {
		expect(access({ channel: channel(["voice.speak"]) })).toBe(false);
		expect(access({ channel: channel(["voice.speak"]), isOwner: true })).toBe(
			true,
		);
	});

	it("hides the chat when the call drops voice.chat", () => {
		expect(access({ callPermissions: new Set(["voice.speak"]) })).toBe(false);
		expect(
			access({ callPermissions: new Set(["voice.speak"]), isOwner: true }),
		).toBe(false);
	});

	it("always hides the chat of a channel the viewer was moved into", () => {
		expect(access({ guest: true, isOwner: true })).toBe(false);
	});

	it("leaves text channels alone", () => {
		expect(
			access({
				channel: channel([], "social.colibri.beta.channel.text"),
				guest: true,
			}),
		).toBe(true);
	});
});
