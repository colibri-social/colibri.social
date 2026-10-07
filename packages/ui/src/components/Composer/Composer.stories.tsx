import { createSignal, For, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { Switch } from "../Switch/Switch";
import { AttachmentTray, type PendingAttachment } from "./AttachmentTray";
import { CharacterRing } from "./CharacterRing";
import { Composer } from "./Composer";
import { EditBar, ReplyBar } from "./ComposerBar";
import { TypingIndicator, type TypingUser } from "./TypingIndicator";

const meta = {
	title: "Messaging/Composer",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const onSend = fn();
const onCancel = fn();

const MobileScreen = (props: { children: JSX.Element }) => (
	<div class="flex min-h-screen flex-col justify-end bg-background pt-16 pb-6">
		{props.children}
	</div>
);

const DesktopScreen = (props: { children: JSX.Element }) => (
	<div class="flex min-h-[420px] w-full flex-col justify-end bg-card pt-16">
		{props.children}
	</div>
);

const typists: TypingUser[] = [
	{ name: "Username", color: "#4ade80" },
	{ name: "Lou", avatarSrc: storyImages.violetIcon() },
	{ name: "Kris", avatarSrc: storyImages.amberIcon() },
	{ name: "Tim", avatarSrc: storyImages.tealIcon() },
];

const textarea = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("textbox") as HTMLTextAreaElement;

export const MobileEmpty: Story = {
	render: () => (
		<MobileScreen>
			<Composer channelName="general" onSend={onSend} />
		</MobileScreen>
	),
	play: async ({ canvasElement }) => {
		onSend.mockClear();
		const canvas = within(canvasElement);
		const send = canvas.getByRole("button", { name: "Send message" });
		await expect(send).toBeDisabled();
		await userEvent.type(textarea(canvasElement), "   ");
		await expect(send).toBeDisabled();
		await userEvent.type(textarea(canvasElement), "Hi there");
		await expect(send).toBeEnabled();
		const icon = send.querySelector("svg");
		await userEvent.click(send);
		await expect(onSend).toHaveBeenCalledWith("   Hi there");
		await expect(icon).toHaveAttribute("data-attention");
		await expect(textarea(canvasElement)).toHaveValue("");
		await expect(send).toBeDisabled();
		await waitFor(() => expect(icon).not.toHaveAttribute("data-attention"), {
			timeout: 4000,
		});
	},
};

export const MobileTyping: Story = {
	render: () => (
		<MobileScreen>
			<Composer
				channelName="general"
				defaultValue="Did you feed them once?"
				onSend={onSend}
			/>
		</MobileScreen>
	),
	play: async ({ canvasElement }) => {
		const field = textarea(canvasElement);
		await userEvent.click(field);
		await userEvent.keyboard("{Enter}");
		await expect(field.value).toBe("Did you feed them once?\n");
	},
};

const eightPlusLines = [
	"Text content that goes on for up to eight lines:",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
].join("\n");

export const MobileOverflow: Story = {
	render: () => (
		<MobileScreen>
			<Composer channelName="general" onSend={onSend} />
		</MobileScreen>
	),
	play: async ({ canvasElement }) => {
		const field = textarea(canvasElement);
		const oneLine = field.getBoundingClientRect().height;
		await expect(oneLine).toBe(21);
		await userEvent.click(field);
		await userEvent.keyboard("1{Enter}2{Enter}3");
		await waitFor(() => expect(field.getBoundingClientRect().height).toBe(63));
		await userEvent.clear(field);
		await userEvent.paste(eightPlusLines);
		await waitFor(() => expect(field.getBoundingClientRect().height).toBe(168));
		await expect(field.style.overflowY).toBe("auto");
		await userEvent.paste("\n11\n12");
		await expect(field.getBoundingClientRect().height).toBe(168);
	},
};

export const DesktopSend: Story = {
	render: () => (
		<DesktopScreen>
			<Composer platform="desktop" channelName="general" onSend={onSend} />
		</DesktopScreen>
	),
	play: async ({ canvasElement }) => {
		onSend.mockClear();
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole("button", { name: "Send message" }),
		).toBeNull();
		const field = textarea(canvasElement);
		await userEvent.click(field);
		await userEvent.keyboard("First line{Shift>}{Enter}{/Shift}second line");
		await expect(field.value).toBe("First line\nsecond line");
		await expect(onSend).not.toHaveBeenCalled();
		await userEvent.keyboard("{Enter}");
		await expect(onSend).toHaveBeenCalledWith("First line\nsecond line");
		await expect(field).toHaveValue("");
		await userEvent.keyboard("{Enter}");
		await expect(onSend).toHaveBeenCalledTimes(1);
	},
};

const nearLimit = "Crows remember faces. ".repeat(100).slice(0, 1990);

export const DesktopNearLimit: Story = {
	render: () => {
		const [threshold, setThreshold] = createSignal(0.8);
		return (
			<DesktopScreen>
				<label class="flex items-center gap-3 px-4 pb-6 text-sm text-muted-foreground">
					Ring threshold
					<input
						type="range"
						min="0.5"
						max="1"
						step="0.01"
						value={threshold()}
						onInput={(event) => setThreshold(Number(event.currentTarget.value))}
					/>
					<span class="tabular-nums">{Math.round(threshold() * 100)}%</span>
				</label>
				<Composer
					platform="desktop"
					channelName="general"
					defaultValue={nearLimit}
					ringThreshold={threshold()}
					maxLines={4}
					typing={<TypingIndicator users={typists.slice(0, 2)} />}
					onSend={onSend}
				/>
			</DesktopScreen>
		);
	},
	play: async ({ canvasElement }) => {
		const ring = canvasElement.querySelector("[data-character-ring]");
		await expect(ring).toHaveAttribute("data-visible");
		await expect(ring).toHaveAttribute("data-tone", "warning");
		await expect(ring).toHaveAccessibleName("58 characters remaining");
	},
};

export const RingThreshold: Story = {
	render: () => (
		<div class="flex items-center gap-4 bg-background p-6">
			<CharacterRing data-testid="low" length={400} />
			<CharacterRing data-testid="above" length={1700} />
			<CharacterRing data-testid="warning" length={1980} />
			<CharacterRing data-testid="over" length={2060} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByTestId("low")).not.toHaveAttribute("data-visible");
		await expect(canvas.getByTestId("above")).toHaveAttribute("data-visible");
		await expect(canvas.getByTestId("above")).toHaveAttribute(
			"data-tone",
			"default",
		);
		await expect(canvas.getByTestId("warning")).toHaveAttribute(
			"data-tone",
			"warning",
		);
		await expect(canvas.getByTestId("over")).toHaveAttribute(
			"data-tone",
			"destructive",
		);
		await expect(canvas.getByTestId("over")).toHaveAccessibleName(
			"12 characters over the limit",
		);
	},
};

