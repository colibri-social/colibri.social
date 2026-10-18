import type { Did, Presence, ProfileView, Status } from "../types";
import { avatarUrl, bannerUrl } from "./media";
import { asDatetime, asDid, asHandle } from "./refs";
import { createRandom, hashString } from "./seed";

export type OnlineState = Presence["onlineState"];

export type PersonSeed = {
	key: string;
	name: string;
	handle: string;
	accent?: string;
	gradient?: readonly [string, string];
	pronouns?: string;
	state: OnlineState;
	status?: {
		text: string;
		emoji?: string;
		expiresInMinutes?: number;
		showWhileOffline?: boolean;
	};
	bot?: boolean;
	bridged?: { platform: string; remoteId: string };
	noAvatar?: boolean;
	bio?: string;
	badges?: string[];
	activity?: {
		kind: "listening" | "playing";
		title: string;
		subtitle?: string;
		detail?: string;
		source: string;
	};
};

export const VIEWER_KEY = "lou";

export const NAMED_PEOPLE: readonly PersonSeed[] = [
	{
		key: "lou",
		name: "Louis",
		handle: "lou.gg",
		accent: "#a579ff",
		pronouns: "he/him",
		state: "online",
		status: { text: "Building the new client", emoji: "🛠️" },
		bio: "Making Colibri. Birds, type, and too many side projects.",
		badges: ["team"],
	},
	{
		key: "mira",
		name: "Mira Okafor",
		handle: "mira.bsky.social",
		accent: "#ff8fab",
		gradient: ["#ff8fab", "#7c3aed"],
		pronouns: "she/they, sie/ihr",
		state: "online",
		status: { text: "Sketching all day", emoji: "✏️" },
	},
	{ key: "tomas", name: "Tomás Reyes", handle: "tomas.dev", state: "online" },
	{
		key: "kris",
		name: "Kris",
		handle: "kris.colibri.social",
		accent: "#5cadff",
		pronouns: "they/them",
		state: "away",
		status: { text: "Back after lunch", emoji: "🥪", expiresInMinutes: 45 },
	},
	{
		key: "ana",
		name: "Ana Lindqvist",
		handle: "ana.lindqvist.se",
		accent: "#7ee0a1",
		gradient: ["#7ee0a1", "#1d4f5c"],
		pronouns: "hon/henne, she/her",
		state: "dnd",
		status: { text: "Deep work, ping if urgent", emoji: "🎧" },
	},
	{
		key: "jun",
		name: "Jun Park",
		handle: "junpark.art",
		state: "online",
		noAvatar: true,
	},
	{
		key: "sam",
		name: "Sam Whitfield",
		handle: "samw.bsky.social",
		state: "offline",
		status: {
			text: "On a trail somewhere",
			emoji: "🥾",
			showWhileOffline: true,
		},
	},
	{
		key: "noor",
		name: "Noor Haddad",
		handle: "noor.haddad.me",
		accent: "#ffc861",
		state: "online",
		badges: ["play-store-tester"],
		activity: {
			kind: "listening",
			title: "Manual Drive 1991",
			subtitle: "DUSQK",
			detail: "Manual Drive 1991",
			source: "teal.fm",
		},
	},
	{ key: "eli", name: "Eli Brandt", handle: "eli.codes", state: "away" },
	{
		key: "priya",
		name: "Priya Raman",
		handle: "priya.bsky.social",
		accent: "#ff7a59",
		state: "online",
		status: { text: "Reviewing PRs", emoji: "👀" },
	},
	{
		key: "felix",
		name: "Felix Moreau",
		handle: "felix.moreau.fr",
		state: "offline",
		noAvatar: true,
	},
	{
		key: "hana",
		name: "Hana Sato",
		handle: "hana.ink",
		accent: "#e58cff",
		state: "online",
		status: { text: "Inktober prep 🖋️" },
	},
	{
		key: "oscar",
		name: "Oscar Nilsen",
		handle: "oscar.nilsen.no",
		state: "dnd",
	},
	{
		key: "lena",
		name: "Lena Fischer",
		handle: "lena.bsky.social",
		state: "online",
		badges: ["supporter-ten"],
		activity: {
			kind: "playing",
			title: "Celeste",
			subtitle: "Chapter 7",
			source: "Steam",
		},
	},
	{
		key: "dev",
		name: "Dev Malhotra",
		handle: "devm.xyz",
		accent: "#4dd4c6",
		state: "away",
		noAvatar: true,
	},
	{
		key: "rosa",
		name: "Rosa Jiménez",
		handle: "rosa.paints",
		accent: "#ff5c8a",
		state: "online",
		status: { text: "Painting the coast", emoji: "🌊" },
	},
	{
		key: "ben",
		name: "Ben Carter",
		handle: "bencarter.bsky.social",
		state: "offline",
	},
	{
		key: "ivy",
		name: "Ivy Chen",
		handle: "ivy.chen.design",
		accent: "#9cc2ff",
		state: "online",
	},
	{
		key: "omar",
		name: "Omar Siddiqui",
		handle: "omar.trails",
		state: "online",
		status: { text: "Planning the Dolomites loop", emoji: "🏔️" },
	},
	{
		key: "greta",
		name: "Greta Holm",
		handle: "greta.bsky.social",
		state: "away",
		noAvatar: true,
	},
	{
		key: "theo",
		name: "Theo Laurent",
		handle: "theo.studio",
		accent: "#b8f27c",
		state: "offline",
	},
	{ key: "maya", name: "Maya Goldberg", handle: "maya.gold", state: "online" },
	{
		key: "kai",
		name: "Kai Nakamura",
		handle: "kai.nakamura.jp",
		accent: "#ffb3c7",
		state: "dnd",
		status: { text: "Exhibition week", emoji: "🖼️" },
	},
	{
		key: "zoe",
		name: "Zoë Adeyemi",
		handle: "zoe.bsky.social",
		state: "online",
	},
	{
		key: "luca",
		name: "Luca Bianchi",
		handle: "luca.bianchi.it",
		state: "offline",
		noAvatar: true,
	},
	{
		key: "nina",
		name: "Nina Petrova",
		handle: "nina.draws",
		accent: "#c9a0ff",
		state: "online",
	},
	{ key: "ravi", name: "Ravi Kumar", handle: "ravi.kumar.dev", state: "away" },
	{
		key: "elsa",
		name: "Elsa Berg",
		handle: "elsa.hikes",
		accent: "#7fd8ff",
		state: "online",
		status: { text: "Summit or bust", emoji: "⛰️" },
	},
	{
		key: "marco",
		name: "Marco Rossi",
		handle: "marco.bsky.social",
		state: "offline",
	},
	{
		key: "aiko",
		name: "Aiko Tanaka",
		handle: "aiko.tanaka.art",
		state: "online",
		noAvatar: true,
	},
	{
		key: "will",
		name: "Will Osei",
		handle: "will.osei.uk",
		accent: "#ffd166",
		state: "online",
	},
	{ key: "sofia", name: "Sofia Costa", handle: "sofia.costa.pt", state: "dnd" },
	{
		key: "jonas",
		name: "Jonas Weber",
		handle: "jonas.weber.de",
		state: "away",
	},
	{
		key: "lucy",
		name: "Lucy Ward",
		handle: "lucy.bsky.social",
		accent: "#ff9e7a",
		state: "online",
	},
	{
		key: "birdbot",
		name: "Birdbot",
		handle: "birdbot.colibri.social",
		state: "online",
		bot: true,
		accent: "#a579ff",
	},
	{
		key: "relay",
		name: "Release relay",
		handle: "relay.colibri.social",
		state: "online",
		bot: true,
	},
	{
		key: "trailbot",
		name: "Trail conditions",
		handle: "conditions.trailheads.club",
		state: "online",
		bot: true,
	},
	{
		key: "maxb",
		name: "Max",
		handle: "bridge-max.trailheads.club",
		state: "online",
		bridged: { platform: "matrix", remoteId: "@max:matrix.org" },
	},
	{
		key: "juneb",
		name: "June",
		handle: "bridge-june.trailheads.club",
		state: "offline",
		bridged: { platform: "matrix", remoteId: "@june:matrix.org" },
		noAvatar: true,
	},
	{
		key: "petra",
		name: "Petra Novak",
		handle: "petra.novak.cz",
		state: "online",
	},
	{
		key: "yusuf",
		name: "Yusuf Demir",
		handle: "yusuf.demir.tr",
		accent: "#8be9fd",
		state: "offline",
	},
];

