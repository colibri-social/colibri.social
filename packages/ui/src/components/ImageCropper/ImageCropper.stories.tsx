import { createResource, createSignal, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import type { ImageCropShape } from "./crop-math";
import { ImageCropper, type ImageCropperPlatform } from "./ImageCropper";

const meta = {
	title: "Media/Image cropper",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const makeTestImage = async (
	name: string,
	width = 1200,
	height = 800,
): Promise<File> => {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("no canvas");
	const gradient = context.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, "#7c5cff");
	gradient.addColorStop(1, "#ff8a5c");
	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);
	context.strokeStyle = "rgba(255,255,255,0.5)";
	context.lineWidth = 4;
	for (let x = 0; x <= width; x += 100) {
		context.beginPath();
		context.moveTo(x, 0);
		context.lineTo(x, height);
		context.stroke();
	}
	for (let y = 0; y <= height; y += 100) {
		context.beginPath();
		context.moveTo(0, y);
		context.lineTo(width, y);
		context.stroke();
	}
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/png"),
	);
	if (!blob) throw new Error("no blob");
	return new File([blob], name, { type: "image/png" });
};

const onApply = fn();

const Harness = (props: {
	shape: ImageCropShape;
	platform?: ImageCropperPlatform;
	name?: string;
}) => {
	const [open, setOpen] = createSignal(true);
	const [file] = createResource(() =>
		makeTestImage(props.name ?? "harbour-at-dusk.png"),
	);
	const [result, setResult] = createSignal<string>();
	return (
		<div class="flex min-h-dvh flex-col items-start gap-3 bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Crop again
			</Button>
			<Show when={result()}>
				<p data-crop-result="" class="m-0 text-sm text-muted-foreground">
					{result()}
				</p>
			</Show>
			<ImageCropper
				open={open()}
				onOpenChange={setOpen}
				file={file()}
				shape={props.shape}
				platform={props.platform}
				maxBytes={1_000_000}
				onApply={(output) => {
					onApply(output);
					setResult(`${output.name} ${output.type} ${output.size}`);
				}}
			/>
		</div>
	);
};

const stage = async () => {
	const element = await waitFor(
		() => {
			const found = document.querySelector<HTMLElement>(
				"[data-image-crop-stage][data-ready]",
			);
			if (!found) throw new Error("stage not ready");
			return found;
		},
		{ timeout: 5000 },
	);
	await new Promise((resolve) => setTimeout(resolve, 400));
	return element;
};

const parts = () => {
	const image = document.querySelector<HTMLElement>("[data-image-crop-image]");
	const frame = document.querySelector<HTMLElement>("[data-image-crop-frame]");
	if (!image || !frame) throw new Error("cropper parts missing");
	return { image, frame };
};

const covers = () => {
	const { image, frame } = parts();
	const a = image.getBoundingClientRect();
	const b = frame.getBoundingClientRect();
	return (
		a.left <= b.left + 0.5 &&
		a.top <= b.top + 0.5 &&
		a.right >= b.right - 0.5 &&
		a.bottom >= b.bottom - 0.5
	);
};

let pointerSeed = 40;

const drag = async (target: HTMLElement, dx: number, dy: number) => {
	const box = target.getBoundingClientRect();
	const x = box.left + box.width / 2;
	const y = box.top + box.height / 2;
	const init = {
		bubbles: true,
		pointerId: ++pointerSeed,
		pointerType: "touch",
		isPrimary: true,
	};
	target.dispatchEvent(
		new PointerEvent("pointerdown", { ...init, clientX: x, clientY: y }),
	);
	const steps = 10;
	for (let index = 1; index <= steps; index++) {
		target.dispatchEvent(
			new PointerEvent("pointermove", {
				...init,
				clientX: x + (dx * index) / steps,
				clientY: y + (dy * index) / steps,
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 8));
	}
	return () =>
		target.dispatchEvent(
			new PointerEvent("pointerup", {
				...init,
				clientX: x + dx,
				clientY: y + dy,
			}),
		);
};

const decodedSize = async (file: File) => {
	const bitmap = await createImageBitmap(file);
	const size = { width: bitmap.width, height: bitmap.height };
	bitmap.close();
	return size;
};

const lastApplied = () => {
	const call = onApply.mock.calls.at(-1);
	if (!call) throw new Error("onApply was not called");
	return call[0] as File;
};

export const Avatar: Story = {
	render: () => <Harness shape="avatar" />,
	play: async () => {
		onApply.mockClear();
		const target = await stage();
		const dialog = screen.getByRole("dialog");
		await expectNoLayoutIssues(dialog);
		const { frame } = parts();
		await expect(getComputedStyle(frame).borderTopLeftRadius).not.toBe("0px");
		const box = frame.getBoundingClientRect();
		await expect(Math.abs(box.width - box.height)).toBeLessThan(1);
		await expect(covers()).toBe(true);

		await userEvent.click(
			within(dialog).getByRole("button", { name: "Apply" }),
		);
		await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
		const output = lastApplied();
		await expect(["image/webp", "image/jpeg"]).toContain(output.type);
		await expect(output.name).toMatch(/^harbour-at-dusk\.(webp|jpg)$/);
		await expect(await decodedSize(output)).toEqual({
			width: 512,
			height: 512,
		});
		await expect(output.size).toBeLessThanOrEqual(1_000_000);
		await waitFor(() =>
			expect(document.querySelector('[role="dialog"]')).toBeNull(),
		);
		await expect(target.isConnected).toBe(false);
	},
};

export const Emoji: Story = {
	render: () => <Harness shape="emoji" />,
	play: async () => {
		onApply.mockClear();
		await stage();
		const dialog = screen.getByRole("dialog", { name: /Crop emoji/ });
		await expectNoLayoutIssues(dialog);
		const { frame } = parts();
		const box = frame.getBoundingClientRect();
		await expect(Math.abs(box.width - box.height)).toBeLessThan(1);
		await expect(
			Number.parseFloat(getComputedStyle(frame).borderTopLeftRadius),
		).toBeLessThan(box.width / 4);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Apply" }),
		);
		await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
		await expect(await decodedSize(lastApplied())).toEqual({
			width: 128,
			height: 128,
		});
	},
};

