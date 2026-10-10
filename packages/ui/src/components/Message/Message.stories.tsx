import { MenuDotsIcon } from "@solar-icons/solid/bold/menu-dots";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { ReplyIcon } from "@solar-icons/solid/linear/reply";
import { createSignal, For, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	type GroupableMessage,
	groupMessages,
} from "../../utils/message-groups";
import { contrastRatio, NameColorProvider } from "../../utils/name-color";
import { formatMessageTime } from "../../utils/time";
import { MentionChip, TeamBadge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { Composer } from "../Composer/Composer";
import { TypingIndicator } from "../Composer/TypingIndicator";
import { IconButton } from "../IconButton/IconButton";
import { InboxGroupCard } from "../Inbox/InboxGroupCard";
import type { RichText } from "../RichEditor/types";
import { RichTextProvider } from "../RichText/context";
import { build, f, mark } from "../RichText/fixtures";
import { RichTextRenderer } from "../RichText/RichText";
import type { RoleIdentity } from "../Roles/RoleBadge";
import { CHAT_LAYOUT, type ChatPlatform } from "./layout";
import { MessagePreview } from "./MessagePreview";
import { type MessageHighlight, MessageRow } from "./MessageRow";
import { MessagePreviewSkeleton, MessageRowSkeleton } from "./MessageSkeletons";

const STORY_MEMBERS: Record<string, { did: string; name: string }> = {
	"did:plc:lou": { did: "did:plc:lou", name: "Lou" },
	"did:plc:username": { did: "did:plc:username", name: "Username" },
};

const meta = {
	title: "Messaging/Message",
	decorators: [
		(Story) => (
			<RichTextProvider value={{ member: (did) => STORY_MEMBERS[did] }}>
				<Story />
			</RichTextProvider>
		),
	],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const mobile = { viewport: { defaultViewport: "iphone" } };

const NOW = new Date(2026, 9, 7, 9, 41);
const at = (hours: number, minutes: number, dayOffset = 0) =>
	new Date(2026, 9, 7 + dayOffset, hours, minutes);

type Fixture = GroupableMessage & {
	id: string;
	name: string;
	team?: boolean;
	body: () => import("solid-js").JSX.Element;
};

const conversation: Fixture[] = [
	{
		id: "1",
		author: "did:plc:username",
		name: "Username",
		timestamp: at(9, 2),
		body: () => (
			<RichTextRenderer
				value={{ text: "Just past it, sat on the rail for a good minute :)" }}
			/>
		),
	},
	{
		id: "2",
		author: "did:plc:lou",
		name: "Lou",
		team: true,
		timestamp: at(9, 4),
		body: () => (
			<RichTextRenderer
				value={build([
					"I have walked that path for ",
					mark("years", f.bold),
					" and never once have I seen one. Lucky you! 🐦",
				])}
			/>
		),
	},
	{
		id: "3",
		author: "did:plc:lou",
		name: "Lou",
		team: true,
		timestamp: at(9, 6),
		body: () => (
			<RichTextRenderer
				value={{ text: "The crows have started following me on my run now" }}
			/>
		),
	},
	{
		id: "4",
		author: "did:plc:username",
		name: "Username",
		timestamp: at(9, 20),
		body: () => (
			<RichTextRenderer value={{ text: "Did you feed them once?" }} />
		),
	},
	{
		id: "5",
		author: "did:plc:lou",
		name: "Lou",
		team: true,
		timestamp: at(9, 31),
		body: () => (
			<RichTextRenderer
				value={{
					text: "I may have shared a sandwich in feb, now that I think about it.",
				}}
			/>
		),
	},
	{
		id: "6",
		author: "did:plc:username",
		name: "Username",
		timestamp: at(9, 33),
		body: () => (
			<RichTextRenderer
				value={{ text: "Then that's your life now, they do not forget faces." }}
			/>
		),
	},
	{
		id: "7",
		author: "did:plc:username",
		name: "Username",
		timestamp: at(9, 34),
		body: () => (
			<RichTextRenderer
				value={build([
					mark("@Lou", f.mention("did:plc:lou")),
					" I am the crow whisperer.",
				])}
			/>
		),
	},
];

export const Conversation: Story = {
	parameters: mobile,
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background py-2 text-foreground">
			<For each={groupMessages(conversation)}>
				{(entry) => (
					<MessageRow
						author={{ name: entry.message.name }}
						badge={entry.message.team ? <TeamBadge /> : undefined}
						timestamp={entry.message.timestamp}
						now={NOW}
						locale="en-GB"
						continuation={entry.continuation}
						data-testid={`message-${entry.message.id}`}
					>
						{entry.message.body()}
					</MessageRow>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		const grouped = groupMessages(conversation).map((entry) => [
			entry.message.id,
			entry.continuation,
		]);
		await expect(grouped).toEqual([
			["1", false],
			["2", false],
			["3", true],
			["4", false],
			["5", false],
			["6", false],
			["7", true],
		]);
		const third = canvasElement.querySelector('[data-testid="message-3"]');
		await expect(third).toHaveAttribute("data-continuation");
		await expect(third?.querySelector("[data-message-header]")).toBeNull();
		await expect(
			within(canvasElement).getAllByRole("article").length,
		).toBeGreaterThan(0);
	},
};

export const GroupingRules: Story = {
	parameters: mobile,
	render: () => <div class="min-h-dvh bg-background" />,
	play: async () => {
		const base = { author: "a" };
		const result = groupMessages([
			{ ...base, timestamp: at(10, 0) },
			{ ...base, timestamp: at(10, 4) },
			{ ...base, timestamp: at(10, 9, 0) },
			{ ...base, timestamp: at(10, 10), reply: true },
			{ ...base, timestamp: at(10, 11), forward: true },
			{ ...base, timestamp: at(10, 12), failed: true },
			{ ...base, timestamp: at(10, 13) },
			{ author: "b", timestamp: at(10, 14) },
			{ author: "b", timestamp: at(0, 1, 1) },
		]).map((entry) => entry.continuation);
		await expect(result).toEqual([
			false,
			true,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
		]);
		const days = groupMessages([
			{ author: "b", timestamp: at(23, 58) },
			{ author: "b", timestamp: at(0, 1, 1) },
		]);
		await expect(days[1]?.newDay).toBe(true);
		await expect(days[1]?.continuation).toBe(false);
		await expect(days[0]?.hasContinuation).toBe(false);
	},
};

export const Timestamps: Story = {
	parameters: mobile,
	render: () => <div class="min-h-dvh bg-background" />,
	play: async () => {
		await expect(formatMessageTime(at(14, 2), NOW, "en-GB")).toBe(
			"Today at 14:02",
		);
		await expect(formatMessageTime(at(9, 10, -1), NOW, "en-GB")).toBe(
			"Yesterday at 09:10",
		);
		await expect(
			formatMessageTime(new Date(2026, 2, 12, 18, 30), NOW, "en-GB"),
		).toBe("12 Mar at 18:30");
		await expect(
			formatMessageTime(new Date(2025, 2, 12, 18, 30), NOW, "en-GB"),
		).toBe("12 Mar 2025 at 18:30");
	},
};

const highlights: { value: MessageHighlight; label: string }[] = [
	{ value: "mention", label: "Mentions you" },
	{ value: "replying", label: "You're replying to this" },
	{ value: "jumped", label: "Jumped to, fades after 1.5s" },
	{ value: "menu", label: "Menu open" },
];

export const Highlights: Story = {
	parameters: mobile,
	render: () => (
		<div class="flex min-h-dvh flex-col gap-1 bg-background py-2 text-foreground">
			<For each={highlights}>
				{(item) => (
					<MessageRow
						author={{ name: "Username" }}
						timestamp={at(9, 34)}
						now={NOW}
						locale="en-GB"
						highlight={item.value}
					>
						{item.value === "mention" ? (
							<>
								<MentionChip>@Lou</MentionChip> {item.label}
							</>
						) : (
							item.label
						)}
					</MessageRow>
				)}
			</For>
		</div>
	),
};

export const Reply: Story = {
	parameters: mobile,
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background py-2 text-foreground">
			<MessageRow
				author={{ name: "Lou" }}
				badge={<TeamBadge />}
				timestamp={at(9, 36)}
				now={NOW}
				locale="en-GB"
				reply={{
					author: { name: "Username" },
					text: "Wow such text I definitely typed!",
					onClick: () => {},
				}}
			>
				<MentionChip>@Username</MentionChip> Text content for the message!
			</MessageRow>
			<MessageRow
				author={{ name: "Username" }}
				timestamp={at(9, 37)}
				now={NOW}
				locale="en-GB"
				reply={{ unavailable: true }}
			>
				Replying to something that was deleted.
			</MessageRow>
		</div>
	),
	play: async ({ canvasElement }) => {
		const connector = canvasElement.querySelector("[data-reply-connector]");
		await expect(connector).not.toBeNull();
		await expect(
			within(canvasElement).getByText("This message is no longer available."),
		).toBeInTheDocument();
	},
};

export const PendingToSent: Story = {
	parameters: mobile,
	render: () => {
		const [sent, setSent] = createSignal(false);
		return (
			<div class="flex min-h-dvh flex-col gap-4 bg-background py-2 text-foreground">
				<MessageRow
					author={{ name: "Lou" }}
					timestamp={at(9, 40)}
					now={NOW}
					locale="en-GB"
					state={sent() ? "sent" : "pending"}
					data-testid="pending"
				>
					On my way to the canal now.
				</MessageRow>
				<div class="px-4">
					<Button variant="secondary" onClick={() => setSent((v) => !v)}>
						{sent() ? "Send again" : "Mark as sent"}
					</Button>
				</div>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector('[data-testid="pending"]');
		await expect(row).toHaveAttribute("data-state", "pending");
		await expect(row).not.toHaveAttribute("data-dimmed");
		await waitFor(() => expect(row).toHaveAttribute("data-dimmed"), {
			timeout: 2000,
		});
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Mark as sent" }),
		);
		await expect(row).toHaveAttribute("data-state", "sent");
		await expect(row).not.toHaveAttribute("data-dimmed");
	},
};

const onRetry = fn();
const onDelete = fn();

const destructiveColor = (element: Element) => {
	const probe = document.createElement("span");
	probe.style.color = "var(--destructive)";
	element.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	return color;
};

export const Failed: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background py-2 text-foreground">
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={at(9, 40)}
				now={NOW}
				locale="en-GB"
				state="failed"
				onRetry={onRetry}
				onDelete={onDelete}
			>
				This one did not make it.{" "}
				<a href="https://colibri.social">The Colibri homepage</a> stays legible.
			</MessageRow>
		</div>
	),
	play: async ({ canvasElement }) => {
		onRetry.mockClear();
		onDelete.mockClear();
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Failed to send.")).toBeInTheDocument();
		const content = canvasElement.querySelector("[data-message-content]");
		const header = canvasElement.querySelector("[data-message-header]");
		if (!content || !header) throw new Error("Message parts missing");
		const red = destructiveColor(content);
		await expect(getComputedStyle(content).color).toBe(red);
		await expect(
			getComputedStyle(within(header as HTMLElement).getByText("Lou")).color,
		).toBe(red);
		await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
		await expect(onRetry).toHaveBeenCalledTimes(1);
		await expect(onDelete).not.toHaveBeenCalled();
	},
};

