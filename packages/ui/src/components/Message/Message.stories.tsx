import { MenuDotsIcon } from "@solar-icons/solid/bold/menu-dots";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { ReplyIcon } from "@solar-icons/solid/linear/reply";
import { createSignal, For, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { tabTo } from "../../foundations/focus-ring-test";
import {
	EMULATED_WINDOW_CHROME,
	emulateWindowChrome,
	expectClearOfWindowChrome,
	expectNoLayoutIssues,
} from "../../foundations/layout-test";
import {
	type GroupableMessage,
	groupMessages,
} from "../../utils/message-groups";
import { contrastRatio, NameColorProvider } from "../../utils/name-color";
import { formatMessageTime } from "../../utils/time";
import { MESSAGE_LINE_HEIGHT } from "../../utils/typography";
import { defaultAvatarFor } from "../Avatar/default-avatars/default-avatars";
import { MentionChip, TeamBadge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { COMPOSER_TYPING_INSET, Composer } from "../Composer/Composer";
import { TypingIndicator } from "../Composer/TypingIndicator";
import { MessageMenuItems } from "../ContextMenu/MessageMenu";
import { EmojiPickerPopover } from "../EmojiPicker/EmojiPickerPopover";
import { IconButton } from "../IconButton/IconButton";
import { InboxGroupCard } from "../Inbox/InboxGroupCard";
import { Lightbox } from "../Lightbox/Lightbox";
import { MessageToolbar } from "../MessageActions/MessageToolbar";
import { ConfirmDialog } from "../Modal/ConfirmDialog";
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
		const plain = (value: string) => value.replace(/[\u202f\u00a0]/g, " ");
		await expect(plain(formatMessageTime(at(14, 2), NOW, "en-US"))).toBe(
			"2:02 PM",
		);
		await expect(formatMessageTime(at(14, 2), NOW, "de-DE")).toBe("14:02");
		await expect(formatMessageTime(at(9, 10, -1), NOW, "de-DE")).toBe(
			"Yesterday at 09:10",
		);
		await expect(
			plain(formatMessageTime(new Date(2026, 2, 12, 18, 30), NOW, "en-US")),
		).toBe("3/12/26, 6:30 PM");
		await expect(
			formatMessageTime(new Date(2025, 2, 12, 18, 30), NOW, "de-DE"),
		).toBe("12.03.25, 18:30");
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

const replyEmoji = (letter: string, fill: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="${fill}"/><text x="12" y="17" font-size="13" text-anchor="middle" font-family="sans-serif" fill="#111">${letter}</text></svg>`,
	)}`;

export const ReplyCustomEmoji: Story = {
	parameters: mobile,
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background py-2 text-foreground">
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={at(9, 36)}
				now={NOW}
				locale="en-GB"
				reply={{
					author: { name: "Username" },
					parts: [
						"Shipping it today ",
						{ name: "kek", src: replyEmoji("k", "#e0a458") },
						" and then ",
						{ name: "party", src: replyEmoji("p", "#8fbf7f") },
						" all weekend, with a long tail so the preview has to cut off at the edge",
					],
					onClick: () => {},
				}}
			>
				Same here!
			</MessageRow>
		</div>
	),
	play: async ({ canvasElement }) => {
		const line = canvasElement.querySelector(
			"[data-message-reply] [data-reply-text]",
		) as HTMLElement;
		const emoji = Array.from(
			line.querySelectorAll<HTMLImageElement>("[data-reply-emoji]"),
		);
		await expect(emoji.map((image) => image.alt)).toEqual([":kek:", ":party:"]);
		await expect(line.textContent).not.toContain(":kek:");
		await expect(line).toHaveTextContent("Shipping it today and then all");
		const button = canvasElement.querySelector(
			"[data-message-reply] button",
		) as HTMLElement;
		await expect(
			button.querySelector("a, button, [tabindex], input"),
		).toBeNull();
		const lineBox = line.getBoundingClientRect();
		for (const image of emoji) {
			await waitFor(() => expect(image.complete).toBe(true));
			const box = image.getBoundingClientRect();
			await expect(box.height).toBe(16);
			await expect(box.top).toBeGreaterThanOrEqual(lineBox.top - 1);
			await expect(box.bottom).toBeLessThanOrEqual(lineBox.bottom + 1);
		}
		await expect(line.scrollWidth).toBeGreaterThan(line.clientWidth);
		await expect(getComputedStyle(line).textOverflow).toBe("ellipsis");
		const row = canvasElement.querySelector("[data-message-reply]") as Element;
		await expect(row.getBoundingClientRect().right).toBeLessThanOrEqual(
			window.innerWidth,
		);
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
		await expect(row).toHaveAttribute("data-dimmed");
		const content = row?.querySelector<HTMLElement>(".transition-opacity");
		await expect(content && getComputedStyle(content).opacity).toBe("0.6");
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

export const TextSelection: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background py-2 text-foreground">
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={at(9, 40)}
				now={NOW}
				locale="en-GB"
				attachments={<div class="h-24 w-40 rounded-control bg-secondary" />}
				reactions={<span>Reaction</span>}
				toolbar={<span>Toolbar</span>}
				thread={<span>Thread card</span>}
				data-testid="selection-desktop"
			/>
			<MessageRow
				author={{ name: "Username" }}
				badge={<TeamBadge />}
				timestamp={at(9, 41)}
				now={NOW}
				locale="en-GB"
				reply={{
					author: { name: "Quoted" },
					text: "Quoted reply text",
					onClick: () => {},
				}}
				data-testid="selection-next"
			>
				Next message
			</MessageRow>
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={at(9, 42)}
				now={NOW}
				locale="en-GB"
				platform="mobile"
				data-testid="selection-mobile"
			>
				On a phone
			</MessageRow>
		</div>
	),
	play: async ({ canvasElement }) => {
		const userSelect = (element: Element | null | undefined) =>
			element ? getComputedStyle(element).userSelect : undefined;
		const desktop = canvasElement.querySelector(
			'[data-testid="selection-desktop"]',
		);
		const next = canvasElement.querySelector('[data-testid="selection-next"]');
		const mobileRow = canvasElement.querySelector(
			'[data-testid="selection-mobile"]',
		);
		await expect(
			userSelect(desktop?.querySelector("[data-message-header]")),
		).toBe("text");
		await expect(
			userSelect(desktop?.querySelector("[data-message-attachments]")),
		).toBe("text");
		await expect(
			userSelect(desktop?.querySelector("[data-message-reactions]")),
		).toBe("none");
		await expect(
			userSelect(desktop?.querySelector("[data-message-toolbar]")),
		).toBe("none");
		await expect(
			userSelect(desktop?.querySelector(":scope > div > span")),
		).toBe("none");
		await expect(
			userSelect(mobileRow?.querySelector("[data-message-header]")),
		).toBe("none");
		const attachments = desktop?.querySelector("[data-message-attachments]");
		const nextContent = next?.querySelector("[data-message-content]");
		if (!attachments || !nextContent) throw new Error("rows missing");
		const range = document.createRange();
		range.setStart(attachments, 0);
		range.setEnd(nextContent, nextContent.childNodes.length);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		const copied = selection?.toString() ?? "";
		selection?.removeAllRanges();
		await expect(copied).toContain("Username");
		await expect(copied).toContain("Next message");
		await expect(copied).not.toContain("Reaction");
		await expect(copied).not.toContain("Toolbar");
		await expect(copied).not.toContain("Quoted");
		await expect(copied).not.toContain("Thread card");
		await expect(userSelect(next?.querySelector("[data-message-time]"))).toBe(
			"none",
		);
		await expect(copied).not.toContain(
			next
				?.querySelector("[data-message-header] > div > :nth-child(2)")
				?.textContent?.trim() || "missing badge",
		);
	},
};

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

const lineTops = (element: Element) => {
	const range = document.createRange();
	range.selectNodeContents(element);
	const tops = Array.from(range.getClientRects())
		.filter((rect) => rect.width > 0)
		.map((rect) => Math.round(rect.top));
	return [...new Set(tops)].sort((a, b) => a - b);
};

const firstLineCenter = (element: Element) => {
	const range = document.createRange();
	range.selectNodeContents(element);
	const first = Array.from(range.getClientRects()).find(
		(rect) => rect.width > 0,
	) as DOMRect;
	return first.top + first.height / 2;
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
		const long = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-message-content]"),
		).find((element) => element.textContent?.includes("old mill"));
		if (!long) throw new Error("missing long message");
		await expect(getComputedStyle(long).lineHeight).toBe(
			`${MESSAGE_LINE_HEIGHT}px`,
		);
		const tops = lineTops(long);
		await expect(tops.length).toBeGreaterThan(3);
		for (let index = 1; index < tops.length; index++) {
			await expect(
				Math.abs(
					(tops[index] as number) -
						(tops[index - 1] as number) -
						MESSAGE_LINE_HEIGHT,
				),
			).toBeLessThanOrEqual(1);
		}
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
		const view = canvasElement.querySelector(
			"[data-message-content]",
		) as HTMLElement;
		const viewLine = Number.parseFloat(getComputedStyle(view).lineHeight);
		const viewLines = lineTops(view).length;
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
		await expect(lineHeight).toBe(viewLine);
		await expect(lineHeight).toBe(MESSAGE_LINE_HEIGHT);
		await expect(paragraph.getBoundingClientRect().height).toBe(
			viewLines * MESSAGE_LINE_HEIGHT,
		);
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

const focusRowFromKeyboard = (row: HTMLElement) => {
	document.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
	);
	row.focus();
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
		await userEvent.click(row);
		await expect(document.activeElement).toBe(row);
		await expect(getComputedStyle(time).opacity).toBe("0");
		row.blur();
		focusRowFromKeyboard(row);
		await waitFor(() => expect(getComputedStyle(time).opacity).toBe("1"));
		row.blur();
		await waitFor(() => expect(getComputedStyle(time).opacity).toBe("0"));
		await expect(time.textContent).toBe("09:06");
		const content = row.querySelector("[data-message-content]") as HTMLElement;
		const timeRect = time.getBoundingClientRect();
		await expect(timeRect.height).toBe(MESSAGE_LINE_HEIGHT);
		await expect(
			Math.abs(timeRect.top + timeRect.height / 2 - firstLineCenter(content)),
		).toBeLessThanOrEqual(1);
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
		await userEvent.click(row);
		await expect(document.activeElement).toBe(row);
		await expect(getComputedStyle(toolbar).visibility).toBe("hidden");
		row.blur();
		focusRowFromKeyboard(row);
		await waitFor(() =>
			expect(getComputedStyle(toolbar).visibility).toBe("visible"),
		);
		const reply = within(toolbar).getByRole("button", { name: "Reply" });
		reply.focus();
		await expect(getComputedStyle(toolbar).visibility).toBe("visible");
		await userEvent.click(reply);
		await waitFor(() =>
			expect(getComputedStyle(toolbar).visibility).toBe("hidden"),
		);
		reply.blur();
		await waitFor(() =>
			expect(getComputedStyle(toolbar).visibility).toBe("hidden"),
		);
	},
};

