import { createSignal, Show } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../Button/Button";
import { MessageList, type MessageListHandle } from "./MessageList";
import { MessageRow } from "./MessageRow";
import {
	createListMessage,
	createListMessages,
	type ListFixtureMessage,
} from "./message-list-fixtures";
import {
	articlesOf,
	ChannelView,
	createChannel,
	distanceOf,
	FixtureRow,
	frames,
	inView,
	iphone,
	receiveButton,
	scrollerOf,
	scrollTo,
	settled,
	sleep,
	topWithin,
	visibleArticle,
} from "./message-list-story-kit";

const meta = {
	title: "Messaging/Message list",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Channel: Story = {
	render: () => {
		const channel = createChannel();
		return (
			<ChannelView
				channel={channel}
				toolbar={(handle) => (
					<>
						{receiveButton(channel)}
						<Button
							variant="secondary"
							onClick={() => {
								channel.receive(0);
								handle()?.scrollToBottom();
							}}
						>
							Send message
						</Button>
						<Button
							variant="secondary"
							onClick={() => {
								channel.openAround(5000);
								handle()?.jumpTo("m5000");
							}}
						>
							Jump to message 5000
						</Button>
					</>
				)}
			/>
		);
	},
};

export const ChannelMobile: Story = {
	parameters: iphone,
	render: () => {
		const channel = createChannel();
		return (
			<ChannelView
				channel={channel}
				platform="mobile"
				toolbar={() => receiveButton(channel)}
			/>
		);
	},
};

export const BoundedDom: Story = {
	render: () => {
		const channel = createChannel({ paging: false });
		return <ChannelView channel={channel} height="800px" />;
	},
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);
		await expect(distanceOf(scroller)).toBeLessThanOrEqual(1);
		await expect(articlesOf(canvasElement).length).toBeLessThan(120);
		const feed = canvasElement.querySelector("[role='feed']") as HTMLElement;
		await expect(feed).toHaveAccessibleName("Messages in general");
		const last = articlesOf(canvasElement).at(-1) as HTMLElement;
		await expect(last).toHaveAttribute("aria-setsize", "10000");
		await expect(last).toHaveAttribute("aria-posinset", "10000");
		await expect(last).toHaveAttribute("tabindex", "0");

		await scrollTo(scroller, scroller.scrollHeight / 2);
		await waitFor(() => expect(visibleArticle(canvasElement)).toBeDefined());
		await expect(articlesOf(canvasElement).length).toBeLessThan(120);
		const middle = visibleArticle(canvasElement) as HTMLElement;
		const position = Number(middle.getAttribute("aria-posinset"));
		await expect(position).toBeGreaterThan(1000);
		await expect(position).toBeLessThan(9000);

		await scrollTo(scroller, 0);
		await waitFor(() =>
			expect(
				canvasElement.querySelector("[data-message-key='m0']"),
			).not.toBeNull(),
		);
		await expect(articlesOf(canvasElement).length).toBeLessThan(120);
	},
};

export const PinnedOnAppend: Story = {
	render: () => {
		const channel = createChannel({ source: createListMessages(300) });
		return (
			<ChannelView
				channel={channel}
				height="700px"
				toolbar={() => receiveButton(channel)}
			/>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);
		const receive = canvas.getByRole("button", { name: "Receive message" });

		await step("Stays pinned while at the bottom", async () => {
			await expect(distanceOf(scroller)).toBeLessThanOrEqual(1);
			for (let index = 0; index < 3; index++) {
				await userEvent.click(receive);
				await frames(2);
			}
			await waitFor(() => {
				expect(
					canvasElement.querySelector("[data-message-key='live3']"),
				).not.toBeNull();
				expect(distanceOf(scroller)).toBeLessThanOrEqual(1);
			});
			const last = canvasElement.querySelector(
				"[data-message-key='live3']",
			) as HTMLElement;
			await expect(inView(last, scroller)).toBe(true);
		});

		await step(
			"Holds position and counts unseen when scrolled up",
			async () => {
				await scrollTo(scroller, scroller.scrollTop - 600);
				const before = scroller.scrollTop;
				await userEvent.click(receive);
				await frames(4);
				await expect(Math.abs(scroller.scrollTop - before)).toBeLessThanOrEqual(
					1,
				);
				const jump = await waitFor(() => {
					const button = canvas.getByRole("button", {
						name: "Jump to bottom",
					});
					expect(button).toHaveAccessibleDescription("1 new message");
					return button;
				});
				await userEvent.click(receive);
				await waitFor(() =>
					expect(jump).toHaveAccessibleDescription("2 new messages"),
				);
				await userEvent.click(jump);
				await waitFor(
					() => expect(distanceOf(scroller)).toBeLessThanOrEqual(1),
					{ timeout: 3000 },
				);
				await waitFor(() =>
					expect(
						canvasElement.querySelector("[data-message-list-jump]"),
					).not.toHaveAttribute("data-visible"),
				);
			},
		);
	},
};

