import {
	type Component,
	createSignal,
	For,
	Match,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { ChatCircleDots } from "@/components/solid/icons/ChatCircleDots";
import { SpeakerLow } from "@/components/solid/icons/SpeakerLow";
import {
	type BuildEventsResult,
	createAnimationTimeline,
	type TimelineEvent,
} from "@/lib/hooks/createAnimationTimeline";
import { SpeakerHigh } from "../solid/icons/SpeakerHigh";

type Guest = {
	id: string;
	name: string;
	color: string;
};

const ME_ID = "00";

const GUESTS: Guest[] = [
	{ id: "01", name: "Alice", color: "bg-pink-400" },
	{ id: "02", name: "Bob", color: "bg-blue-400" },
	{ id: "03", name: "Charlie", color: "bg-amber-400" },
	{ id: "04", name: "Dana", color: "bg-emerald-400" },
	{ id: "05", name: "Louis", color: "bg-red-400" },
	{ id: "06", name: "Matthew", color: "bg-teal-400" },
	{ id: "07", name: "Rueben", color: "bg-orange-400" },
	{ id: "08", name: "Houston", color: "bg-cyan-400" },
] as const;

const ChevronDown: Component = () => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="32"
		fill="currentColor"
		height="32"
		viewBox="0 0 256 256"
		aria-hidden="true"
	>
		<path
			fill="currentColor"
			d="m213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32"
		/>
	</svg>
);

function shuffled<T>(array: T[]): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

function pickGuests(count: number, excludeIds: string[] = []): Guest[] {
	const available = GUESTS.filter((g) => !excludeIds.includes(g.id));
	return shuffled(available).slice(0, count);
}

type ConversationResult = {
	events: TimelineEvent[];
	endTime: number;
};

function buildGroupConversation(
	startTime: number,
	participantIds: string[],
	rounds: number,
	setSpeakingId: (id: string | null) => void,
): ConversationResult {
	const events: TimelineEvent[] = [];
	let t = startTime;
	let lastSpeaker = -1;

	for (let i = 0; i < rounds; i++) {
		let next: number;
		do {
			next = Math.floor(Math.random() * participantIds.length);
		} while (next === lastSpeaker && participantIds.length > 1);
		lastSpeaker = next;

		const duration = 400 + Math.random() * 600;
		const id = participantIds[next];
		events.push({ timestamp: t, execute: () => setSpeakingId(id) });
		t += duration;
		events.push({ timestamp: t, execute: () => setSpeakingId(null) });
		t += 150 + Math.random() * 100;
	}

	return { events, endTime: t };
}

const PHASE_1_DURATION = 6000;
const PHASE_2_FALLBACK_DURATION = 12000;