export const PanClamping: Story = {
	render: () => <Harness shape="avatar" />,
	play: async () => {
		const target = await stage();
		const { image, frame } = parts();
		const release = await drag(target, 600, 0);
		const frameBox = frame.getBoundingClientRect();
		const stretched = image.getBoundingClientRect();
		await expect(stretched.left).toBeGreaterThan(frameBox.left);
		await expect(stretched.left - frameBox.left).toBeLessThan(600);
		release();
		await waitFor(() => expect(covers()).toBe(true), { timeout: 2000 });
		await expect(
			Math.abs(image.getBoundingClientRect().left - frameBox.left),
		).toBeLessThan(1);

		const releaseDown = await drag(target, 0, 400);
		releaseDown();
		await waitFor(() => expect(covers()).toBe(true), { timeout: 2000 });
	},
};

export const BannerOnDesktop: Story = {
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: () => <Harness shape="banner" platform="desktop" />,
	play: async () => {
		onApply.mockClear();
		const target = await stage();
		const dialog = screen.getByRole("dialog");
		await expectNoLayoutIssues(dialog);
		const box = parts().frame.getBoundingClientRect();
		await expect(Math.abs(box.width / box.height - 3)).toBeLessThan(0.02);

		const slider = within(dialog).getByRole("slider", { name: "Zoom" });
		const before = parts().image.getBoundingClientRect().width;
		target.dispatchEvent(
			new WheelEvent("wheel", {
				bubbles: true,
				cancelable: true,
				deltaY: -300,
				clientX: box.left + box.width / 2,
				clientY: box.top + box.height / 2,
			}),
		);
		await waitFor(() =>
			expect(parts().image.getBoundingClientRect().width).toBeGreaterThan(
				before,
			),
		);
		await expect(Number(slider.getAttribute("aria-valuenow"))).toBeGreaterThan(
			1,
		);
		await expect(covers()).toBe(true);

		await userEvent.click(
			within(dialog).getByRole("button", { name: "Apply" }),
		);
		await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
		await expect(await decodedSize(lastApplied())).toEqual({
			width: 1500,
			height: 500,
		});
	},
};

export const ZoomWithSliderAndKeys: Story = {
	render: () => <Harness shape="avatar" />,
	play: async () => {
		const target = await stage();
		const dialog = screen.getByRole("dialog");
		const slider = within(dialog).getByRole("slider", { name: "Zoom" });
		const width = () => parts().image.getBoundingClientRect().width;
		const start = width();
		slider.focus();
		await userEvent.keyboard("{End}");
		await waitFor(() => expect(width()).toBeGreaterThan(start * 3.5));
		await expect(slider).toHaveAttribute("aria-valuenow", "4");
		await expect(covers()).toBe(true);
		await userEvent.keyboard("{Home}");
		await waitFor(() => expect(Math.abs(width() - start)).toBeLessThan(1));

		target.focus();
		await userEvent.keyboard("+");
		await waitFor(() => expect(width()).toBeGreaterThan(start));
		await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
		await expect(covers()).toBe(true);
		await userEvent.keyboard("-");
		await waitFor(() => expect(Math.abs(width() - start)).toBeLessThan(1));
	},
};

export const Cancel: Story = {
	render: () => <Harness shape="banner" />,
	play: async () => {
		onApply.mockClear();
		await stage();
		const dialog = screen.getByRole("dialog");
		const cancels = within(dialog).getAllByRole("button", { name: "Cancel" });
		await userEvent.click(cancels[cancels.length - 1] as HTMLElement);
		await waitFor(() =>
			expect(document.querySelector('[role="dialog"]')).toBeNull(),
		);
		await expect(onApply).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(
				document.querySelector('body > div[aria-hidden="true"]'),
			).toBeNull(),
		);
	},
};

export const LongFileName: Story = {
	render: () => (
		<Harness
			shape="avatar"
			name="IMG_20261010_183245_portrait_mode_with_a_very_long_export_name_from_the_gallery_app.png"
		/>
	),
	play: async () => {
		await stage();
		const dialog = screen.getByRole("dialog");
		await expectNoLayoutIssues(dialog);
		const caption = dialog.querySelector<HTMLElement>("[data-image-crop-name]");
		await expect(caption).not.toBeNull();
		if (!caption) return;
		await expect(caption.scrollWidth).toBeGreaterThan(caption.clientWidth);
		await expect(caption).not.toHaveAttribute("title");
		await userEvent.hover(caption);
		await waitFor(
			() =>
				expect(screen.getByRole("tooltip")).toHaveTextContent(
					"very_long_export_name",
				),
			{ timeout: 2000 },
		);
	},
};
