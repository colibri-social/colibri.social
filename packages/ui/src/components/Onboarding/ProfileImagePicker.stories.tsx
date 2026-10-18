/// <reference path="../../gifenc.d.ts" />
import { GIFEncoder } from "gifenc";
import { createSignal, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../Button/Button";
import { ProfileImagePicker } from "./OnboardingScreens";

const PIXEL_PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const pngFile = (name: string) => {
	const bytes = Uint8Array.from(atob(PIXEL_PNG), (char) => char.charCodeAt(0));
	return new File([bytes], name, { type: "image/png" });
};

const pick = (input: HTMLInputElement, file: File) => {
	const transfer = new DataTransfer();
	transfer.items.add(file);
	input.files = transfer.files;
	input.dispatchEvent(new Event("change", { bubbles: true }));
};

const onFile = fn();

const Harness = () => {
	const [error, setError] = createSignal<string>();
	return (
		<div class="flex flex-col items-start gap-3 bg-background p-6">
			<ProfileImagePicker maxBytes={1_000} onFile={onFile} onError={setError}>
				{(open) => (
					<Button variant="secondary" onClick={open}>
						Change picture
					</Button>
				)}
			</ProfileImagePicker>
			<Show when={error()}>
				<p role="alert" class="m-0 text-sm text-destructive">
					{error()}
				</p>
			</Show>
		</div>
	);
};

const meta = {
	title: "Primitives/Profile image picker",
	render: () => <Harness />,
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const PicksAndRejects: Story = {
	play: async ({ canvasElement }) => {
		onFile.mockClear();
		const input =
			canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("file input missing");
		await expect(
			within(canvasElement).getByRole("button", { name: "Change picture" }),
		).toBeVisible();
		pick(input, pngFile("avatar.png"));
		await waitFor(() => expect(onFile).toHaveBeenCalledOnce());
		await expect(within(canvasElement).queryByRole("alert")).toBeNull();
		pick(
			input,
			new File([new Uint8Array(5_000)], "huge.png", { type: "image/png" }),
		);
		await waitFor(() =>
			expect(within(canvasElement).getByRole("alert")).toBeVisible(),
		);
		await expect(onFile).toHaveBeenCalledOnce();
	},
};

const GIF_BYTES = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const gifFile = (name: string) => {
	const bytes = Uint8Array.from(atob(GIF_BYTES), (char) => char.charCodeAt(0));
	return new File([bytes], name, { type: "image/gif" });
};

const photoFile = async (name: string) => {
	const canvas = document.createElement("canvas");
	canvas.width = 900;
	canvas.height = 600;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("no canvas");
	context.fillStyle = "#4f7cff";
	context.fillRect(0, 0, 900, 600);
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/png"),
	);
	if (!blob) throw new Error("no blob");
	return new File([blob], name, { type: "image/png" });
};

const animatedGif = (
	name: string,
	size: number,
	frames: number,
	paint: (index: Uint8Array, frame: number) => void,
) => {
	const palette = Array.from({ length: 256 }, (_, color) => [
		color,
		(color * 37) % 256,
		(color * 91) % 256,
	]);
	const encoder = GIFEncoder();
	for (let frame = 0; frame < frames; frame++) {
		const index = new Uint8Array(size * size);
		paint(index, frame);
		encoder.writeFrame(index, size, size, { palette, delay: 80 });
	}
	encoder.finish();
	return new File([encoder.bytes()], name, { type: "image/gif" });
};

const flatFrames = (index: Uint8Array, frame: number) => {
	index.fill(frame % 2 ? 200 : 40);
};

const noiseFrames = (index: Uint8Array) => {
	for (let pixel = 0; pixel < index.length; pixel++) {
		index[pixel] = Math.random() * 256;
	}
};

const sizeOf = async (file: File) => {
	const bitmap = await createImageBitmap(file);
	const size = [bitmap.width, bitmap.height];
	bitmap.close();
	return size;
};

const onCropped = fn();

const CropHarness = (props: {
	crop?: "avatar" | "emoji";
	maxBytes?: number;
}) => {
	const [error, setError] = createSignal<string>();
	return (
		<div class="flex flex-col items-start gap-3 bg-background p-6">
			<ProfileImagePicker
				maxBytes={props.maxBytes ?? 1_000_000}
				crop={props.crop ?? "avatar"}
				onFile={onCropped}
				onError={setError}
			>
				{(open) => (
					<Button variant="secondary" onClick={open}>
						Change picture
					</Button>
				)}
			</ProfileImagePicker>
			<Show when={error()}>
				<p role="alert" class="m-0 text-sm text-destructive">
					{error()}
				</p>
			</Show>
		</div>
	);
};

export const CropsBeforeApplying: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <CropHarness />,
	play: async ({ canvasElement }) => {
		onCropped.mockClear();
		const input =
			canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("file input missing");
		pick(input, await photoFile("beach.png"));
		const dialog = await screen.findByRole("dialog");
		await expect(onCropped).not.toHaveBeenCalled();
		await waitFor(
			() =>
				expect(
					dialog.querySelector("[data-image-crop-stage][data-ready]"),
				).not.toBeNull(),
			{ timeout: 5000 },
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Apply" }),
		);
		await waitFor(() => expect(onCropped).toHaveBeenCalledOnce());
		const output = onCropped.mock.calls[0]?.[0] as File;
		await expect(output.name).toMatch(/^beach\.(webp|jpg)$/);
		const bitmap = await createImageBitmap(output);
		await expect([bitmap.width, bitmap.height]).toEqual([512, 512]);
		bitmap.close();
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await waitFor(() =>
			expect(
				document.querySelector('body > div[aria-hidden="true"]'),
			).toBeNull(),
		);
	},
};

