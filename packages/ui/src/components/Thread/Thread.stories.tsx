import { For, type JSX } from "solid-js";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { NavHeader } from "../Header/NavHeader";
import {
	NewMessagesDivider,
	ThreadCard,
	type ThreadPerson,
	ThreadRow,
} from "./Thread";
import { ThreadCardSkeleton, ThreadRowSkeleton } from "./ThreadSkeletons";

const meta = {
	title: "Messaging/Threads",
	parameters: { viewport: { defaultViewport: "iphone" }, layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const lou: ThreadPerson = { name: "Lou", color: "#8e51ff" };
const robin: ThreadPerson = { name: "Robin", color: "#4ade80" };
const kris: ThreadPerson = { name: "Kris", color: "#ffd857" };

const lastMessage = {
	...robin,
	text: "Wow such text I definitely typed!",
};

const onOpen = fn();

const ThreadsPage = (props: { children: JSX.Element }) => (
	<div class="flex min-h-screen flex-col bg-popover text-foreground">
		<NavHeader
			kind="close"
			title="Threads in #general"
			onNavigate={() => {}}
			class="bg-popover"
		/>
		<div class="flex flex-col gap-4 p-4">{props.children}</div>
	</div>
);

export const ThreadsScreen: Story = {
	render: () => (
		<ThreadsPage>
			<ThreadRow
				name="Kingfisher sightings"
				messageCount={5}
				age="1w"
				lastMessage={lastMessage}
				onOpen={onOpen}
			/>
			<ThreadRow
				name="Crow whispering"
				messageCount={19}
				age="5m"
				typing={[robin, lou]}
				unread
				onOpen={onOpen}
			/>
			<ThreadRow
				name="Moderation notes"
				messageCount={1}
				age="2d"
				lastMessage={{ ...kris, text: "Pinned the new rules, take a look." }}
				private
				mentions={3}
				onOpen={onOpen}
			/>
		</ThreadsPage>
	),
	play: async ({ canvasElement }) => {
		onOpen.mockClear();
		const canvas = within(canvasElement);
		const typing = canvasElement.querySelector("[data-thread-typing]");
		await expect(typing).not.toBeNull();
		await expect(typing).toHaveTextContent("Robin and Lou are typing...");
		await expect(canvas.getByText("1 message · 2d")).toBeInTheDocument();
		await expect(canvas.getByText("19 messages · 5m")).toBeInTheDocument();
		await expect(canvas.getByRole("img", { name: "Private" })).toBeVisible();
		const row = canvas.getByRole("button", { name: /^Kingfisher sightings/ });
		await userEvent.click(row);
		await expect(onOpen).toHaveBeenCalledTimes(1);
	},
};

const MessageStub = (props: { name: string; text: string }) => (
	<div class="flex gap-3 px-2 pt-2">
		<span class="size-10 shrink-0 rounded-full bg-secondary" />
		<div class="flex min-w-0 flex-col gap-1">
			<span class="text-sm leading-4 font-semibold">{props.name}</span>
			<p class="m-0 text-base">{props.text}</p>
		</div>
	</div>
);

export const InChannel: Story = {
	render: () => (
		<div class="flex min-h-screen flex-col gap-2 bg-background py-4 text-foreground">
			<MessageStub
				name="Lou"
				text="I have walked that path for years and never once have I seen one. Lucky you!"
			/>
			<div class="pr-2 pb-2 pl-15">
				<ThreadCard
					name="Kingfisher sightings"
					messageCount={5}
					age="1w"
					lastMessage={lastMessage}
					onOpen={onOpen}
				/>
			</div>
			<NewMessagesDivider />
			<MessageStub
				name="Robin"
				text="The crows have started following me on my run now"
			/>
			<div class="pr-2 pb-2 pl-15">
				<ThreadCard
					name="Crow whispering"
					messageCount={19}
					age="5m"
					typing={[robin, lou, kris]}
					unread
					onOpen={onOpen}
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		onOpen.mockClear();
		const canvas = within(canvasElement);
		const card = canvas.getByRole("button", { name: /^Kingfisher sightings/ });
		await userEvent.click(card);
		await expect(onOpen).toHaveBeenCalledTimes(1);
		await expect(canvas.getByText("New messages")).toBeVisible();
		await expect(
			canvas.getByText("Several people are typing..."),
		).toBeInTheDocument();
	},
};

const LONG_NAME =
	"A very long thread name about the kingfisher on the canal by the old stone bridge";

export const LongNames: Story = {
	render: () => (
		<ThreadsPage>
			<ThreadRow
				name={LONG_NAME}
				messageCount={12480}
				age="3w"
				lastMessage={{
					...lou,
					text: "This message is long enough that it has to be cut off at the end of the line",
				}}
				onOpen={onOpen}
			/>
			<ThreadCard
				name={LONG_NAME}
				messageCount={2}
				age="now"
				lastMessage={lastMessage}
				onOpen={onOpen}
			/>
		</ThreadsPage>
	),
	play: async ({ canvasElement }) => {
		const names = Array.from(
			canvasElement.querySelectorAll<HTMLElement>(`[title="${LONG_NAME}"]`),
		);
		await expect(names).toHaveLength(2);
		for (const name of names) {
			await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
		}
		const row = canvasElement.querySelector<HTMLElement>("[data-thread]");
		await expect(row?.scrollWidth).toBeLessThanOrEqual(row?.clientWidth ?? 0);
		await expect(
			within(canvasElement).getByText("12,480 messages · 3w"),
		).toBeVisible();
	},
};

const READ_UNREAD = (tone: "card" | "secondary") => (
	<>
		<ThreadRow
			tone={tone}
			name="Kingfisher sightings"
			messageCount={5}
			age="1w"
			lastMessage={lastMessage}
			onOpen={onOpen}
		/>
		<ThreadRow
			tone={tone}
			name="Crow whispering"
			messageCount={19}
			age="5m"
			lastMessage={{ ...lou, text: "They brought me a shiny button today" }}
			unread
			onOpen={onOpen}
		/>
		<ThreadRow
			tone={tone}
			name="Moderation notes"
			messageCount={3}
			age="2d"
			lastMessage={{ ...kris, text: "Pinned the new rules, take a look." }}
			mentions={2}
			onOpen={onOpen}
		/>
	</>
);

export const ReadAndUnread: Story = {
	render: () => (
		<div class="grid min-h-screen grid-cols-1 text-foreground">
			<div data-surface="popover" class="flex flex-col gap-3 bg-popover p-4">
				{READ_UNREAD("secondary")}
			</div>
			<div
				data-surface="background"
				class="flex flex-col gap-3 bg-background p-4"
			>
				{READ_UNREAD("card")}
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const rows = Array.from(
			canvasElement.querySelectorAll<HTMLElement>(
				"[data-surface=popover] [data-thread]",
			),
		);
		const [read, unread, mentioned] = rows;
		await expect(read).toHaveAttribute("data-state", "read");
		await expect(unread).toHaveAttribute("data-state", "unread");
		await expect(mentioned).toHaveAttribute("data-state", "unread");
		const style = (element: Element) => getComputedStyle(element);
		await expect(style(read).borderTopColor).toBe("rgba(0, 0, 0, 0)");
		await expect(style(unread).borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
		await expect(style(read).backgroundColor).not.toBe(
			style(unread).backgroundColor,
		);
		const name = (row: Element) =>
			row.querySelector<HTMLElement>("[data-thread-name]") as HTMLElement;
		await expect(style(name(read)).color).not.toBe(style(name(unread)).color);
		await expect(Number(style(name(unread)).fontWeight)).toBeGreaterThan(
			Number(style(name(read)).fontWeight),
		);
		await expect(unread.querySelector("[data-unread-dot]")).not.toBeNull();
		await expect(within(mentioned).getByText("2")).toBeVisible();
	},
};

export const Skeletons: Story = {
	render: () => (
		<ThreadsPage>
			<For each={[0, 1, 2]}>{() => <ThreadRowSkeleton />}</For>
			<ThreadCardSkeleton />
		</ThreadsPage>
	),
};

const Pair = (props: { real: JSX.Element; skeleton: JSX.Element }) => (
	<div data-pair-group="" class="flex flex-col gap-4">
		<div data-pair="real">{props.real}</div>
		<div data-pair="skeleton">{props.skeleton}</div>
	</div>
);

export const SizeParity: Story = {
	render: () => (
		<div class="flex flex-col gap-8 bg-popover p-4 text-foreground">
			<Pair
				real={
					<ThreadCard
						name="Kingfisher sightings"
						messageCount={5}
						age="1w"
						lastMessage={lastMessage}
						onOpen={onOpen}
					/>
				}
				skeleton={<ThreadCardSkeleton />}
			/>
			<Pair
				real={
					<ThreadRow
						name="Crow whispering"
						messageCount={19}
						age="5m"
						lastMessage={lastMessage}
						onOpen={onOpen}
					/>
				}
				skeleton={<ThreadRowSkeleton />}
			/>
			<Pair
				real={
					<ThreadRow
						name="Crow whispering"
						messageCount={19}
						age="5m"
						typing={[robin, lou]}
						unread
					/>
				}
				skeleton={<ThreadRowSkeleton />}
			/>
			<Pair
				real={
					<ThreadCard
						name="Crow whispering"
						messageCount={19}
						age="5m"
						lastMessage={lastMessage}
						mentions={4}
						onOpen={onOpen}
					/>
				}
				skeleton={<ThreadCardSkeleton />}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const groups =
			canvasElement.querySelectorAll<HTMLElement>("[data-pair-group]");
		for (const [index, group] of Array.from(groups).entries()) {
			const box = (kind: string) =>
				group
					.querySelector(`[data-pair=${kind}]`)
					?.firstElementChild?.getBoundingClientRect();
			const real = box("real");
			const skeleton = box("skeleton");
			await expect({
				index,
				width: Math.round(skeleton?.width ?? -1),
				height: Math.round(skeleton?.height ?? -1),
			}).toEqual({
				index,
				width: Math.round(real?.width ?? -2),
				height: Math.round(real?.height ?? -2),
			});
		}
	},
};

export const EqualTileInsets: Story = {
	render: () => (
		<div class="flex flex-col gap-4 bg-popover p-4 text-foreground">
			<ThreadCard
				name="Kingfisher sightings"
				messageCount={5}
				age="1w"
				lastMessage={lastMessage}
				onOpen={onOpen}
			/>
			<ThreadCard
				name="Crow whispering"
				messageCount={19}
				age="5m"
				lastMessage={lastMessage}
				mentions={4}
			/>
			<ThreadRow
				name="Crow whispering"
				messageCount={19}
				age="5m"
				lastMessage={lastMessage}
			/>
			<ThreadRow
				name="Crow whispering"
				messageCount={19}
				age="5m"
				typing={[robin, lou]}
				unread
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const cards = canvasElement.querySelectorAll<HTMLElement>("[data-thread]");
		await expect(cards.length).toBe(4);
		for (const card of Array.from(cards)) {
			const outer = card.getBoundingClientRect();
			const tile = card
				.querySelector("[data-thread-tile]")
				?.getBoundingClientRect();
			if (!tile) throw new Error("missing tile");
			const left = tile.left - outer.left;
			const top = tile.top - outer.top;
			const bottom = outer.bottom - tile.bottom;
			await expect(Math.abs(top - left)).toBeLessThanOrEqual(0.5);
			await expect(Math.abs(bottom - left)).toBeLessThanOrEqual(0.5);
		}
	},
};
