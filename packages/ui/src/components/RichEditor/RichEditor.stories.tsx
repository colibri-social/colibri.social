import type { ColibriRichTextFacet } from "@colibri-social/lib";
import { createSignal, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
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

const sources: RichEditorSources = {
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