const sheetSettled = (sheet: HTMLElement) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, 1000);
		sheet.addEventListener(
			"transitionend",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});

const onMobileRetry = fn();
const onMobileDelete = fn();

export const FailedMobile: Story = {
	parameters: mobile,
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background py-2 text-foreground">
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={at(9, 40)}
				now={NOW}
				locale="en-GB"
				platform="mobile"
				state="failed"
				onRetry={onMobileRetry}
				onDelete={onMobileDelete}
			>
				This one did not make it either.
			</MessageRow>
		</div>
	),
	play: async ({ canvasElement }) => {
		onMobileRetry.mockClear();
		onMobileDelete.mockClear();
		const canvas = within(canvasElement);
		await expect(canvas.queryByRole("button", { name: "Retry" })).toBeNull();
		await expect(
			canvas.getByRole("button", { name: "Failed to send. Tap for options" }),
		).toBeInTheDocument();
		await userEvent.click(canvas.getByText("This one did not make it either."));
		const dialog = await screen.findByRole("dialog");
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Retry" }),
			).toBeVisible(),
		);
		await sheetSettled(dialog);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Retry" }),
		);
		await expect(onMobileRetry).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
			timeout: 3000,
		});
		await userEvent.click(
			canvas.getByRole("button", { name: "Failed to send. Tap for options" }),
		);
		const again = await screen.findByRole("dialog");
		await sheetSettled(again);
		await userEvent.click(
			await within(again).findByRole("button", { name: "Delete message" }),
		);
		await expect(onMobileDelete).toHaveBeenCalledTimes(1);
		await expect(onMobileRetry).toHaveBeenCalledTimes(1);
	},
};

