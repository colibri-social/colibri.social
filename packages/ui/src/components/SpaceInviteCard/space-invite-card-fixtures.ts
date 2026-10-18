import { storyImages } from "../Banner/story-images";
import type { SpaceInviteCardSpace } from "./space-invite-card-model";

export const inviteUrlFixture = (code: string) =>
	`https://colibri.social/invite/${code}`;

export const inviteSpaceFixture = (
	overrides: Partial<SpaceInviteCardSpace> = {},
): SpaceInviteCardSpace => ({
	id: "did:plc:flock",
	name: "Colibri Social Flock",
	handle: "flock.colibri.social",
	iconSrc: storyImages.violetIcon(),
	bannerSrc: storyImages.sunsetBanner(),
	description:
		"A cozy corner for people who build things on the AT Protocol. Share projects, ask questions, and hang out in voice on Fridays.",
	memberCount: 1204,
	onlineCount: 32,
	joinMode: "open",
	viewer: "none",
	...overrides,
});

export const LONG_SPACE_NAME =
	"The International Society of Extremely Late Night Pixel Artists and Friends";

export const LONG_SPACE_DESCRIPTION =
	"Weekly prompts, palette swaps, critique threads, voice co-working on Sundays, a library of tutorials, a channel for every tool you can think of, and a very long welcome message that keeps going well past the point where anyone would still be reading it on a phone.";