export const MobileRing: Story = {
	render: () => (
		<MobileScreen>
			<Composer
				channelName="general"
				defaultValue={nearLimit}
				maxLines={3}
				onSend={onSend}
			/>
		</MobileScreen>
	),
	play: async ({ canvasElement }) => {
		const slot = canvasElement.querySelector("[data-ring-slot]");
		await expect(slot).toHaveAttribute("data-visible");
	},
};

export const Replying: Story = {
	render: () => {
		const [replying, setReplying] = createSignal(true);
		return (
			<MobileScreen>
				<div class="px-4 pb-4">
					<Button variant="secondary" onClick={() => setReplying(true)}>
						Reply to Lou
					</Button>
				</div>
				<Composer
					channelName="general"
					onSend={onSend}
					onEscape={() => setReplying(false)}
					top={
						<ReplyBar
							open={replying()}
							name="Lou"
							onCancel={() => {
								onCancel();
								setReplying(false);
							}}
						/>
					}
				/>
			</MobileScreen>
		);
	},
	play: async ({ canvasElement }) => {
		onCancel.mockClear();
		const canvas = within(canvasElement);
		const bar = canvasElement.querySelector("[data-composer-bar]");
		await expect(bar).toHaveAttribute("data-open");
		await expect(canvas.getByText("Lou")).toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: "Cancel reply" }));
		await expect(onCancel).toHaveBeenCalledOnce();
		await expect(bar).not.toHaveAttribute("data-open");
		await expect(bar).toHaveAttribute("inert");
	},
};

export const Editing: Story = {
	render: () => {
		const [editing, setEditing] = createSignal(true);
		return (
			<MobileScreen>
				<div class="px-4 pb-4">
					<Switch label="Editing" checked={editing()} onChange={setEditing} />
				</div>
				<Composer
					channelName="general"
					defaultValue="I may have shared a sandwich in feb"
					onSend={onSend}
					onEscape={() => setEditing(false)}
					top={<EditBar open={editing()} onCancel={() => setEditing(false)} />}
				/>
			</MobileScreen>
		);
	},
	play: async ({ canvasElement }) => {
		const bar = canvasElement.querySelector("[data-composer-bar]");
		await expect(bar).toHaveAttribute("data-open");
		await userEvent.click(textarea(canvasElement));
		await userEvent.keyboard("{Escape}");
		await expect(bar).not.toHaveAttribute("data-open");
	},
};