const fileInput = (canvasElement: HTMLElement) => {
	const input =
		canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
	if (!input) throw new Error("file input missing");
	return input;
};

export const AnimatedGifSkipsCropper: Story = {
	render: () => <CropHarness />,
	play: async ({ canvasElement }) => {
		onCropped.mockClear();
		const gif = animatedGif("party.gif", 32, 2, flatFrames);
		pick(fileInput(canvasElement), gif);
		await waitFor(() => expect(onCropped).toHaveBeenCalledOnce());
		await expect(onCropped).toHaveBeenCalledWith(gif);
		await expect(screen.queryByRole("dialog")).toBeNull();
	},
};

export const StillGifOpensCropper: Story = {
	render: () => <CropHarness />,
	play: async ({ canvasElement }) => {
		onCropped.mockClear();
		pick(fileInput(canvasElement), gifFile("still.gif"));
		await expect(await screen.findByRole("dialog")).toBeVisible();
		await expect(onCropped).not.toHaveBeenCalled();
	},
};

export const ScalesDownALargeGif: Story = {
	render: () => <CropHarness crop="emoji" maxBytes={128_000} />,
	play: async ({ canvasElement }) => {
		onCropped.mockClear();
		pick(fileInput(canvasElement), animatedGif("wave.gif", 400, 3, flatFrames));
		await waitFor(() => expect(onCropped).toHaveBeenCalledOnce(), {
			timeout: 5000,
		});
		const output = onCropped.mock.calls[0]?.[0] as File;
		await expect(output.type).toBe("image/gif");
		await expect(await sizeOf(output)).toEqual([128, 128]);
		await expect(screen.queryByRole("dialog")).toBeNull();
	},
};

export const AsksBeforeLoweringQuality: Story = {
	render: () => <CropHarness crop="emoji" maxBytes={70_000} />,
	play: async ({ canvasElement }) => {
		onCropped.mockClear();
		pick(
			fileInput(canvasElement),
			animatedGif("static.gif", 400, 8, noiseFrames),
		);
		const dialog = await screen.findByRole("dialog", undefined, {
			timeout: 10_000,
		});
		await waitFor(() =>
			expect(within(dialog).getByText("This GIF is too large")).toBeVisible(),
		);
		await expect(onCropped).not.toHaveBeenCalled();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Lower quality" }),
		);
		await waitFor(() => expect(onCropped).toHaveBeenCalledOnce(), {
			timeout: 10_000,
		});
		const output = onCropped.mock.calls[0]?.[0] as File;
		await expect(output.size).toBeLessThanOrEqual(70_000);
		await expect(await sizeOf(output)).toEqual([128, 128]);
	},
};
