import type { ColibriRichTextFacet } from "@colibri-social/lib";
import { createSignal, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { setAppActive } from "../../utils/playback";
import { storyImages } from "../Banner/story-images";
import { buildClipboardHtml } from "./clipboard-facets";
import { RichEditorProvider } from "./context";
import {
	RichEditor,
	type RichEditorHandle,
	type RichEditorPlatform,
} from "./RichEditor";
import type {
	ChannelSuggestion,
	MemberSuggestion,
	RichEditorSources,
	RichText,
	RoleSuggestion,
} from "./types";

const meta = {
	title: "Messaging/Rich editor",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const members: MemberSuggestion[] = [
	{
		did: "did:plc:lou",
		name: "Lou",
		handle: "lou.gg",
		avatarSrc: storyImages.violetIcon(),
		presence: "online",
	},
	{
		did: "did:plc:lena",
		name: "Lena",
		handle: "lena.bsky.social",
		avatarSrc: storyImages.amberIcon(),
		presence: "idle",
	},
	{ did: "did:plc:kris", name: "Kris", handle: "kris.dev", presence: "dnd" },
];

const roles: RoleSuggestion[] = [
	{ id: "3lkmods", name: "Moderators", color: "#5cadff" },
	{ id: "3lkbirds", name: "Bird watchers", color: "#4ade80" },
];

const channels: ChannelSuggestion[] = [
	{ id: "general", name: "general" },
	{ id: "gallery", name: "gallery" },
	{ id: "lounge", name: "lounge", kind: "voice" },
];

const customEmojiSrc = (fill: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="${fill}"/></svg>`,
	)}`;

const customEmoji = [
	{
		id: "at://did:plc:hq/blue.moji.collection.item/shipit",
		name: "shipit",
		src: customEmojiSrc("#2f6fed"),
		source: "Colibri HQ",
		cid: "bafyshipit",
		alt: "A rocket",
		fallback: "🚀",
	},
	{
		id: "at://did:plc:owls/blue.moji.collection.item/ship_of_theseus_with_an_unreasonably_long_name",
		name: "ship_of_theseus_with_an_unreasonably_long_name",
		src: customEmojiSrc("#d9467a"),
		source: "The Night Owls Art Club and Friends Collective",
	},
];

const sources: RichEditorSources = {
	searchCustomEmoji: (query, limit) =>
		customEmoji
			.filter((emoji) => emoji.name.includes(query.toLowerCase()))
			.slice(0, limit),
	customEmojiByName: (name) => customEmoji.find((emoji) => emoji.name === name),
	resolveCustomEmoji: ({ uri }) =>
		customEmoji.find((emoji) => emoji.id === uri),
	searchMembers: (query, limit) =>
		members
			.filter((member) =>
				member.name.toLowerCase().startsWith(query.toLowerCase()),
			)
			.slice(0, limit),
	searchBridged: (query, limit) =>
		"nelly".startsWith(query.toLowerCase())
			? [
					{
						remoteId: "123",
						registration: "3lkbridge",
						platform: "chat",
						platformName: "Chat",
						name: "Nelly",
					},
				].slice(0, limit)
			: [],
	roles: () => roles,
	channels: () => channels,
	resolveMember: (did) => members.find((member) => member.did === did),
	resolveRole: (id) => roles.find((role) => role.id === id),
	resolveChannel: (id) => {
		const channel = channels.find((item) => item.id === id);
		return channel ? { label: channel.name } : undefined;
	},
};

const onSubmit = fn();
const onEscape = fn();

const Screen = (props: {
	platform?: RichEditorPlatform;
	children: JSX.Element;
}) => (
	<RichEditorProvider sources={sources}>
		<div
			class="flex min-h-[520px] flex-col justify-end bg-background p-4"
			classList={{ "bg-card": props.platform === "desktop" }}
		>
			<div class="rounded-control-lg border border-popover-highlight bg-popover p-3">
				{props.children}
			</div>
		</div>
	</RichEditorProvider>
);

const Harness = (props: {
	platform?: RichEditorPlatform;
	initialValue?: RichText | string;
	maxLength?: number;
	autofocus?: boolean;
	onReady?: (handle: RichEditorHandle) => void;
}) => {
	const [value, setValue] = createSignal<RichText>({ text: "", facets: [] });
	return (
		<Screen platform={props.platform}>
			<RichEditor
				platform={props.platform}
				placeholder="Message #general"
				initialValue={props.initialValue}
				maxLength={props.maxLength}
				autofocus={props.autofocus}
				onSubmit={(next) => {
					onSubmit(next);
					return undefined;
				}}
				onEscape={onEscape}
				onChange={setValue}
				ref={(handle) => {
					props.onReady?.(handle);
					queueMicrotask(() => setValue(handle.getValue()));
				}}
			/>
			<output
				data-testid="value"
				class="mt-3 block border-t border-border pt-2 font-mono text-xs break-all whitespace-pre-wrap text-muted-foreground"
			>
				{JSON.stringify(value())}
			</output>
		</Screen>
	);
};

const field = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("textbox", { name: "Message #general" });

const currentValue = (canvasElement: HTMLElement): RichText =>
	JSON.parse(
		within(canvasElement).getByTestId("value").textContent || "{}",
	) as RichText;

const featureTypes = (value: RichText) =>
	value.facets.flatMap((facet) =>
		facet.features.map((feature) => feature.$type.split("#")[1]),
	);

const resetSpies = () => {
	onSubmit.mockClear();
	onEscape.mockClear();
};

export const MarkdownShortcuts: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard(
			"Some **bold**, *soft*, ~~gone~~ and `code` with ||secrets||",
		);
		await waitFor(() =>
			expect(featureTypes(currentValue(canvasElement))).toEqual(
				expect.arrayContaining([
					"bold",
					"italic",
					"strikethrough",
					"code",
					"spoiler",
				]),
			),
		);
		await expect(currentValue(canvasElement).text).toBe(
			"Some bold, soft, gone and code with secrets",
		);
		await expect(editor.querySelector(".font-bold")).toHaveTextContent("bold");
		await expect(editor.querySelector(".line-through")).toHaveTextContent(
			"gone",
		);
	},
};

export const MentionAutocomplete: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("Ping @l");
		const list = await canvas.findByRole("listbox", { name: "Suggestions" });
		const options = within(list).getAllByRole("option");
		await expect(options).toHaveLength(2);
		await expect(editor).toHaveAttribute(
			"aria-activedescendant",
			options[0].id,
		);
		await userEvent.keyboard("{ArrowDown}");
		await expect(editor).toHaveAttribute(
			"aria-activedescendant",
			options[1].id,
		);
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(canvas.queryByRole("listbox", { name: "Suggestions" })).toBeNull(),
		);
		const chip = editor.querySelector("[data-mention-type='member']");
		await expect(chip).toHaveTextContent("@Lena");
		await userEvent.keyboard("and @mod");
		await userEvent.keyboard("{Tab}");
		await expect(
			editor.querySelector("[data-mention-type='role']"),
		).toHaveTextContent("@Moderators");
		await userEvent.keyboard("in #ga");
		await userEvent.click(
			await canvas.findByRole("option", { name: /gallery/ }),
		);
		await waitFor(() =>
			expect(featureTypes(currentValue(canvasElement))).toEqual([
				"mention",
				"role",
				"channel",
			]),
		);
		await expect(currentValue(canvasElement).text).toBe(
			"Ping @Lena and @Moderators in #gallery",
		);
	},
};