export const EditedAndLong: Story = {
	parameters: mobile,
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background py-2 text-foreground">
			<MessageRow
				author={{ name: "Username" }}
				timestamp={at(9, 10)}
				now={NOW}
				locale="en-GB"
				edited
			>
				Fixed the typo, nothing to see here.
			</MessageRow>
			<MessageRow
				author={{ name: "Username" }}
				timestamp={at(9, 11)}
				now={NOW}
				locale="en-GB"
				continuation
				edited
			>
				<RichTextRenderer
					value={build(["Also ", mark("edited", f.italic), "."])}
				/>
			</MessageRow>
			<MessageRow
				author={{ name: "Lou" }}
				badge={<TeamBadge />}
				timestamp={at(9, 15)}
				now={NOW}
				locale="en-GB"
			>
				Here is the full route: start at the old mill, follow the canal past the
				lock gates, take the second bridge, and keep going until the path turns
				to gravel. The kingfisher sits on the rail right before the bend. Read
				more at{" "}
				<a href="https://colibri.social" target="_blank" rel="noreferrer">
					colibri.social
				</a>
				, or ping me.
				Averyveryverylongwordwithoutanybreaksthatshouldstillwrapcleanly.
			</MessageRow>
		</div>
	),
	play: async ({ canvasElement }) => {
		const content = Array.from(
			canvasElement.querySelectorAll("[data-message-content]"),
		).find((element) => element.querySelector("[data-rich-text]"));
		const text = content?.querySelector("em")?.getBoundingClientRect();
		const marker = Array.from(content?.querySelectorAll("span") ?? [])
			.find((element) => element.textContent === "(edited)")
			?.getBoundingClientRect();
		await expect(
			marker && text && Math.abs(marker.bottom - text.bottom),
		).toBeLessThan(4);
	},
};

const editSave = fn();
const editCancel = fn();

const EditableMessage = (props: {
	platform: ChatPlatform;
	initial: RichText;
	attachments?: boolean;
	failSave?: boolean;
}) => {
	const [value, setValue] = createSignal<RichText>(props.initial);
	const [editing, setEditing] = createSignal(false);
	const [edited, setEdited] = createSignal(false);
	const editState = () =>
		editing()
			? {
					value: value(),
					allowEmpty: props.attachments,
					onSave: async (next: RichText) => {
						editSave(next);
						if (props.failSave) return false;
						setValue(next);
						setEdited(true);
						setEditing(false);
						return true;
					},
					onCancel: () => {
						editCancel();
						setEditing(false);
					},
				}
			: undefined;
	return (
		<div class="flex min-h-dvh flex-col bg-background py-2 text-foreground">
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={at(9, 20)}
				now={NOW}
				locale="en-GB"
				platform={props.platform}
				edited={edited()}
				editing={editState()}
				attachments={
					props.attachments ? (
						<div class="h-24 w-40 rounded-control bg-muted" />
					) : undefined
				}
			>
				<RichTextRenderer value={value()} />
			</MessageRow>
			<div class="px-4 pt-4">
				<Button
					variant="secondary"
					disabled={editing()}
					onClick={() => setEditing(true)}
				>
					Edit
				</Button>
			</div>
			<Show when={props.platform === "mobile"}>
				<div class="mt-auto">
					<Composer
						platform="mobile"
						channelName="general"
						onSend={(next) => {
							composerSend(next);
							return true;
						}}
						editing={
							editState()
								? {
										...(editState() as NonNullable<
											ReturnType<typeof editState>
										>),
										preview: value().text,
									}
								: undefined
						}
					/>
				</div>
			</Show>
		</div>
	);
};

