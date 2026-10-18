import {
	type Accessor,
	batch,
	createMemo,
	createSignal,
	For,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { expect, waitFor } from "storybook/test";
import { Button } from "../Button/Button";
import type { ChatPlatform } from "./layout";
import {
	MessageList,
	type MessageListHandle,
	type MessageListProps,
} from "./MessageList";
import { MessageRow } from "./MessageRow";
import {
	createListMessage,
	createListMessages,
	type ListFixtureMessage,
	listFixtureAuthors,
} from "./message-list-fixtures";
import type { MessageListEntry } from "./message-list-model";

export const iphone = { viewport: { defaultViewport: "iphone" } };

export const ALL = createListMessages(10_000);
export const LAST_TIME = (ALL[ALL.length - 1]?.timestamp as Date).getTime();
export const NOW = new Date(LAST_TIME + 3_600_000);

export const DelayedImage = (props: {
	width: number;
	height: number;
	delay: number;
}) => {
	const [loaded, setLoaded] = createSignal(false);
	onMount(() => {
		const timer = setTimeout(() => setLoaded(true), props.delay);
		onCleanup(() => clearTimeout(timer));
	});
	return (
		<div
			data-fixture-image=""
			class="max-w-full rounded-control bg-muted"
			style={{
				width: `${props.width}px`,
				height: loaded() ? `${props.height}px` : "0px",
			}}
		/>
	);
};

export const Reactions = (props: { count: number }) => (
	<div class="flex gap-1">
		<For each={Array.from({ length: props.count }, (_, index) => index)}>
			{(index) => (
				<span class="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-secondary px-2 text-xs text-foreground">
					<span aria-hidden="true">{["🐦", "🦆", "🌿"][index]}</span>
					{index + 1}
				</span>
			)}
		</For>
	</div>
);

export const FixtureRow = (props: {
	entry: Accessor<MessageListEntry<ListFixtureMessage>>;
	platform: ChatPlatform;
	onReplyClick?: (id: string) => void;
}) => {
	const message = () => props.entry().message;
	const replyTarget = () => {
		const index = Number(message().id.slice(1));
		return `m${Math.max(0, index - 40)}`;
	};
	return (
		<MessageRow
			author={{ name: message().name, color: message().color }}
			timestamp={message().timestamp}
			now={NOW}
			locale="en-GB"
			continuation={props.entry().continuation}
			edited={message().edited}
			platform={props.platform}
			reply={
				message().reply
					? {
							author: { name: "Kris" },
							text: "An earlier message about the herons",
							onClick: () => props.onReplyClick?.(replyTarget()),
						}
					: undefined
			}
			attachments={
				message().image ? (
					<DelayedImage
						width={message().image?.width ?? 0}
						height={message().image?.height ?? 0}
						delay={message().image?.delay ?? 0}
					/>
				) : undefined
			}
			reactions={
				message().reactions ? (
					<Reactions count={message().reactions ?? 0} />
				) : undefined
			}
		>
			{message().text}
		</MessageRow>
	);
};

export type ChannelOptions = {
	source?: ListFixtureMessage[];
	initial?: number;
	page?: number;
	delay?: number;
	paging?: boolean;
};

export const createChannel = (options: ChannelOptions = {}) => {
	const source = [...(options.source ?? ALL)];
	const page = options.page ?? 100;
	const delay = options.delay ?? 350;
	const initial = options.initial ?? 120;
	const [all, setAll] = createSignal(source);
	const [start, setStart] = createSignal(
		options.paging === false ? 0 : Math.max(0, source.length - initial),
	);
	const [end, setEnd] = createSignal(source.length);
	const [loadingOlder, setLoadingOlder] = createSignal(false);
	const [loadingNewer, setLoadingNewer] = createSignal(false);
	const messages = createMemo(() => all().slice(start(), end()));
	const hasOlder = () => start() > 0;
	const hasNewer = () => end() < all().length;
	const loadOlder = () => {
		if (loadingOlder() || !hasOlder()) return;
		setLoadingOlder(true);
		setTimeout(() => {
			setStart((value) => Math.max(0, value - page));
			setLoadingOlder(false);
		}, delay);
	};
	const loadNewer = () => {
		if (loadingNewer() || !hasNewer()) return;
		setLoadingNewer(true);
		setTimeout(() => {
			setEnd((value) => Math.min(all().length, value + page));
			setLoadingNewer(false);
		}, delay);
	};
	const openAround = (index: number) =>
		batch(() => {
			setStart(Math.max(0, index - 50));
			setEnd(Math.min(all().length, index + 50));
		});
	const openLatest = () =>
		batch(() => {
			setStart(Math.max(0, all().length - initial));
			setEnd(all().length);
		});
	let counter = 0;
	const receive = (authorIndex = 1) => {
		counter++;
		const atPresent = !hasNewer();
		const last = all()[all().length - 1];
		const time = new Date(
			((last?.timestamp as Date | undefined)?.getTime() ?? LAST_TIME) + 30_000,
		);
		const message = createListMessage(
			`live${counter}`,
			`Fresh message number ${counter}`,
			time,
			listFixtureAuthors[authorIndex],
		);
		const nextLength = all().length + 1;
		batch(() => {
			setAll((list) => [...list, message]);
			if (atPresent) setEnd(nextLength);
		});
		return message;
	};
	return {
		messages,
		hasOlder,
		hasNewer,
		loadingOlder,
		loadingNewer,
		loadOlder,
		loadNewer,
		openAround,
		openLatest,
		receive,
		all,
	};
};

export type ChannelModel = ReturnType<typeof createChannel>;

export const ChannelView = (props: {
	channel: ChannelModel;
	platform?: ChatPlatform;
	toolbar?: (handle: () => MessageListHandle | undefined) => JSX.Element;
	listProps?: Partial<MessageListProps<ListFixtureMessage>>;
	height?: string;
}) => {
	let handle: MessageListHandle | undefined;
	const platform = () => props.platform ?? "desktop";
	return (
		<div
			class="flex flex-col bg-background text-foreground"
			style={{ height: props.height ?? "100dvh" }}
			data-story-root=""
			data-loaded={props.channel.messages().length}
		>
			<Show when={props.toolbar}>
				<div class="flex flex-wrap gap-2 border-b border-border p-2">
					{props.toolbar?.(() => handle)}
				</div>
			</Show>
			<MessageList
				label="Messages in general"
				platform={platform()}
				messages={props.channel.messages()}
				getKey={(message) => message.id}
				now={NOW}
				locale="en-GB"
				hasOlder={props.channel.hasOlder()}
				loadingOlder={props.channel.loadingOlder()}
				onLoadOlder={props.channel.loadOlder}
				hasNewer={props.channel.hasNewer()}
				loadingNewer={props.channel.loadingNewer()}
				onLoadNewer={props.channel.loadNewer}
				onJumpToLatest={() => {
					props.channel.openLatest();
				}}
				header={
					<div class="px-4 pt-6 pb-2 text-sm text-muted-foreground">
						This is the start of #general.
					</div>
				}
				ref={(value) => {
					handle = value;
				}}
				{...props.listProps}
			>
				{(entry) => (
					<FixtureRow
						entry={entry}
						platform={platform()}
						onReplyClick={(id) => handle?.jumpTo(id)}
					/>
				)}
			</MessageList>
		</div>
	);
};

export const frames = (count = 2) =>
	new Promise<void>((resolve) => {
		const step = (left: number) => {
			if (left <= 0) {
				resolve();
				return;
			}
			requestAnimationFrame(() => step(left - 1));
		};
		step(count);
	});

export const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

export const scrollerOf = (canvas: HTMLElement) =>
	canvas.querySelector<HTMLElement>(
		"[data-message-list-scroller]",
	) as HTMLElement;

export const distanceOf = (scroller: HTMLElement) =>
	scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;

export const articlesOf = (canvas: HTMLElement) =>
	Array.from(canvas.querySelectorAll<HTMLElement>("article[data-message-key]"));

export const visibleArticle = (canvas: HTMLElement) => {
	const scroller = scrollerOf(canvas);
	const box = scroller.getBoundingClientRect();
	return articlesOf(canvas)
		.filter((article) => {
			const rect = article.getBoundingClientRect();
			return (
				rect.height > 0 &&
				rect.top >= box.top + 20 &&
				rect.bottom <= box.bottom - 20
			);
		})
		.sort(
			(a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
		)[0];
};

export const topWithin = (element: HTMLElement, scroller: HTMLElement) =>
	element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;

export const inView = (element: HTMLElement, scroller: HTMLElement) => {
	const rect = element.getBoundingClientRect();
	const box = scroller.getBoundingClientRect();
	return rect.bottom > box.top && rect.top < box.bottom;
};

export const settled = async (canvas: HTMLElement) => {
	await waitFor(
		() => {
			const content = canvas.querySelector<HTMLElement>(
				"[data-message-list-content]",
			);
			expect(content?.style.opacity).toBe("");
		},
		{ timeout: 3000 },
	);
	await frames(3);
};

export const scrollTo = async (scroller: HTMLElement, top: number) => {
	scroller.scrollTop = top;
	await frames(3);
};

export const receiveButton = (channel: ChannelModel) => (
	<Button variant="secondary" onClick={() => channel.receive()}>
		Receive message
	</Button>
);
