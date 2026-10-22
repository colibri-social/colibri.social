import type {
	ChannelView,
	CommunityView,
	Did,
	MemberView,
	RoleView,
} from "../types";
import { avatarUrl, bannerUrl } from "./media";
import { VIEWER_KEY } from "./people";
import { asDatetime, asDid, asHandle, spaceRef, tidFor } from "./refs";
import { createRandom } from "./seed";
import type { SpaceSeed } from "./spaces";
import type { ChannelRecord, SpaceRecord, World } from "./world";
import { MANAGING_APP } from "./world";

const DAY = 24 * 60 * 60_000;

export const OWNER_PERMISSIONS = [
	"community.manage",
	"community.delete",
	"category.create",
	"category.update",
	"category.delete",
	"channel.create",
	"channel.update",
	"channel.delete",
	"label.apply",
	"member.kick",
	"member.ban",
	"member.unban",
	"role.manage",
	"invitation.create",
	"invitation.delete",
	"moderation.viewLog",
	"approval.manage",
	"voice.moderate",
	"mention.roles",
	"thread.create",
	"thread.manage",
	"thread.move",
];

const MEMBER_PERMISSIONS = ["thread.create", "invitation.create"];

export type StarterLayout = {
	text: string;
	voice: string;
	textCategory: string;
	voiceCategory: string;
};

export const STARTER_LAYOUT: StarterLayout = {
	text: "general",
	voice: "General",
	textCategory: "Text channels",
	voiceCategory: "Voice channels",
};

export type DiscoverableSeed = {
	key: string;
	did: string;
	handle: string;
	name: string;
	description: string;
	picture: string;
	banner?: string;
	memberCount: number;
	requiresApproval: boolean;
	ownerKey: string;
	channels: string[];
};

export const DISCOVERABLE: DiscoverableSeed[] = [
	{
		key: "flock",
		did: "did:plc:colibriflock7k2m4n6p8q",
		handle: "flock.colibri.social",
		name: "Colibri Social Flock",
		description:
			"A cozy corner for people who build things on the AT Protocol. Share projects, ask questions, and hang out in voice on Fridays.",
		picture: "flock-icon",
		banner: "flock-banner",
		memberCount: 180,
		requiresApproval: false,
		ownerKey: "mira",
		channels: ["general", "projects", "help"],
	},
	{
		key: "synth",
		did: "did:plc:synthclub3b5d7f9h2j4k",
		handle: "synth.club",
		name: "Modular Synth Club",
		description:
			"Patch notes, rack tours and the occasional bleep. Bring your weirdest sounds and your favourite module.",
		picture: "synth-club-icon",
		banner: "synth-club-banner",
		memberCount: 1_240,
		requiresApproval: false,
		ownerKey: "jonas",
		channels: ["general", "patches", "gear-talk", "show-and-tell"],
	},
	{
		key: "bookworms",
		did: "did:plc:bookwormsread6m8n2p4q",
		handle: "bookworms.read",
		name: "Bookworms",
		description: "One book a month, spoiler channels for every chapter.",
		picture: "bookworms-icon",
		memberCount: 412,
		requiresApproval: true,
		ownerKey: "lena",
		channels: ["general", "this-month", "spoilers"],
	},
	{
		key: "gardeners",
		did: "did:plc:balconygarden8w2y4a6c",
		handle: "balcony.garden",
		name: "Balcony Gardeners of the Very Long Named Neighbourhood Association",
		description:
			"Tomatoes on the fifth floor, herbs on the windowsill, and a lot of questions about drainage.",
		picture: "balcony-icon",
		banner: "balcony-banner",
		memberCount: 9_870,
		requiresApproval: false,
		ownerKey: "rosa",
		channels: ["general", "harvest", "pests"],
	},
];

export const randomDid = (salt: number) => {
	const random = createRandom(salt);
	const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
	let out = "";
	for (let index = 0; index < 24; index++) {
		out += alphabet[random.int(0, alphabet.length - 1)];
	}
	return asDid(`did:plc:${out}`);
};

const emptySeed = (input: {
	key: string;
	did: string;
	handle: string;
	name: string;
	description: string;
	owner: string;
	requiresApproval: boolean;
}): SpaceSeed => ({
	key: input.key,
	did: input.did,
	handle: input.handle,
	name: input.name,
	description: input.description,
	picture: "",
	banner: "",
	requiresApproval: input.requiresApproval,
	overrideUserNameColors: false,
	owner: input.owner,
	members: [VIEWER_KEY],
	roles: [],
	memberRoles: {},
	categories: [],
	channels: [],
	createdDaysAgo: 0,
});

const channelRecord = (spaceKey: string, view: ChannelView): ChannelRecord => ({
	view,
	spaceKey,
	messages: [],
	build: () => [],
});

const channelView = (
	did: Did,
	kind: "text" | "voice",
	skey: string,
	name: string,
	category: string,
	permissions: string[],
): ChannelView => ({
	space: spaceRef(did, kind, skey),
	type:
		kind === "voice"
			? "social.colibri.beta.channel.voice"
			: "social.colibri.beta.channel.text",
	name,
	category,
	viewer: { canRead: true, canPost: true, permissions },
});

