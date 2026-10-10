import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { GifGlyph } from "../../icons/animated/brand";
import { fixturePacks, fixtureUsage } from "../EmojiPicker/fixtures";
import { createFakeGifSource } from "../GifPicker/fixtures";
import { IconButton } from "../IconButton/IconButton";
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

export const MobileSheet: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <Harness platform="mobile" />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Send a GIF" }),
		);
		const sheet = await screen.findByRole("dialog", {
			name: "Emoji and GIF picker",
		});
		await waitFor(() => expect(sheet).toHaveFocus());
		await expect(document.activeElement).not.toHaveAttribute("type", "search");
		await expect(
			within(sheet).getByRole("tab", { name: "GIFs" }),
		).toHaveAttribute("aria-selected", "true");
		await within(sheet).findByRole("button", { name: "Trending GIF 1" });
		await userEvent.click(within(sheet).getByRole("tab", { name: "Emoji" }));
		await userEvent.click(
			within(sheet).getAllByRole("button", { name: "fire" })[0],
		);
		await expect(onEmoji).toHaveBeenCalledWith(
			expect.objectContaining({ kind: "unicode", emoji: "🔥" }),
			expect.anything(),
		);
		await waitFor(
			() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
			{ timeout: 3000 },
		);
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