export const PrependKeepsPosition: Story = {
	render: () => {
		const channel = createChannel();
		return <ChannelView channel={channel} height="700px" />;
	},
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		const root = canvasElement.querySelector(
			"[data-story-root]",
		) as HTMLElement;
		const scroller = scrollerOf(canvasElement);
		await expect(root.dataset.loaded).toBe("120");
		const skeleton = canvasElement.querySelector(
			"[data-message-list-skeleton='top']",
		) as HTMLElement;
		await expect(skeleton).not.toBeNull();
		const feed = canvasElement.querySelector("[role='feed']") as HTMLElement;
		await scrollTo(scroller, feed.offsetTop + 150);
		const anchor = visibleArticle(canvasElement) as HTMLElement;
		const key = anchor.dataset.messageKey;
		const position = Number(anchor.getAttribute("aria-posinset"));
		const before = topWithin(anchor, scroller);
		await waitFor(() => expect(root.dataset.loaded).toBe("220"), {
			timeout: 3000,
		});
		await frames(4);
		const after = canvasElement.querySelector(
			`[data-message-key='${key}']`,
		) as HTMLElement;
		await expect(after).toBe(anchor);
		await expect(Math.abs(topWithin(after, scroller) - before)).toBeLessThan(1);
		await expect(after).toHaveAttribute(
			"aria-posinset",
			String(position + 100),
		);
	},
};

export const ResizeAboveKeepsPosition: Story = {
	render: () => {
		const channel = createChannel({
			source: createListMessages(400, { images: false }),
			paging: false,
		});
		return <ChannelView channel={channel} height="700px" />;
	},
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);
		await scrollTo(scroller, scroller.scrollHeight / 2);
		const anchor = visibleArticle(canvasElement) as HTMLElement;
		const before = topWithin(anchor, scroller);
		const box = scroller.getBoundingClientRect();
		const above = articlesOf(canvasElement).find(
			(article) => article.getBoundingClientRect().bottom < box.top - 4,
		) as HTMLElement;
		await expect(above).toBeDefined();
		const growth = document.createElement("div");
		growth.style.height = "180px";
		above.append(growth);
		await frames(4);
		await expect(Math.abs(topWithin(anchor, scroller) - before)).toBeLessThan(
			1,
		);
		growth.style.height = "20px";
		await frames(4);
		await expect(Math.abs(topWithin(anchor, scroller) - before)).toBeLessThan(
			1,
		);
	},
};

export const GrowsWhilePinned: Story = {
	render: () => {
		const channel = createChannel({
			source: createListMessages(200, { images: false }),
			paging: false,
		});
		return <ChannelView channel={channel} height="600px" />;
	},
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);
		const last = articlesOf(canvasElement).at(-1) as HTMLElement;
		const growth = document.createElement("div");
		growth.style.height = "240px";
		last.append(growth);
		await frames(3);
		await expect(distanceOf(scroller)).toBeLessThanOrEqual(1);
	},
};

export const ImagesLoadWhilePinned: Story = {
	render: () => {
		const channel = createChannel({
			source: createListMessages(150, { seed: 11 }),
			paging: false,
		});
		return <ChannelView channel={channel} height="700px" />;
	},
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);
		await sleep(800);
		await frames(2);
		await expect(distanceOf(scroller)).toBeLessThanOrEqual(1);
	},
};