export const DesktopToolbarMenuOpen: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background px-4 py-8 text-foreground">
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={at(9, 4)}
				now={NOW}
				locale="en-GB"
				toolbar={<ToolbarPlaceholder />}
				toolbarOpen
				data-testid="menu-open"
			>
				The toolbar stays while one of its menus is open
			</MessageRow>
		</div>
	),
	play: async ({ canvasElement }) => {
		const toolbar = canvasElement.querySelector<HTMLElement>(
			'[data-testid="menu-open"] [data-message-toolbar]',
		);
		await expect(toolbar).not.toBeNull();
		if (!toolbar) return;
		await expect(getComputedStyle(toolbar).visibility).toBe("visible");
	},
};

const toolbarParts = (row: HTMLElement) => {
	const layer = row.querySelector<HTMLElement>("[data-message-toolbar]");
	const bar = layer?.firstElementChild as HTMLElement | null | undefined;
	if (!layer || !bar) throw new Error("Missing toolbar");
	return { layer, bar };
};

const expectToolbarAboveRow = async (row: HTMLElement) => {
	const { layer, bar } = toolbarParts(row);
	await waitFor(() => expect(layer.matches(":popover-open")).toBe(true));
	const rowRect = row.getBoundingClientRect();
	const barRect = bar.getBoundingClientRect();
	const liftedTop = rowRect.top + 1 - layer.offsetHeight * 0.75;
	await expect(Math.abs(barRect.top - liftedTop)).toBeLessThanOrEqual(0.5);
	await expect(barRect.bottom).toBeGreaterThan(rowRect.top);
	await expect(
		Math.abs(rowRect.right - 12 - barRect.right),
	).toBeLessThanOrEqual(0.5);
	const x = barRect.left + barRect.width / 2;
	const center = document.elementFromPoint(x, barRect.top + barRect.height / 2);
	await expect(center && bar.contains(center)).toBe(true);
	const above = document.elementFromPoint(x, barRect.bottom - 0.5);
	const below = document.elementFromPoint(x, barRect.bottom + 0.5);
	await expect(above && layer.contains(above)).toBe(true);
	await expect(below && row.contains(below)).toBe(true);
	return { rowRect, barRect };
};

