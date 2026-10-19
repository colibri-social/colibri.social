import { afterEach, expect, it, vi } from "vitest";
import type { ChannelView } from "../../data/types";
import type { Navigator } from "../../shell/stack";
import { closeVoicePrompt, voicePrompt } from "../voice/voice-prompt";
import { openLinkedChannel } from "./channel-link";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const VOICE = "social.colibri.beta.channel.voice";
const TEXT = "social.colibri.beta.channel.text";

const channelOf = (type: string, skey: string) =>
	({
		space: `at://${HQ}/space/${type}/${skey}`,
		type,
		name: skey,
		viewer: { canRead: true },
	}) as unknown as ChannelView;

const fakeStack = () => {
	const push = vi.fn();
	const replaceTop = vi.fn();
	return {
		stack: { push, replaceTop } as unknown as Navigator,
		push,
		replaceTop,
	};
};

afterEach(() => closeVoicePrompt());

it("opens a linked text channel in place with its type", () => {
	const { stack, replaceTop } = fakeStack();
	openLinkedChannel({
		space: HQ,
		skey: "dev",
		channel: channelOf(TEXT, "dev"),
		stack,
		desktop: true,
		confirmJoin: true,
	});
	expect(replaceTop).toHaveBeenCalledWith({
		kind: "chat",
		space: HQ,
		channel: "dev",
		channelType: TEXT,
	});
});

it("opens a linked voice channel the way the desktop sidebar does", () => {
	const { stack, push, replaceTop } = fakeStack();
	openLinkedChannel({
		space: HQ,
		skey: "lounge",
		channel: channelOf(VOICE, "lounge"),
		stack,
		desktop: true,
		confirmJoin: true,
	});
	expect(replaceTop).not.toHaveBeenCalled();
	expect(push).toHaveBeenCalledWith({
		kind: "chat",
		channelType: VOICE,
		space: HQ,
		channel: "lounge",
	});
});

it("asks before joining a linked voice channel on mobile", () => {
	const { stack, push, replaceTop } = fakeStack();
	const channel = channelOf(VOICE, "lounge");
	openLinkedChannel({
		space: HQ,
		skey: "lounge",
		channel,
		stack,
		desktop: false,
		confirmJoin: true,
	});
	expect(push).not.toHaveBeenCalled();
	expect(replaceTop).not.toHaveBeenCalled();
	expect(voicePrompt()).toEqual({ space: HQ, channel: channel.space });
});