export const JumpToMessage: Story = {
	render: () => {
		const channel = createChannel({ paging: false });
		return (
			<ChannelView
				channel={channel}
				height="700px"
				toolbar={(handle) => (
					<Button variant="secondary" onClick={() => handle()?.jumpTo("m1234")}>
						Jump to message 1234
					</Button>
				)}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Jump to message 1234" }),
		);
		const target = await waitFor(
			() => {
				const element = canvasElement.querySelector(
					"[data-message-key='m1234']",
				) as HTMLElement;
				expect(element).not.toBeNull();
				expect(inView(element, scroller)).toBe(true);
				expect(element).toHaveAttribute("data-highlight", "jumped");
				return element;
			},
			{ timeout: 3000 },
		);
		const rect = target.getBoundingClientRect();
		const box = scroller.getBoundingClientRect();
		await expect(rect.top).toBeGreaterThanOrEqual(box.top);
		await expect(rect.bottom).toBeLessThanOrEqual(box.bottom);
		await expect(target).toHaveAttribute("tabindex", "0");
		await expect(
			canvasElement.querySelector("[data-message-list-jump]"),
		).toHaveAttribute("data-visible");
	},
};

export const JumpIntoHistory: Story = {
	render: () => {
		const channel = createChannel();
		return (
			<ChannelView
				channel={channel}
				height="700px"
				toolbar={(handle) => (
					<Button
						variant="secondary"
						onClick={() => {
							channel.openAround(5000);
							handle()?.jumpTo("m5000");
						}}
					>
						Jump to message 5000
					</Button>
				)}
			/>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);

		await step("Opens a window around the target", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: "Jump to message 5000" }),
			);
			await waitFor(
				() => {
					const target = canvasElement.querySelector(
						"[data-message-key='m5000']",
					) as HTMLElement;
					expect(target).not.toBeNull();
					expect(inView(target, scroller)).toBe(true);
					expect(target).toHaveAttribute("data-highlight", "jumped");
				},
				{ timeout: 3000 },
			);
			await expect(
				canvasElement.querySelector("[data-message-list-skeleton='bottom']"),
			).not.toBeNull();
			await waitFor(() =>
				expect(
					canvas.getByRole("button", { name: "Jump to present" }),
				).toBeVisible(),
			);
		});

		await step("Returns to the present", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: "Jump to present" }),
			);
			await waitFor(
				() => {
					const last = canvasElement.querySelector(
						"[data-message-key='m9999']",
					) as HTMLElement;
					expect(last).not.toBeNull();
					expect(inView(last, scroller)).toBe(true);
					expect(distanceOf(scroller)).toBeLessThanOrEqual(1);
				},
				{ timeout: 3000 },
			);
		});
	},
};

export const FocusSurvivesScroll: Story = {
	render: () => {
		const channel = createChannel({
			source: createListMessages(2000, { images: false }),
			paging: false,
		});
		return <ChannelView channel={channel} height="700px" />;
	},
	play: async ({ canvasElement, step }) => {
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);
		const last = articlesOf(canvasElement).at(-1) as HTMLElement;

		await step("Arrow keys move between messages", async () => {
			last.focus();
			await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
			const focused = document.activeElement as HTMLElement;
			await expect(focused).toHaveAttribute("aria-posinset", "1997");
			await expect(focused).toHaveAttribute("tabindex", "0");
			await expect(last).toHaveAttribute("tabindex", "-1");
		});

		await step("Focus survives scrolling the row out", async () => {
			const focused = document.activeElement as HTMLElement;
			await scrollTo(scroller, 0);
			await waitFor(() =>
				expect(
					canvasElement.querySelector("[data-message-key='m0']"),
				).not.toBeNull(),
			);
			await frames(4);
			await expect(document.activeElement).toBe(focused);
			await expect(focused.isConnected).toBe(true);
			await expect(inView(focused, scroller)).toBe(false);
		});

		await step("The next arrow brings the next message into view", async () => {
			await userEvent.keyboard("{ArrowDown}");
			await frames(4);
			const next = document.activeElement as HTMLElement;
			await expect(next).toHaveAttribute("aria-posinset", "1998");
			await waitFor(() => expect(inView(next, scroller)).toBe(true));
		});

		await step("Home and End reach both ends", async () => {
			await userEvent.keyboard("{Home}");
			await waitFor(() =>
				expect(document.activeElement).toHaveAttribute("aria-posinset", "1"),
			);
			await userEvent.keyboard("{End}");
			await waitFor(() =>
				expect(document.activeElement).toHaveAttribute("aria-posinset", "2000"),
			);
			await waitFor(() =>
				expect(inView(document.activeElement as HTMLElement, scroller)).toBe(
					true,
				),
			);
		});
	},
};

