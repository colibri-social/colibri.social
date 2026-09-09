import { describe, expect, it } from "vitest";
import {
	type ForwardTargetChannel,
	type ForwardTargetOption,
	type ForwardTargetThread,
	forwardTargetLabel,
	forwardTargetName,
	forwardTargets,
	matchesForwardFilter,
} from "./forward-targets";
import { SPACE_TYPES } from "./lexicons";

const COMMUNITY = "did:plc:community000000000";

const LOUNGE = { did: COMMUNITY, name: "Astro Lounge" };

const channelSpaceOf = (skey: string) =>
	`at://${COMMUNITY}/space/${SPACE_TYPES.channelText}/${skey}`;

const threadSpaceOf = (skey: string) =>
	`at://${COMMUNITY}/space/${SPACE_TYPES.channelThread}/${skey}`;

const channel = (
	skey: string,
	name: string,
	overrides: Partial<ForwardTargetChannel> = {},
): ForwardTargetChannel => ({
	space: channelSpaceOf(skey),
	name,
	type: SPACE_TYPES.channelText,
	viewer: { canPost: true },
	...overrides,
});

const thread = (
	skey: string,
	name: string,
	channelSkey: string,
	canPost = true,
): ForwardTargetThread => ({
	space: threadSpaceOf(skey),
	channel: channelSpaceOf(channelSkey),
	name,
	viewer: { canPost },
});

const option = (
	overrides: Partial<ForwardTargetOption> = {},
): ForwardTargetOption => ({
	space: channelSpaceOf("general"),
	channelSpace: channelSpaceOf("general"),
	channelName: "general",
	community: LOUNGE,
	...overrides,
});

describe("forwardTargets", () => {
	it("keeps text channels the viewer can post in", () => {
		const options = forwardTargets({
			community: LOUNGE,
			channels: [
				channel("general", "general"),
				channel("locked", "locked", { viewer: { canPost: false } }),
				channel("lounge", "lounge", { type: SPACE_TYPES.channelVoice }),
			],
			threads: [],
		});

		expect(options.map((entry) => entry.channelName)).toEqual(["general"]);
	});

	it("tags every option with the community it belongs to", () => {
		const options = forwardTargets({
			community: LOUNGE,
			channels: [channel("general", "general")],
			threads: [thread("release", "Release plan", "general")],
		});

		expect(options.map((entry) => entry.community)).toEqual([LOUNGE, LOUNGE]);
	});

	it("lists a thread under its channel", () => {
		const options = forwardTargets({
			community: LOUNGE,
			channels: [channel("general", "general")],
			threads: [thread("release", "Release plan", "general")],
		});

		expect(options.map((entry) => entry.space)).toEqual([
			channelSpaceOf("general"),
			threadSpaceOf("release"),
		]);
		expect(options[1]?.thread).toBe("Release plan");
	});

	it("drops a thread the viewer cannot post in", () => {
		const options = forwardTargets({
			community: LOUNGE,
			channels: [channel("general", "general")],
			threads: [thread("quiet", "Quiet", "general", false)],
		});

		expect(options).toHaveLength(1);
	});

	it("drops a thread whose channel is not a target", () => {
		const options = forwardTargets({
			community: LOUNGE,
			channels: [channel("general", "general", { viewer: { canPost: false } })],
			threads: [thread("release", "Release plan", "general")],
		});

		expect(options).toEqual([]);
	});

	it("prefixes the category when one name sits in two categories", () => {
		const options = forwardTargets({
			community: LOUNGE,
			channels: [
				channel("dev-general", "general", { category: "dev" }),
				channel("ops-general", "general", { category: "ops" }),
				channel("random", "random", { category: "dev" }),
			],
			categories: [
				{ rkey: "dev", name: "Development" },
				{ rkey: "ops", name: "Operations" },
			],
			threads: [],
		});

		expect(options.map(forwardTargetName)).toEqual([
			"Development / general",
			"Operations / general",
			"random",
		]);
	});

	it("leaves the category off when both channels share it", () => {
		const options = forwardTargets({
			community: LOUNGE,
			channels: [
				channel("general", "general", { category: "dev" }),
				channel("general-2", "general", { category: "dev" }),
			],
			categories: [{ rkey: "dev", name: "Development" }],
			threads: [],
		});

		expect(options.map((entry) => entry.category)).toEqual([
			undefined,
			undefined,
		]);
	});
});

describe("matchesForwardFilter", () => {
	const target = option({
		space: threadSpaceOf("release"),
		category: "Development",
		thread: "Release plan",
	});

	it("matches an empty query", () => {
		expect(matchesForwardFilter(target, "  ")).toBe(true);
	});

	it("matches on the thread name, case insensitively", () => {
		expect(matchesForwardFilter(target, "RELEASE")).toBe(true);
	});

	it("matches on the category", () => {
		expect(matchesForwardFilter(target, "develop")).toBe(true);
	});

	it("matches on the community name", () => {
		expect(matchesForwardFilter(target, "astro")).toBe(true);
	});

	it("rejects an unrelated query", () => {
		expect(matchesForwardFilter(target, "billing")).toBe(false);
	});
});

describe("forwardTargetLabel", () => {
	it("names the community the target lives in", () => {
		expect(forwardTargetLabel(option({ thread: "Release plan" }))).toBe(
			"general / Release plan in Astro Lounge",
		);
	});

	it("uses the channel name on its own", () => {
		expect(forwardTargetLabel(option())).toBe("general in Astro Lounge");
	});
});