const showToolbarFromKeyboard = async (row: HTMLElement) => {
	row.tabIndex = -1;
	focusRowFromKeyboard(row);
	const { layer } = toolbarParts(row);
	await waitFor(() =>
		expect(getComputedStyle(layer).visibility).toBe("visible"),
	);
};

const ToolbarFrame = (props: { toolbarOpen?: boolean }) => (
	<div
		data-testid="toolbar-frame"
		class="flex h-dvh flex-col bg-background text-foreground"
	>
		<div
			data-testid="toolbar-header"
			class="flex h-12 shrink-0 items-center border-b border-border px-4 font-semibold"
		>
			# general
		</div>
		<div data-testid="toolbar-scroller" class="min-h-0 flex-1 overflow-y-auto">
			<For each={groupMessages(conversation)}>
				{(entry, index) => (
					<MessageRow
						author={{ name: entry.message.name }}
						badge={entry.message.team ? <TeamBadge /> : undefined}
						timestamp={entry.message.timestamp}
						now={NOW}
						locale="en-GB"
						continuation={entry.continuation}
						toolbar={<ToolbarPlaceholder />}
						toolbarOpen={props.toolbarOpen && index() === 0}
						data-testid={`above-${entry.message.id}`}
						class={index() === 0 ? "mt-0" : undefined}
					>
						{entry.message.body()}
					</MessageRow>
				)}
			</For>
		</div>
	</div>
);

const frameParts = (canvasElement: HTMLElement) => {
	const frame = canvasElement.querySelector<HTMLElement>(
		'[data-testid="toolbar-frame"]',
	);
	const scroller = canvasElement.querySelector<HTMLElement>(
		'[data-testid="toolbar-scroller"]',
	);
	const first = canvasElement.querySelector<HTMLElement>(
		'[data-testid="above-1"]',
	);
	const grouped = canvasElement.querySelector<HTMLElement>(
		'[data-testid="above-3"]',
	);
	if (!frame || !scroller || !first || !grouped)
		throw new Error("Missing rows");
	return { frame, scroller, first, grouped };
};

