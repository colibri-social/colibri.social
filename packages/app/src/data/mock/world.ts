import {
	isPrivateCategory,
	permissionsOf,
	resolveChannelView,
} from "../category-permissions";
import { skeyOf } from "../ids";
import type {
	AttachmentView,
	CategoryPermissions,
	CategoryView,
	ChannelView,
	CommunityView,
	DeletedMessageView,
	Did,
	MemberView,
	MessageView,
	ReactionView,
	RoleView,
	SpaceRef,
	ThreadView,
} from "../types";
import { avatarUrl, bannerUrl, photo } from "./media";
import { createPeople, VIEWER_KEY } from "./people";
import {
	asDatetime,
	asDid,
	asHandle,
	asUri,
	messageUri,
	spaceRef,
	tidFor,
} from "./refs";
import type { RichTextValue } from "./rich";
import { hqScripts } from "./script-hq";
import { archiveLines, owlsScripts } from "./script-owls";
import { threadSeeds } from "./script-threads";
import { trailScripts } from "./script-trail";
import type { ScriptContext, ScriptEntry } from "./script-types";
import { createRandom } from "./seed";
import { SPACES, type SpaceSeed } from "./spaces";
import { mockThreadRights } from "./thread-rights";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
export const MANAGING_APP = asDid("did:web:spaces-api.colibri.social");
const MESSAGE_VIEW = "social.colibri.beta.channel.defs#messageView";
const DELETED_VIEW = "social.colibri.beta.channel.defs#deletedMessageView";
const ICON_BADGE = "social.colibri.beta.community.defs#roleIconBadge";
const IMAGE_BADGE = "social.colibri.beta.community.defs#roleImageBadgeView";
export const ARCHIVE_SIZE = 10_000;

const END_AGO: Record<string, number> = {
	"hq:welcome": 60 * 24 * 30,
	"hq:announcements": 60 * 26,
	"hq:releases": 60 * 30,
	"hq:general": 3,
	"hq:off-topic": 60 * 5,
	"hq:design": 95,
	"hq:dev": 38,
	"hq:mod-room": 60 * 50,
	"owls:showcase": 22,
	"owls:prompts": 60 * 7,
	"owls:critique": 140,
	"owls:gifs": 12,
	"trail:planning": 55,
	"trail:routes": 60 * 20,
	"trail:gear": 60 * 9,
	"trail:matrix": 75,
};

const UNREAD_PLAN: Record<string, number> = {
	"hq:general": 14,
	"hq:design": 3,
	"hq:dev": 2,
	"hq:announcements": 1,
	"hq:off-topic": 6,
	"owls:showcase": 4,
	"owls:gifs": 2,
	"owls:archive": 250,
	"trail:planning": 5,
	"trail:matrix": 3,
};

const FILLER = [
	"has anyone tried the new build on a tablet yet",
	"lunch break, back in 30",
	"that's a good point actually",
	"lol",
	"agreed",
	"I'll look into it after this meeting",
	"the new icons are so crisp",
	"could someone check the invite link, it says expired for me",
	"works for me, try generating a new one",
	"thanks!",
	"happy friday everyone 🎉",
	"just pushed a fix for that",
	"oh nice, much faster now",
	"is the member list sorted by role or by name",
	"by role first, then name",
	"brb",
	"back",
	"that screenshot is cursed",
	"10/10 would scroll again",
	"good morning from Berlin ☀️",
	"good night from Tokyo 🌙",
	"the scrolling is buttery on my phone",
	"I keep forgetting threads exist, they're great",
	"same",
];

export type ChannelRecord = {
	view: ChannelView;
	spaceKey: string;
	messages: MessageView[] | undefined;
	build: () => MessageView[];
	readCursor?: string;
};

export type ThreadRecord = {
	view: ThreadView;
	messages: MessageView[];
};

