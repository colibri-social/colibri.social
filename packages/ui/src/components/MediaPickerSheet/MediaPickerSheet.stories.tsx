import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { GifGlyph } from "../../icons/animated/brand";
import { Composer } from "../Composer/Composer";
import { fixturePacks, fixtureUsage } from "../EmojiPicker/fixtures";
import { createFakeGifSource } from "../GifPicker/fixtures";
import { IconButton } from "../IconButton/IconButton";
import type { RichEditorHandle } from "../RichEditor/RichEditor";
import { type MediaPickerKind, MediaPickers } from "./MediaPickerSheet";

const meta = {
	title: "Pickers/Media pickers",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const onEmoji = fn();
const onGif = fn();

const Harness = (props: { platform: "mobile" | "desktop" }) => {
	const [open, setOpen] = createSignal<MediaPickerKind | null>(null);
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	const show = (kind: MediaPickerKind) => (event: MouseEvent) => {
		setAnchor(event.currentTarget as HTMLElement);
		setOpen((current) => (current === kind ? null : kind));
	};
	return (
		<div class="flex min-h-[600px] items-end justify-end gap-1 p-4">
			<IconButton
				variant="ghost"
				label="Send a GIF"
				icon={<GifGlyph />}
				onClick={show("gif")}
			/>
			<IconButton
				variant="ghost"
				label="Add an emoji"
				icon={<SmileCircleIcon />}
				onClick={show("emoji")}
			/>
			<MediaPickers
				platform={props.platform}
				open={open()}
				onOpenChange={setOpen}
				anchorElement={anchor()}
				emoji={{ usage: fixtureUsage(), packs: fixturePacks }}
				gif={{
					source: createFakeGifSource({ delay: 60 }),
					attribution: "Powered by KLIPY",
				}}
				onEmoji={onEmoji}
				onGif={onGif}
			/>
		</div>
	);
};

const PANEL_HEIGHT = 300;

const PanelHarness = () => {
	const [open, setOpen] = createSignal<MediaPickerKind | null>(null);
	let editor: RichEditorHandle | undefined;
	const toggleEmoji = () => {
		if (open()) {
			editor?.focus(null);
			setOpen(null);
			return;
		}
		setOpen("emoji");
		editor?.blur();
	};
	return (
		<div
			class="fixed inset-0 flex flex-col justify-end bg-background"
			style={{ "padding-bottom": `${open() ? PANEL_HEIGHT : 0}px` }}
		>
			<Composer
				platform="mobile"
				channelName="general"
				onEmoji={toggleEmoji}
				emojiPanelOpen={open() !== null}
				editorRef={(handle) => {
					editor = handle;
				}}
			/>
			<MediaPickers
				platform="mobile"
				open={open()}
				onOpenChange={setOpen}
				panelHeight={PANEL_HEIGHT}
				emoji={{ usage: fixtureUsage() }}
				gif={{
					source: createFakeGifSource({ delay: 60 }),
					attribution: "Powered by KLIPY",
				}}
				onEmoji={(pick, event) => {
					onEmoji(pick, event);
					if (pick.kind === "unicode")
						editor?.insertText(pick.emoji, { focus: false });
				}}
				onGif={onGif}
			/>
		</div>
	);
};

const findPanel = () =>
	screen.findByRole("region", { name: "Emoji and GIF picker" });

const panelGone = () =>
	waitFor(() =>
		expect(
			screen.queryByRole("region", { name: "Emoji and GIF picker" }),
		).not.toBeInTheDocument(),
	);

export const MobilePanel: Story = {
	parameters: { layout: "fullscreen", viewport: { defaultViewport: "iphone" } },
	render: () => <PanelHarness />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editor = canvas.getByRole("textbox", { name: "Message general" });
		await userEvent.click(canvas.getByRole("button", { name: "Add an emoji" }));
		const panel = await findPanel();
		await expectNoLayoutIssues(panel);
		await expect(document.activeElement).not.toHaveAttribute("type", "search");
		await expect(Math.round(panel.getBoundingClientRect().height)).toBe(
			PANEL_HEIGHT,
		);
		await expect(Math.round(panel.getBoundingClientRect().bottom)).toBe(
			document.documentElement.clientHeight,
		);
		await expect(
			canvasElement
				.querySelector("[data-composer-box]")
				?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
		).toBeLessThanOrEqual(panel.getBoundingClientRect().top + 0.5);

		await userEvent.click(
			within(panel).getAllByRole("button", { name: "fire" })[0],
		);
		await expect(onEmoji).toHaveBeenCalledWith(
			expect.objectContaining({ kind: "unicode", emoji: "🔥" }),
			expect.anything(),
		);
		await expect(editor).toHaveTextContent("🔥");
		await expect(editor).not.toHaveFocus();
		await expect(await findPanel()).toBe(panel);

		await userEvent.click(
			canvas.getByRole("button", { name: "Show keyboard" }),
		);
		await panelGone();
		await waitFor(() => expect(editor).toHaveFocus());

		await userEvent.click(canvas.getByRole("button", { name: "Add an emoji" }));
		await findPanel();
		await userEvent.click(editor);
		await panelGone();
		await expect(
			canvas.getByRole("button", { name: "Add an emoji" }),
		).toBeInTheDocument();

		await userEvent.click(canvas.getByRole("button", { name: "Add an emoji" }));
		const reopened = await findPanel();
		await userEvent.click(within(reopened).getByRole("tab", { name: "GIFs" }));
		await within(reopened).findByRole("button", { name: "Trending GIF 1" });
		await userEvent.keyboard("{Escape}");
		await panelGone();
	},
};

export const DesktopPopovers: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const emojiButton = canvas.getByRole("button", { name: "Add an emoji" });
		await userEvent.click(emojiButton);
		await screen.findByRole(
			"dialog",
			{ name: "Emoji picker" },
			{ timeout: 3000 },
		);
		await userEvent.click(canvas.getByRole("button", { name: "Send a GIF" }));
		await screen.findByRole(
			"dialog",
			{ name: "GIF picker" },
			{ timeout: 3000 },
		);
		await waitFor(
			() =>
				expect(
					screen.queryByRole("dialog", { name: "Emoji picker" }),
				).not.toBeInTheDocument(),
			{ timeout: 3000 },
		);
		await userEvent.click(canvas.getByRole("button", { name: "Send a GIF" }));
		await waitFor(
			() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
			{ timeout: 3000 },
		);
	},
};