export const DesktopToolbarAboveRow: Story = {
	render: () => <ToolbarFrame />,
	play: async ({ canvasElement }) => {
		const { frame, scroller, first, grouped } = frameParts(canvasElement);
		await expect(grouped).toHaveAttribute("data-continuation");
		await showToolbarFromKeyboard(first);
		await expect(toolbarParts(first).layer).toHaveAttribute(
			"data-toolbar-layer",
			"top",
		);
		const top = await expectToolbarAboveRow(first);
		await expect(top.barRect.top).toBeLessThan(
			scroller.getBoundingClientRect().top,
		);
		await expectNoLayoutIssues(frame);
		first.blur();
		await showToolbarFromKeyboard(grouped);
		await expectToolbarAboveRow(grouped);
		await expectNoLayoutIssues(frame);
		grouped.blur();
	},
};

export const DesktopToolbarOwnMenuAtScrollerTop: Story = {
	render: () => <ToolbarFrame toolbarOpen />,
	play: async ({ canvasElement }) => {
		const { frame, scroller, first } = frameParts(canvasElement);
		const { layer, bar } = toolbarParts(first);
		await expect(layer).toHaveAttribute("data-toolbar-layer", "row");
		await expect(layer.matches(":popover-open")).toBe(false);
		await expect(getComputedStyle(layer).visibility).toBe("visible");
		const barRect = bar.getBoundingClientRect();
		const rowRect = first.getBoundingClientRect();
		await expect(barRect.top).toBeGreaterThanOrEqual(
			scroller.getBoundingClientRect().top - 0.5,
		);
		await expect(barRect.bottom).toBeLessThanOrEqual(rowRect.bottom + 0.5);
		await expect(
			Math.abs(rowRect.right - 12 - barRect.right),
		).toBeLessThanOrEqual(0.5);
		const hit = document.elementFromPoint(
			barRect.left + barRect.width / 2,
			barRect.top + barRect.height / 2,
		);
		await expect(hit && bar.contains(hit)).toBe(true);
		await expectNoLayoutIssues(frame);
	},
};

export const DesktopToolbarClearsWindowChrome: Story = {
	render: () => (
		<div
			class="flex h-dvh flex-col bg-background text-foreground"
			style={{ "padding-top": `${EMULATED_WINDOW_CHROME}px` }}
		>
			<div class="min-h-0 flex-1 overflow-y-auto">
				<MessageRow
					author={{ name: "Lou" }}
					timestamp={at(9, 4)}
					now={NOW}
					locale="en-GB"
					toolbar={<ToolbarPlaceholder />}
					class="mt-0"
					data-testid="chrome-row"
				>
					The first row sits right under the window chrome
				</MessageRow>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const restore = emulateWindowChrome();
		try {
			const row = canvasElement.querySelector<HTMLElement>(
				'[data-testid="chrome-row"]',
			);
			if (!row) throw new Error("Missing row");
			await showToolbarFromKeyboard(row);
			const { layer, bar } = toolbarParts(row);
			await waitFor(() => expect(layer.matches(":popover-open")).toBe(true));
			window.dispatchEvent(new Event("resize"));
			await waitFor(() =>
				expect(bar.getBoundingClientRect().top).toBeGreaterThanOrEqual(
					EMULATED_WINDOW_CHROME - 0.5,
				),
			);
			await expectClearOfWindowChrome(layer);
			row.blur();
		} finally {
			restore();
		}
	},
};

const overlayHidesToolbar = async (layer: HTMLElement, bar: HTMLElement) => {
	await waitFor(() => expect(layer).toHaveAttribute("data-overlay-hidden"));
	await expect(getComputedStyle(layer).opacity).toBe("0");
	await expect(getComputedStyle(layer).pointerEvents).toBe("none");
	const rect = bar.getBoundingClientRect();
	const hit = document.elementFromPoint(
		rect.left + rect.width / 2,
		rect.top + rect.height / 2,
	);
	await expect(hit && layer.contains(hit)).toBe(false);
};

const toolbarStaysUnder = async (layer: HTMLElement, overlay: HTMLElement) => {
	await waitFor(() =>
		expect(layer).toHaveAttribute("data-toolbar-layer", "row"),
	);
	await expect(layer).not.toHaveAttribute("data-overlay-hidden");
	await expect(layer.matches(":popover-open")).toBe(false);
	await expect(getComputedStyle(layer).visibility).toBe("visible");
	await expect(getComputedStyle(layer).opacity).toBe("1");
	await paintsOnTop(overlay);
};

const paintsOnTop = async (overlay: HTMLElement) => {
	const rect = overlay.getBoundingClientRect();
	const hit = document.elementFromPoint(
		rect.left + rect.width / 2,
		rect.top + rect.height / 2,
	);
	await expect(hit && overlay.contains(hit)).toBe(true);
};

let openUnrelatedDialog: (() => void) | undefined;