export const MentionEscape: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const canvas = within(canvasElement);
		await userEvent.click(field(canvasElement));
		await userEvent.keyboard("@zz");
		await expect(
			await canvas.findByText("No matching members"),
		).toHaveAttribute("role", "status");
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(canvasElement.querySelector("[data-suggestions]")).toBeNull(),
		);
		await expect(onEscape).not.toHaveBeenCalled();
		await userEvent.keyboard("{Escape}");
		await expect(onEscape).toHaveBeenCalledOnce();
	},
};

export const EmojiShortcodes: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("Hi :");
		await expect(canvasElement.querySelector("[data-suggestions]")).toBeNull();
		await userEvent.keyboard("wave");
		const list = await canvas.findByRole("listbox", { name: "Suggestions" });
		await expect(within(list).getAllByRole("option")[0]).toHaveTextContent(
			"👋:wave:",
		);
		await userEvent.keyboard("{Enter}");
		await waitFor(() => expect(currentValue(canvasElement).text).toBe("Hi 👋"));
		await userEvent.keyboard(" :tada:");
		await waitFor(() =>
			expect(currentValue(canvasElement).text).toBe("Hi 👋 🎉"),
		);
		await expect(currentValue(canvasElement).facets).toEqual([]);
		await userEvent.keyboard(" `:tada:`");
		await waitFor(() =>
			expect(currentValue(canvasElement).text).toBe("Hi 👋 🎉 :tada:"),
		);
	},
};

