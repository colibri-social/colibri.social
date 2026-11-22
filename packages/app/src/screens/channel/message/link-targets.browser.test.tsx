import { clientOrigin } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import {
	type LinkTargetContext,
	linkTargetFor,
	packLinkTarget,
} from "./link-targets";

const SPACE = "did:plc:space";
const OTHER = "did:plc:other";
const TEXT = "social.colibri.beta.channel.text";
const THREAD = "social.colibri.beta.channel.thread";
const CHANNEL_REF = `at://${SPACE}/space/${TEXT}/general`;
const THREAD_REF = `at://${SPACE}/space/${THREAD}/3kthread`;

const context: LinkTargetContext = {
	space: SPACE,
	threadChannel: (thread) => (thread === THREAD_REF ? CHANNEL_REF : undefined),
	pack: ({ rkey }) => (rkey === "3kowls" ? { name: "Owls" } : undefined),
};

describe("message links", () => {
	it("maps a channel message link to a message chip", () => {
		const href = `https://spaces.colibri.social/app/c/${SPACE}/${TEXT}/general/m/3kmsg`;
		expect(linkTargetFor(href, context)).toEqual({
			kind: "message",
			space: SPACE,
			channel: "general",
			rkey: "3kmsg",
			href,
		});
	});

	it("maps a thread message link to a message chip", () => {
		const href = `https://spaces.colibri.social/app/c/${SPACE}/${TEXT}/general/t/3kthread/m/3kmsg`;
		expect(linkTargetFor(href, context)).toEqual({
			kind: "message",
			space: SPACE,
			channel: "general",
			thread: "3kthread",
			rkey: "3kmsg",
			href,
		});
	});

	it("maps a message in another space to a foreign message chip", () => {
		const href = `https://spaces.colibri.social/app/c/${OTHER}/${TEXT}/general/m/3kmsg`;
		expect(linkTargetFor(href, context)).toEqual({
			kind: "message",
			space: OTHER,
			foreign: true,
			channel: "general",
			rkey: "3kmsg",
			href,
		});
	});

	it("maps a channel in another space to a foreign channel chip", () => {
		const href = `https://spaces.colibri.social/app/c/${OTHER}/${TEXT}/general`;
		expect(linkTargetFor(href, context)).toEqual({
			kind: "channel",
			channel: "general",
			space: OTHER,
		});
	});

	it("keeps the app link on a thread in another space", () => {
		const href = `https://spaces.colibri.social/app/c/${OTHER}/${TEXT}/general/t/3kthread`;
		expect(linkTargetFor(href, context)).toEqual({
			kind: "thread",
			channel: "general",
			thread: "3kthread",
			space: OTHER,
			href,
		});
	});

	it("maps a channel at uri to a channel chip", () => {
		expect(linkTargetFor(CHANNEL_REF, context)).toEqual({
			kind: "channel",
			channel: "general",
		});
	});

	it("maps a thread at uri to a thread chip with an app link", () => {
		expect(linkTargetFor(THREAD_REF, context)).toEqual({
			kind: "thread",
			channel: "general",
			thread: "3kthread",
			href: `${clientOrigin()}/app/c/${SPACE}/${TEXT}/general/t/3kthread`,
		});
	});

	it("maps a message at uri in a channel to a message chip", () => {
		const uri = `${CHANNEL_REF}/did:plc:lou/social.colibri.beta.message/3kmsg`;
		expect(linkTargetFor(uri, context)).toEqual({
			kind: "message",
			space: SPACE,
			channel: "general",
			rkey: "3kmsg",
			href: `${clientOrigin()}/app/c/${SPACE}/${TEXT}/general/m/3kmsg`,
		});
	});

	it("maps a message at uri in a thread to a message chip", () => {
		const uri = `${THREAD_REF}/did:plc:lou/social.colibri.beta.message/3kmsg`;
		expect(linkTargetFor(uri, context)).toEqual({
			kind: "message",
			space: SPACE,
			channel: "general",
			thread: "3kthread",
			rkey: "3kmsg",
			href: `${clientOrigin()}/app/c/${SPACE}/${TEXT}/general/t/3kthread/m/3kmsg`,
		});
	});

	it("maps a channel at uri in another space to a foreign channel chip", () => {
		const uri = `at://${OTHER}/space/${TEXT}/general`;
		expect(linkTargetFor(uri, context)).toEqual({
			kind: "channel",
			channel: "general",
			space: OTHER,
		});
	});
});

describe("other at uris", () => {
	it("opens a foreign record on pdsls", () => {
		const uri = "at://did:plc:abc/app.bsky.feed.post/3kpost";
		expect(linkTargetFor(uri, context)).toEqual({
			kind: "external",
			href: `https://pdsls.dev/${uri}`,
		});
	});

	it("opens a thread it can't place on pdsls", () => {
		const uri = `at://${SPACE}/space/${THREAD}/3kunknown`;
		expect(linkTargetFor(uri, context)).toEqual({
			kind: "external",
			href: `https://pdsls.dev/${uri}`,
		});
	});

	it("opens a message outside a space on pdsls", () => {
		const uri = "at://did:plc:lou/social.colibri.beta.message/3kmsg";
		expect(linkTargetFor(uri, context)).toEqual({
			kind: "external",
			href: `https://pdsls.dev/${uri}`,
		});
	});
});

describe("pack links", () => {
	const owls = {
		kind: "pack",
		did: "did:plc:lou",
		rkey: "3kowls",
		href: `${clientOrigin()}/app/emoji/did:plc:lou/3kowls`,
		name: "Owls",
	};

	it.each([
		"https://spaces.colibri.social/emoji/did:plc:lou/3kowls",
		"https://colibri.social/app/emoji/did:plc:lou/3kowls",
		"https://moji.blue/packs/did:plc:lou/3kowls",
		"at://did:plc:lou/blue.moji.packs.pack/3kowls",
	])("maps %s to a pack chip", (uri) => {
		expect(linkTargetFor(uri, context)).toEqual(owls);
	});

	it("leaves the name out while the pack loads", () => {
		expect(
			linkTargetFor("https://moji.blue/packs/did:plc:lou/3kother", context),
		).toEqual({
			kind: "pack",
			did: "did:plc:lou",
			rkey: "3kother",
			href: `${clientOrigin()}/app/emoji/did:plc:lou/3kother`,
		});
	});

	it("ignores other moji.blue pages and emoji item uris", () => {
		expect(packLinkTarget("https://moji.blue/packs/lou/3kowls")).toBe(
			undefined,
		);
		expect(
			packLinkTarget("at://did:plc:lou/blue.moji.collection.item/owl"),
		).toBe(undefined);
	});
});