export const DesktopToolbarOverlays: Story = {
	render: () => {
		const [menuOpen, setMenuOpen] = createSignal(false);
		const [picker, setPicker] = createSignal<HTMLElement>();
		const [confirming, setConfirming] = createSignal(false);
		openUnrelatedDialog = () => setConfirming(true);
		return (
			<div class="flex min-h-dvh flex-col bg-background px-4 pt-24 text-foreground">
				<MessageRow
					author={{ name: "Lou" }}
					timestamp={at(9, 4)}
					now={NOW}
					locale="en-GB"
					toolbarOpen={menuOpen() || !!picker()}
					data-testid="overlay-row"
					toolbar={
						<MessageToolbar
							own
							recentReactions={["🐦"]}
							onReact={() => {}}
							onAddReaction={(event) =>
								setPicker(event.currentTarget as HTMLElement)
							}
							onEdit={() => {}}
							onForward={() => {}}
							menuOpen={menuOpen()}
							onMenuOpenChange={setMenuOpen}
							menu={<MessageMenuItems onReply={() => {}} onDelete={() => {}} />}
						/>
					}
				>
					Its own menus sit above the toolbar, other dialogs hide it
				</MessageRow>
				<Show when={picker()}>
					{(anchorElement) => (
						<EmojiPickerPopover
							open
							onOpenChange={(open) => {
								if (!open) setPicker(undefined);
							}}
							anchorElement={anchorElement()}
							placement="bottom-end"
							label="Add a reaction"
							onPick={() => {}}
						/>
					)}
				</Show>
				<ConfirmDialog
					open={confirming()}
					onOpenChange={setConfirming}
					title="Leave this Space?"
					confirmLabel="Leave"
					tone="destructive"
					onConfirm={() => {
						setConfirming(false);
					}}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector<HTMLElement>(
			'[data-testid="overlay-row"]',
		);
		if (!row) throw new Error("Missing row");
		await showToolbarFromKeyboard(row);
		const { layer, bar } = toolbarParts(row);
		await waitFor(() => expect(layer.matches(":popover-open")).toBe(true));
		await expect(layer).toHaveAttribute("data-toolbar-layer", "top");
		const toolbar = within(bar);

		const add = toolbar.getByRole("button", { name: "Add reaction" });
		await tabTo(add);
		const tooltip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
		await waitFor(() => expect(getComputedStyle(tooltip).opacity).toBe("1"));
		await expect(layer).not.toHaveAttribute("data-overlay-hidden");
		const tip = tooltip.getBoundingClientRect();
		const barRect = bar.getBoundingClientRect();
		await expect(
			tip.bottom <= barRect.top + 0.5 || tip.top >= barRect.bottom - 0.5,
		).toBe(true);
		await paintsOnTop(tooltip);

		const more = toolbar.getByRole("button", { name: "More actions" });
		await tabTo(more);
		await userEvent.keyboard("{Enter}");
		const menu = await screen.findByRole("menu");
		await toolbarStaysUnder(layer, menu);
		await expect(more).toHaveAttribute("data-expanded");
		await expect(getComputedStyle(more).backgroundColor).not.toBe(
			"rgba(0, 0, 0, 0)",
		);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await expect(document.activeElement).toBe(more);
		await waitFor(() =>
			expect(layer).toHaveAttribute("data-toolbar-layer", "top"),
		);

		add.focus();
		await expect(document.activeElement).toBe(add);
		await userEvent.keyboard("{Enter}");
		const pickerDialog = await screen.findByRole("dialog", {
			name: "Add a reaction",
		});
		await toolbarStaysUnder(layer, pickerDialog);
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Add a reaction" }),
			).toBeNull(),
		);
		await waitFor(() =>
			expect(layer).toHaveAttribute("data-toolbar-layer", "top"),
		);

		const rowRect = row.getBoundingClientRect();
		row.dispatchEvent(
			new PointerEvent("pointermove", {
				bubbles: true,
				pointerType: "mouse",
				clientX: rowRect.left + 31,
				clientY: rowRect.top + 7,
			}),
		);
		row.dispatchEvent(new PointerEvent("pointerenter"));
		await waitFor(() => expect(layer.matches(":popover-open")).toBe(true));
		openUnrelatedDialog?.();
		const dialog = await screen.findByRole("dialog", {
			name: "Leave this Space?",
		});
		await overlayHidesToolbar(layer, bar);
		await paintsOnTop(dialog);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Cancel" }),
		);
		await waitFor(() =>
			expect(layer).not.toHaveAttribute("data-overlay-hidden"),
		);
	},
};

