import { NAMED_PEOPLE, VIEWER_KEY } from "./people";

export type ChannelSeed = {
	skey: string;
	name: string;
	kind: "text" | "voice";
	description?: string;
	category?: string;
	private?: boolean;
};

export type RoleSeed = {
	rkey: string;
	name: string;
	color?: string;
	hoisted?: boolean;
	mentionable?: boolean;
	protected?: boolean;
	icon?: { icon: string; color?: string };
	image?: string;
	permissions: string[];
};

export type CategorySeed = { rkey: string; name: string };

export type SpaceSeed = {
	key: string;
	did: string;
	handle: string;
	name: string;
	description: string;
	picture: string;
	banner: string;
	requiresApproval: boolean;
	overrideUserNameColors: boolean;
	hideOwnerBadge?: boolean;
	owner: string;
	members: string[];
	roles: RoleSeed[];
	memberRoles: Record<string, string[]>;
	categories: CategorySeed[];
	channels: ChannelSeed[];
	createdDaysAgo: number;
};

const ALL_PERMISSIONS = [
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

const MOD_PERMISSIONS = [
	"label.apply",
	"member.kick",
	"member.ban",
	"member.unban",
	"moderation.viewLog",
	"approval.manage",
	"voice.moderate",
	"thread.manage",
	"thread.move",
	"invitation.create",
];

const named = (keys: string) => keys.split(" ");
const gen = (from: number, to: number) =>
	Array.from({ length: to - from }, (_, index) => `gen${from + index}`);

const namedKeys = NAMED_PEOPLE.map((person) => person.key);

const hqMembers = [
	...named(
		"lou mira tomas kris ana jun noor eli priya felix lena dev ivy maya zoe ravi will jonas lucy petra yusuf ben theo sofia birdbot relay hana rosa nina kai",
	),
	...gen(0, 30),
];

const owlsNamed = namedKeys.filter(
	(key) => !["trailbot", "maxb", "juneb", "relay"].includes(key),
);
const owlsMembers = [...owlsNamed, ...gen(0, 500 - owlsNamed.length)];

const trailMembers = [
	...named(
		"omar lou elsa sam greta marco luca aiko oscar ben rosa theo will sofia petra trailbot maxb juneb",
	),
	...gen(30, 37),
];

const assign = (roles: Record<string, string[]>): Record<string, string[]> => {
	const out: Record<string, string[]> = {};
	for (const [role, people] of Object.entries(roles)) {
		for (const person of people) {
			const list = out[person] ?? [];
			list.push(role);
			out[person] = list;
		}
	}
	return out;
};

export const SPACES: readonly SpaceSeed[] = [
	{
		key: "hq",
		did: "did:plc:colibrihqspace2a4b6c8d",
		handle: "hq.colibri.social",
		name: "Colibri HQ",
		description:
			"Where Colibri gets built in the open. Releases, design reviews and the occasional bird photo.",
		picture: "colibri-hq-icon",
		banner: "colibri-hq-banner",
		requiresApproval: false,
		overrideUserNameColors: false,
		owner: VIEWER_KEY,
		members: hqMembers,
		createdDaysAgo: 420,
		roles: [
			{
				rkey: "owner",
				name: "Owner",
				color: "#a579ff",
				hoisted: true,
				protected: true,
				icon: { icon: "crown", color: "#ffc861" },
				permissions: ALL_PERMISSIONS,
			},
			{
				rkey: "core",
				name: "Core team",
				color: "#5cadff",
				hoisted: true,
				mentionable: true,
				icon: { icon: "code" },
				permissions: [...MOD_PERMISSIONS, "channel.create", "channel.update"],
			},
			{
				rkey: "mods",
				name: "Moderators",
				color: "#7ee0a1",
				hoisted: true,
				mentionable: true,
				image: "colibri-mod-badge",
				permissions: MOD_PERMISSIONS,
			},
			{
				rkey: "testers",
				name: "Testers",
				color: "#ff8fab",
				mentionable: true,
				icon: { icon: "bug", color: "#ff8fab" },
				permissions: ["thread.create"],
			},
			{
				rkey: "bots",
				name: "Bots",
				color: "#a1a1a1",
				hoisted: true,
				permissions: [],
			},
		],
		memberRoles: assign({
			owner: ["lou"],
			core: ["mira", "tomas", "kris", "priya"],
			mods: ["ana", "noor", "eli"],
			testers: ["jun", "lena", "ivy", "maya", "zoe", "gen3", "gen7", "gen12"],
			bots: ["birdbot", "relay"],
		}),
		categories: [
			{ rkey: "info", name: "Info" },
			{ rkey: "talk", name: "Talk" },
			{ rkey: "build", name: "Build" },
			{ rkey: "voice", name: "Voice" },
			{ rkey: "staff", name: "Staff" },
			{ rkey: "testing", name: "Testing" },
		],
		channels: [
			{
				skey: "welcome",
				name: "welcome",
				kind: "text",
				description: "Start here. Read the rules and say hi.",
			},
			{
				skey: "announcements",
				name: "announcements",
				kind: "text",
				category: "info",
				description: "Release notes and news from the team.",
			},
			{
				skey: "releases",
				name: "releases",
				kind: "text",
				category: "info",
				description: "Automated release feed.",
			},
			{
				skey: "general",
				name: "general",
				kind: "text",
				category: "talk",
				description: "Anything goes, keep it kind.",
			},
			{
				skey: "off-topic",
				name: "off-topic",
				kind: "text",
				category: "talk",
				description: "Bird photos, memes, weekend plans.",
			},
			{
				skey: "design",
				name: "design",
				kind: "text",
				category: "build",
				description: "Design reviews, Figma links and pixel pushing.",
			},
			{
				skey: "dev",
				name: "dev",
				kind: "text",
				category: "build",
				description: "Code, builds and lexicon talk.",
			},
			{ skey: "lounge", name: "Lounge", kind: "voice", category: "voice" },
			{ skey: "standup", name: "Standup", kind: "voice", category: "voice" },
			{
				skey: "mod-room",
				name: "mod-room",
				kind: "text",
				category: "staff",
				private: true,
				description: "Moderators only.",
			},
			{
				skey: "typing",
				name: "typing",
				kind: "text",
				category: "testing",
				description:
					"Typing indicators on a loop: nobody, one, two, three, more, then messages.",
			},
			{
				skey: "mutations",
				name: "mutations",
				kind: "text",
				category: "testing",
				description:
					'Edits, deletes, reactions and replies on a loop. Messages containing "fail" never send.',
			},
		],
	},
	{
		key: "owls",
		did: "did:plc:nightowlsartclub3e5f7g9h",
		handle: "nightowls.art",
		name: "Night Owls Art Club",
		description:
			"A cozy club for people who draw after dark. Weekly prompts, critique circles and a very long archive.",
		picture: "night-owls-icon",
		banner: "night-owls-banner",
		requiresApproval: false,
		overrideUserNameColors: true,
		owner: "hana",
		members: owlsMembers,
		createdDaysAgo: 900,
		roles: [
			{
				rkey: "founder",
				name: "Founder",
				color: "#e58cff",
				hoisted: true,
				protected: true,
				icon: { icon: "crown-star" },
				permissions: ALL_PERMISSIONS,
			},
			{
				rkey: "curators",
				name: "Curators",
				color: "#ffc861",
				hoisted: true,
				mentionable: true,
				icon: { icon: "palette", color: "#ffc861" },
				permissions: MOD_PERMISSIONS,
			},
			{
				rkey: "mentors",
				name: "Mentors",
				color: "#4dd4c6",
				hoisted: true,
				mentionable: true,
				image: "night-owls-mentor-badge",
				permissions: ["thread.create", "thread.manage"],
			},
			{
				rkey: "artists",
				name: "Artists",
				color: "#ff8fab",
				mentionable: true,
				permissions: ["thread.create"],
			},
			{
				rkey: "night-shift",
				name: "Night shift",
				color: "#9cc2ff",
				permissions: [],
			},
		],
		memberRoles: assign({
			founder: ["hana"],
			curators: ["rosa", "kai", "nina"],
			mentors: ["mira", "aiko", "jun", "theo"],
			artists: ["lou", "ivy", "lucy", "greta", "maya", "sofia", ...gen(0, 60)],
			"night-shift": ["lou", "will", ...gen(40, 90)],
		}),
		categories: [
			{ rkey: "club", name: "Club" },
			{ rkey: "studio", name: "Studio" },
			{ rkey: "voice", name: "Voice rooms" },
		],
		channels: [
			{
				skey: "showcase",
				name: "showcase",
				kind: "text",
				category: "club",
				description: "Finished pieces only. Reactions encouraged.",
			},
			{
				skey: "prompts",
				name: "prompts",
				kind: "text",
				category: "club",
				description: "Weekly prompt drops.",
			},
			{
				skey: "critique",
				name: "critique",
				kind: "text",
				category: "studio",
				description: "Ask for feedback in a thread.",
			},
			{
				skey: "gifs",
				name: "gifs",
				kind: "text",
				category: "studio",
				description: "Reaction GIF dumping ground.",
			},
			{
				skey: "archive",
				name: "archive",
				kind: "text",
				category: "studio",
				description: "Years of chatter. Scroll at your own risk.",
			},
			{
				skey: "draw-along",
				name: "Draw along",
				kind: "voice",
				category: "voice",
			},
			{
				skey: "quiet-studio",
				name: "Quiet studio",
				kind: "voice",
				category: "voice",
			},
		],
	},
	{
		key: "trail",
		did: "did:plc:trailheadsclub4i6j8k2m",
		handle: "trailheads.club",
		name: "Trailheads",
		description:
			"Small group planning hikes, swapping gear and checking trail conditions. Ask to join.",
		picture: "trailheads-icon",
		banner: "trailheads-banner",
		requiresApproval: true,
		overrideUserNameColors: false,
		owner: "omar",
		members: trailMembers,
		createdDaysAgo: 160,
		roles: [
			{
				rkey: "leader",
				name: "Trail lead",
				color: "#ff7a59",
				hoisted: true,
				protected: true,
				icon: { icon: "flag" },
				permissions: ALL_PERMISSIONS,
			},
			{
				rkey: "guides",
				name: "Guides",
				color: "#7ee0a1",
				hoisted: true,
				mentionable: true,
				icon: { icon: "leaf", color: "#7ee0a1" },
				permissions: MOD_PERMISSIONS,
			},
			{
				rkey: "regulars",
				name: "Regulars",
				mentionable: true,
				permissions: ["thread.create"],
			},
		],
		memberRoles: assign({
			leader: ["omar"],
			guides: ["elsa", "sam", "lou"],
			regulars: ["greta", "marco", "aiko", "oscar"],
		}),
		categories: [
			{ rkey: "trips", name: "Trips" },
			{ rkey: "bridge", name: "Bridged" },
		],
		channels: [
			{
				skey: "planning",
				name: "planning",
				kind: "text",
				category: "trips",
				description: "Dates, carpools, who is in.",
			},
			{
				skey: "routes",
				name: "routes",
				kind: "text",
				category: "trips",
				description: "GPX files and route ideas.",
			},
			{
				skey: "gear",
				name: "gear",
				kind: "text",
				category: "trips",
				description: "Swap, lend, review.",
			},
			{
				skey: "matrix",
				name: "matrix",
				kind: "text",
				category: "bridge",
				description: "Bridged with our old Matrix room.",
			},
			{
				skey: "photos",
				name: "photos",
				kind: "text",
				category: "trips",
				description: "Nothing here yet.",
			},
		],
	},
	{
		key: "pixel",
		did: "did:plc:pixelgardenspace5n7p9q",
		handle: "pixel.garden",
		name: "Pixel Garden",
		description:
			"Pixel art, tiny palettes and weekly sprite challenges. Everyone is welcome.",
		picture: "pixel-garden-icon",
		banner: "pixel-garden-banner",
		requiresApproval: false,
		overrideUserNameColors: false,
		owner: "gen200",
		members: gen(200, 284),
		createdDaysAgo: 90,
		roles: [
			{
				rkey: "gardener",
				name: "Head gardener",
				color: "#9be15d",
				hoisted: true,
				protected: true,
				permissions: ALL_PERMISSIONS,
			},
		],
		memberRoles: assign({ gardener: ["gen200"] }),
		categories: [],
		channels: [
			{
				skey: "sprites",
				name: "sprites",
				kind: "text",
				description: "Share what you're working on.",
			},
			{
				skey: "challenges",
				name: "challenges",
				kind: "text",
				description: "This week's prompt and entries.",
			},
		],
	},
	{
		key: "readers",
		did: "did:plc:quietreadersclub6r8s2t",
		handle: "quietreaders.club",
		name: "Quiet Readers",
		description:
			"A slow book club. One chapter a week, spoilers in threads. Requests are reviewed by the hosts.",
		picture: "quiet-readers-icon",
		banner: "quiet-readers-banner",
		requiresApproval: true,
		overrideUserNameColors: false,
		owner: "gen300",
		members: gen(300, 342),
		createdDaysAgo: 210,
		roles: [
			{
				rkey: "host",
				name: "Host",
				color: "#e0b3ff",
				hoisted: true,
				protected: true,
				permissions: ALL_PERMISSIONS,
			},
		],
		memberRoles: assign({ host: ["gen300"] }),
		categories: [],
		channels: [
			{
				skey: "chapter",
				name: "this-week",
				kind: "text",
				description: "The current chapter.",
			},
		],
	},
];
