import { createSignal, For, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import type { RichEditorHandle } from "../RichEditor/RichEditor";
import type { RichEditorSources } from "../RichEditor/types";
import { AttachmentTray, type PendingAttachment } from "./AttachmentTray";
import { CHARACTER_LIMIT, CharacterRing } from "./CharacterRing";
import { Composer } from "./Composer";
import { ReplyBar } from "./ComposerBar";
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
	within(canvasElement).getByRole("textbox") as HTMLElement;

const scroller = (canvasElement: HTMLElement) =>
	textarea(canvasElement).parentElement as HTMLElement;

const isEmpty = (canvasElement: HTMLElement) =>
	canvasElement.querySelector("[data-rich-editor]")?.hasAttribute("data-empty");

const hardBreaks = (canvasElement: HTMLElement) =>
	textarea(canvasElement).querySelectorAll("br:not(.ProseMirror-trailingBreak)")
		.length;

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
		await expect(onSend).toHaveBeenCalledWith({ text: "Hi there", facets: [] });
		await expect(icon).toHaveAttribute("data-attention");
		await waitFor(() => expect(isEmpty(canvasElement)).toBe(true));
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
		onSend.mockClear();
		const field = textarea(canvasElement);
		await userEvent.click(field);
		await userEvent.keyboard("{Enter}");
		await expect(onSend).not.toHaveBeenCalled();
		await waitFor(() => expect(hardBreaks(canvasElement)).toBe(1));
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
		const box = scroller(canvasElement);
		await expect(box.getBoundingClientRect().height).toBe(21);
		await userEvent.click(field);
		await userEvent.keyboard("1{Enter}2{Enter}3");
		await waitFor(() => expect(box.getBoundingClientRect().height).toBe(63));
		await userEvent.keyboard("{Enter}");
		await userEvent.paste(eightPlusLines);
		await waitFor(() => expect(box.getBoundingClientRect().height).toBe(168));
		await expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
		await userEvent.paste("\n11\n12");
		await expect(box.getBoundingClientRect().height).toBe(168);
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
		await expect(hardBreaks(canvasElement)).toBe(1);
		await expect(onSend).not.toHaveBeenCalled();
		await userEvent.keyboard("{Enter}");
		await expect(onSend).toHaveBeenCalledWith({
			text: "First line\nsecond line",
			facets: [],
		});
		await waitFor(() => expect(isEmpty(canvasElement)).toBe(true));
		await userEvent.keyboard("{Enter}");
		await expect(onSend).toHaveBeenCalledTimes(1);
	},
};

const suggestionSources: RichEditorSources = {
	searchMembers: (query, limit) =>
		[
			{ did: "did:plc:lou", name: "Lou", handle: "lou.gg" },
			{ did: "did:plc:lena", name: "Lena", handle: "lena.bsky.social" },
		]
			.filter((member) =>
				member.name.toLowerCase().startsWith(query.toLowerCase()),
			)
			.slice(0, limit),
};

const expectSuggestionsAnchored = async (canvasElement: HTMLElement) => {
	const field = textarea(canvasElement);
	await userEvent.click(field);
	await userEvent.keyboard("Hey @l");
	const list = await within(canvasElement).findByRole("listbox", {
		name: "Suggestions",
	});
	const panel = list.closest("[data-suggestions]");
	const box = canvasElement.querySelector("[data-composer-box]");
	const panelRect = rect(panel);
	const boxRect = rect(box);
	await expect(Math.abs(panelRect.left - boxRect.left)).toBeLessThanOrEqual(1);
	await expect(Math.abs(panelRect.width - boxRect.width)).toBeLessThanOrEqual(
		1,
	);
	await expect(boxRect.top - panelRect.bottom).toBeGreaterThanOrEqual(7);
	await expect(boxRect.top - panelRect.bottom).toBeLessThanOrEqual(9);
	await userEvent.keyboard("{Enter}");
	await waitFor(() =>
		expect(
			field.querySelector("[data-mention-type='member']"),
		).toHaveTextContent("@Lou"),
	);
};

export const DesktopSuggestions: Story = {
	render: () => (
		<DesktopScreen>
			<Composer
				platform="desktop"
				channelName="general"
				sources={suggestionSources}
				typing={<TypingIndicator users={typists.slice(0, 2)} />}
				onSend={onSend}
			/>
		</DesktopScreen>
	),
	play: async ({ canvasElement }) => {
		onSend.mockClear();
		await expectSuggestionsAnchored(canvasElement);
		await expect(onSend).not.toHaveBeenCalled();
	},
};