export const ShortcodesAfterText: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("Coming soon:tm: to a device near you:joy:");
		await waitFor(() =>
			expect(currentValue(canvasElement).text).toBe(
				"Coming soon\u2122 to a device near you😂",
			),
		);
		await userEvent.keyboard(" at 10:100: and :notanemoji:");
		await waitFor(() =>
			expect(currentValue(canvasElement).text).toBe(
				"Coming soon\u2122 to a device near you😂 at 10:100: and :notanemoji:",
			),
		);
	},
};

export const CustomEmojiShortcodes: Story = {
	render: () => <Harness platform="mobile" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("Go :ship");
		const list = await canvas.findByRole("listbox", { name: "Suggestions" });
		const options = within(list).getAllByRole("option");
		await expect(options[0]).toHaveTextContent(":shipit:");
		await expect(
			options[0].querySelector("img[data-custom-emoji-suggestion='shipit']"),
		).not.toBeNull();
		await expect(options[1]).toHaveTextContent(
			":ship_of_theseus_with_an_unreasonably_long_name:",
		);
		await expectNoLayoutIssues(list);
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(
				editor.querySelector(
					"[data-mention-type='customEmoji'][data-custom-emoji='shipit'] img",
				),
			).toHaveAttribute("alt", "A rocket"),
		);
		await waitFor(() => expect(currentValue(canvasElement).text).toBe("Go 🚀"));
		await expect(currentValue(canvasElement).facets).toEqual([
			expect.objectContaining({
				index: expect.objectContaining({ byteStart: 3, byteEnd: 7 }),
				features: [
					{
						$type: "social.colibri.beta.richtext.facet#customEmoji",
						uri: "at://did:plc:hq/blue.moji.collection.item/shipit",
						cid: "bafyshipit",
					},
				],
			}),
		]);
	},
};

let inlineEditor: RichEditorHandle | undefined;

export const CustomEmojiInline: Story = {
	render: () => (
		<Harness
			platform="mobile"
			onReady={(handle) => {
				inlineEditor = handle;
			}}
			initialValue={{
				text: "Ship it 🚀",
				facets: [
					{
						index: { byteStart: 8, byteEnd: 12 },
						features: [
							{
								$type: "social.colibri.beta.richtext.facet#customEmoji",
								uri: "at://did:plc:hq/blue.moji.collection.item/shipit",
							} as never,
						],
					},
				],
			}}
		/>
	),
	play: async ({ canvasElement }) => {
		const editor = field(canvasElement);
		await waitFor(() =>
			expect(
				editor.querySelector("[data-custom-emoji='shipit'] img"),
			).not.toBeNull(),
		);
		await userEvent.click(editor);
		inlineEditor?.focus("end");
		await waitFor(() => expect(editor).toHaveFocus());
		await new Promise((resolve) => setTimeout(resolve, 50));
		await userEvent.keyboard(
			" :ship_of_theseus_with_an_unreasonably_long_name:",
		);
		await waitFor(() =>
			expect(
				editor.querySelectorAll("[data-mention-type='customEmoji'] img"),
			).toHaveLength(2),
		);
		await expectNoLayoutIssues(editor);
		await expect(currentValue(canvasElement).text).toBe(
			"Ship it 🚀 :ship_of_theseus_with_an_unreasonably_long_name:",
		);
		await expect(featureTypes(currentValue(canvasElement))).toEqual([
			"customEmoji",
			"customEmoji",
		]);
		await userEvent.keyboard("{Backspace}");
		await waitFor(() =>
			expect(
				editor.querySelectorAll("[data-mention-type='customEmoji']"),
			).toHaveLength(1),
		);
		await expect(currentValue(canvasElement).text).toBe("Ship it 🚀");
	},
};