export const KeyboardInset: Story = {
	parameters: iphone,
	render: () => {
		const [inset, setInset] = createSignal(0);
		const channel = createChannel({
			source: createListMessages(300, { images: false }),
			paging: false,
		});
		return (
			<div class="flex h-[874px] flex-col bg-background">
				<div class="flex gap-2 p-2">
					<Button variant="secondary" onClick={() => setInset(320)}>
						Open keyboard
					</Button>
					<Button variant="secondary" onClick={() => setInset(0)}>
						Close keyboard
					</Button>
				</div>
				<div
					class="flex min-h-0 flex-col"
					style={{ height: `calc(100% - 52px - ${inset()}px)` }}
				>
					<ChannelView channel={channel} platform="mobile" height="100%" />
				</div>
			</div>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);

		await step("Pinned content follows the keyboard", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: "Open keyboard" }),
			);
			await frames(3);
			await expect(distanceOf(scroller)).toBeLessThanOrEqual(1);
			await userEvent.click(
				canvas.getByRole("button", { name: "Close keyboard" }),
			);
			await frames(3);
			await expect(distanceOf(scroller)).toBeLessThanOrEqual(1);
		});

		await step("Scrolled content keeps its bottom edge", async () => {
			await scrollTo(scroller, scroller.scrollTop - 500);
			const before = distanceOf(scroller);
			await userEvent.click(
				canvas.getByRole("button", { name: "Open keyboard" }),
			);
			await frames(3);
			await expect(Math.abs(distanceOf(scroller) - before)).toBeLessThanOrEqual(
				1,
			);
		});
	},
};

export const LoadingStates: Story = {
	render: () => (
		<div class="grid h-dvh grid-cols-2 gap-4 bg-background p-4 text-foreground">
			<div
				class="flex min-h-0 flex-col border border-border"
				data-case="initial"
			>
				<MessageList
					label="Loading messages"
					messages={[]}
					getKey={(message: ListFixtureMessage) => message.id}
					hasOlder
					loadingOlder
				>
					{(entry) => <FixtureRow entry={entry} platform="desktop" />}
				</MessageList>
			</div>
			<div
				class="flex min-h-0 flex-col border border-border"
				data-case="history"
			>
				<MessageList
					label="Older messages"
					messages={createListMessages(30, { images: false })}
					getKey={(message) => message.id}
					hasOlder
					hasNewer
				>
					{(entry) => <FixtureRow entry={entry} platform="desktop" />}
				</MessageList>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const initial = canvasElement.querySelector(
			"[data-case='initial']",
		) as HTMLElement;
		await expect(initial.querySelector("[role='feed']")).toHaveAttribute(
			"aria-busy",
			"true",
		);
		await expect(
			initial.querySelectorAll("[data-message-skeleton]").length,
		).toBeGreaterThan(6);
		const history = canvasElement.querySelector(
			"[data-case='history']",
		) as HTMLElement;
		await expect(
			history.querySelector("[data-message-list-skeleton='top']"),
		).not.toBeNull();
		await expect(
			history.querySelector("[data-message-list-skeleton='bottom']"),
		).not.toBeNull();
		await expect(
			within(history).getByRole("button", { name: "Jump to present" }),
		).toBeInTheDocument();
		const article = history.querySelector("article") as HTMLElement;
		await expect(article).toHaveAttribute("aria-setsize", "-1");
	},
};

const DIVIDER_NOW = new Date(2026, 9, 7, 12, 0);
const dividerMessages = [
	createListMessage("a", "Two days ago", new Date(2026, 9, 5, 9, 0)),
	createListMessage("b", "Yesterday morning", new Date(2026, 9, 6, 9, 0)),
	createListMessage("c", "Still yesterday", new Date(2026, 9, 6, 9, 1)),
	createListMessage("d", "Today first", new Date(2026, 9, 7, 9, 0)),
	createListMessage("e", "Today second", new Date(2026, 9, 7, 9, 1)),
	createListMessage("f", "Today third", new Date(2026, 9, 7, 9, 2)),
];