const FIRST = [
	"Alex",
	"Bea",
	"Cam",
	"Dara",
	"Emil",
	"Fay",
	"Gus",
	"Hugo",
	"Iris",
	"Jade",
	"Kit",
	"Leo",
	"Mila",
	"Nico",
	"Opal",
	"Pia",
	"Quinn",
	"Remy",
	"Saga",
	"Tove",
	"Uma",
	"Vik",
	"Wren",
	"Xia",
	"Yara",
	"Zed",
	"Ada",
	"Bo",
	"Cleo",
	"Dov",
];
const LAST = [
	"Ash",
	"Birch",
	"Cole",
	"Dune",
	"Eck",
	"Frost",
	"Gale",
	"Hart",
	"Isle",
	"Jett",
	"Kemp",
	"Lark",
	"Moss",
	"Nash",
	"Oak",
	"Pike",
	"Reed",
	"Stone",
	"Thorn",
	"Vale",
];
const DOMAINS = [
	"bsky.social",
	"nightowls.art",
	"studio.ink",
	"draws.art",
	"sketch.club",
];
const STATES: readonly OnlineState[] = [
	"online",
	"online",
	"away",
	"dnd",
	"offline",
	"offline",
	"offline",
];

export const generatedPeople = (count: number): PersonSeed[] => {
	const random = createRandom(0x0715);
	const people: PersonSeed[] = [];
	for (let index = 0; index < count; index++) {
		const first = FIRST[index % FIRST.length] as string;
		const last = LAST[Math.floor(index / FIRST.length) % LAST.length] as string;
		const domain = random.pick(DOMAINS);
		people.push({
			key: `gen${index}`,
			name: `${first} ${last}`,
			handle: `${first}${last}${index}.${domain}`.toLowerCase(),
			state: random.pick(STATES),
			noAvatar: random.chance(0.2),
			accent: random.chance(0.15)
				? random.pick(["#ff8fab", "#7ee0a1", "#9cc2ff", "#ffc861"])
				: undefined,
		});
	}
	return people;
};

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