export const DesktopToolbarHidesWhileTyping: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background px-4 py-16 text-foreground">
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={at(9, 4)}
				now={NOW}
				locale="en-GB"
				toolbar={<ToolbarPlaceholder />}
				data-testid="typing-row"
			>
				Type in the composer and this toolbar steps aside
			</MessageRow>
			<textarea
				aria-label="Composer stand-in"
				data-testid="typing-input"
				class="mt-8 h-20 rounded-control border border-border bg-card p-2"
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector<HTMLElement>(
			'[data-testid="typing-row"]',
		);
		const input = canvasElement.querySelector<HTMLTextAreaElement>(
			'[data-testid="typing-input"]',
		);
		if (!row || !input) throw new Error("Missing row");
		const rect = row.getBoundingClientRect();
		const pointer = (type: string, x: number) =>
			row.dispatchEvent(
				new PointerEvent(type, {
					bubbles: type !== "pointerenter",
					clientX: x,
					clientY: rect.top + 10,
					pointerType: "mouse",
				}),
			);
		pointer("pointermove", rect.left + 40);
		pointer("pointerenter", rect.left + 40);
		const { layer } = toolbarParts(row);
		await waitFor(() => expect(layer.matches(":popover-open")).toBe(true));
		input.focus();
		input.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Shift", bubbles: true }),
		);
		await waitFor(() => expect(layer.matches(":popover-open")).toBe(false));
		pointer("pointermove", rect.left + 40);
		await expect(layer.matches(":popover-open")).toBe(false);
		pointer("pointermove", rect.left + 50);
		await waitFor(() => expect(layer.matches(":popover-open")).toBe(true));
		input.dispatchEvent(
			new KeyboardEvent("keydown", { key: "h", bubbles: true }),
		);
		await waitFor(() => expect(layer.matches(":popover-open")).toBe(false));
		pointer("pointermove", rect.left + 60);
		await waitFor(() => expect(layer.matches(":popover-open")).toBe(true));
		input.blur();
	},
};

const COVER_IMAGE = `data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#4a7a9c"/></svg>',
)}`;

const setFullscreenElement = (
	element: Element | null,
	event: "fullscreenchange" | "webkitfullscreenchange",
) => {
	Object.defineProperty(document, "fullscreenElement", {
		configurable: true,
		get: () => element,
	});
	document.dispatchEvent(new Event(event));
};

const clearFullscreenElement = (
	event: "fullscreenchange" | "webkitfullscreenchange",
) => {
	Reflect.deleteProperty(document, "fullscreenElement");
	document.dispatchEvent(new Event(event));
};

const toolbarShown = (layer: HTMLElement) =>
	layer.matches(":popover-open") && getComputedStyle(layer).display !== "none";

export const DesktopToolbarUnderMedia: Story = {
	render: () => {
		const [lightbox, setLightbox] = createSignal(false);
		return (
			<div
				data-testid="media-frame"
				class="flex min-h-dvh flex-col gap-6 bg-background px-4 py-16 text-foreground"
			>
				<MessageRow
					author={{ name: "Lou" }}
					timestamp={at(9, 4)}
					now={NOW}
					locale="en-GB"
					toolbar={<ToolbarPlaceholder />}
					data-testid="media-hover-row"
				>
					A hovered toolbar steps aside for a lightbox or fullscreen video
				</MessageRow>
				<MessageRow
					author={{ name: "Lis" }}
					timestamp={at(9, 5)}
					now={NOW}
					locale="en-GB"
					toolbar={<ToolbarPlaceholder />}
					toolbarOpen
					data-testid="media-held-row"
				>
					A held toolbar steps aside too
				</MessageRow>
				<Button
					variant="secondary"
					class="self-start"
					onClick={() => setLightbox(true)}
				>
					Open the image
				</Button>
				<Lightbox
					items={[
						{
							src: COVER_IMAGE,
							width: 1200,
							height: 800,
							kind: "image",
							name: "lake.png",
							alt: "A flat blue picture.",
						},
					]}
					open={lightbox()}
					onOpenChange={setLightbox}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const hovered = canvasElement.querySelector<HTMLElement>(
			'[data-testid="media-hover-row"]',
		);
		const held = canvasElement.querySelector<HTMLElement>(
			'[data-testid="media-held-row"]',
		);
		const frame = canvasElement.querySelector<HTMLElement>(
			'[data-testid="media-frame"]',
		);
		if (!hovered || !held || !frame) throw new Error("Missing rows");
		let nudge = 0;
		const hover = () => {
			const rect = hovered.getBoundingClientRect();
			nudge += 1;
			hovered.dispatchEvent(
				new PointerEvent("pointermove", {
					bubbles: true,
					pointerType: "mouse",
					clientX: rect.left + 40 + nudge,
					clientY: rect.top + 10,
				}),
			);
			hovered.dispatchEvent(new PointerEvent("pointerenter"));
		};
		hover();
		const hoverLayer = toolbarParts(hovered).layer;
		const heldLayer = toolbarParts(held).layer;
		await waitFor(() => expect(toolbarShown(hoverLayer)).toBe(true));
		await expect(getComputedStyle(heldLayer).display).not.toBe("none");
		await expectNoLayoutIssues(frame);

		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open the image" }),
		);
		const dialog = await screen.findByRole("dialog", { name: /image/i });
		await waitFor(() => expect(dialog).toHaveAttribute("data-phase", "open"));
		await waitFor(() =>
			expect(hoverLayer.matches(":popover-open")).toBe(false),
		);
		await expect(hoverLayer).toHaveAttribute("data-media-hidden");
		await expect(getComputedStyle(heldLayer).display).toBe("none");
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(document.querySelector("[data-lightbox]")).toBeNull(),
		);
		hover();
		await waitFor(() => expect(toolbarShown(hoverLayer)).toBe(true));
		await expect(getComputedStyle(heldLayer).display).not.toBe("none");

		const video = document.createElement("video");
		frame.append(video);
		for (const event of [
			"fullscreenchange",
			"webkitfullscreenchange",
		] as const) {
			setFullscreenElement(video, event);
			await waitFor(() =>
				expect(hoverLayer.matches(":popover-open")).toBe(false),
			);
			await expect(getComputedStyle(heldLayer).display).toBe("none");
			clearFullscreenElement(event);
			hover();
			await waitFor(() => expect(toolbarShown(hoverLayer)).toBe(true));
			await expect(getComputedStyle(heldLayer).display).not.toBe("none");
		}
		video.remove();
	},
};