export const TimestampPicker: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("Meet @ti");
		const option = await canvas.findByRole("option", { name: /Time/ });
		await expect(option).toHaveAttribute("data-suggestion-kind", "time");
		await userEvent.keyboard("{Enter}");
		const when = await canvas.findByRole("combobox", { name: "When" });
		await waitFor(() => expect(when).toHaveFocus());
		await userEvent.keyboard("tomorrow at 3pm");
		const formats = within(
			canvas.getByRole("listbox", { name: "Time formats" }),
		).getAllByRole("option");
		await expect(formats).toHaveLength(7);
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await waitFor(() =>
			expect(editor.querySelector("[data-mention-type='time']")).not.toBeNull(),
		);
		await waitFor(() =>
			expect(featureTypes(currentValue(canvasElement))).toEqual(["time"]),
		);
		const time = currentValue(canvasElement).facets[0].features[0] as {
			datetime: string;
			style: string;
		};
		await expect(time.style).toBe("time-short");
		await expect(new Date(time.datetime).getHours()).toBe(15);
	},
};

export const TimestampCancel: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("Meet @time");
		await userEvent.click(await canvas.findByRole("option", { name: /Time/ }));
		await canvas.findByRole("combobox", { name: "When" });
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(editor).toHaveFocus());
		await waitFor(() => expect(currentValue(canvasElement).text).toBe("Meet"));
	},
};

const pastedFacets: ColibriRichTextFacet[] = [
	{
		index: { byteStart: 0, byteEnd: 4 },
		features: [
			{
				$type: "social.colibri.beta.richtext.facet#mention",
				did: "did:plc:lou",
			},
		],
	},
	{
		index: { byteStart: 11, byteEnd: 15 },
		features: [{ $type: "social.colibri.beta.richtext.facet#bold" }],
	},
];

const pasteInto = (element: HTMLElement, data: Record<string, string>) => {
	const transfer = new DataTransfer();
	for (const [type, value] of Object.entries(data))
		transfer.setData(type, value);
	element.dispatchEvent(
		new ClipboardEvent("paste", {
			clipboardData: transfer,
			bubbles: true,
			cancelable: true,
		}),
	);
};

export const PasteWithFacets: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		const editor = field(canvasElement);
		await userEvent.click(editor);
		pasteInto(editor, {
			"text/plain": "@Lou feeds **them**",
			"text/html": buildClipboardHtml("@Lou feeds them", pastedFacets),
		});
		await waitFor(() =>
			expect(
				editor.querySelector("[data-mention-type='member']"),
			).toHaveTextContent("@Lou"),
		);
		await waitFor(() =>
			expect(currentValue(canvasElement).text).toBe("@Lou feeds them"),
		);
		await expect(featureTypes(currentValue(canvasElement))).toEqual([
			"mention",
			"bold",
		]);
	},
};

export const PasteMultiline: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		const editor = field(canvasElement);
		await userEvent.click(editor);
		pasteInto(editor, { "text/plain": "Shopping\n- seeds\n- **suet**" });
		await waitFor(() =>
			expect(featureTypes(currentValue(canvasElement))).toEqual(
				expect.arrayContaining(["list", "bold"]),
			),
		);
	},
};

export const PasteLinkOverSelection: Story = {
	render: () => <Harness platform="desktop" initialValue="read the docs" />,
	play: async ({ canvasElement }) => {
		const editor = field(canvasElement);
		await userEvent.click(editor);
		const text = editor.querySelector("p")?.firstChild as Text;
		const range = document.createRange();
		range.setStart(text, 9);
		range.setEnd(text, 13);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		document.dispatchEvent(new Event("selectionchange"));
		await new Promise((resolve) => setTimeout(resolve, 50));
		pasteInto(editor, { "text/plain": "https://colibri.social/docs" });
		await waitFor(() =>
			expect(featureTypes(currentValue(canvasElement))).toEqual(["link"]),
		);
		await expect(currentValue(canvasElement).text).toBe("read the docs");
	},
};

