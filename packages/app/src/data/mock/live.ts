import { skeyOf } from "../ids";
import type { LiveEvent } from "../source";
import type { Did, Facet, MessageView, Presence, SpaceRef } from "../types";
import type { OnlineState } from "./people";
import { fx, mark, rich } from "./rich";
import { createRandom } from "./seed";
import { startVoiceActivity } from "./voice";
import type { World } from "./world";

const LINES = [
	"just saw the new build, the gestures feel great",
	"anyone around for a quick review?",
	"lol yes",
	"that makes sense",
	"posting the update in a sec",
	"coffee break ☕",
	"did the rain stop where you are?",
	"ok I'm convinced",
	"same here",
	"this is looking really good",
	"ha, classic",
	"brb",
	"new sketch incoming 🖊️",
	"the trail report says clear skies this weekend",
	"thanks for the help earlier!",
	"👀",
	"🎉",
];

const HOT_CHANNELS = [
	"hq:general",
	"hq:general",
	"hq:general",
	"hq:design",
	"hq:dev",
	"owls:showcase",
	"owls:gifs",
	"trail:planning",
	"trail:matrix",
];

const STATES: OnlineState[] = ["online", "online", "away", "dnd", "offline"];

export const startLive = (options: {
	world: World;
	emit: (event: LiveEvent) => void;
	append: (message: MessageView) => void;
	createMessage: (input: {
		author: Did;
		channel: SpaceRef;
		text: string;
		facets?: Facet[];
	}) => MessageView;
	applyReaction: (
		ref: SpaceRef,
		rkey: string,
		emoji: string,
		actor: Did,
		add: boolean,
	) => boolean;
	messagesFor: (ref: SpaceRef) => MessageView[];
	replaceMessage: (ref: SpaceRef, rkey: string, text: string) => MessageView;
	removeMessage: (ref: SpaceRef, rkey: string) => void;
}) => {
	const { world, emit } = options;
	const random = createRandom(0x11fe);
	const timers = new Set<ReturnType<typeof setTimeout>>();
	let stopped = false;

	const later = (ms: number, run: () => void) => {
		const timer = setTimeout(() => {
			timers.delete(timer);
			if (!stopped) run();
		}, ms);
		timers.add(timer);
	};

	const channelFor = (key: string) => {
		const [spaceKey, skey] = key.split(":");
		const space = world.spaces.find((entry) => entry.seed.key === spaceKey);
		const channel = space?.channels.find(
			(entry) => skeyOf(entry.view.space) === skey,
		);
		return space && channel ? { space, channel } : undefined;
	};

	const memberOf = (spaceKey: string) => {
		const space = world.spaces.find((entry) => entry.seed.key === spaceKey);
		const candidates = (space?.seed.members ?? []).filter((key) => {
			const person = world.people.byKey.get(key);
			if (!person || person.bot || key === "lou") return false;
			const state = world.people.presenceOf(person.did)?.onlineState;
			return state === "online" || state === "away";
		});
		return candidates.length ? random.pick(candidates.slice(0, 60)) : undefined;
	};

	const scheduleMessage = () => {
		later(random.int(6_000, 14_000), () => {
			const key = random.pick(HOT_CHANNELS);
			const target = channelFor(key);
			const author = memberOf(key.split(":")[0] as string);
			if (target && author) {
				const did = world.people.didOf(author);
				const channel = target.channel.view.space;
				const typingFor = random.int(2_000, 6_000);
				emit({ $type: "typingEvent", did, channel });
				for (let elapsed = 3_000; elapsed < typingFor; elapsed += 3_000) {
					later(elapsed, () => emit({ $type: "typingEvent", did, channel }));
				}
				later(typingFor, () => {
					const mention = random.chance(1 / 6);
					const body = mention
						? rich(
								mark("@Louis", fx.mention(world.viewerDid)),
								` ${random.pick(LINES)}`,
							)
						: { text: random.pick(LINES) };
					const message = options.createMessage({
						author: did,
						channel,
						text: body.text,
						facets: "facets" in body ? body.facets : undefined,
					});
					options.append(message);
					emit({ $type: "messageEvent", event: "create", channel, message });
				});
			}
			scheduleMessage();
		});
	};

	const schedulePresence = () => {
		later(random.int(9_000, 20_000), () => {
			const person = random.pick(world.people.all.slice(1, 40));
			if (!person.bot) {
				const current = world.people.presenceOf(person.did);
				const next: Presence = { ...current, onlineState: random.pick(STATES) };
				world.people.setPresence(person.did, next);
				emit({ $type: "presenceEvent", did: person.did, presence: next });
			}
			schedulePresence();
		});
	};

	const scheduleReaction = () => {
		later(random.int(7_000, 15_000), () => {
			const target = channelFor(
				random.pick(["hq:general", "owls:showcase", "hq:design"]),
			);
			if (target) {
				const channel = target.channel.view.space;
				const recent = options.messagesFor(channel).slice(-10);
				const message = recent.length ? random.pick(recent) : undefined;
				const reactor = memberOf(target.space.seed.key);
				if (message && reactor) {
					const emoji = random.pick(["👍", "❤️", "😂", "🔥", "🎉", "👀"]);
					const actor = world.people.didOf(reactor);
					if (
						options.applyReaction(channel, message.rkey, emoji, actor, true)
					) {
						emit({
							$type: "reactionEvent",
							event: "create",
							channel,
							target: message.rkey,
							emoji,
							actor,
						});
					}
				}
			}
			scheduleReaction();
		});
	};

	const TYPISTS = ["mira", "tomas", "kris", "priya", "ana", "noor"];
	const TYPING_REFRESH_MS = 2_500;

	const sendAs = (key: string, channel: SpaceRef, text: string) => {
		const message = options.createMessage({
			author: world.people.didOf(key),
			channel,
			text,
		});
		options.append(message);
		emit({ $type: "messageEvent", event: "create", channel, message });
		return message;
	};

	const typingCycle = () => {
		const target = channelFor("hq:typing");
		if (!target) return;
		const channel = target.channel.view.space;
		const steps = [0, 1, 2, 3, 6];
		const stepMs = 5_000;
		let offset = 4_000;
		for (const count of steps) {
			const start = offset;
			for (let tick = 0; tick < stepMs; tick += TYPING_REFRESH_MS) {
				later(start + tick, () => {
					for (const key of TYPISTS.slice(0, count)) {
						emit({
							$type: "typingEvent",
							did: world.people.didOf(key),
							channel,
						});
					}
				});
			}
			offset += count === 0 ? 0 : stepMs;
		}
		TYPISTS.forEach((key, index) => {
			later(offset + index * 900, () =>
				sendAs(key, channel, random.pick(LINES)),
			);
		});
		later(offset + TYPISTS.length * 900 + 8_000, typingCycle);
	};

	const MUTATORS = ["tomas", "kris", "priya"];

	const mutationCycle = () => {
		const target = channelFor("hq:mutations");
		if (!target) return;
		const channel = target.channel.view.space;
		const viewer = world.viewerDid;
		const others = () =>
			options
				.messagesFor(channel)
				.filter((message) => message.author.did !== viewer)
				.slice(-6);
		const own = () =>
			options
				.messagesFor(channel)
				.filter((message) => message.author.did === viewer)
				.slice(-4);
		const actions: (() => void)[] = [
			() => {
				const key = random.pick(MUTATORS);
				sendAs(key, channel, `${random.pick(LINES)} (new message)`);
			},
			() => {
				const message = others().at(-1);
				if (!message) return;
				const next = options.replaceMessage(
					channel,
					message.rkey,
					`${message.text.replace(/ \(edited.*\)$/, "")} (edited remotely)`,
				);
				emit({
					$type: "messageEvent",
					event: "update",
					channel,
					message: next,
				});
			},
			() => {
				const message = own().at(-1);
				if (!message) return;
				const actor = world.people.didOf(random.pick(MUTATORS));
				const emoji = random.pick(["👍", "❤️", "😂", "🎉"]);
				if (options.applyReaction(channel, message.rkey, emoji, actor, true)) {
					emit({
						$type: "reactionEvent",
						event: "create",
						channel,
						target: message.rkey,
						emoji,
						actor,
					});
					later(4_000, () => {
						if (
							options.applyReaction(channel, message.rkey, emoji, actor, false)
						) {
							emit({
								$type: "reactionEvent",
								event: "delete",
								channel,
								target: message.rkey,
								emoji,
								actor,
							});
						}
					});
				}
			},
			() => {
				const parent = own().at(-1);
				const key = random.pick(MUTATORS);
				const message = options.createMessage({
					author: world.people.didOf(key),
					channel,
					text: "replying to you here",
				});
				if (parent) {
					message.parent = {
						...parent,
						$type: "social.colibri.beta.channel.defs#messageView",
					} as never;
				}
				options.append(message);
				emit({ $type: "messageEvent", event: "create", channel, message });
			},
			() => {
				const message = others().find((entry) =>
					entry.text.endsWith("(new message)"),
				);
				if (!message) return;
				options.removeMessage(channel, message.rkey);
				emit({
					$type: "messageEvent",
					event: "delete",
					channel,
					rkey: message.rkey,
				});
			},
		];
		let index = 0;
		const step = () => {
			actions[index % actions.length]?.();
			index += 1;
			later(4_000, step);
		};
		later(3_000, step);
	};

	scheduleMessage();
	schedulePresence();
	scheduleReaction();
	typingCycle();
	mutationCycle();
	startVoiceActivity({ world, emit, later });

	return () => {
		stopped = true;
		for (const timer of timers) clearTimeout(timer);
		timers.clear();
	};
};