export const createCommunityRecord = (
	world: World,
	input: {
		name: string;
		description?: string;
		requiresApprovalToJoin?: boolean;
		did?: Did;
	},
	now: number,
): SpaceRecord => {
	const clock = world.nextClock();
	const did = input.did ?? randomDid(now + clock);
	const key = `created-${clock}`;
	const textCategory = tidFor(now, world.nextClock());
	const voiceCategory = tidFor(now, world.nextClock());
	const owner: RoleView = {
		rkey: "owner",
		name: "Owner",
		permissions: OWNER_PERMISSIONS,
		position: 1,
		memberCount: 1,
		protected: true,
	};
	const member: MemberView = {
		actor: world.people.profile(VIEWER_KEY),
		roles: ["owner"],
		joinedAt: asDatetime(now),
	};
	const view: CommunityView = {
		did,
		handle: asHandle(`${did.slice(-10)}.colibri.social`),
		managingApp: MANAGING_APP,
		name: input.name,
		requiresApprovalToJoin: input.requiresApprovalToJoin ?? false,
		linkEmbeds: true,
		overrideUserNameColors: false,
		memberCount: 1,
		viewer: {
			isMember: true,
			isOwner: true,
			roles: ["owner"],
			permissions: OWNER_PERMISSIONS,
		},
	};
	if (input.description) view.description = input.description;
	return {
		seed: emptySeed({
			key,
			did,
			handle: view.handle,
			name: input.name,
			description: input.description ?? "",
			owner: VIEWER_KEY,
			requiresApproval: view.requiresApprovalToJoin ?? false,
		}),
		did,
		view,
		roles: [owner],
		categories: [
			{ rkey: textCategory, name: STARTER_LAYOUT.textCategory },
			{ rkey: voiceCategory, name: STARTER_LAYOUT.voiceCategory },
		],
		channels: [
			channelRecord(
				key,
				channelView(
					did,
					"text",
					tidFor(now, world.nextClock()),
					STARTER_LAYOUT.text,
					textCategory,
					OWNER_PERMISSIONS,
				),
			),
			channelRecord(
				key,
				channelView(
					did,
					"voice",
					tidFor(now, world.nextClock()),
					STARTER_LAYOUT.voice,
					voiceCategory,
					OWNER_PERMISSIONS,
				),
			),
		],
		members: [member],
		threads: [],
	};
};

export const discoverableView = (
	seed: DiscoverableSeed,
	viewer: CommunityView["viewer"],
): CommunityView => {
	const view: CommunityView = {
		did: asDid(seed.did),
		handle: asHandle(seed.handle),
		managingApp: MANAGING_APP,
		name: seed.name,
		description: seed.description,
		picture: avatarUrl(seed.picture),
		requiresApprovalToJoin: seed.requiresApproval,
		linkEmbeds: true,
		overrideUserNameColors: false,
		memberCount: seed.memberCount,
		viewer,
	};
	if (seed.banner) view.banner = bannerUrl(seed.banner);
	return view;
};

export const discoverableRecord = (
	world: World,
	seed: DiscoverableSeed,
	now: number,
): SpaceRecord => {
	const did = asDid(seed.did);
	const category = tidFor(now - DAY, world.nextClock());
	const random = createRandom(seed.did.length * 131);
	const others = world.people.all
		.slice(1, 60)
		.filter((person) => person.key !== VIEWER_KEY && random.chance(0.4))
		.map((person) => person.key);
	const memberKeys = [
		seed.ownerKey,
		...others.filter((key) => key !== seed.ownerKey),
	];
	const roles: RoleView[] = [
		{
			rkey: "owner",
			name: "Owner",
			permissions: OWNER_PERMISSIONS,
			position: 1,
			memberCount: 1,
			protected: true,
		},
	];
	const members: MemberView[] = memberKeys.map((key) => ({
		actor: world.people.profile(key),
		roles: key === seed.ownerKey ? ["owner"] : [],
		joinedAt: asDatetime(now - random.int(2, 300) * DAY),
	}));
	const view = discoverableView(seed, {
		isMember: false,
		isOwner: false,
		roles: [],
		permissions: MEMBER_PERMISSIONS,
	});
	return {
		seed: {
			...emptySeed({
				key: seed.key,
				did: seed.did,
				handle: seed.handle,
				name: seed.name,
				description: seed.description,
				owner: seed.ownerKey,
				requiresApproval: seed.requiresApproval,
			}),
			members: memberKeys,
		},
		did,
		view,
		roles,
		categories: [{ rkey: category, name: STARTER_LAYOUT.textCategory }],
		channels: seed.channels.map((name) =>
			channelRecord(
				seed.key,
				channelView(did, "text", name, name, category, MEMBER_PERMISSIONS),
			),
		),
		members,
		threads: [],
	};
};