export type SpaceRecord = {
	seed: SpaceSeed;
	did: Did;
	view: CommunityView;
	roles: RoleView[];
	categories: ({ rkey: string; name: string } & CategoryPermissions)[];
	channels: ChannelRecord[];
	members: MemberView[];
	threads: ThreadRecord[];
};

const reactionsFor = (
	entry: ScriptEntry,
	didOf: (key: string) => Did,
): ReactionView[] =>
	(entry.react ?? []).map(([emoji, ...people]) => {
		const reactors = people.map(didOf);
		const view: ReactionView = {
			emoji,
			count: reactors.length + (entry.extraReactions?.[emoji] ?? 0),
			reactors,
		};
		if (people.includes(VIEWER_KEY)) view.viewerReacted = true;
		return view;
	});

const textOf = (value: string | RichTextValue): RichTextValue =>
	typeof value === "string" ? { text: value } : value;

export const createWorld = (now: number) => {
	const people = createPeople(500, now);
	const didOf = (key: string) => people.didOf(key);
	let clock = 0;
	const nextClock = () => {
		clock += 1;
		return clock;
	};

	const context: ScriptContext = {
		did: didOf,
		at: (minutesFromNow) => asDatetime(now + minutesFromNow * MINUTE),
	};

	const scripts: Record<string, Record<string, ScriptEntry[]>> = {
		hq: hqScripts(context),
		owls: owlsScripts(context),
		trail: trailScripts(context),
	};

	const fillerFor = (key: string, count: number, authors: string[]) => {
		const random = createRandom(0xf111e5 + key.length);
		const entries: ScriptEntry[] = [];
		let previous = "";
		for (let index = 0; index < count; index++) {
			const by =
				random.chance(0.35) && previous ? previous : random.pick(authors);
			entries.push({
				by,
				text: random.pick(FILLER),
				gap: by === previous ? random.int(0, 3) : random.int(4, 240),
			});
			previous = by;
		}
		return entries;
	};

	const anchors = new Map<string, MessageView>();

	const materialize = (
		channel: SpaceRef,
		entries: ScriptEntry[],
		endAgoMinutes: number,
		channelRefs: Map<string, SpaceRef>,
	) => {
		const total = entries.reduce((sum, entry) => sum + (entry.gap ?? 5), 0);
		let time = now - (endAgoMinutes + total) * MINUTE;
		const byId = new Map<string, MessageView>();
		const views: MessageView[] = [];
		for (const entry of entries) {
			time += (entry.gap ?? 5) * MINUTE;
			const author = people.profile(entry.by);
			const rkey = tidFor(time, nextClock());
			const rich = textOf(entry.text);
			const view: MessageView = {
				uri: messageUri(author.did, rkey),
				rkey,
				channel,
				author,
				text: rich.text,
				createdAt: asDatetime(time),
				attachments: entry.files ?? [],
				reactions: reactionsFor(entry, didOf),
				labels: [],
			};
			if (rich.facets) view.facets = rich.facets;
			if (entry.hidden) {
				view.labels = [
					{
						src: MANAGING_APP,
						val: "hidden",
						createdAt: asDatetime(time + 5 * MINUTE),
					} as MessageView["labels"][number],
				];
			}
			if (entry.edited) view.updatedAt = asDatetime(time + 3 * MINUTE);
			if (entry.embeds) view.embeds = entry.embeds;
			if (entry.suppress) view.suppressedEmbeds = entry.suppress as never;
			if (entry.reply) {
				const target = byId.get(entry.reply);
				if (target) {
					const { parent: _parent, ...rest } = target;
					view.parent = { ...rest, $type: MESSAGE_VIEW } as never;
				}
			}
			if (entry.replyDeleted) {
				const ghostKey = tidFor(time - 20 * MINUTE, nextClock());
				const ghost: DeletedMessageView = {
					uri: messageUri(didOf("felix"), ghostKey),
					rkey: ghostKey,
					channel,
				};
				view.parent = { ...ghost, $type: DELETED_VIEW } as never;
			}
			if (entry.forward) {
				const source = entry.forward;
				const sourceRef =
					channelRefs.get(`${source.space}:${source.channel}`) ?? channel;
				const sourceRich = textOf(source.text);
				const sourceTime = time - source.minutesBefore * MINUTE;
				view.forward = {
					source: {
						space: sourceRef,
						did: didOf(source.by),
						rkey: tidFor(sourceTime, nextClock()),
					},
					...(source.hidden ? {} : { sourceName: source.channelName }),
					sourceCommunity: sourceRef.slice(
						"at://".length,
						sourceRef.indexOf("/space/"),
					) as Did,
					createdAt: asDatetime(sourceTime),
					text: sourceRich.text,
					attachments: source.files ?? [],
				};
				if (sourceRich.facets) view.forward.facets = sourceRich.facets;
			}
			if (entry.id) {
				byId.set(entry.id, view);
				anchors.set(`${skeyOf(channel)}:${entry.id}`, view);
			}
			views.push(view);
		}
		return views;
	};

	const archiveBuilder = (channel: SpaceRef, authors: string[]) => () => {
		const random = createRandom(0xa2c417e);
		const views: MessageView[] = [];
		const start = now - 700 * DAY;
		const span = 693 * DAY;
		let previousAuthor = "";
		let time = start;
		const step = span / ARCHIVE_SIZE;
		for (let index = 0; index < ARCHIVE_SIZE; index++) {
			const sameAuthor = previousAuthor && random.chance(0.3);
			time += sameAuthor
				? random.int(5, 90) * 1000
				: step * (0.4 + random.next() * 1.2);
			const by = sameAuthor ? previousAuthor : random.pick(authors);
			previousAuthor = by;
			const author = people.profile(by);
			const rkey = tidFor(time, nextClock());
			const view: MessageView = {
				uri: messageUri(author.did, rkey),
				rkey,
				channel,
				author,
				text: `${random.pick(archiveLines)}`,
				createdAt: asDatetime(time),
				attachments: [],
				reactions: [],
				labels: [],
			};
			if (random.chance(0.03)) {
				view.attachments = [
					photo(
						`archive-${index}`,
						random.pick([800, 1200, 900]),
						random.pick([800, 900, 1200]),
					),
				];
			}
			if (random.chance(0.05)) {
				const emoji = random.pick(["🦉", "😂", "❤️", "🔥", "👏"]);
				const reactor = didOf(random.pick(authors));
				view.reactions = [
					{ emoji, count: random.int(1, 9), reactors: [reactor] },
				];
			}
			if (random.chance(0.04) && views.length > 10) {
				const target = views[views.length - random.int(2, 10)] as MessageView;
				const { parent: _parent, ...rest } = target;
				view.parent = { ...rest, $type: MESSAGE_VIEW } as never;
			}
			if (random.chance(0.01)) view.updatedAt = asDatetime(time + 60_000);
			views.push(view);
		}
		return views;
	};

	const channelRefs = new Map<string, SpaceRef>();
	for (const seed of SPACES) {
		for (const channel of seed.channels) {
			channelRefs.set(
				`${seed.key}:${channel.skey}`,
				spaceRef(asDid(seed.did), channel.kind, channel.skey),
			);
		}
		channelRefs.set(
			`${seed.key}:hidden`,
			spaceRef(asDid(seed.did), "text", "stewards"),
		);
	}

	const spaces: SpaceRecord[] = SPACES.map((seed) => {
		const did = asDid(seed.did);
		const positions = new Map(
			seed.roles.map((role, index) => [role.rkey, seed.roles.length - index]),
		);
		const roleCounts = new Map<string, number>();
		for (const member of seed.members) {
			for (const role of seed.memberRoles[member] ?? []) {
				roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
			}
		}
		const roles: RoleView[] = seed.roles.map((role) => {
			const view: RoleView = {
				rkey: role.rkey,
				name: role.name,
				permissions: role.permissions,
				position: positions.get(role.rkey) ?? 0,
				memberCount: roleCounts.get(role.rkey) ?? 0,
			};
			if (role.color) view.color = role.color;
			if (role.hoisted) view.hoisted = true;
			if (role.mentionable) view.mentionable = true;
			if (role.protected) view.protected = true;
			if (role.icon) {
				view.badge = { $type: ICON_BADGE, ...role.icon } as never;
			}
			if (role.image) {
				view.badge = {
					$type: IMAGE_BADGE,
					image: asUri(`https://picsum.photos/seed/${role.image}/64`),
				} as never;
			}
			return view;
		});
		const sortRoles = (keys: string[]) =>
			[...keys].sort(
				(a, b) => (positions.get(b) ?? 0) - (positions.get(a) ?? 0),
			);
		const joinRandom = createRandom(seed.did.length * 977);
		const members: MemberView[] = seed.members.map((key) => {
			const view: MemberView = {
				actor: people.profile(key),
				roles: sortRoles(seed.memberRoles[key] ?? []),
				joinedAt: asDatetime(
					now - joinRandom.int(1, seed.createdDaysAgo) * DAY,
				),
			};
			if (key === "will" && seed.key === "hq")
				view.nickname = "Will (podcast guy)";
			if (key === "lou" && seed.key === "owls") view.nickname = "Lou";
			return view;
		});
		const viewerRoles = sortRoles(seed.memberRoles[VIEWER_KEY] ?? []);
		const viewerPermissions = [
			...new Set(
				seed.roles
					.filter((role) => viewerRoles.includes(role.rkey))
					.flatMap((role) => role.permissions),
			),
		];
		const isOwner = seed.owner === VIEWER_KEY;
		const view: CommunityView = {
			did,
			handle: asHandle(seed.handle),
			managingApp: MANAGING_APP,
			name: seed.name,
			description: seed.description,
			picture: avatarUrl(seed.picture),
			banner: bannerUrl(seed.banner),
			requiresApprovalToJoin: seed.requiresApproval,
			linkEmbeds: true,
			overrideUserNameColors: seed.overrideUserNameColors,
			memberCount: members.length,
			viewer: {
				isMember: seed.members.includes(VIEWER_KEY),
				isOwner,
				roles: viewerRoles,
				permissions: viewerPermissions,
			},
		};
		const channels: ChannelRecord[] = seed.channels.map((channel) => {
			const ref = channelRefs.get(`${seed.key}:${channel.skey}`) as SpaceRef;
			const readOnly = seed.key === "owls" && channel.skey === "prompts";
			const channelView: ChannelView = {
				space: ref,
				type:
					channel.kind === "voice"
						? "social.colibri.beta.channel.voice"
						: "social.colibri.beta.channel.text",
				name: channel.name,
				viewer: {
					canRead: true,
					canPost: !readOnly,
					permissions: viewerPermissions,
				},
			};
			if (channel.description) channelView.description = channel.description;
			if (channel.category) channelView.category = channel.category;
			if (channel.private) {
				channelView.private = true;
				channelView.allowedRoles = ["owner", "mods"];
				channelView.visibleToRoles = ["owner", "mods"];
			}
			const key = `${seed.key}:${channel.skey}`;
			const build =
				channel.kind === "voice"
					? () => []
					: channel.skey === "archive"
						? archiveBuilder(ref, seed.members.slice(0, 160))
						: () => {
								const script = scripts[seed.key]?.[channel.skey] ?? [];
								const filler =
									key === "hq:general" || key === "hq:typing"
										? fillerFor(key, 120, seed.members.slice(1, 40))
										: [];
								return materialize(
									ref,
									[...filler, ...script],
									END_AGO[key] ?? 60,
									channelRefs,
								);
							};
			return {
				view: channelView,
				spaceKey: seed.key,
				messages: undefined,
				build,
			};
		});
		return {
			seed,
			did,
			view,
			roles,
			categories: seed.categories,
			channels,
			members,
			threads: [],
		};
	});

	const messagesOf = (record: ChannelRecord) => {
		if (!record.messages) {
			record.messages = record.build();
			const unread =
				UNREAD_PLAN[`${record.spaceKey}:${skeyOf(record.view.space)}`];
			if (unread && record.messages.length > unread) {
				record.readCursor =
					record.messages[record.messages.length - unread - 1]?.rkey;
			} else if (record.messages.length) {
				record.readCursor = record.messages[record.messages.length - 1]?.rkey;
			}
		}
		return record.messages;
	};

	for (const space of spaces) {
		for (const channel of space.channels) {
			if (
				channel.spaceKey !== "owls" ||
				skeyOf(channel.view.space) !== "archive"
			) {
				messagesOf(channel);
			}
		}
	}

	for (const thread of threadSeeds(context)) {
		const space = spaces.find((entry) => entry.seed.key === thread.space);
		const channel = space?.channels.find(
			(entry) => skeyOf(entry.view.space) === thread.channel,
		);
		const anchor = anchors.get(`${thread.channel}:${thread.anchor}`);
		if (!space || !channel || !anchor) continue;
		const threadRef =
			`at://${space.did}/space/social.colibri.beta.channel.thread/${thread.tkey}` as SpaceRef;
		const anchorTime = Date.parse(anchor.createdAt);
		const total = thread.entries.reduce(
			(sum, entry) => sum + (entry.gap ?? 5),
			0,
		);
		const endAgo = Math.max(1, Math.round((now - anchorTime) / MINUTE) - total);
		const messages = materialize(
			threadRef,
			thread.entries,
			Math.min(endAgo, 30),
			new Map(),
		);
		const last = messages[messages.length - 1];
		const participants = [
			...new Set([
				anchor.author.did,
				...messages.map((message) => message.author.did),
			]),
		];
		const { parent: _parent, ...anchorRest } = anchor;
		space.threads.push({
			messages,
			view: {
				space: threadRef,
				channel: channel.view.space,
				community: space.did,
				name: thread.name,
				anchor: {
					space: channel.view.space,
					did: anchor.author.did,
					rkey: anchor.rkey,
				},
				anchorMessage: { ...anchorRest, $type: MESSAGE_VIEW } as never,
				createdBy: didOf(thread.by),
				createdAt: anchor.createdAt,
				lastActivityAt: last?.createdAt ?? anchor.createdAt,
				messageCount: messages.length,
				participants,
				viewer: {
					canRead: true,
					...mockThreadRights(
						{ createdBy: didOf(thread.by) },
						didOf(VIEWER_KEY),
						!!space.view.viewer.isOwner ||
							!!space.view.viewer.permissions?.includes("thread.manage"),
					),
					following: !!thread.following,
					muted: false,
					hasUnread: !!thread.unread,
					unreadMentions: thread.unread ? 1 : 0,
				},
			},
		});
	}

	const channelViewIn = (space: SpaceRecord, view: ChannelView) =>
		resolveChannelView(
			view,
			space.categories.find((entry) => entry.rkey === view.category),
			{ did: didOf(VIEWER_KEY), community: space.view, roles: space.roles },
		);

	const channelsOf = (space: SpaceRecord): ChannelView[] =>
		space.channels.map((channel) => channelViewIn(space, channel.view));

	const categoriesOf = (space: SpaceRecord): CategoryView[] =>
		space.categories.map((category) => {
			const view: CategoryView = {
				...permissionsOf(category),
				rkey: category.rkey,
				name: category.name,
				channels: space.channels
					.filter((channel) => channel.view.category === category.rkey)
					.map((channel) => channelViewIn(space, channel.view)),
			};
			if (isPrivateCategory(category)) view.private = true;
			return view;
		});

	return {
		people,
		spaces,
		messagesOf,
		categoriesOf,
		channelsOf,
		channelViewIn,
		nextClock,
		viewerDid: didOf(VIEWER_KEY),
	};
};

export type World = ReturnType<typeof createWorld>;
export type { AttachmentView };
