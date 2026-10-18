import { CloseIcon } from "@solar-icons/solid/bold/close";
import { createSignal } from "solid-js";
import { expect, fn, spyOn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { paintImage } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";
import { ImageUploadTile } from "../Onboarding/ImageUploadTile";
import { TextField } from "../TextField/TextField";

type Args = {
	onFileChange: (file: File) => void;
};

const meta: Meta<Args> = {
	title: "Surfaces/Space creation",
	parameters: { viewport: { defaultViewport: "iphone" } },
	args: { onFileChange: fn() },
};

export default meta;
type Story = StoryObj<Args>;

const paintedPng = async (name: string, stops: [string, string]) => {
	const blob = await (await fetch(paintImage(96, 96, stops))).blob();
	return new File([blob], name, { type: "image/png" });
};

const SpaceCreation = (props: { onFileChange?: (file: File) => void }) => {
	const [preview, setPreview] = createSignal<string>();
	return (
		<div class="flex min-h-dvh flex-col bg-popover pt-safe text-foreground">
			<div class="flex h-12 items-center p-2">
				<IconButton
					variant="ghost"
					size="md"
					label="Close"
					icon={<CloseIcon />}
					class="[&_svg]:size-6"
				/>
			</div>
			<div class="flex flex-col items-center gap-2 px-12 pt-2.5 pb-6 text-center">
				<h1 class="m-0 text-xl font-bold">Create your Space</h1>
				<p class="m-0 text-sm text-balance">
					A Space is where you and other people hang out.
				</p>
			</div>
			<div class="flex flex-col items-center gap-6 px-4">
				<ImageUploadTile
					label="Upload Space icon"
					src={preview()}
					onFileChange={(file) => {
						setPreview(URL.createObjectURL(file));
						props.onFileChange?.(file);
					}}
				/>
				<TextField label="Space name" placeholder="My Space" />
				<Button block>Create Space</Button>
			</div>
		</div>
	);
};

export const CreateSpace: Story = {
	render: (args) => <SpaceCreation onFileChange={args.onFileChange} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const tile = canvas.getByRole("button", { name: "Upload Space icon" });
		await expect(tile).not.toHaveAttribute("data-has-image");
		const outline = tile.querySelector("svg rect");
		if (!outline) throw new Error("Missing dashed outline");
		const style = getComputedStyle(outline);
		await expect(style.strokeDasharray).toBe("8px, 8px");
		await expect(style.strokeWidth).toBe("2px");
		await expect(style.stroke).not.toBe("none");
		await expect(style.stroke).toBe(getComputedStyle(tile).color);
		await expect(outline.getBoundingClientRect().width).toBeGreaterThan(0);
	},
};

export const UploadSpaceIcon: Story = {
	render: (args) => <SpaceCreation onFileChange={args.onFileChange} />,
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const tile = canvas.getByRole("button", { name: "Upload Space icon" });
		const input =
			canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("Missing file input");
		const click = spyOn(input, "click").mockImplementation(() => {});

		await userEvent.click(tile);
		await expect(click).toHaveBeenCalledTimes(1);
		click.mockRestore();

		const file = await paintedPng("icon.png", ["#8e51ff", "#5b21b6"]);
		const transfer = new DataTransfer();
		transfer.items.add(file);
		input.files = transfer.files;
		input.dispatchEvent(new Event("change", { bubbles: true }));

		await waitFor(() => expect(args.onFileChange).toHaveBeenCalledWith(file));
		await waitFor(() => expect(tile).toHaveAttribute("data-has-image"));
		await expect(tile.querySelector("svg rect")).toBeNull();
	},
};