const composerSend = fn();

const composerEditorOf = (canvasElement: HTMLElement) =>
	canvasElement.querySelector("[data-composer] .ProseMirror") as HTMLElement;

const startComposerEdit = async (canvasElement: HTMLElement) => {
	editSave.mockClear();
	editCancel.mockClear();
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Edit" }),
	);
	await waitFor(() =>
		expect(
			canvasElement.querySelector('[data-composer-bar="edit"][data-open]'),
		).not.toBeNull(),
	);
	await waitFor(() => expect(composerEditorOf(canvasElement)).toHaveFocus());
};

const editorOf = (canvasElement: HTMLElement) =>
	canvasElement.querySelector(
		"[data-message-editor] .ProseMirror",
	) as HTMLElement;

const startEditing = async (canvasElement: HTMLElement) => {
	editSave.mockClear();
	editCancel.mockClear();
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Edit" }),
	);
	await waitFor(() => expect(editorOf(canvasElement)).toHaveFocus());
};

export const InlineEditDesktop: Story = {
	render: () => (
		<EditableMessage
			platform="desktop"
			initial={{ text: "The kingfisher sits on the rail", facets: [] }}
		/>
	),
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector("[data-message]") as HTMLElement;
		await startEditing(canvasElement);
		await expect(row).toHaveAttribute("data-editing");
		await expect(row).not.toHaveAttribute("data-highlight");
		await expect(
			canvasElement.querySelector("[data-message-content]"),
		).toBeNull();
		await expect(
			canvasElement.querySelector("[data-message-editor-hint]"),
		).toHaveTextContent("escape to cancel");
		await expect(
			canvasElement.querySelector("[data-message-editor-hint]"),
		).toHaveTextContent("enter to submit");
		await userEvent.keyboard(" by the bend{Enter}");
		await waitFor(() => expect(row).not.toHaveAttribute("data-editing"));
		await expect(editSave).toHaveBeenCalledWith(
			expect.objectContaining({
				text: "The kingfisher sits on the rail by the bend",
			}),
		);
		await expect(row).toHaveTextContent("by the bend");
		await expect(row).toHaveTextContent("(edited)");
		await startEditing(canvasElement);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(row).not.toHaveAttribute("data-editing"));
		await expect(editCancel).toHaveBeenCalledOnce();
	},
};

export const InlineEditEmoji: Story = {
	render: () => (
		<EditableMessage
			platform="desktop"
			initial={{ text: "The kingfisher sits on the rail", facets: [] }}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await startEditing(canvasElement);
		const paragraph = editorOf(canvasElement).querySelector("p") as HTMLElement;
		await userEvent.pointer({
			keys: "[MouseLeft]",
			target: paragraph,
			offset: 0,
		});
		await userEvent.keyboard("X");
		await waitFor(() =>
			expect(editorOf(canvasElement)).toHaveTextContent(
				"XThe kingfisher sits on the rail",
			),
		);
		await userEvent.click(canvas.getByRole("button", { name: "Add an emoji" }));
		const search = await screen.findByLabelText(
			"Search emoji",
			{ selector: "input" },
			{ timeout: 3000 },
		);
		await waitFor(() => expect(search).toHaveFocus(), { timeout: 3000 });
		await userEvent.keyboard("salute{Enter}");
		await waitFor(
			() =>
				expect(
					screen.queryByRole("dialog", { name: "Emoji picker" }),
				).not.toBeInTheDocument(),
			{ timeout: 3000 },
		);
		await waitFor(() =>
			expect(editorOf(canvasElement)).toHaveTextContent(
				"X\u{1FAE1}The kingfisher sits on the rail",
			),
		);
		await waitFor(() => expect(editorOf(canvasElement)).toHaveFocus());
	},
};

export const MobileEditInComposer: Story = {
	parameters: mobile,
	render: () => (
		<EditableMessage
			platform="mobile"
			initial={{ text: "Meet at the old mill", facets: [] }}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const row = canvasElement.querySelector("[data-message]") as HTMLElement;
		await userEvent.click(composerEditorOf(canvasElement));
		await userEvent.keyboard("half typed");
		await startComposerEdit(canvasElement);
		await expect(row).not.toHaveAttribute("data-editing");
		await expect(row).not.toHaveAttribute("data-highlight");
		await expect(
			canvasElement.querySelector("[data-message-editor]"),
		).toBeNull();
		await expect(
			canvasElement.querySelector("[data-edit-bar]"),
		).toHaveTextContent("Editing message");
		await expect(composerEditorOf(canvasElement)).toHaveTextContent(
			"Meet at the old mill",
		);
		await userEvent.keyboard(" at noon");
		await userEvent.click(canvas.getByRole("button", { name: "Save edit" }));
		await waitFor(() =>
			expect(editSave).toHaveBeenCalledWith(
				expect.objectContaining({ text: "Meet at the old mill at noon" }),
			),
		);
		await expect(composerSend).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(composerEditorOf(canvasElement)).toHaveTextContent("half typed"),
		);
		await expect(row).toHaveTextContent("Meet at the old mill at noon");
		await expect(row).toHaveTextContent("(edited)");
		await startComposerEdit(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Cancel editing" }),
		);
		await expect(editCancel).toHaveBeenCalledOnce();
		await waitFor(() =>
			expect(composerEditorOf(canvasElement)).toHaveTextContent("half typed"),
		);
		await expect(
			canvas.getByRole("button", { name: "Send message" }),
		).toBeInTheDocument();
	},
};