export const didFor = (key: string) => {
	let out = "";
	for (let round = 0; out.length < 24; round++) {
		let hash = hashString(`${key}:${round}`);
		for (let index = 0; index < 6; index++) {
			out += BASE32[hash & 31];
			hash >>>= 5;
		}
	}
	return asDid(`did:plc:${out.slice(0, 24)}`);
};

export type PersonRecord = PersonSeed & { did: Did };

export type ProfileEdit = {
	displayName?: string;
	description?: string | null;
	pronouns?: string | null;
	avatar?: string | null;
	banner?: string | null;
	syncBluesky?: boolean;
	theme?: ProfileView["theme"] | null;
	preferredBadge?: string | null;
};

const applyEdit = (view: ProfileView, edit: ProfileEdit) => {
	if (edit.syncBluesky !== undefined) view.syncBluesky = edit.syncBluesky;
	if (edit.displayName !== undefined) view.displayName = edit.displayName;
	if (edit.description === null) delete view.description;
	else if (edit.description !== undefined) view.description = edit.description;
	if (edit.pronouns === null) delete view.pronouns;
	else if (edit.pronouns !== undefined) view.pronouns = edit.pronouns;
	if (edit.avatar === null) delete view.avatar;
	else if (edit.avatar !== undefined) view.avatar = edit.avatar as never;
	if (edit.banner === null) delete view.banner;
	else if (edit.banner !== undefined) view.banner = edit.banner as never;
	if (edit.preferredBadge === null) delete view.preferredBadge;
	else if (edit.preferredBadge !== undefined)
		view.preferredBadge = edit.preferredBadge;
	if (edit.theme === null) delete view.theme;
	else if (edit.theme !== undefined) view.theme = edit.theme;
};