export const ContinuationTimeSubtext: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col bg-background px-4 py-8 text-foreground">
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
				showTime
				data-testid="subtext-continuation"
			>
				<RichTextRenderer
					value={build([
						{ block: [f.subtext], parts: ["Small print under the message"] },
					])}
				/>
			</MessageRow>
		</div>
	),
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector<HTMLElement>(
			'[data-testid="subtext-continuation"]',
		);
		const time = row?.querySelector<HTMLElement>("[data-continuation-time]");
		const subtext = row?.querySelector<HTMLElement>(
			'[data-facet-type="subtext"]',
		);
		if (!row || !time || !subtext) throw new Error("Missing subtext row");
		await expect(getComputedStyle(subtext).fontSize).toBe("14px");
		const timeRect = time.getBoundingClientRect();
		await expect(timeRect.height).toBe(MESSAGE_LINE_HEIGHT);
		await expect(
			Math.abs(timeRect.top + timeRect.height / 2 - firstLineCenter(subtext)),
		).toBeLessThanOrEqual(1);
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
		await expect(long.getBoundingClientRect().height).toBeLessThanOrEqual(
			MESSAGE_LINE_HEIGHT * 3 + 1,
		);
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
		<div
			class="flex flex-col pb-2"
			style={{ "padding-bottom": `${8 + COMPOSER_TYPING_INSET}px` }}
		>
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
			typing={
				<TypingIndicator
					size="sm"
					users={[{ name: "Kris" }, { name: "Lou" }]}
				/>
			}
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
			const time = canvasElement.querySelector(
				'[data-testid="lou"] [data-message-header] [data-message-time]',
			) as HTMLElement;
			const style = getComputedStyle(time);
			await expect(style.fontSize).toBe("11px");
			await expect(style.fontVariantNumeric).toBe("tabular-nums");
			const gap =
				time.getBoundingClientRect().left -
				header.getBoundingClientRect().right;
			await expect(gap).toBeGreaterThanOrEqual(7.5);
			await expect(gap).toBeLessThanOrEqual(8.5);
			await expect(time.querySelector("time[datetime]")).not.toBeNull();
			await expect(time.querySelector("time")?.title).not.toBe("");
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

const seedPair = () => {
	const first = "did:plc:sameNameA";
	for (let index = 0; index < 50; index++) {
		const second = `did:plc:sameNameB${index}`;
		if (defaultAvatarFor(second) !== defaultAvatarFor(first)) {
			return [first, second] as const;
		}
	}
	throw new Error("No distinct seeds found");
};

const [SEED_A, SEED_B] = seedPair();