export const MobileEditRules: Story = {
	parameters: mobile,
	render: () => (
		<EditableMessage
			platform="mobile"
			initial={{ text: "Unchanged", facets: [] }}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await startComposerEdit(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Save edit" }));
		await waitFor(() => expect(editCancel).toHaveBeenCalledOnce());
		await expect(editSave).not.toHaveBeenCalled();
		await startComposerEdit(canvasElement);
		await userEvent.keyboard("{Backspace>9/}");
		await waitFor(() =>
			expect(canvas.getByRole("button", { name: "Save edit" })).toBeDisabled(),
		);
	},
};

export const MobileEditFailedSave: Story = {
	parameters: mobile,
	render: () => (
		<EditableMessage
			platform="mobile"
			failSave
			initial={{ text: "Draft that fails", facets: [] }}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await startComposerEdit(canvasElement);
		await userEvent.keyboard(" to save");
		await userEvent.click(canvas.getByRole("button", { name: "Save edit" }));
		await waitFor(() => expect(editSave).toHaveBeenCalledOnce());
		await waitFor(() =>
			expect(composerEditorOf(canvasElement)).toHaveTextContent(
				"Draft that fails to save",
			),
		);
		await expect(
			canvasElement.querySelector('[data-composer-bar="edit"][data-open]'),
		).not.toBeNull();
	},
};

export const InlineEditAlignment: Story = {
	render: () => (
		<EditableMessage
			platform="desktop"
			initial={{ text: "The kingfisher sits on the rail", facets: [] }}
		/>
	),
	play: async ({ canvasElement }) => {
		await startEditing(canvasElement);
		const box = canvasElement.querySelector(
			"[data-message-editor-box]",
		) as HTMLElement;
		const glyph = canvasElement.querySelector(
			"[data-message-editor-emoji] svg",
		) as SVGElement;
		const paragraph = editorOf(canvasElement).querySelector("p") as HTMLElement;
		const boxRect = box.getBoundingClientRect();
		const glyphRect = glyph.getBoundingClientRect();
		const textRange = document.createRange();
		textRange.selectNodeContents(paragraph);
		const textRect = textRange.getClientRects()[0] as DOMRect;
		const leftInset = textRect.left - boxRect.left;
		const rightInset = boxRect.right - glyphRect.right;
		await expect(Math.abs(rightInset - leftInset)).toBeLessThanOrEqual(1);
		const lineHeight = Number.parseFloat(
			getComputedStyle(editorOf(canvasElement)).lineHeight,
		);
		const lineCenter =
			editorOf(canvasElement).getBoundingClientRect().top + lineHeight / 2;
		const glyphCenter = glyphRect.top + glyphRect.height / 2;
		await expect(Math.abs(glyphCenter - lineCenter)).toBeLessThanOrEqual(1);
		await expect(boxRect.height).toBeLessThanOrEqual(lineHeight + 18 + 0.5);
	},
};

export const InlineEditFailedSave: Story = {
	render: () => (
		<EditableMessage
			platform="desktop"
			failSave
			initial={{ text: "Draft that fails", facets: [] }}
		/>
	),
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector("[data-message]") as HTMLElement;
		await startEditing(canvasElement);
		await userEvent.keyboard(" to save{Enter}");
		await waitFor(() => expect(editSave).toHaveBeenCalledOnce());
		await expect(row).toHaveAttribute("data-editing");
		await waitFor(() =>
			expect(editorOf(canvasElement)).toHaveTextContent(
				"Draft that fails to save",
			),
		);
	},
};

export const ContinuationTime: Story = {
	parameters: mobile,
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background py-2 text-foreground">
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={at(9, 4)}
				now={NOW}
				locale="en-GB"
			>
				First message in the group
			</MessageRow>
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={at(9, 6)}
				now={NOW}
				locale="en-GB"
				continuation
				data-testid="continuation"
			>
				Hover me to see the time in the gutter
			</MessageRow>
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={at(9, 7)}
				now={NOW}
				locale="en-GB"
				continuation
				showTime
			>
				Long-pressed on mobile, so the time shows
			</MessageRow>
		</div>
	),
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector<HTMLElement>(
			'[data-testid="continuation"]',
		);
		const time = row?.querySelector<HTMLElement>("[data-continuation-time]");
		await expect(time).not.toBeNull();
		if (!row || !time) return;
		await expect(getComputedStyle(time).opacity).toBe("0");
		row.tabIndex = -1;
		row.focus();
		await waitFor(() => expect(getComputedStyle(time).opacity).toBe("1"));
		row.blur();
		await waitFor(() => expect(getComputedStyle(time).opacity).toBe("0"));
		await expect(time.textContent).toBe("09:06");
	},
};

