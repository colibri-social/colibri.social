import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { UndoLeftRoundIcon } from "@solar-icons/solid/bold/undo-left-round";
import { createSignal, For, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { cx } from "../../utils/cx";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { fixturePacks, fixtureUsage } from "../EmojiPicker/fixtures";
import { Modal, ModalContent } from "../Modal/Modal";
import type { RichEditorSources } from "../RichEditor/types";
import { SearchField } from "../TextField/TextField";
import {
	DestinationAction,
	DestinationChannel,
	DestinationEmpty,
	DestinationList,
	DestinationNote,
	type DestinationPlatform,
	DestinationSpace,
	DestinationThread,
	DestinationThreadSkeleton,
} from "./DestinationPicker";
import { FORWARD_NOTE_HEIGHT_CLASS, ForwardNote } from "./ForwardNote";
import { ForwardPreview, summarizeForwardAttachments } from "./ForwardPreview";

const meta = {
	title: "Navigation/Destination picker",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Thread = { id: string; name: string; age: string };
type Channel = {
	id: string;
	name: string;
	current?: boolean;
	threads: Thread[];
	state?: "loading" | "failed";
};

const LONG_CHANNEL =
	"design-system-and-component-library-discussions-for-the-whole-team";

const HQ: Channel[] = [
	{
		id: "dev",
		name: "dev",
		current: true,
		threads: [
			{ id: "spring", name: "Spring tuning", age: "2h" },
			{
				id: "long-thread",
				name: "A very long thread name that keeps going well past the edge",
				age: "3w",
			},
		],
	},
	{
		id: "design",
		name: LONG_CHANNEL,
		threads: [
			{ id: "tokens", name: "Tokens", age: "3h" },
			{ id: "icons", name: "Icon review", age: "1d" },
		],
	},
	{ id: "general", name: "general", threads: [], state: "loading" },
	{ id: "random", name: "random", threads: [], state: "failed" },
];

const OWLS: Channel[] = [
	{
		id: "showcase",
		name: "showcase",
		threads: [{ id: "sketch", name: "Sketch swap", age: "5h" }],
	},
	{ id: "critique", name: "critique", threads: [] },
];

const threadCount = (count: number) =>
	`${count} ${count === 1 ? "thread" : "threads"}`;

const createExpanded = (initial: string[]) => {
	const [open, setOpen] = createSignal<ReadonlySet<string>>(new Set(initial));
	const set = (id: string, expanded: boolean) =>
		setOpen((current) => {
			const next = new Set(current);
			if (expanded) next.add(id);
			else next.delete(id);
			return next;
		});
	return { has: (id: string) => open().has(id), set };
};

const onChoose = fn();

const MoveDemo = (props: { platform: DestinationPlatform }) => {
	const expanded = createExpanded(["dev"]);
	return (
		<DestinationList platform={props.platform} aria-label="Destinations">
			<DestinationAction
				icon={<UndoLeftRoundIcon />}
				label="Back to #dev"
				onClick={() => onChoose("back")}
			/>
			<DestinationSpace name="Colibri HQ">
				<For each={HQ}>
					{(channel) => (
						<DestinationChannel
							name={channel.name}
							hint={channel.current ? "Current channel" : undefined}
							meta={
								channel.threads.length > 0
									? threadCount(channel.threads.length)
									: undefined
							}
							expanded={expanded.has(channel.id)}
							onExpandedChange={(open) => expanded.set(channel.id, open)}
							onSelect={
								channel.current ? undefined : () => onChoose(channel.id)
							}
							toggleLabel={`Threads in #${channel.name}`}
						>
							<DestinationAction
								icon={<AddCircleIcon />}
								label={`New thread in #${channel.name}`}
								onClick={() => onChoose(`new:${channel.id}`)}
							/>
							<For each={channel.threads}>
								{(thread) => (
									<DestinationThread
										name={thread.name}
										meta={thread.age}
										onSelect={() => onChoose(thread.id)}
									/>
								)}
							</For>
							<Show when={channel.state === "loading"}>
								<DestinationThreadSkeleton />
							</Show>
							<Show when={channel.state === "failed"}>
								<DestinationAction
									tone="muted"
									icon={<DangerTriangleIcon />}
									label="Couldn't load threads. Try again"
									onClick={() => onChoose(`retry:${channel.id}`)}
								/>
							</Show>
						</DestinationChannel>
					)}
				</For>
			</DestinationSpace>
		</DestinationList>
	);
};

const rowOf = (root: HTMLElement, name: string) =>
	Array.from(
		root.querySelectorAll<HTMLElement>("[data-destination-name]"),
	).find((element) => element.textContent === name);

export const Move: Story = {
	render: () => (
		<div data-testid="move" class="min-h-dvh bg-popover p-4 text-foreground">
			<MoveDemo platform="mobile" />
		</div>
	),
	play: async ({ canvasElement }) => {
		onChoose.mockClear();
		const canvas = within(canvasElement);
		const root = canvas.getByTestId("move");
		await expect(canvas.getByText("Current channel")).toBeVisible();
		await expect(canvas.getByText("Spring tuning")).toBeVisible();

		const dev = rowOf(root, "dev")?.closest("button") as HTMLElement;
		await expect(dev).toHaveAttribute("aria-expanded", "true");
		await userEvent.click(dev);
		await expect(dev).toHaveAttribute("aria-expanded", "false");
		await expect(onChoose).not.toHaveBeenCalled();
		await userEvent.click(dev);

		await userEvent.click(
			canvas.getByRole("button", { name: `Threads in #${LONG_CHANNEL}` }),
		);
		await userEvent.click(canvas.getByText("Tokens"));
		await expect(onChoose).toHaveBeenCalledWith("tokens");
		await userEvent.click(rowOf(root, LONG_CHANNEL) as HTMLElement);
		await expect(onChoose).toHaveBeenCalledWith("design");

		const rows = Array.from(
			root.querySelectorAll<HTMLElement>(
				"[data-destination-main], [data-destination-action]",
			),
		).filter((row) => row.getBoundingClientRect().height > 0);
		const heights = new Set(
			rows.map((row) => Math.round(row.getBoundingClientRect().height)),
		);
		await expect([...heights]).toEqual([44]);

		await userEvent.click(
			canvas.getByRole("button", { name: "Threads in #general" }),
		);
		await expect(
			root.querySelector("[data-destination-skeleton]"),
		).not.toBeNull();
		await userEvent.click(
			canvas.getByRole("button", { name: "Threads in #random" }),
		);
		await userEvent.click(canvas.getByText("Couldn't load threads. Try again"));
		await expect(onChoose).toHaveBeenCalledWith("retry:random");
		await expectNoLayoutIssues(root);
	},
};

const MESSAGE_TEXT =
	"Here are the new icon sketches for the release. I tried a rounder stroke on the thread glyph and a tighter grid for the channel icon, so let me know which direction you prefer before Friday.";

const noteSources: RichEditorSources = {
	searchMembers: (query, limit) =>
		[
			{
				did: "did:plc:ada",
				name: "Ada Lovelace",
				handle: "ada.colibri.social",
			},
			{
				did: "did:plc:grace",
				name: "Grace Hopper",
				handle: "grace.bsky.social",
			},
		]
			.filter((member) =>
				member.name.toLowerCase().startsWith(query.toLowerCase()),
			)
			.slice(0, limit),
};

const ForwardDemo = (props: {
	platform: DestinationPlatform;
	problem?: { kind: string; hint: string };
}) => {
	const expanded = createExpanded(["dev"]);
	const [picked, setPicked] = createSignal<ReadonlySet<string>>(new Set());
	const [emojiOpen, setEmojiOpen] = createSignal(false);
	const pick = (id: string, checked: boolean) =>
		setPicked((current) => {
			const next = new Set(current);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	const spaces = [
		{ name: "Colibri HQ", channels: HQ.slice(0, 2) },
		{ name: "Night Owls Art Club", channels: OWLS },
	];
	const label = () => (picked().size > 1 ? `Send (${picked().size})` : "Send");

	return (
		<div class="flex min-w-0 flex-col gap-3">
			<SearchField
				aria-label="Search channels and threads"
				placeholder="Search channels and threads"
			/>
			<DestinationList mode="multi" platform={props.platform}>
				<For each={spaces}>
					{(space) => (
						<DestinationSpace name={space.name}>
							<For each={space.channels}>
								{(channel) => (
									<DestinationChannel
										value={channel.id}
										name={channel.name}
										hint={channel.current ? "Current channel" : undefined}
										meta={
											channel.threads.length > 0
												? threadCount(channel.threads.length)
												: undefined
										}
										checked={picked().has(channel.id)}
										onCheckedChange={(checked) => pick(channel.id, checked)}
										disabled={channel.current}
										expanded={expanded.has(channel.id)}
										onExpandedChange={(open) => expanded.set(channel.id, open)}
										toggleLabel={`Threads in #${channel.name}`}
									>
										<For each={channel.threads}>
											{(thread) => (
												<DestinationThread
													value={thread.id}
													name={thread.name}
													meta={thread.age}
													checked={picked().has(thread.id)}
													onCheckedChange={(checked) =>
														pick(thread.id, checked)
													}
												/>
											)}
										</For>
										<Show when={channel.threads.length === 0}>
											<DestinationNote>No threads yet</DestinationNote>
										</Show>
									</DestinationChannel>
								)}
							</For>
						</DestinationSpace>
					)}
				</For>
			</DestinationList>
			<div data-forward-footer="" class="flex min-w-0 flex-col gap-3">
				<ForwardPreview
					author="Ada Lovelace"
					timestamp={new Date(Date.now() - 3_600_000)}
					attachments={[
						{
							kind: "image",
							src: storyImages.violetIcon(),
							alt: "Icon sketch",
						},
						{ kind: "image", src: storyImages.tealIcon() },
						{ kind: "file" },
					]}
				>
					{MESSAGE_TEXT}
				</ForwardPreview>
				<div
					class={
						props.platform === "desktop"
							? "flex min-w-0 items-end gap-2"
							: "flex min-w-0 flex-col gap-2"
					}
				>
					<ForwardNote
						platform={props.platform}
						sources={noteSources}
						problem={props.problem}
						emoji={{
							open: emojiOpen(),
							onOpenChange: setEmojiOpen,
							usage: fixtureUsage(),
							packs: fixturePacks,
							onPick: () => setEmojiOpen(false),
						}}
					/>
					<Button
						disabled={picked().size === 0 || Boolean(props.problem)}
						class={cx(
							FORWARD_NOTE_HEIGHT_CLASS,
							props.platform === "desktop" ? "shrink-0" : "w-full",
						)}
					>
						<span data-forward-submit="" class="tabular-nums">
							{label()}
						</span>
					</Button>
				</div>
			</div>
		</div>
	);
};

const checkOf = (root: HTMLElement, name: string) =>
	rowOf(root, name)
		?.closest("[data-destination-main]")
		?.querySelector<HTMLElement>("[data-destination-check]");

export const Forward: Story = {
	render: () => (
		<div data-testid="forward" class="min-h-dvh bg-popover p-4 text-foreground">
			<ForwardDemo platform="mobile" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const root = canvas.getByTestId("forward");
		const dev = canvas.getByRole("checkbox", { name: /^dev/ });
		await expect(dev).toBeDisabled();

		await userEvent.click(canvas.getByText("Spring tuning"));
		await expect(
			canvas.getByRole("checkbox", { name: /Spring tuning/ }),
		).toBeChecked();
		await expect(checkOf(root, "Spring tuning")).toHaveClass("bg-primary");
		await userEvent.click(canvas.getByText("showcase"));
		await expect(canvas.getByText("Send (2)")).toBeVisible();

		const channelCheck = checkOf(root, "showcase")?.getBoundingClientRect();
		const threadCheck = checkOf(root, "Spring tuning")?.getBoundingClientRect();
		await expect(
			Math.abs((channelCheck?.right ?? 0) - (threadCheck?.right ?? 1)),
		).toBeLessThan(0.5);

		await userEvent.click(canvas.getByText("Spring tuning"));
		await expect(
			canvas.getByRole("checkbox", { name: /Spring tuning/ }),
		).not.toBeChecked();
		await expectNoLayoutIssues(root);
	},
};

export const ForwardModal: Story = {
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: () => (
		<Modal defaultOpen>
			<ModalContent
				title="Forward message"
				closeLabel="Cancel forwarding"
				class="md:w-[440px]"
			>
				<ForwardDemo platform="desktop" />
			</ModalContent>
		</Modal>
	),
	play: async () => {
		const dialog = await screen.findByRole("dialog", {
			name: "Forward message",
		});
		await waitFor(
			() =>
				expect(
					Math.round(
						dialog
							.querySelector("[data-destination-main]")
							?.getBoundingClientRect().height ?? 0,
					),
				).toBe(40),
			{ timeout: 3000 },
		);
		const send = within(dialog).getByRole("button", { name: "Send" });
		const note = dialog.querySelector("[data-forward-note]") as HTMLElement;
		await waitFor(() =>
			expect(
				Math.abs(
					note.getBoundingClientRect().height -
						send.getBoundingClientRect().height,
				),
			).toBeLessThan(0.5),
		);
		await expect(
			Math.abs(
				note.getBoundingClientRect().bottom -
					send.getBoundingClientRect().bottom,
			),
		).toBeLessThan(0.5);
		await expectNoLayoutIssues(dialog);
	},
};

export const ForwardNoteEditor: Story = {
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: () => (
		<Modal defaultOpen>
			<ModalContent
				title="Forward message"
				closeLabel="Cancel forwarding"
				class="md:w-[440px]"
			>
				<ForwardDemo platform="desktop" />
			</ModalContent>
		</Modal>
	),
	play: async () => {
		const dialog = await screen.findByRole("dialog", {
			name: "Forward message",
		});
		const editor = await within(dialog).findByRole("textbox", {
			name: "Add a message",
		});
		await userEvent.click(editor);
		await userEvent.keyboard("**Look** at this @gr");
		const list = await screen.findByRole("listbox", { name: "Suggestions" });
		await expect(within(list).getAllByText("Grace Hopper")[0]).toBeVisible();
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(
				editor.querySelector("[data-mention-type='member']"),
			).toHaveTextContent("@Grace Hopper"),
		);
		await expect(editor.querySelector(".font-bold")).toHaveTextContent("Look");
		await expect(
			within(dialog).getByRole("button", { name: "Add an emoji" }),
		).toBeVisible();
		await expectNoLayoutIssues(dialog);
	},
};

export const ForwardNoteProblem: Story = {
	render: () => (
		<div data-testid="forward" class="min-h-dvh bg-popover p-4 text-foreground">
			<ForwardDemo
				platform="mobile"
				problem={{
					kind: "member",
					hint: "@Mo isn't in Night Owls Art Club. Remove the mention to forward this.",
				}}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const root = canvas.getByTestId("forward");
		await userEvent.click(canvas.getByText("showcase"));
		await expect(canvas.getByRole("status")).toHaveTextContent(
			"@Mo isn't in Night Owls Art Club.",
		);
		await expect(root.querySelector("[data-forward-note]")).toHaveAttribute(
			"data-invalid",
		);
		await expect(canvas.getByRole("button", { name: "Send" })).toBeDisabled();
		await expectNoLayoutIssues(root);
	},
};

export const ForwardPreviews: Story = {
	render: () => (
		<div
			data-testid="previews"
			class="flex min-h-dvh flex-col gap-3 bg-popover p-4 text-foreground"
		>
			<ForwardPreview author="Ada Lovelace" timestamp={new Date()}>
				Short and sweet
			</ForwardPreview>
			<ForwardPreview
				author="A display name that is far too long to fit on one line"
				timestamp={new Date(Date.now() - 86_400_000 * 3)}
				attachments={[
					{ kind: "video" },
					{ kind: "audio" },
					{ kind: "file" },
					{ kind: "file" },
				]}
			>
				{MESSAGE_TEXT}
			</ForwardPreview>
			<ForwardPreview
				author="Grace Hopper"
				timestamp={new Date()}
				attachments={[
					{
						kind: "image",
						src: storyImages.amberIcon(),
						spoiler: true,
					},
				]}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const root = within(canvasElement).getByTestId("previews");
		const summaries = Array.from(
			root.querySelectorAll("[data-forward-preview-summary]"),
		).map((element) => element.textContent);
		await expect(summaries).toEqual([
			"1 video · 1 audio file · 2 files",
			"1 image",
		]);
		await expect(
			summarizeForwardAttachments([{ kind: "gif" }, { kind: "gif" }]),
		).toBe("2 GIFs");
		await expectNoLayoutIssues(root);
	},
};

export const Empty: Story = {
	render: () => (
		<div data-testid="empty" class="min-h-dvh bg-popover p-4 text-foreground">
			<DestinationList aria-label="Destinations">
				<DestinationEmpty>Nothing matches your search.</DestinationEmpty>
			</DestinationList>
		</div>
	),
	play: async ({ canvasElement }) => {
		const root = within(canvasElement).getByTestId("empty");
		await expect(
			within(root).getByText("Nothing matches your search."),
		).toBeVisible();
		await expectNoLayoutIssues(root);
	},
};