export const Dividers: Story = {
	render: () => (
		<div class="flex h-dvh flex-col bg-background text-foreground">
			<MessageList
				label="Messages in general"
				messages={dividerMessages}
				getKey={(message) => message.id}
				unreadAfter="e"
				now={DIVIDER_NOW}
				locale="en-GB"
			>
				{(entry) => (
					<MessageRow
						author={{ name: entry().message.name }}
						timestamp={entry().message.timestamp}
						now={DIVIDER_NOW}
						locale="en-GB"
						continuation={entry().continuation}
					>
						{entry().message.text}
					</MessageRow>
				)}
			</MessageList>
		</div>
	),
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		const labels = Array.from(
			canvasElement.querySelectorAll("[data-day-divider]"),
		).map((divider) => divider.textContent);
		await expect(labels).toEqual(["Yesterday", "Today"]);
		const unread = canvasElement.querySelector(
			"[data-new-messages]",
		) as HTMLElement;
		const item = unread.closest("[data-message-list-item]") as HTMLElement;
		const article = item.querySelector("article") as HTMLElement;
		await expect(article).toHaveAttribute("data-message-key", "f");
		await expect(article).not.toHaveAttribute("data-continuation");
		const previous = canvasElement.querySelector(
			"[data-message-key='e']",
		) as HTMLElement;
		await expect(previous).toHaveAttribute("data-continuation");
	},
};

export const JumpWaitsForOlderPage: Story = {
	render: () => {
		const channel = createChannel();
		return (
			<ChannelView
				channel={channel}
				height="700px"
				toolbar={(handle) => (
					<Button
						variant="secondary"
						onClick={() => {
							handle()?.jumpTo("m9820");
							channel.loadOlder();
						}}
					>
						Jump to an unloaded reply
					</Button>
				)}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);
		await expect(
			canvasElement.querySelector("[data-message-key='m9820']"),
		).toBeNull();
		await userEvent.click(
			canvas.getByRole("button", { name: "Jump to an unloaded reply" }),
		);
		await waitFor(
			() => {
				const target = canvasElement.querySelector(
					"[data-message-key='m9820']",
				) as HTMLElement;
				expect(target).not.toBeNull();
				expect(inView(target, scroller)).toBe(true);
				expect(target).toHaveAttribute("data-highlight", "jumped");
			},
			{ timeout: 3000 },
		);
	},
};

export const ReachingStartKeepsPosition: Story = {
	render: () => {
		const channel = createChannel({
			source: createListMessages(260, { images: false }),
			page: 200,
		});
		return <ChannelView channel={channel} height="700px" />;
	},
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		const root = canvasElement.querySelector(
			"[data-story-root]",
		) as HTMLElement;
		const scroller = scrollerOf(canvasElement);
		const feed = canvasElement.querySelector("[role='feed']") as HTMLElement;
		await scrollTo(scroller, feed.offsetTop + 120);
		const anchor = visibleArticle(canvasElement) as HTMLElement;
		const before = topWithin(anchor, scroller);
		await waitFor(() => expect(root.dataset.loaded).toBe("260"), {
			timeout: 3000,
		});
		await frames(4);
		await expect(
			canvasElement.querySelector("[data-message-list-skeleton='top']"),
		).toBeNull();
		await expect(
			within(canvasElement).getByText("This is the start of #general."),
		).toBeInTheDocument();
		await expect(anchor.isConnected).toBe(true);
		await expect(Math.abs(topWithin(anchor, scroller) - before)).toBeLessThan(
			1,
		);
	},
};

const pillOf = (canvas: HTMLElement) =>
	canvas.querySelector<HTMLElement>("[data-message-list-jump]") as HTMLElement;

export const JumpCardMotion: Story = {
	render: () => {
		const channel = createChannel();
		return <ChannelView channel={channel} height="700px" />;
	},
	play: async ({ canvasElement, step }) => {
		await settled(canvasElement);
		const jump = pillOf(canvasElement);
		const root = document.documentElement;
		await step("Hidden pills exit blurred and shifted", async () => {
			await waitFor(() => {
				expect(getComputedStyle(jump).transitionDuration).toBe("0.15s");
				expect(getComputedStyle(jump).filter).toBe("blur(4px)");
			});
			await expect(getComputedStyle(jump).opacity).toBe("0");
		});
		await step("Reduced motion drops the transition", async () => {
			const previous = root.dataset.reducedMotion;
			root.dataset.reducedMotion = "true";
			try {
				await expect(getComputedStyle(jump).transitionProperty).toBe("none");
			} finally {
				if (previous === undefined) delete root.dataset.reducedMotion;
				else root.dataset.reducedMotion = previous;
			}
		});
	},
};