export const CharacterLimit: Story = {
	render: () => <Harness platform="desktop" maxLength={10} />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("twelve chars{Enter}");
		await expect(onSubmit).not.toHaveBeenCalled();
		await expect(currentValue(canvasElement).text).toBe("twelve chars");
		await userEvent.keyboard("{Backspace}{Backspace}{Enter}");
		await expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ text: "twelve cha" }),
		);
	},
};

const selectAll = async (editor: HTMLElement) => {
	const paragraph = editor.querySelector("p");
	if (!paragraph) throw new Error("Paragraph missing");
	const selection = window.getSelection();
	const range = document.createRange();
	range.selectNodeContents(paragraph);
	selection?.removeAllRanges();
	selection?.addRange(range);
	document.dispatchEvent(new Event("selectionchange"));
};

export const FormattingBubble: Story = {
	render: () => <Harness platform="desktop" initialValue="hello world" />,
	play: async ({ canvasElement }) => {
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await selectAll(editor);
		const bubble = await waitFor(() => {
			const element = document.querySelector<HTMLElement>(
				"[data-format-bubble]",
			);
			if (!element) throw new Error("Bubble missing");
			return element;
		});
		const toolbar = within(bubble);
		await expect(toolbar.getAllByRole("button")).toHaveLength(6);
		const bold = toolbar.getByRole("button", { name: "Bold" });
		await expect(bold).toHaveAttribute("aria-pressed", "false");
		await userEvent.click(bold);
		await waitFor(() =>
			expect(currentValue(canvasElement).text).toBe("hello world"),
		);
		await expect(featureTypes(currentValue(canvasElement))).toEqual(["bold"]);
		await expect(editor).toHaveFocus();
		await waitFor(() => expect(bold).toHaveAttribute("aria-pressed", "true"));
		await userEvent.click(bold);
		await waitFor(() =>
			expect(featureTypes(currentValue(canvasElement))).toEqual([]),
		);
		await userEvent.click(toolbar.getByRole("button", { name: "Spoiler" }));
		await waitFor(() =>
			expect(featureTypes(currentValue(canvasElement))).toEqual(["spoiler"]),
		);
	},
};

export const NoBubbleOnMobile: Story = {
	render: () => <Harness platform="mobile" initialValue="hello world" />,
	play: async ({ canvasElement }) => {
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await selectAll(editor);
		await new Promise((resolve) => setTimeout(resolve, 100));
		await expect(document.querySelector("[data-format-bubble]")).toBeNull();
	},
};

export const EnterVersusShiftEnter: Story = {
	render: () => (
		<div class="flex flex-col gap-4">
			<Harness platform="desktop" />
		</div>
	),
	play: async ({ canvasElement }) => {
		resetSpies();
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("- seeds{Shift>}{Enter}{/Shift}suet");
		await expect(onSubmit).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(currentValue(canvasElement).text).toBe("seeds\nsuet"),
		);
		await userEvent.keyboard("{Enter}");
		await expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ text: "seeds\nsuet" }),
		);
		await waitFor(() =>
			expect(canvasElement.querySelector("[data-rich-editor]")).toHaveAttribute(
				"data-empty",
			),
		);
	},
};

export const MobileEnterAddsLine: Story = {
	render: () => <Harness platform="mobile" />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const editor = field(canvasElement);
		await expect(editor).toHaveAttribute("enterkeyhint", "enter");
		await userEvent.click(editor);
		await userEvent.keyboard("1. seeds{Enter}suet");
		await expect(onSubmit).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(featureTypes(currentValue(canvasElement))).toEqual([
				"list",
				"list",
			]),
		);
	},
};