export const DefaultAvatarsFollowSeed: Story = {
	parameters: mobile,
	render: () => (
		<div class="flex flex-col bg-background">
			<For
				each={[
					{ testId: "a", name: "Alex", seed: SEED_A },
					{ testId: "b", name: "Alex", seed: SEED_B },
					{ testId: "c", name: "Renamed Alex", seed: SEED_A },
				]}
			>
				{(author) => (
					<div data-testid={author.testId}>
						<MessageRow
							platform="mobile"
							author={{ name: author.name, seed: author.seed }}
							timestamp={at(9, 30)}
							now={NOW}
							locale="en-GB"
						>
							Same name, different person
						</MessageRow>
					</div>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		const illustration = (testId: string) =>
			canvasElement
				.querySelector(`[data-testid="${testId}"] [data-default-avatar]`)
				?.getAttribute("data-default-avatar");
		await expect(illustration("a")).toBe(defaultAvatarFor(SEED_A));
		await expect(illustration("b")).toBe(defaultAvatarFor(SEED_B));
		await expect(illustration("a")).not.toBe(illustration("b"));
		await expect(illustration("c")).toBe(illustration("a"));
	},
};

export const OwnerCrown: Story = {
	render: () => (
		<div class="flex flex-col bg-background py-4">
			<div data-testid="owner">
				<MessageRow
					platform="desktop"
					author={{
						name: "Lou with a display name long enough to truncate in the header",
						seed: SEED_A,
						owner: true,
						role: {
							id: "core",
							name: "Core team",
							color: "#a579ff",
							badge: { kind: "icon", name: "shield-check" },
						},
					}}
					timestamp={at(9, 30)}
					now={NOW}
					locale="en-GB"
				>
					Welcome to the Space
				</MessageRow>
			</div>
			<div data-testid="member">
				<MessageRow
					platform="desktop"
					author={{ name: "Tim", seed: SEED_B }}
					timestamp={at(9, 31)}
					now={NOW}
					locale="en-GB"
				>
					Thanks!
				</MessageRow>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const owner = canvasElement.querySelector(
			'[data-testid="owner"]',
		) as HTMLElement;
		const crown = within(owner).getByRole("button", { name: "Space Owner" });
		const header = owner.querySelector("[data-message-header]") as HTMLElement;
		const name = owner.querySelector("[data-author-name]") as HTMLElement;
		await expect(header.contains(crown)).toBe(true);
		await expect(crown.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			name.getBoundingClientRect().right,
		);
		await expect(crown.getBoundingClientRect().right).toBeLessThanOrEqual(
			header.getBoundingClientRect().right,
		);
		const member = canvasElement.querySelector(
			'[data-testid="member"]',
		) as HTMLElement;
		await expect(
			within(member).queryByRole("button", { name: "Space Owner" }),
		).toBeNull();
		await userEvent.hover(crown);
		const tooltip = await screen.findByRole("tooltip", {}, { timeout: 3000 });
		await expect(tooltip).toHaveTextContent("Space Owner");
		await userEvent.unhover(crown);
	},
};

export const BridgedAuthor: Story = {
	render: () => (
		<div class="flex flex-col bg-background py-4">
			<div data-testid="member">
				<MessageRow
					platform="desktop"
					author={{ name: "Tim", seed: SEED_B }}
					timestamp={at(9, 30)}
					now={NOW}
					locale="en-GB"
					onAuthorClick={fn()}
					onAuthorMenu={fn()}
				>
					Can you all see this?
				</MessageRow>
			</div>
			<div data-testid="bridged">
				<MessageRow
					platform="desktop"
					author={{ name: "Max", seed: SEED_A }}
					via="Matrix"
					timestamp={at(9, 31)}
					now={NOW}
					locale="en-GB"
				>
					Hey from the other side of the bridge
				</MessageRow>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const member = canvasElement.querySelector(
			'[data-testid="member"]',
		) as HTMLElement;
		await expect(
			within(member).getByRole("button", { name: "Tim's profile" }),
		).toBeVisible();
		const memberName = member.querySelector("[data-author-name]");
		await expect(memberName?.tagName).toBe("BUTTON");

		const bridged = canvasElement.querySelector(
			'[data-testid="bridged"]',
		) as HTMLElement;
		await expect(within(bridged).queryByRole("button")).toBeNull();
		await expect(bridged.querySelector("[data-member-menu]")).toBeNull();
		const name = bridged.querySelector("[data-author-name]") as HTMLElement;
		await expect(name.tagName).toBe("SPAN");
		await expect(name.className).not.toContain("hover:underline");
		await expect(getComputedStyle(name).cursor).not.toBe("pointer");
		const avatar = bridged.querySelector(
			"[data-default-avatar]",
		) as HTMLElement;
		await expect(avatar.closest("button")).toBeNull();
		await expect(getComputedStyle(avatar).cursor).not.toBe("pointer");
		await expect(within(bridged).getByText("via Matrix")).toBeVisible();
	},
};

const BRIDGE_DID = "did:plc:matrixbridge";

const bridgedConversation = [
	{
		id: "max-1",
		name: "Max",
		seed: SEED_A,
		author: BRIDGE_DID,
		groupKey: `${BRIDGE_DID} 3lbridgereg22 @max:matrix.org`,
		timestamp: at(9, 30),
		text: "Anyone around for the canal walk?",
	},
	{
		id: "june-1",
		name: "June",
		seed: SEED_B,
		author: BRIDGE_DID,
		groupKey: `${BRIDGE_DID} 3lbridgereg22 @june:matrix.org`,
		timestamp: at(9, 31),
		text: "Count me in",
	},
	{
		id: "june-2",
		name: "June",
		seed: SEED_B,
		author: BRIDGE_DID,
		groupKey: `${BRIDGE_DID} 3lbridgereg22 @june:matrix.org`,
		timestamp: at(9, 32),
		text: "Bringing bread for the ducks",
	},
];

export const BridgedAuthorsGroupSeparately: Story = {
	render: () => (
		<div class="flex flex-col bg-background py-4">
			<For each={groupMessages(bridgedConversation)}>
				{(entry) => (
					<MessageRow
						platform="desktop"
						author={{ name: entry.message.name, seed: entry.message.seed }}
						via="Matrix"
						timestamp={entry.message.timestamp}
						now={NOW}
						locale="en-GB"
						continuation={entry.continuation}
						data-testid={`message-${entry.message.id}`}
					>
						{entry.message.text}
					</MessageRow>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		const row = (id: string) =>
			canvasElement.querySelector(
				`[data-testid="message-${id}"]`,
			) as HTMLElement;
		await expect(
			row("june-1").querySelector("[data-message-header]"),
		).not.toBeNull();
		await expect(
			row("june-1").querySelector("[data-author-name]"),
		).toHaveTextContent("June");
		await expect(row("june-1")).not.toHaveAttribute("data-continuation");
		await expect(row("june-2")).toHaveAttribute("data-continuation");
		await expect(
			row("june-2").querySelector("[data-message-header]"),
		).toBeNull();
	},
};