export const AnnouncesWhilePinned: Story = {
	render: () => {
		const channel = createChannel({
			source: createListMessages(200, { images: false }),
		});
		return (
			<ChannelView
				channel={channel}
				height="700px"
				toolbar={() => (
					<>
						<Button variant="secondary" onClick={() => channel.receive(1)}>
							Receive message
						</Button>
						<Button variant="secondary" onClick={() => channel.receive(0)}>
							Send message
						</Button>
					</>
				)}
				listProps={{
					isOwnMessage: (message) => message.author === "did:plc:lou",
					getAuthorName: (message) => message.name,
				}}
			/>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		await settled(canvasElement);
		const status = canvasElement.querySelector(
			"[data-message-list-announcer]",
		) as HTMLElement;
		await expect(status).toHaveAttribute("role", "status");
		const receive = canvas.getByRole("button", { name: "Receive message" });
		const send = canvas.getByRole("button", { name: "Send message" });

		await step("Announces the first arrival right away", async () => {
			await userEvent.click(receive);
			await waitFor(() =>
				expect(status).toHaveTextContent("New message from Kris"),
			);
		});

		await step("Batches arrivals inside the throttle window", async () => {
			await userEvent.click(receive);
			await userEvent.click(send);
			await userEvent.click(receive);
			await sleep(400);
			await expect(status).toHaveTextContent("New message from Kris");
			await waitFor(
				() => expect(status).toHaveTextContent("2 new messages from Kris"),
				{ timeout: 4000 },
			);
		});

		await step("Stays quiet for own sends and when scrolled up", async () => {
			await sleep(3200);
			await userEvent.click(send);
			await sleep(300);
			await expect(status).toHaveTextContent("2 new messages from Kris");
			const scroller = scrollerOf(canvasElement);
			await scrollTo(scroller, scroller.scrollTop - 600);
			await userEvent.click(receive);
			await sleep(300);
			await expect(status).toHaveTextContent("2 new messages from Kris");
		});
	},
};

const dividerOf = (canvas: HTMLElement) =>
	canvas.querySelector<HTMLElement>("[data-new-messages]") as HTMLElement;

export const OpensAtUnread: Story = {
	render: () => {
		const channel = createChannel();
		return (
			<ChannelView
				channel={channel}
				height="700px"
				toolbar={() => receiveButton(channel)}
				listProps={{
					unreadAfter: "m9950",
					getAuthorName: (message) => message.name,
				}}
			/>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);

		await step("The divider sits near the top with context above", async () => {
			await waitFor(() => {
				const divider = dividerOf(canvasElement);
				expect(divider).not.toBeNull();
				const top = topWithin(divider, scroller);
				expect(top).toBeGreaterThanOrEqual(40);
				expect(top).toBeLessThanOrEqual(130);
			});
			await expect(distanceOf(scroller)).toBeGreaterThan(200);
			const first = canvasElement.querySelector(
				"[data-message-key='m9951']",
			) as HTMLElement;
			await expect(first).not.toHaveAttribute("data-highlight");
			await waitFor(() =>
				expect(
					canvas.getByRole("button", { name: "Jump to bottom" }),
				).toBeVisible(),
			);
		});

		await step("Arrivals count on the jump button and stay quiet", async () => {
			const divider = dividerOf(canvasElement);
			const before = topWithin(divider, scroller);
			await userEvent.click(
				canvas.getByRole("button", { name: "Receive message" }),
			);
			await frames(4);
			await expect(
				Math.abs(topWithin(divider, scroller) - before),
			).toBeLessThan(1);
			await waitFor(() =>
				expect(
					canvas.getByRole("button", { name: "Jump to bottom" }),
				).toHaveAccessibleDescription("1 new message"),
			);
			const status = canvasElement.querySelector(
				"[data-message-list-announcer]",
			) as HTMLElement;
			await expect(status).toHaveTextContent("");
		});

		await step("Jumping reaches the bottom and pins", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: "Jump to bottom" }),
			);
			await waitFor(() => expect(distanceOf(scroller)).toBeLessThanOrEqual(1), {
				timeout: 3000,
			});
			await userEvent.click(
				canvas.getByRole("button", { name: "Receive message" }),
			);
			await waitFor(() => expect(distanceOf(scroller)).toBeLessThanOrEqual(1));
		});
	},
};