export const SubtextCaretHeight: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("-# quiet note");
		const lineHeightOf = (element: Element) =>
			Number.parseFloat(getComputedStyle(element).lineHeight);
		const paragraphWith = (text: string) =>
			[...editor.querySelectorAll("p")].find((paragraph) =>
				paragraph.textContent?.includes(text),
			);
		await waitFor(() =>
			expect(paragraphWith("quiet note")).toHaveClass("subtext-block"),
		);
		const subtext = paragraphWith("quiet note");
		if (!subtext) throw new Error("subtext paragraph missing");
		await expect(lineHeightOf(subtext)).toBeLessThan(lineHeightOf(editor));
		await expect(lineHeightOf(subtext)).toBeCloseTo(
			Number.parseFloat(getComputedStyle(subtext).fontSize) / 0.75,
		);

		await userEvent.keyboard("{Shift>}{Enter}{/Shift}loud line");
		await waitFor(() =>
			expect(paragraphWith("loud line")).not.toHaveClass("subtext-block"),
		);
		const mixed = paragraphWith("loud line");
		if (!mixed) throw new Error("plain paragraph missing");
		await expect(lineHeightOf(mixed)).toBe(lineHeightOf(editor));
	},
};

export const SubtextLineAfterText: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("loud line{Shift>}{Enter}{/Shift}-# quiet note");
		const paragraphWith = (text: string) =>
			[...editor.querySelectorAll("p")].find((paragraph) =>
				paragraph.textContent?.includes(text),
			);
		await waitFor(() =>
			expect(paragraphWith("quiet note")).toHaveClass("subtext-block"),
		);
		const loud = paragraphWith("loud line");
		const quiet = paragraphWith("quiet note");
		if (!loud || !quiet) throw new Error("line paragraphs missing");
		await expect(loud).not.toBe(quiet);
		await expect(loud).not.toHaveClass("subtext-block");
		await expect(
			editor.querySelectorAll("br:not(.ProseMirror-trailingBreak)"),
		).toHaveLength(0);

		const lineHeight = (element: Element) =>
			Number.parseFloat(getComputedStyle(element).lineHeight);
		const quietBox = quiet.getBoundingClientRect();
		await expect(quietBox.height).toBeCloseTo(lineHeight(quiet), 0);
		await expect(lineHeight(quiet)).toBeLessThan(lineHeight(loud));

		const selection = window.getSelection();
		if (!selection?.rangeCount) throw new Error("no caret");
		const caret = selection.getRangeAt(0).getBoundingClientRect();
		await expect(caret.top).toBeGreaterThanOrEqual(quietBox.top - 0.5);
		await expect(caret.bottom).toBeLessThanOrEqual(quietBox.bottom + 0.5);

		await userEvent.keyboard("{Enter}");
		await expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ text: "loud line\nquiet note" }),
		);
	},
};

const LONG_PLACEHOLDER =
	"Message #kingfisher-sightings-along-the-river-path-behind-the-old-mill";

export const PlaceholderInEmptyEditor: Story = {
	name: "Placeholder in an empty editor",
	render: () => (
		<RichEditorProvider sources={sources}>
			<div class="flex min-h-[520px] flex-col justify-end bg-background p-4">
				<div
					data-testid="frame"
					class="w-56 rounded-control-lg border border-popover-highlight bg-popover p-3"
				>
					<RichEditor platform="desktop" placeholder={LONG_PLACEHOLDER} />
				</div>
			</div>
		</RichEditorProvider>
	),
	play: async ({ canvasElement }) => {
		const editor = within(canvasElement).getByRole("textbox", {
			name: LONG_PLACEHOLDER,
		});
		const paragraph = await waitFor(() => {
			const found = editor.querySelector<HTMLElement>("p.is-editor-empty");
			if (!found) throw new Error("empty paragraph missing");
			return found;
		});
		await expect(paragraph).toHaveAttribute(
			"data-placeholder",
			LONG_PLACEHOLDER,
		);
		const placeholder = getComputedStyle(paragraph, "::before");
		await expect(placeholder.content).toBe(`"${LONG_PLACEHOLDER}"`);
		await expect(placeholder.float).toBe("left");
		await expect(placeholder.height).toBe("0px");
		await expect(placeholder.whiteSpace).toBe("nowrap");
		await expect(placeholder.textOverflow).toBe("ellipsis");
		await expect(placeholder.overflowX).toBe("clip");
		await expect(placeholder.pointerEvents).toBe("none");
		await expect(getComputedStyle(paragraph).position).toBe("static");
		await expect(getComputedStyle(editor).userSelect).toBe("text");
		await expect(getComputedStyle(paragraph).userSelect).toBe("text");

		const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight);
		const box = paragraph.getBoundingClientRect();
		await expect(box.height).toBeCloseTo(lineHeight, 0);
		const frame = within(canvasElement).getByTestId("frame");
		await expect(editor.scrollWidth).toBeLessThanOrEqual(editor.clientWidth);
		await expectNoLayoutIssues(frame);

		await userEvent.click(editor);
		const selection = window.getSelection();
		if (!selection?.rangeCount) throw new Error("no caret");
		await expect(paragraph.contains(selection.anchorNode)).toBe(true);
		const lineStart = paragraph.querySelector("br");
		if (!lineStart) throw new Error("trailing break missing");
		const caret = lineStart.getBoundingClientRect();
		await expect(caret.height).toBeGreaterThan(0);
		await expect(caret.left).toBeCloseTo(box.left, 0);
		await expect(caret.top).toBeGreaterThanOrEqual(box.top - 0.5);
		await expect(caret.bottom).toBeLessThanOrEqual(box.bottom + 0.5);
	},
};

