import { type Component, createSignal, For, onMount, Show } from "solid-js";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import { createAnimationTimeline } from "../../hooks/createAnimationTimeline";
import { parseEmojiText } from "../../utils/emoji";
import { MessageTimestamp } from "../app/channel/message/MessageTimestamp";
import User from "../app/user";
import {
	createConversation,
	randomReaction,
	type ScriptedMessage,
	type Speaker,
	toMessage,
} from "./chat-script";

const HISTORY_LIMIT = 30;
const SEED_COUNT = 7;
const TYPING_MS = 1100;
const GAP_MIN_MS = 2200;
const GAP_MAX_MS = 5200;
const CYCLE_MESSAGES = 3;
const REACTIONS_PER_CYCLE = 2;
const MAX_REACTIONS = 3;

const typingLabel = (name: string) =>
	name === "You" ? "You are typing" : `${name} is typing`;

export const SignInShowcase: Component = () => {
	const conversation = createConversation();

	const seedMessages = (): Array<ScriptedMessage> => {
		const messages: Array<ScriptedMessage> = [];
		let stamp = Date.now() - SEED_COUNT * 120_000;

		for (let index = 0; index < SEED_COUNT; index++) {
			stamp += 40_000 + Math.random() * 80_000;
			messages.push(toMessage(conversation.next(), new Date(stamp)));
		}

		return messages;
	};

	const [messages, setMessages] = createSignal<Array<ScriptedMessage>>(
		seedMessages(),
	);
	const [typing, setTyping] = createSignal<Speaker | null>(null);

	const react = () => {
		setMessages((previous) => {
			if (previous.length === 0) return previous;

			const recent = previous.slice(-6);
			const target = recent[Math.floor(Math.random() * recent.length)];
			const existing = target.reactions;
			const bump =
				existing.length > 0 &&
				(existing.length >= MAX_REACTIONS || Math.random() < 0.55);

			const nextReactions = bump
				? existing.map((reaction, index) =>
						index === Math.floor(Math.random() * existing.length)
							? { ...reaction, count: reaction.count + 1 }
							: reaction,
					)
				: [...existing, { emoji: randomReaction(existing), count: 1 }];

			return previous.map((message) =>
				message.id === target.id
					? { ...message, reactions: nextReactions }
					: message,
			);
		});
	};

	const buildCycle = () => {
		const events: Array<{ timestamp: number; execute: () => void }> = [];
		let cursor = 0;

		for (let index = 0; index < CYCLE_MESSAGES; index++) {
			const turn = conversation.next();

			cursor += GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS);
			events.push({
				timestamp: cursor,
				execute: () => setTyping(turn.speaker),
			});

			cursor += TYPING_MS;
			events.push({
				timestamp: cursor,
				execute: () => {
					setTyping(null);
					setMessages((previous) =>
						[...previous, toMessage(turn, new Date())].slice(-HISTORY_LIMIT),
					);
				},
			});
		}

		const duration = cursor + GAP_MIN_MS;

		for (let index = 0; index < REACTIONS_PER_CYCLE; index++) {
			events.push({ timestamp: Math.random() * duration, execute: react });
		}

		events.sort((a, b) => a.timestamp - b.timestamp);

		return { events, duration };
	};

	const timeline = createAnimationTimeline(buildCycle, 20_000, {
		loop: true,
		onLoop: () => {
			setTyping(null);
			timeline.invalidateCache();
		},
	});

	onMount(() => timeline.start());

	const hasSubsequent = (index: number) => {
		const list = messages();
		return index + 1 < list.length && isGroupedAt(index + 1);
	};

	const isGroupedAt = (index: number) => {
		if (index === 0) return false;
		const list = messages();
		const current = list[index];
		const previous = list[index - 1];
		if (!current || !previous) return false;
		if (current.parent) return false;
		if (previous.speaker !== current.speaker) return false;
		return (
			new Date(current.createdAt).getTime() -
				new Date(previous.createdAt).getTime() <
			5 * 60_000
		);
	};

	const isGrouped = (index: number) => isGroupedAt(index);

	return (
		<div class="flex h-full w-full flex-col overflow-hidden select-none">
			<div class="sticky top-0 left-0 flex h-12 w-full shrink-0 flex-row items-center border-b border-border bg-background p-2">
				<div class="flex min-w-0 flex-1 flex-row items-center gap-2 pl-1">
					<ChatCircleDotsIcon
						class="shrink-0 text-muted-foreground"
						width={20}
						height={20}
					/>
					<span class="min-w-0 truncate">Bird Talk</span>
					<span class="shrink-0 text-muted-foreground">—</span>
					<span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
						You wing some, you lose some
					</span>
				</div>
			</div>

			<div class="flex min-h-0 flex-1 flex-col justify-end overflow-hidden pb-2">
				<For each={messages()}>
					{(message, index) => (
						<div
							class="group relative flex h-fit w-full flex-col gap-1 border-l-2 border-transparent pr-4 pl-3.5 duration-300 hover:bg-card/50 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
							classList={{
								"pt-1": !isGrouped(index()),
								"pt-0": isGrouped(index()),
								"pb-2": message.reactions.length > 0,
								"pb-0.5":
									message.reactions.length === 0 && hasSubsequent(index()),
							}}
						>
							<Show when={message.parent}>
								{(parent) => (
									<div class="flex w-full max-w-full flex-row gap-4">
										<button
											type="button"
											disabled
											class="before:w-8 before:block before:h-2 before:border-t before:border-l before:border-muted-foreground/50 before:rounded-tl-sm w-10 h-4 relative before:absolute before:translate-y-0.75 before:left-5.5 before:transform before:-translate-x-1 cursor-default"
										/>
										<div class="flex w-full max-w-[calc(100%-4rem)] flex-row items-center gap-2">
											<User.Avatar
												disableState
												size="small"
												user={parent().speaker.actor}
												overrideSrc={parent().speaker.avatar}
											/>
											<strong class="block text-xs">
												{parent().speaker.actor.data.displayName}
											</strong>
											<span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs">
												{parent().text}
											</span>
										</div>
									</div>
								)}
							</Show>
							<div class="flex flex-row gap-4">
								<Show
									when={!isGrouped(index())}
									fallback={
										<div class="flex h-8 min-h-8 w-10 min-w-10 items-center justify-center text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
											<span class="whitespace-nowrap">
												{new Date(message.createdAt).toLocaleTimeString(
													undefined,
													{ hour: "2-digit", minute: "2-digit" },
												)}
											</span>
										</div>
									}
								>
									<div class="h-10 w-10 rounded-full pt-0.5">
										<User.Avatar
											disableState
											user={message.speaker.actor}
											overrideSrc={message.speaker.avatar}
										/>
									</div>
								</Show>
								<div class="flex w-full min-w-0 flex-col justify-center">
									<Show when={!isGrouped(index())}>
										<div class="flex flex-wrap items-baseline gap-2 text-sm">
											<span class="font-bold">
												{message.speaker.actor.data.displayName}
											</span>
											<small class="text-muted-foreground">
												<MessageTimestamp datetime={message.createdAt} />
											</small>
										</div>
									</Show>
									<div
										class="rich-text emoji-readonly m-0 min-w-0 leading-7 text-foreground [overflow-wrap:anywhere]"
										innerHTML={message.html}
									/>
								</div>
							</div>
							<Show when={message.reactions.length > 0}>
								<div class="flex flex-row flex-wrap items-center gap-1 pl-14">
									<For each={message.reactions}>
										{(reaction) => (
											<span class="flex cursor-default items-center gap-1 rounded-sm border border-border bg-card px-1.5 py-1 duration-200 animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none">
												<span
													class="flex h-4 w-4 items-center justify-center"
													innerHTML={parseEmojiText(reaction.emoji)}
												/>
												<span class="text-sm text-muted-foreground">
													{reaction.count}
												</span>
											</span>
										)}
									</For>
								</div>
							</Show>
						</div>
					)}
				</For>

				<div class="flex h-6 shrink-0 items-center gap-2 pr-4 pl-3.5 text-xs text-muted-foreground">
					<Show when={typing()}>
						{(speaker) => (
							<>
								<span class="flex w-10 min-w-10 justify-center gap-1">
									<span class="size-1 animate-pulse rounded-full bg-current" />
									<span class="size-1 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
									<span class="size-1 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
								</span>
								<span class="truncate">
									{typingLabel(speaker().actor.data.displayName)}
								</span>
							</>
						)}
					</Show>
				</div>
			</div>
		</div>
	);
};