export const OpensAtUnloadedUnread: Story = {
	render: () => {
		const channel = createChannel();
		return (
			<ChannelView
				channel={channel}
				height="700px"
				listProps={{ unreadAfter: "m9820" }}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);
		const root = canvasElement.querySelector(
			"[data-story-root]",
		) as HTMLElement;
		await waitFor(() => expect(root.dataset.loaded).toBe("220"), {
			timeout: 3000,
		});
		await waitFor(
			() => {
				const divider = dividerOf(canvasElement);
				expect(divider).not.toBeNull();
				const item = divider.closest("[data-message-list-item]") as HTMLElement;
				expect(item.querySelector("[data-message-key='m9821']")).not.toBeNull();
				const top = topWithin(divider, scroller);
				expect(top).toBeGreaterThanOrEqual(40);
				expect(top).toBeLessThanOrEqual(130);
			},
			{ timeout: 3000 },
		);
	},
};

export const OpensPinnedWithoutUnread: Story = {
	render: () => {
		const channel = createChannel();
		return (
			<ChannelView
				channel={channel}
				height="700px"
				listProps={{ unreadAfter: "m9999" }}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		await expect(dividerOf(canvasElement)).toBeNull();
		await expect(distanceOf(scrollerOf(canvasElement))).toBeLessThanOrEqual(1);
		await expect(pillOf(canvasElement)).not.toHaveAttribute("data-visible");
	},
};

const JumpCardScenario = (props: { platform: "desktop" | "mobile" }) => {
	const channel = createChannel();
	const [inset, setInset] = createSignal(0);
	let handle: MessageListHandle | undefined;
	return (
		<div
			class="flex flex-col bg-background"
			style={{ height: props.platform === "mobile" ? "874px" : "760px" }}
		>
			<div class="flex flex-wrap gap-2 p-2">
				<Button variant="secondary" onClick={() => channel.receive()}>
					Receive message
				</Button>
				<Button
					variant="secondary"
					onClick={() => {
						channel.openAround(5000);
						handle?.jumpTo("m5000");
					}}
				>
					Open history
				</Button>
				<Show when={props.platform === "mobile"}>
					<Button variant="secondary" onClick={() => setInset(320)}>
						Open keyboard
					</Button>
				</Show>
			</div>
			<div
				class="flex min-h-0 flex-col"
				style={{ height: `calc(100% - 52px - ${inset()}px)` }}
			>
				<ChannelView
					channel={channel}
					platform={props.platform}
					height="100%"
					listProps={{
						ref: (value) => {
							handle = value;
						},
					}}
				/>
			</div>
		</div>
	);
};

const jumpCardOf = (canvas: HTMLElement) =>
	canvas.querySelector<HTMLElement>("[data-message-list-jump]") as HTMLElement;

const jumpCardButton = (canvas: HTMLElement) =>
	within(jumpCardOf(canvas)).getByRole("button");

const expectJumpCardGeometry = async (
	canvas: HTMLElement,
	minimumTarget: number,
) => {
	const list = scrollerOf(canvas).getBoundingClientRect();
	const card = jumpCardOf(canvas).firstElementChild as HTMLElement;
	const surface = card.getBoundingClientRect();
	const left = surface.left - list.left;
	const right = list.right - surface.right;
	await expect(surface.top).toBeGreaterThanOrEqual(list.top);
	await expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
	await expect(left).toBeGreaterThanOrEqual(16);
	await expect(surface.width).toBeLessThanOrEqual(448);
	await expect(Math.round(list.bottom - surface.bottom)).toBe(12);
	const text = card.querySelector("p") as HTMLElement;
	if (text.scrollWidth > text.clientWidth + 1)
		await expect(text).toHaveAttribute("title", text.textContent ?? "");
	await expect(text.getBoundingClientRect().width).toBeGreaterThan(40);
	if (minimumTarget < 44) {
		const content = Array.from(card.children).reduce(
			(total, child) => total + child.getBoundingClientRect().width,
			0,
		);
		await expect(surface.width).toBeLessThan(content + 48);
		await expect(surface.width).toBeLessThan(list.width - 32);
	}
	const button = jumpCardButton(canvas);
	const box = button.getBoundingClientRect();
	await expect(box.height).toBeGreaterThanOrEqual(minimumTarget);
	await expect(box.width).toBeGreaterThanOrEqual(minimumTarget);
	const radius = Number.parseFloat(getComputedStyle(card).borderTopLeftRadius);
	const inner = Number.parseFloat(getComputedStyle(button).borderTopLeftRadius);
	const padding = Number.parseFloat(getComputedStyle(card).paddingTop);
	await expect(radius).toBe(inner + padding);
	await expect(radius).toBe(minimumTarget < 44 ? 12 : 16);
};

const waitJumpCard = (canvas: HTMLElement, mode: string) =>
	waitFor(
		() => {
			const control = jumpCardOf(canvas);
			expect(control).toHaveAttribute("data-visible");
			expect(control).toHaveAttribute("data-mode", mode);
			expect(getComputedStyle(control).opacity).toBe("1");
		},
		{ timeout: 3000 },
	);

const playJumpCard =
	(platform: "desktop" | "mobile") =>
	async ({
		canvasElement,
		step,
	}: {
		canvasElement: HTMLElement;
		step: (name: string, run: () => Promise<void>) => Promise<void> | void;
	}) => {
		const canvas = within(canvasElement);
		const minimum = platform === "mobile" ? 44 : 32;
		await settled(canvasElement);
		const scroller = scrollerOf(canvasElement);
		const control = jumpCardOf(canvasElement);
		await expect(control).not.toHaveAttribute("data-visible");
		await expect(control).toHaveAttribute("inert");

		await step("Jump to bottom when scrolled up", async () => {
			await scrollTo(scroller, scroller.scrollTop - 800);
			await waitJumpCard(canvasElement, "bottom");
			await expect(jumpCardButton(canvasElement)).toHaveAccessibleName(
				"Jump to bottom",
			);
			await expectJumpCardGeometry(canvasElement, minimum);
		});

		if (platform === "mobile") {
			await step("Fits with the keyboard open", async () => {
				await userEvent.click(
					canvas.getByRole("button", { name: "Open keyboard" }),
				);
				await frames(6);
				await waitJumpCard(canvasElement, "bottom");
				await expectJumpCardGeometry(canvasElement, minimum);
			});
		}

		await step("Counts new messages", async () => {
			const receive = canvas.getByRole("button", { name: "Receive message" });
			await userEvent.click(receive);
			await userEvent.click(receive);
			await waitJumpCard(canvasElement, "new");
			await expect(jumpCardButton(canvasElement)).toHaveAccessibleDescription(
				"2 new messages",
			);
			await expectJumpCardGeometry(canvasElement, minimum);
		});

		await step("Keyboard Enter jumps to the bottom", async () => {
			const button = jumpCardButton(canvasElement);
			button.focus();
			await expect(document.activeElement).toBe(button);
			await userEvent.keyboard("{Enter}");
			await waitFor(
				() => {
					expect(distanceOf(scroller)).toBeLessThanOrEqual(1);
					expect(control).not.toHaveAttribute("data-visible");
				},
				{ timeout: 3000 },
			);
			await expect(control).toHaveAttribute("inert");
		});

		await step("Jump to present from history", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: "Open history" }),
			);
			await waitJumpCard(canvasElement, "present");
			const button = jumpCardButton(canvasElement);
			await expect(button).toHaveAccessibleName("Jump to present");
			await expect(button).toHaveAccessibleDescription(
				"You're viewing older messages",
			);
			await expectJumpCardGeometry(canvasElement, minimum);
			await userEvent.click(button);
			await waitFor(
				() => {
					const last = canvasElement.querySelector(
						"[data-message-key='live2']",
					) as HTMLElement;
					expect(last).not.toBeNull();
					expect(inView(last, scroller)).toBe(true);
					expect(distanceOf(scroller)).toBeLessThanOrEqual(1);
				},
				{ timeout: 3000 },
			);
		});
	};

export const JumpCardDesktop: Story = {
	render: () => <JumpCardScenario platform="desktop" />,
	play: playJumpCard("desktop"),
};

export const JumpCardMobile: Story = {
	parameters: iphone,
	render: () => <JumpCardScenario platform="mobile" />,
	play: playJumpCard("mobile"),
};