export const CaretAfterAppActivation: Story = {
	name: "Caret after the app becomes active",
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const editor = field(canvasElement);
		await userEvent.click(editor);
		await waitFor(() => expect(document.activeElement).toBe(editor));
		let changes = 0;
		const count = () => {
			changes += 1;
		};
		document.addEventListener("selectionchange", count);
		try {
			setAppActive(false);
			await new Promise((resolve) => requestAnimationFrame(resolve));
			changes = 0;
			setAppActive(true);
			await waitFor(() => expect(changes).toBeGreaterThan(0));
		} finally {
			document.removeEventListener("selectionchange", count);
			setAppActive(undefined);
		}
		await expect(document.activeElement).toBe(editor);
		const selection = window.getSelection();
		if (!selection?.rangeCount) throw new Error("no caret");
		await expect(selection.isCollapsed).toBe(true);
		await expect(editor.contains(selection.anchorNode)).toBe(true);
		await userEvent.keyboard("still here");
		await waitFor(() =>
			expect(currentValue(canvasElement).text).toBe("still here"),
		);
	},
};

const editedFacets: ColibriRichTextFacet[] = [
	{
		index: { byteStart: 0, byteEnd: 5 },
		features: [
			{
				$type: "social.colibri.beta.richtext.facet#mention",
				did: "did:plc:lena",
			},
		],
	},
	{
		index: { byteStart: 6, byteEnd: 10 },
		features: [{ $type: "social.colibri.beta.richtext.facet#bold" }],
	},
	{
		index: { byteStart: 24, byteEnd: 29 },
		features: [
			{
				$type: "social.colibri.beta.richtext.facet#mention",
				did: "did:plc:gone",
			},
		],
	},
];

export const EditingExistingMessage: Story = {
	render: () => (
		<Harness
			platform="desktop"
			initialValue={{
				text: "@Lena feed them, thanks @Olaf",
				facets: editedFacets,
			}}
			autofocus
		/>
	),
	play: async ({ canvasElement }) => {
		resetSpies();
		const editor = field(canvasElement);
		const chips = editor.querySelectorAll("[data-mention-type='member']");
		await expect(chips).toHaveLength(2);
		await expect(chips[0]).toHaveTextContent("@Lena");
		await expect(chips[1]).toHaveTextContent("@Olaf");
		await expect(editor).toHaveTextContent("**feed**");
		await waitFor(() => expect(editor).toHaveFocus());
		await userEvent.keyboard("!{Enter}");
		await expect(onSubmit).toHaveBeenCalledWith({
			text: "@Lena feed them, thanks @Olaf!",
			facets: expect.arrayContaining([
				expect.objectContaining({
					index: expect.objectContaining({ byteStart: 0, byteEnd: 5 }),
				}),
				expect.objectContaining({
					index: expect.objectContaining({ byteStart: 24, byteEnd: 29 }),
				}),
			]),
		});
		await userEvent.keyboard("{Escape}");
		await expect(onEscape).toHaveBeenCalledOnce();
	},
};

export const Playground: Story = {
	render: () => <Harness platform="desktop" />,
};
