import { createSignal } from "solid-js";
import { expect, fn, spyOn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ImageUploadTile } from "./ImageUploadTile";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MIB = 1_048_576;
const PIXEL_PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const meta = {
	title: "Primitives/Image upload",
	component: ImageUploadTile,
	args: { label: "Upload image", onFileChange: fn(), onReject: fn() },
	decorators: [
		(Story) => (
			<div class="flex flex-wrap items-start gap-8 bg-popover p-8">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ImageUploadTile>;

export default meta;
type Story = StoryObj<typeof meta>;

const pick = (input: HTMLInputElement, file: File) => {
	const transfer = new DataTransfer();
	transfer.items.add(file);
	input.files = transfer.files;
	input.dispatchEvent(new Event("change", { bubbles: true }));
};

const fileOfSize = (name: string, type: string, bytes: number) =>
	new File([new Uint8Array(bytes)], name, { type });

const pixelPng = (name = "icon.png") => {
	const bytes = Uint8Array.from(atob(PIXEL_PNG), (char) => char.charCodeAt(0));
	return new File([bytes], name, { type: "image/png" });
};

export const Limits: Story = {
	render: () => (
		<>
			<ImageUploadTile
				label="Upload Space icon"
				accept={IMAGE_ACCEPT}
				maxBytes={MIB}
			/>
			<ImageUploadTile
				label="Upload avatar"
				shape="circle"
				accept={IMAGE_ACCEPT}
				maxBytes={MIB}
			/>
			<ImageUploadTile
				label="Upload banner"
				accept={IMAGE_ACCEPT}
				maxBytes={4 * MIB}
				description="Shown at 2:1. PNG, JPEG, WebP or GIF, up to 4 MB"
			/>
			<ImageUploadTile label="Upload emoji" size={64} />
		</>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: "Upload Space icon" }),
		).toHaveAccessibleDescription("PNG, JPEG, WebP or GIF, up to 1 MB");
		await expect(
			canvas.getByRole("button", { name: "Upload banner" }),
		).toHaveAccessibleDescription(
			"Shown at 2:1. PNG, JPEG, WebP or GIF, up to 4 MB",
		);
		await expect(
			canvas.getByRole("button", { name: "Upload emoji" }),
		).toHaveAccessibleDescription("Any image");
	},
};