export const createPeople = (generatedCount: number, now: number) => {
	const all: PersonRecord[] = [
		...NAMED_PEOPLE,
		...generatedPeople(generatedCount),
	].map((seed) => ({ ...seed, did: didFor(seed.key) }));
	const byKey = new Map(all.map((person) => [person.key, person]));
	const byDid = new Map(all.map((person) => [person.did as string, person]));
	const presence = new Map<string, Presence>();
	const edits = new Map<string, ProfileEdit>();

	const statusFor = (person: PersonSeed): Status | undefined => {
		if (!person.status) return undefined;
		const status: Status = { text: person.status.text };
		if (person.status.emoji) status.emoji = person.status.emoji;
		if (person.status.expiresInMinutes)
			status.expiresAt = asDatetime(
				now + person.status.expiresInMinutes * 60_000,
			);
		if (person.status.showWhileOffline) status.showWhileOffline = true;
		return status;
	};

	for (const person of all) {
		const value: Presence = { onlineState: person.state };
		const status = statusFor(person);
		if (status) value.status = status;
		if (person.activity) {
			value.activities = [
				{
					...person.activity,
					startedAt: asDatetime(now - 4 * 60_000),
				},
			];
		}
		presence.set(person.did, value);
	}

	const profile = (key: string): ProfileView => {
		const person = byKey.get(key) ?? byDid.get(key);
		if (!person) throw new Error(`Unknown person ${key}`);
		const view: ProfileView = {
			did: person.did,
			handle: asHandle(person.handle),
			displayName: person.name,
			isBot: !!person.bot,
			syncBluesky: person.handle.endsWith(".bsky.social"),
		};
		if (!person.noAvatar) view.avatar = avatarUrl(`colibri-${person.key}`);
		if (person.key === VIEWER_KEY)
			view.banner = bannerUrl("colibri-lou-banner");
		if (person.bio) view.description = person.bio;
		if (person.pronouns) view.pronouns = person.pronouns;
		if (person.accent || person.gradient) {
			view.theme = {};
			if (person.accent) view.theme.accentColor = person.accent;
			if (person.gradient) {
				const [primary, secondary] = person.gradient;
				view.theme.gradient = { primary, secondary };
			}
		}
		if (person.bridged) {
			view.bridge = {
				registration: "3lbridgereg22",
				platform: person.bridged.platform,
				remoteId: person.bridged.remoteId,
			};
		}
		const edit = edits.get(person.did);
		if (edit) applyEdit(view, edit);
		const current = presence.get(person.did);
		if (current) view.presence = current;
		return view;
	};

	const setProfile = (did: string, edit: ProfileEdit, replace = false) => {
		edits.set(did, replace ? edit : { ...edits.get(did), ...edit });
	};

	const setPresence = (did: string, next: Presence) => {
		presence.set(did, next);
	};

	return {
		all,
		byKey,
		byDid,
		profile,
		presenceOf: (did: string) => presence.get(did),
		setPresence,
		setProfile,
		didOf: (key: string) => (byKey.get(key) as PersonRecord).did,
	};
};

export type People = ReturnType<typeof createPeople>;