export const Typing: Story = {
	render: () => (
		<div class="flex flex-col gap-4 bg-card p-6 [--typing-ring:var(--card)]">
			<For each={[1, 2, 3, 4]}>
				{(count) => <TypingIndicator users={typists.slice(0, count)} />}
			</For>
			<TypingIndicator size="sm" users={typists.slice(0, 2)} />
			<TypingIndicator users={[]} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const statuses = canvas.getAllByRole("status");
		await expect(statuses[0]).toHaveTextContent("Username is typing...");
		await expect(statuses[1]).toHaveTextContent(
			"Username and Lou are typing...",
		);
		await expect(statuses[2]).toHaveTextContent(
			"Username, Lou and Kris are typing...",
		);
		await expect(statuses[3]).toHaveTextContent("Several people are typing...");
		const empty = canvasElement.querySelectorAll("[data-typing-indicator]")[5];
		await expect(empty).not.toHaveAttribute("data-active");
	},
};

const rect = (element: Element | null) => {
	if (!element) throw new Error("Element missing");
	return element.getBoundingClientRect();
};

const textStart = (field: HTMLTextAreaElement) =>
	rect(field).left + Number.parseFloat(getComputedStyle(field).paddingLeft);

const expectTypingAligned = async (canvasElement: HTMLElement) => {
	const field = textarea(canvasElement);
	const names = canvasElement.querySelector("[data-typing-names]");
	const avatars = canvasElement.querySelector("[data-typing-avatars]");
	const upload = canvasElement.querySelector("[data-composer-upload]");
	await waitFor(() =>
		expect(Math.abs(rect(names).left - textStart(field))).toBeLessThanOrEqual(
			1,
		),
	);
	const avatarBox = rect(avatars);
	const uploadBox = rect(upload);
	await expect(
		Math.abs(
			avatarBox.left +
				avatarBox.width / 2 -
				(uploadBox.left + uploadBox.width / 2),
		),
	).toBeLessThanOrEqual(1);
	await expect(Math.abs(avatarBox.width - uploadBox.width)).toBeLessThanOrEqual(
		1,
	);
};

export const DesktopTypingAlignment: Story = {
	render: () => (
		<DesktopScreen>
			<Composer
				platform="desktop"
				channelName="general"
				onSend={onSend}
				typing={<TypingIndicator users={typists.slice(0, 2)} />}
			/>
		</DesktopScreen>
	),
	play: async ({ canvasElement }) => {
		await expectTypingAligned(canvasElement);
	},
};

export const MobileTypingAlignment: Story = {
	render: () => (
		<MobileScreen>
			<Composer
				channelName="general"
				onSend={onSend}
				typing={<TypingIndicator size="sm" users={typists.slice(0, 3)} />}
			/>
		</MobileScreen>
	),
	play: async ({ canvasElement }) => {
		await expectTypingAligned(canvasElement);
	},
};