const ToolbarPlaceholder = () => (
	<div class="flex h-8 items-center gap-0.5 rounded-control border border-border bg-popover p-0.5 shadow-overlay">
		<IconButton
			size="sm"
			variant="ghost"
			label="Add reaction"
			icon={<SmileCircleIcon />}
		/>
		<IconButton size="sm" variant="ghost" label="Reply" icon={<ReplyIcon />} />
		<IconButton
			size="sm"
			variant="ghost"
			label="More actions"
			icon={<MenuDotsIcon />}
		/>
	</div>
);

export const DesktopToolbar: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background px-4 py-8 text-foreground">
			<For each={groupMessages(conversation)}>
				{(entry) => (
					<MessageRow
						author={{ name: entry.message.name }}
						badge={entry.message.team ? <TeamBadge /> : undefined}
						timestamp={entry.message.timestamp}
						now={NOW}
						locale="en-GB"
						continuation={entry.continuation}
						toolbar={<ToolbarPlaceholder />}
						data-testid={`desktop-${entry.message.id}`}
					>
						{entry.message.body()}
					</MessageRow>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector<HTMLElement>(
			'[data-testid="desktop-4"]',
		);
		const toolbar = row?.querySelector<HTMLElement>("[data-message-toolbar]");
		await expect(toolbar).not.toBeNull();
		if (!row || !toolbar) return;
		await expect(getComputedStyle(toolbar).visibility).toBe("hidden");
		row.tabIndex = -1;
		row.focus();
		await waitFor(() =>
			expect(getComputedStyle(toolbar).visibility).toBe("visible"),
		);
		row.blur();
		await waitFor(() =>
			expect(getComputedStyle(toolbar).visibility).toBe("hidden"),
		);
	},
};

export const InboxPreviews: Story = {
	parameters: mobile,
	render: () => (
		<div class="flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground">
			<InboxGroupCard name="Awesome Space" summary="2 mentions">
				<MessagePreview
					author="Username"
					badge={<TeamBadge describe={false} />}
					timestamp={at(9, 34)}
					now={NOW}
					locale="en-GB"
					onClick={() => {}}
				>
					<MentionChip>@Username</MentionChip> Text content for the message!
				</MessagePreview>
				<MessagePreview
					author="Username"
					badge={<TeamBadge describe={false} />}
					timestamp={at(9, 35)}
					now={NOW}
					locale="en-GB"
					onClick={() => {}}
				>
					<MentionChip>@Username</MentionChip> Very long text content for the
					message. I think we won't show more than 3 rows. See this example for
					context, there is a lot of text here that keeps going and going.
				</MessagePreview>
			</InboxGroupCard>
			<InboxGroupCard name="Replies test" summary="1 reply">
				<MessagePreview
					author="Username"
					badge={<TeamBadge describe={false} />}
					timestamp={at(18, 30, -2)}
					now={NOW}
					locale="en-GB"
					reply="Wow such text I definitely typed! And so many too, incredible."
					onClick={() => {}}
				>
					Text content for the message!
				</MessagePreview>
			</InboxGroupCard>
		</div>
	),
	play: async ({ canvasElement }) => {
		const long = canvasElement.querySelectorAll<HTMLElement>(
			"[data-message-preview-content]",
		)[1];
		await expect(long).toBeDefined();
		if (!long) return;
		await expect(long.getBoundingClientRect().height).toBeLessThanOrEqual(64);
		await expect(
			canvasElement.querySelector("[data-message-preview-reply]"),
		).not.toBeNull();
	},
};

const ParityPair = (props: {
	real: import("solid-js").JSX.Element;
	skeleton: import("solid-js").JSX.Element;
}) => (
	<div data-pair-group="" class="flex flex-col gap-2">
		<div data-pair="real">{props.real}</div>
		<div data-pair="skeleton">{props.skeleton}</div>
	</div>
);