const MockVoiceCall: Component = () => {
	// Phase 1 signals (set once, never reset)
	const [discussionsUnread, setDiscussionsUnread] = createSignal(false);
	const [generalUnread, setGeneralUnread] = createSignal(false);
	const [someoneJoined, setSomeoneJoined] = createSignal(false);
	const [youJoined, setYouJoined] = createSignal(false);

	// Phase 2 signals (driven by looping timeline)
	const [voiceGuests, setVoiceGuests] = createSignal<Guest[]>([]);
	const [speakingId, setSpeakingId] = createSignal<string | null>(null);

	// Phase 1: Initial sequence (plays once)
	const phase1 = createAnimationTimeline(
		() => {
			const firstGuest = GUESTS[Math.floor(Math.random() * GUESTS.length)];
			return [
				{ timestamp: 1000, execute: () => setDiscussionsUnread(true) },
				{
					timestamp: 2500,
					execute: () => {
						setVoiceGuests([firstGuest]);
						setSomeoneJoined(true);
					},
				},
				{ timestamp: 4000, execute: () => setYouJoined(true) },
				{ timestamp: 5500, execute: () => setGeneralUnread(true) },
			];
		},
		PHASE_1_DURATION,
		{
			onComplete: () => phase2.start(),
		},
	);

	// Phase 2: Ongoing voice loop with randomized cycles
	const phase2 = createAnimationTimeline(
		(): BuildEventsResult => {
			const isGroupCall = Math.random() > 0.5;
			const currentGuestIds = voiceGuests().map((g) => g.id);

			if (isGroupCall) {
				return buildGroupCycle(currentGuestIds);
			}
			return buildSoloCycle(currentGuestIds);
		},
		PHASE_2_FALLBACK_DURATION,
		{
			loop: true,
			onLoop: () => {
				setSpeakingId(null);
				phase2.invalidateCache();
			},
		},
	);

	/** Type A: 1 guest at a time */
	function buildSoloCycle(currentGuestIds: string[]): BuildEventsResult {
		const currentGuest = voiceGuests()[0];
		const allIds = currentGuest ? [currentGuest.id, ME_ID] : [ME_ID];
		const [nextGuest] = pickGuests(1, currentGuestIds);

		const convo1 = currentGuest
			? buildGroupConversation(0, allIds, 4, setSpeakingId)
			: { events: [], endTime: 0 };

		const leaveTime = convo1.endTime + 500;
		const joinTime = leaveTime + 2000;
		const convo2 = buildGroupConversation(
			joinTime + 500,
			[nextGuest.id, ME_ID],
			4,
			setSpeakingId,
		);
		const silenceTime = convo2.endTime + 500;

		return {
			events: [
				...convo1.events,
				{
					timestamp: leaveTime,
					execute: () => {
						setSpeakingId(null);
						setVoiceGuests([]);
					},
				},
				{
					timestamp: joinTime,
					execute: () => setVoiceGuests([nextGuest]),
				},
				...convo2.events,
				{
					timestamp: silenceTime,
					execute: () => setSpeakingId(null),
				},
			],
			duration: silenceTime + 500,
		};
	}

	/** Type B: 2 guests join for a 3-person call */
	function buildGroupCycle(currentGuestIds: string[]): BuildEventsResult {
		const currentGuest = voiceGuests()[0];
		const [secondGuest] = pickGuests(1, currentGuestIds);
		const [seedGuest] = pickGuests(1, [...currentGuestIds, secondGuest.id]);

		const convo1 = currentGuest
			? buildGroupConversation(0, [currentGuest.id, ME_ID], 2, setSpeakingId)
			: { events: [], endTime: 0 };

		const secondJoinTime = convo1.endTime + 500;

		const threeWayIds = [
			...(currentGuest ? [currentGuest.id] : []),
			secondGuest.id,
			ME_ID,
		];
		const convo2 = buildGroupConversation(
			secondJoinTime + 500,
			threeWayIds,
			5,
			setSpeakingId,
		);

		const firstLeaveTime = convo2.endTime + 500;
		const convo3 = buildGroupConversation(
			firstLeaveTime + 500,
			[secondGuest.id, ME_ID],
			2,
			setSpeakingId,
		);

		const remainingLeaveTime = convo3.endTime + 500;
		const seedJoinTime = remainingLeaveTime + 500;
		const silenceTime = seedJoinTime + 1000;

		return {
			events: [
				...convo1.events,
				{
					timestamp: secondJoinTime,
					execute: () => {
						const current = voiceGuests();
						setVoiceGuests([...current, secondGuest]);
					},
				},
				...convo2.events,
				{
					timestamp: firstLeaveTime,
					execute: () => {
						setSpeakingId(null);
						setVoiceGuests([secondGuest]);
					},
				},
				...convo3.events,
				{
					timestamp: remainingLeaveTime,
					execute: () => {
						setSpeakingId(null);
						setVoiceGuests([]);
					},
				},
				{
					timestamp: seedJoinTime,
					execute: () => setVoiceGuests([seedGuest]),
				},
				{
					timestamp: silenceTime,
					execute: () => setSpeakingId(null),
				},
			],
			duration: silenceTime + 500,
		};
	}

	onMount(() => {
		phase1.start();
	});

	return (
		<div class="w-64 h-88 flex flex-col rounded-t-xl bg-background border border-border overflow-hidden select-none font-sans relative top-4">
			<div class="px-4 py-3.5 border-b border-border text-xl">
				<span class="text-white font-semibold">at://enthusiasts</span>
			</div>

			<div class="flex flex-col py-4 px-3">
				<div class="flex items-center gap-2 px-1 pb-1.5 text-xs text-neutral-500 *:first:text-neutral-400 *:first:size-4 *:first:-translate-y-0.25">
					<ChevronDown />
					<span>Text Channels</span>
				</div>

				<ChannelRow
					icon={<ChatCircleDots className="w-4 h-4" />}
					name="General"
					unread={generalUnread()}
				/>
				<ChannelRow
					icon={<ChatCircleDots className="w-4 h-4" />}
					name="Discussions"
					unread={discussionsUnread()}
				/>
			</div>

			<div class="flex flex-col px-3">
				<div class="flex items-center gap-2 px-1 pb-1.5 text-xs text-neutral-500 *:first:text-neutral-400 *:first:size-4 *:first:-translate-y-0.25">
					<ChevronDown />
					<span>Voice Channels</span>
				</div>

				<div
					class="flex flex-col border-l transition-all duration-300"
					classList={{
						"border-transparent": !youJoined(),
						"border-primary": youJoined(),
					}}
				>
					<div
						class="flex items-center gap-2 text-sm px-1 py-0.75 rounded-sm transition-colors duration-300 mb-1.5"
						classList={{
							"bg-gradient-to-r from-[#090615] via-[#31226d80] to-[#e0deec40]":
								youJoined(),
						}}
					>
						<Switch>
							<Match when={!youJoined()}>
								<SpeakerLow
									className="w-4 h-4 shrink-0"
									classList={{
										"text-neutral-500": !youJoined() && !someoneJoined(),
										"text-foreground": someoneJoined() && !youJoined(),
									}}
								/>
							</Match>
							<Match when={youJoined()}>
								<SpeakerHigh className="w-4 h-4 shrink-0 text-primary" />
							</Match>
						</Switch>
						<span
							class="transition-colors duration-300"
							classList={{
								"text-neutral-500": !youJoined(),
								"text-white": youJoined(),
							}}
						>
							Hangout
						</span>
					</div>

					<Show when={voiceGuests().length > 0 || youJoined()}>
						<div class="flex flex-col gap-1 pl-7 pr-3 pb-2">
							<For each={voiceGuests()}>
								{(guest) => (
									<VoiceUser
										name={guest.name}
										color={guest.color}
										speaking={speakingId() === guest.id}
									/>
								)}
							</For>
							<Show when={youJoined()}>
								<VoiceUser
									name="You"
									color="bg-purple-500"
									speaking={speakingId() === ME_ID}
								/>
							</Show>
						</div>
					</Show>
				</div>
			</div>
		</div>
	);
};

const ChannelRow: Component<{
	icon: any;
	name: string;
	unread: boolean;
}> = (props) => (
	<div
		class="flex items-center gap-2 px-1 text-sm py-0.75 rounded-sm transition-colors duration-300 mb-1.5"
		classList={{
			"text-neutral-400": !props.unread,
			"text-white": props.unread,
		}}
	>
		{props.icon}
		<span>{props.name}</span>
	</div>
);

const VoiceUser: Component<{
	name: string;
	color: string;
	speaking: boolean;
}> = (props) => (
	<div class="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
		<div
			class={`size-4 rounded-full ${props.color} transition-shadow duration-150`}
			classList={{
				"shadow-[0_0_0_1px_var(--primary)]": props.speaking,
			}}
		/>
		<span class="text-xs text-neutral-400">{props.name}</span>
	</div>
);

export default MockVoiceCall;