export const DesktopIconsFlushRight: Story = {
	render: () => {
		const [value, setValue] = createSignal("Short message");
		return (
			<DesktopScreen>
				<div class="px-4">
					<Button
						variant="secondary"
						onClick={() =>
							setValue((current) =>
								current.length > 100 ? "Short message" : nearLimit,
							)
						}
					>
						Toggle near limit
					</Button>
				</div>
				<Composer
					platform="desktop"
					channelName="general"
					value={value()}
					onInput={setValue}
					maxLines={3}
					onSend={onSend}
				/>
			</DesktopScreen>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const box = canvasElement.querySelector("[data-composer-box]");
		const emoji = canvas.getByRole("button", { name: "Add an emoji" });
		const slot = canvasElement.querySelector("[data-ring-slot]");
		const innerRight = () => {
			const boxRect = rect(box);
			return boxRect.right - 1 - 12;
		};
		await expect(slot).not.toHaveAttribute("data-visible");
		await expect(
			Math.abs(rect(emoji).right - innerRight()),
		).toBeLessThanOrEqual(1);
		await userEvent.click(
			canvas.getByRole("button", { name: "Toggle near limit" }),
		);
		await expect(slot).toHaveAttribute("data-visible");
		await waitFor(() =>
			expect(Math.abs(rect(slot).right - innerRight())).toBeLessThanOrEqual(1),
		);
		await waitFor(() =>
			expect(
				Math.abs(rect(emoji).right - (innerRight() - 32 - 12)),
			).toBeLessThanOrEqual(1),
		);
	},
};

const liveStart = "Crows remember faces. ".repeat(100).slice(0, 2040);

export const RingLiveTyping: Story = {
	render: () => (
		<DesktopScreen>
			<Composer
				platform="desktop"
				channelName="general"
				defaultValue={liveStart}
				maxLines={3}
				onSend={onSend}
			/>
		</DesktopScreen>
	),
	play: async ({ canvasElement }) => {
		const ring = canvasElement.querySelector("[data-character-ring]");
		const count = canvasElement.querySelector("[data-ring-count]");
		const progress = canvasElement.querySelector("[data-ring-progress]");
		await expect(ring).toHaveAttribute("data-visible");
		await expect(count).toHaveTextContent("8");
		const warmColor = getComputedStyle(progress as Element).stroke;
		const field = textarea(canvasElement);
		field.focus();
		field.setSelectionRange(field.value.length, field.value.length);
		await userEvent.keyboard("abc");
		await expect(count).toHaveTextContent("5");
		await userEvent.keyboard("abcdef");
		await expect(count).toHaveTextContent("-1");
		await expect(ring).toHaveAttribute("data-tone", "destructive");
		await expect(ring).toHaveAttribute("data-intensity", "1.00");
		await waitFor(() =>
			expect(getComputedStyle(progress as Element).stroke).not.toBe(warmColor),
		);
	},
};

export const RingIntensity: Story = {
	render: () => (
		<div class="flex items-center gap-4 bg-background p-6">
			<For each={[1640, 1760, 1880, 1960, 2000, 2030, 2048, 2060]}>
				{(length) => (
					<CharacterRing data-testid={`ring-${length}`} length={length} />
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const intensity = (length: number) =>
			Number(
				canvas.getByTestId(`ring-${length}`).getAttribute("data-intensity"),
			);
		await expect(intensity(1640)).toBeLessThan(intensity(1880));
		await expect(intensity(1880)).toBeLessThan(intensity(2030));
		await expect(intensity(2048)).toBe(1);
		await expect(canvas.getByTestId("ring-1960")).toHaveAttribute(
			"data-tone",
			"warning",
		);
		await expect(canvas.getByTestId("ring-1760")).toHaveAttribute(
			"data-tone",
			"default",
		);
	},
};

export const MobileWithTyping: Story = {
	render: () => (
		<MobileScreen>
			<Composer
				channelName="general"
				onSend={onSend}
				typing={<TypingIndicator size="sm" users={typists.slice(0, 2)} />}
			/>
		</MobileScreen>
	),
};

const onRemove = fn();

export const Attachments: Story = {
	render: () => {
		const [items, setItems] = createSignal<PendingAttachment[]>([
			{
				id: "1",
				name: "kingfisher.png",
				size: 482_133,
				previewSrc: storyImages.tealIcon(),
			},
			{
				id: "2",
				name: "canal.jpg",
				size: 2_310_000,
				previewSrc: storyImages.amberIcon(),
				progress: 0.42,
			},
			{ id: "3", name: "crow-notes.pdf", size: 81_920 },
			{ id: "4", name: "sandwich.mov", size: 18_400_000, failed: true },
		]);
		return (
			<MobileScreen>
				<Composer
					channelName="general"
					hasAttachments={items().length > 0}
					onSend={onSend}
					top={
						<AttachmentTray
							items={items()}
							max={10}
							onRemove={(id) => {
								onRemove(id);
								setItems((current) => current.filter((item) => item.id !== id));
							}}
						/>
					}
				/>
			</MobileScreen>
		);
	},
	play: async ({ canvasElement }) => {
		onRemove.mockClear();
		const canvas = within(canvasElement);
		await expect(canvas.getByText("4/10 attachments")).toBeInTheDocument();
		await expect(canvas.getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"42",
		);
		await expect(
			canvas.getByRole("button", { name: "Send message" }),
		).toBeEnabled();
		await userEvent.click(
			canvas.getByRole("button", { name: "Remove crow-notes.pdf" }),
		);
		await expect(onRemove).toHaveBeenCalledWith("3");
		await expect(canvas.getByText("3/10 attachments")).toBeInTheDocument();
	},
};

export const Disabled: Story = {
	render: () => (
		<MobileScreen>
			<Composer
				channelName="announcements"
				disabled
				disabledReason="Only moderators can post in this channel."
			/>
		</MobileScreen>
	),
};