export const SkeletonParity: Story = {
	parameters: mobile,
	render: () => (
		<div class="flex min-h-dvh flex-col gap-6 bg-background py-2 text-foreground">
			<ParityPair
				real={
					<MessageRow
						author={{ name: "Username" }}
						timestamp={at(9, 2)}
						now={NOW}
						locale="en-GB"
					>
						Short one
					</MessageRow>
				}
				skeleton={<MessageRowSkeleton />}
			/>
			<ParityPair
				real={
					<MessageRow
						author={{ name: "Username" }}
						timestamp={at(9, 2)}
						now={NOW}
						locale="en-GB"
						continuation
					>
						Short one
					</MessageRow>
				}
				skeleton={<MessageRowSkeleton continuation />}
			/>
			<ParityPair
				real={
					<MessageRow
						author={{ name: "Username" }}
						timestamp={at(9, 2)}
						now={NOW}
						locale="en-GB"
						reply={{ author: { name: "Lou" }, text: "Earlier" }}
					>
						Short one
					</MessageRow>
				}
				skeleton={<MessageRowSkeleton reply />}
			/>
			<div class="px-4">
				<ParityPair
					real={
						<MessagePreview
							author="Username"
							timestamp={at(9, 2)}
							now={NOW}
							locale="en-GB"
							reply="Earlier"
						>
							Short one
						</MessagePreview>
					}
					skeleton={<MessagePreviewSkeleton reply />}
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const groups = canvasElement.querySelectorAll("[data-pair-group]");
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

const AlignmentDemo = (props: { platform: ChatPlatform }) => (
	<div class="flex min-h-dvh flex-col justify-end bg-background text-foreground">
		<div class="flex flex-col pb-2">
			<MessageRow
				platform={props.platform}
				author={{ name: "Lou" }}
				badge={<TeamBadge />}
				timestamp={at(9, 30)}
				now={NOW}
				locale="en-GB"
			>
				The crows have started following me on my run now
			</MessageRow>
			<MessageRow
				platform={props.platform}
				author={{ name: "Lou" }}
				timestamp={at(9, 31)}
				now={NOW}
				locale="en-GB"
				continuation
			>
				Every single morning
			</MessageRow>
			<MessageRow
				platform={props.platform}
				author={{ name: "Username" }}
				timestamp={at(9, 40)}
				now={NOW}
				locale="en-GB"
				reply={{ author: { name: "Lou" }, text: "Every single morning" }}
			>
				Did you feed them once?
			</MessageRow>
		</div>
		<Composer
			platform={props.platform}
			channelName="#general"
			typing={<TypingIndicator users={[{ name: "Kris" }, { name: "Lou" }]} />}
		/>
	</div>
);

const left = (element: Element | null | undefined) =>
	element?.getBoundingClientRect().left ?? Number.NaN;
const centerX = (element: Element | null | undefined) => {
	const rect = element?.getBoundingClientRect();
	return rect ? rect.left + rect.width / 2 : Number.NaN;
};

const checkAlignment = async (
	canvasElement: HTMLElement,
	platform: ChatPlatform,
) => {
	const field = canvasElement.querySelector(
		"[data-rich-editor] [contenteditable]",
	);
	const textStart = left(field);
	const contents = canvasElement.querySelectorAll("[data-message-content]");
	await expect(contents.length).toBe(3);
	for (const content of contents) {
		await expect(Math.abs(left(content) - textStart)).toBeLessThanOrEqual(1);
	}
	for (const header of canvasElement.querySelectorAll(
		"[data-message-header]",
	)) {
		await expect(Math.abs(left(header) - textStart)).toBeLessThanOrEqual(1);
	}
	const replyButton = canvasElement.querySelector(
		"[data-message-reply] button",
	);
	await expect(Math.abs(left(replyButton) - textStart)).toBeLessThanOrEqual(1);
	const names = canvasElement.querySelector("[data-typing-names]");
	await waitFor(() =>
		expect(Math.abs(left(names) - textStart)).toBeLessThanOrEqual(1),
	);
	const upload = canvasElement.querySelector("[data-composer-upload]");
	const avatar = canvasElement
		.querySelector("[data-message]")
		?.querySelector(":scope > div > span");
	if (platform === "desktop") {
		await expect(
			Math.abs(centerX(avatar) - centerX(upload)),
		).toBeLessThanOrEqual(1);
	} else {
		const box = canvasElement.querySelector("[data-composer-box]");
		await expect(Math.abs(left(avatar) - left(box))).toBeLessThanOrEqual(1);
	}
	const article = canvasElement.querySelector("[data-message]");
	await expect(Math.round(left(article))).toBe(
		Math.round(left(canvasElement.querySelector("[data-composer]"))),
	);
	await expect(Math.round(textStart - left(article))).toBe(
		CHAT_LAYOUT[platform].rowPadding +
			CHAT_LAYOUT[platform].avatarSize +
			CHAT_LAYOUT[platform].avatarGap,
	);
};

const checkTypingClearsLastMessage = async (canvasElement: HTMLElement) => {
	const messages = canvasElement.querySelectorAll("[data-message]");
	const last = messages[messages.length - 1]?.getBoundingClientRect();
	const typing = canvasElement
		.querySelector("[data-typing-indicator]")
		?.getBoundingClientRect();
	if (!last || !typing) throw new Error("Message or typing indicator missing");
	await expect(typing.top).toBeGreaterThanOrEqual(Math.floor(last.bottom));
};

export const ChatAlignmentDesktop: Story = {
	render: () => <AlignmentDemo platform="desktop" />,
	play: async ({ canvasElement }) => {
		await checkAlignment(canvasElement, "desktop");
		await checkTypingClearsLastMessage(canvasElement);
		const article = canvasElement.querySelector(
			"[data-message]",
		) as HTMLElement;
		const style = getComputedStyle(article);
		await expect(style.borderTopLeftRadius).toBe("0px");
		await expect(style.borderTopRightRadius).toBe("4px");
		await expect(style.marginTop).toBe(`${CHAT_LAYOUT.desktop.groupGap}px`);
		const continuation = canvasElement.querySelector(
			"[data-message][data-continuation]",
		) as HTMLElement;
		await expect(getComputedStyle(continuation).marginTop).toBe("0px");
	},
};

export const ChatAlignmentMobile: Story = {
	parameters: mobile,
	render: () => <AlignmentDemo platform="mobile" />,
	play: async ({ canvasElement }) => {
		await checkAlignment(canvasElement, "mobile");
		await checkTypingClearsLastMessage(canvasElement);
		const article = canvasElement.querySelector(
			"[data-message]",
		) as HTMLElement;
		const style = getComputedStyle(article);
		await expect(style.borderTopRightRadius).toBe("0px");
		await expect(style.marginTop).toBe(`${CHAT_LAYOUT.mobile.groupGap}px`);
	},
};

const storyModerators: RoleIdentity = {
	id: "mods",
	name: "Moderators",
	color: "#c4a7ff",
	badge: { kind: "icon", name: "shield-check", color: "#76c4e5" },
};

const NameColorDemo = () => (
	<div class="flex min-h-dvh flex-col bg-background py-2 text-foreground">
		<MessageRow
			author={{ name: "Lis", nameColor: "#ff7a90" }}
			timestamp={at(9, 10)}
			now={NOW}
			locale="en-GB"
			data-testid="lis"
		>
			My name keeps the color I picked
		</MessageRow>
		<MessageRow
			author={{ name: "Lou", nameColor: "#22d3ee", role: storyModerators }}
			badge={<TeamBadge />}
			timestamp={at(9, 12)}
			now={NOW}
			locale="en-GB"
			reply={{
				author: { name: "Lis", nameColor: "#ff7a90" },
				text: "My name keeps the color I picked",
			}}
			data-testid="lou"
		>
			Mine follows the moderator role
		</MessageRow>
		<MessageRow
			author={{ name: "Kris", nameColor: "#000000" }}
			timestamp={at(9, 14)}
			now={NOW}
			locale="en-GB"
			data-testid="kris"
		>
			I picked black, which would vanish here
		</MessageRow>
		<MessageRow
			author={{ name: "Mara" }}
			timestamp={at(9, 16)}
			now={NOW}
			locale="en-GB"
			data-testid="mara"
		>
			No color for me
		</MessageRow>
		<TypingIndicator
			users={[
				{ name: "Lis", nameColor: "#ff7a90" },
				{ name: "Lou", nameColor: "#22d3ee", roleColor: "#c4a7ff" },
			]}
			class="px-4"
		/>
	</div>
);

const nameColorOf = (root: HTMLElement, id: string) => {
	const name = root.querySelector<HTMLElement>(
		`[data-testid="${id}"] [data-message-header] [data-author-name]`,
	);
	return getComputedStyle(name as Element).color;
};

export const NameColors: Story = {
	parameters: mobile,
	render: () => <NameColorDemo />,
	play: async ({ canvasElement, step }) => {
		await step("User colors show in chat", async () => {
			await expect(nameColorOf(canvasElement, "lis")).toBe(
				"rgb(255, 122, 144)",
			);
			await expect(nameColorOf(canvasElement, "mara")).toBe(
				"rgb(255, 255, 255)",
			);
		});

		await step("A role color overrides the user's color", async () => {
			await expect(nameColorOf(canvasElement, "lou")).toBe(
				"rgb(196, 167, 255)",
			);
		});

		await step("Unreadable colors are lightened in dark mode", async () => {
			const color = nameColorOf(canvasElement, "kris");
			const [r, g, b] = (color.match(/\d+/g) ?? []).map(Number);
			const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
			await expect(contrastRatio(hex, "#2c2c2c")).toBeGreaterThanOrEqual(4.5);
		});

		await step("Header order is name, role badge, user badges", async () => {
			const header = canvasElement.querySelector(
				'[data-testid="lou"] [data-message-header] > div',
			) as HTMLElement;
			const order = Array.from(header.children).map((child) =>
				child.matches("[data-author-name]")
					? "name"
					: child.querySelector("[data-role-badge]")
						? "role"
						: child.querySelector("[data-user-badge]") ||
								child.matches("[data-user-badge]")
							? "user"
							: "other",
			);
			await expect(order).toEqual(["name", "role", "user"]);
			await expect(
				within(header).getByRole("button", { name: "Moderators role" }),
			).toBeVisible();
		});

		await step("Replies and typing names use the same colors", async () => {
			const reply = canvasElement.querySelector<HTMLElement>(
				'[data-testid="lou"] [data-message-reply] [data-author-name]',
			);
			await expect(getComputedStyle(reply as Element).color).toBe(
				"rgb(255, 122, 144)",
			);
			const typing =
				canvasElement.querySelectorAll<HTMLElement>("[data-typing-name]");
			await expect(getComputedStyle(typing[0]).color).toBe(
				"rgb(255, 122, 144)",
			);
			await expect(getComputedStyle(typing[1]).color).toBe(
				"rgb(196, 167, 255)",
			);
		});
	},
};

export const NameColorsOverridden: Story = {
	parameters: mobile,
	render: () => (
		<NameColorProvider overrideUserColors>
			<NameColorDemo />
		</NameColorProvider>
	),
	play: async ({ canvasElement }) => {
		await expect(nameColorOf(canvasElement, "lis")).toBe("rgb(255, 255, 255)");
		await expect(nameColorOf(canvasElement, "lou")).toBe("rgb(196, 167, 255)");
	},
};

export const NameColorsLight: Story = {
	parameters: mobile,
	globals: { theme: "light" },
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background py-2 text-foreground">
			<MessageRow
				author={{ name: "Snow", nameColor: "#ffffff" }}
				timestamp={at(9, 10)}
				now={NOW}
				locale="en-GB"
				data-testid="snow"
			>
				White would vanish on a light background
			</MessageRow>
		</div>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(document.documentElement.dataset.theme).toBe("light"),
		);
		const color = nameColorOf(canvasElement, "snow");
		const [r, g, b] = (color.match(/\d+/g) ?? []).map(Number);
		const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
		await expect(contrastRatio(hex, "#e4e4e6")).toBeGreaterThanOrEqual(4.5);
	},
};