export const Errors: Story = {
	render: (args) => {
		const [preview, setPreview] = createSignal<string>();
		return (
			<ImageUploadTile
				label="Upload banner"
				src={preview()}
				accept={IMAGE_ACCEPT}
				maxBytes={4 * MIB}
				onReject={args.onReject}
				onFileChange={(file) => {
					setPreview(URL.createObjectURL(file));
					args.onFileChange?.(file);
				}}
			/>
		);
	},
	play: async ({ canvasElement, args, step }) => {
		const canvas = within(canvasElement);
		const tile = canvas.getByRole("button", { name: "Upload banner" });
		const input =
			canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("Missing file input");
		const click = spyOn(input, "click").mockImplementation(() => {});
		await userEvent.click(tile);
		await expect(click).toHaveBeenCalledTimes(1);
		click.mockRestore();

		const expectError = async (message: string) => {
			await waitFor(() =>
				expect(canvas.getByRole("alert")).toHaveTextContent(message),
			);
			await expect(tile).toHaveAttribute("aria-invalid", "true");
			await expect(tile).toHaveAccessibleDescription(
				`PNG, JPEG, WebP or GIF, up to 4 MB ${message}`,
			);
		};

		await step("Wrong format names the detected type", async () => {
			pick(input, fileOfSize("IMG_0042.HEIC", "image/heic", 2048));
			await expectError("HEIC isn't supported. Use PNG, JPEG, WebP or GIF.");
			await expect(args.onReject).toHaveBeenLastCalledWith(
				expect.objectContaining({ reason: "type", problems: ["type"] }),
			);
		});

		await step("Unknown type falls back to the extension", async () => {
			pick(input, fileOfSize("scan.tiff", "", 2048));
			await expectError("TIFF isn't supported. Use PNG, JPEG, WebP or GIF.");
		});

		await step("Too large names the size and the limit", async () => {
			pick(input, fileOfSize("banner.png", "image/png", Math.round(6.2 * MIB)));
			await expectError("This image is 6.2 MB. Choose one under 4 MB.");
			await expect(args.onReject).toHaveBeenLastCalledWith(
				expect.objectContaining({ reason: "size", problems: ["size"] }),
			);
		});

		await step("Both problems at once", async () => {
			pick(input, fileOfSize("banner.heic", "image/heic", 7 * MIB));
			await expectError(
				"HEIC isn't supported and the file is 7 MB. Use PNG, JPEG, WebP or GIF under 4 MB.",
			);
			await expect(args.onReject).toHaveBeenLastCalledWith(
				expect.objectContaining({
					reason: "type-and-size",
					problems: ["type", "size"],
				}),
			);
		});

		await step("Corrupt file", async () => {
			pick(input, fileOfSize("banner.png", "image/png", 2048));
			await expectError("This file couldn't be read as an image.");
			await expect(args.onReject).toHaveBeenLastCalledWith(
				expect.objectContaining({ reason: "unreadable" }),
			);
		});

		await step("Empty file", async () => {
			pick(input, fileOfSize("banner.png", "image/png", 0));
			await expectError("This file couldn't be read as an image.");
		});

		await expect(args.onFileChange).not.toHaveBeenCalled();

		await step("A valid file clears the error", async () => {
			const file = pixelPng("banner.png");
			pick(input, file);
			await waitFor(() => expect(args.onFileChange).toHaveBeenCalledWith(file));
			await waitFor(() =>
				expect(canvas.queryByRole("alert")).not.toBeInTheDocument(),
			);
			await expect(tile).not.toHaveAttribute("aria-invalid");
			await expect(tile).toHaveAccessibleDescription(
				"PNG, JPEG, WebP or GIF, up to 4 MB",
			);
		});
	},
};

export const NotAnImage: Story = {
	render: (args) => (
		<ImageUploadTile label="Upload emoji" onReject={args.onReject} />
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const input =
			canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("Missing file input");
		pick(input, fileOfSize("notes.pdf", "application/pdf", 2048));
		await waitFor(() =>
			expect(canvas.getByRole("alert")).toHaveTextContent(
				"This file isn't an image. Choose an image file.",
			),
		);
		await expect(args.onReject).toHaveBeenCalledWith(
			expect.objectContaining({ reason: "type" }),
		);
	},
};

export const ExternalError: Story = {
	render: () => (
		<ImageUploadTile
			label="Upload avatar"
			shape="circle"
			accept={IMAGE_ACCEPT}
			maxBytes={MIB}
			error="Upload failed. Try again."
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("alert")).toHaveTextContent(
			"Upload failed. Try again.",
		);
		await expect(
			canvas.getByRole("button", { name: "Upload avatar" }),
		).toHaveAccessibleDescription(
			"PNG, JPEG, WebP or GIF, up to 1 MB Upload failed. Try again.",
		);
	},
};

export const UploadTiles: Story = {
	render: () => (
		<>
			<ImageUploadTile label="Upload Space icon" />
			<ImageUploadTile label="Upload avatar" shape="circle" />
			<ImageUploadTile label="Upload Space icon" disabled />
		</>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const avatar = canvas.getByRole("button", { name: "Upload avatar" });
		const input = avatar
			.closest("[data-image-upload]")
			?.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("Missing file input");
		pick(input, pixelPng("avatar.png"));
		await waitFor(() => expect(avatar).toHaveAttribute("data-has-image"));
		await expect(avatar.querySelector("img")?.getAttribute("src")).toMatch(
			/^blob:/,
		);
	},
};