export const MobileSuggestions: Story = {
	render: () => (
		<MobileScreen>
			<Composer
				channelName="general"
				sources={suggestionSources}
				typing={<TypingIndicator size="sm" users={typists.slice(0, 2)} />}
				onSend={onSend}
			/>
		</MobileScreen>
	),
	play: async ({ canvasElement }) => {
		await expectSuggestionsAnchored(canvasElement);
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

const onEditSave = fn();
const onEditCancel = fn();

export const Editing: Story = {
	render: () => (
		<MobileScreen>
			<Composer
				channelName="general"
				onSend={onSend}
				editing={{
					value: { text: "The heron left at dawn", facets: [] },
					preview: "The heron left at dawn",
					onSave: (value) => {
						onEditSave(value);
						return true;
					},
					onCancel: onEditCancel,
				}}
			/>
		</MobileScreen>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const bar = canvasElement.querySelector('[data-composer-bar="edit"]');
		await expect(bar).toHaveAttribute("data-open");
		const editor = canvasElement.querySelector(
			"[data-composer] .ProseMirror",
		) as HTMLElement;
		await waitFor(() =>
			expect(editor).toHaveTextContent("The heron left at dawn"),
		);
		await expect(
			canvas.getByRole("button", { name: "Upload a file" }),
		).toBeDisabled();
		await waitFor(() => expect(editor).toHaveFocus());
		await userEvent.keyboard(" again");
		await userEvent.click(canvas.getByRole("button", { name: "Save edit" }));
		await waitFor(() =>
			expect(onEditSave).toHaveBeenCalledWith(
				expect.objectContaining({ text: "The heron left at dawn again" }),
			),
		);
		await expect(onSend).not.toHaveBeenCalled();
	},
};

export const EditingCancelHoldsPreview: Story = {
	render: () => {
		const [editing, setEditing] = createSignal(true);
		return (
			<MobileScreen>
				<div class="px-4 pb-4">
					<Button variant="secondary" onClick={() => setEditing(true)}>
						Edit message
					</Button>
				</div>
				<Composer
					channelName="general"
					class="[--duration-overlay-in:1200ms]"
					onSend={onSend}
					editing={
						editing()
							? {
									value: { text: "The heron left at dawn", facets: [] },
									preview: "The heron left at dawn",
									onSave: () => true,
									onCancel: () => setEditing(false),
								}
							: undefined
					}
				/>
			</MobileScreen>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const bar = canvasElement.querySelector<HTMLElement>(
			'[data-composer-bar="edit"]',
		);
		if (!bar) throw new Error("Missing edit bar");
		const running = () =>
			bar
				.getAnimations()
				.some((animation) => animation.playState === "running");
		const closes = async () => {
			await expect(bar).toHaveAttribute("data-open");
			await waitFor(() => expect(running()).toBe(false), { timeout: 3000 });
			await expect(bar).toHaveTextContent("The heron left at dawn");
			await userEvent.click(
				canvas.getByRole("button", { name: "Cancel editing" }),
			);
			await expect(bar).not.toHaveAttribute("data-open");
			await expect(running()).toBe(true);
			await expect(bar).toHaveTextContent("The heron left at dawn");
			await waitFor(
				() => expect(bar).not.toHaveTextContent("The heron left at dawn"),
				{ timeout: 3000 },
			);
		};
		await closes();
		await userEvent.click(canvas.getByRole("button", { name: "Edit message" }));
		await closes();
	},
};

export const ReplyCancelHoldsName: Story = {
	render: () => {
		const [replyTo, setReplyTo] = createSignal<string | undefined>("Lou");
		return (
			<MobileScreen>
				<Composer
					channelName="general"
					class="[--duration-overlay-in:1200ms]"
					onSend={onSend}
					top={
						<ReplyBar
							open={!!replyTo()}
							name={replyTo()}
							onCancel={() => setReplyTo(undefined)}
						/>
					}
				/>
			</MobileScreen>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const bar = canvasElement.querySelector<HTMLElement>(
			'[data-composer-bar="reply"]',
		);
		if (!bar) throw new Error("Missing reply bar");
		await expect(bar).toHaveTextContent("Replying to Lou");
		await userEvent.click(canvas.getByRole("button", { name: "Cancel reply" }));
		await expect(bar).not.toHaveAttribute("data-open");
		await expect(bar).toHaveTextContent("Replying to Lou");
		await waitFor(() => expect(bar).not.toHaveTextContent("Lou"), {
			timeout: 3000,
		});
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
		const bar = canvasElement.querySelector('[data-composer-bar="reply"]');
		await expect(bar).toHaveAttribute("data-open");
		await expect(canvas.getByText("Lou")).toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: "Cancel reply" }));
		await expect(onCancel).toHaveBeenCalledOnce();
		await expect(bar).not.toHaveAttribute("data-open");
		await expect(bar).toHaveAttribute("inert");
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

const textStart = (field: HTMLElement) =>
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

let editorHandle: RichEditorHandle | undefined;

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
		await userEvent.click(textarea(canvasElement));
		editorHandle?.focus("end");
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
		const arcShare = (length: number) => {
			const arc = canvas
				.getByTestId(`ring-${length}`)
				.querySelector("[data-ring-progress]") as SVGCircleElement;
			const circumference = Number(arc.getAttribute("stroke-dasharray"));
			const offset = Number(arc.getAttribute("stroke-dashoffset"));
			return (circumference - offset) / circumference;
		};
		await expect(arcShare(1640)).toBeCloseTo(0, 2);
		await expect(arcShare(1760)).toBeGreaterThan(arcShare(1640));
		await expect(arcShare(1880)).toBeGreaterThan(arcShare(1760));
		await expect(arcShare(2030)).toBeGreaterThan(arcShare(1880));
		await expect(arcShare(1880)).toBeCloseTo(intensity(1880), 2);
		await expect(arcShare(2048)).toBeCloseTo(1, 5);
		await expect(arcShare(2060)).toBeCloseTo(1, 5);
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

const RING_STEPS = [1500, 1700, 1990, 2050, 1700];

export const RingThresholdCrossing: Story = {
	render: () => {
		const [step, setStep] = createSignal(0);
		return (
			<div class="flex items-center gap-4 bg-background p-6">
				<CharacterRing data-testid="ring" length={RING_STEPS[step()]} />
				<Button
					variant="secondary"
					onClick={() => setStep((index) => (index + 1) % RING_STEPS.length)}
				>
					Next length
				</Button>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const ring = canvas.getByTestId("ring");
		const glyph = () => ring.querySelector("svg") as SVGSVGElement;
		const arc = () =>
			ring.querySelector("[data-ring-progress]") as SVGCircleElement;
		const next = () =>
			userEvent.click(canvas.getByRole("button", { name: "Next length" }));
		await expect(ring).not.toHaveAttribute("data-visible");
		await next();
		await expect(ring).toHaveAttribute("data-visible");
		await expect(arc().getAnimations().length).toBeGreaterThan(0);
		await next();
		await expect(ring).toHaveAttribute("data-crossed", "warning");
		await expect(glyph().getAnimations().length).toBeGreaterThan(0);
		await next();
		await expect(ring).toHaveAttribute("data-tone", "destructive");
		await expect(ring).toHaveAttribute("data-crossed", "destructive");
		await next();
		await expect(ring).toHaveAttribute("data-tone", "default");
		await expect(ring).toHaveAttribute("data-crossed", "destructive");
	},
};

export const RingFullCircle: Story = {
	render: () => (
		<div class="flex items-center gap-4 bg-background p-6">
			<CharacterRing data-testid="full" length={CHARACTER_LIMIT} />
			<CharacterRing data-testid="small" length={CHARACTER_LIMIT * 0.9} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		for (const id of ["full", "small"]) {
			const arc = canvas
				.getByTestId(id)
				.querySelector("[data-ring-progress]") as SVGCircleElement;
			await expect(arc).not.toHaveAttribute("vector-effect");
			await expect(arc.getAttribute("stroke-dasharray")).toBe(
				arc.getAttribute("pathLength"),
			);
		}
		const full = canvas
			.getByTestId("full")
			.querySelector("[data-ring-progress]") as SVGCircleElement;
		await expect(Number(full.getAttribute("stroke-dashoffset"))).toBe(0);
	},
};

export const RingCountsBytes: Story = {
	render: () => (
		<Composer
			channelName="general"
			onSend={onSend}
			defaultValue={"\u00fc".repeat(1100)}
		/>
	),
	play: async ({ canvasElement }) => {
		const ring = await waitFor(
			() => {
				const element = canvasElement.querySelector("[data-character-ring]");
				if (!element) throw new Error("no ring");
				return element;
			},
			{ timeout: 3000 },
		);
		await waitFor(
			() => expect(ring).toHaveAttribute("data-tone", "destructive"),
			{
				timeout: 3000,
			},
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
