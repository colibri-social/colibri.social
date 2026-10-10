import { createSignal } from "solid-js";
import { expect, fn, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { MessageRow } from "../Message/MessageRow";
import { AttachmentDropzone } from "./AttachmentDropzone";
import { AttachmentTray, type PendingAttachment } from "./AttachmentTray";
import { Composer } from "./Composer";
import {
	fileTransfer,
	fireDrag,
	storyFiles,
	textTransfer,
} from "./drag-fixtures";

const meta = {
	title: "Messaging/Attachment dropzone",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const NOW = new Date(2026, 9, 7, 9, 41);
const onFiles = fn();

const toPending = (file: File, index: number): PendingAttachment => ({
	id: `${file.name}-${index}`,
	name: file.name,
	size: file.size,
});

const Chat = (props: { disabled?: boolean }) => {
	const [items, setItems] = createSignal<PendingAttachment[]>([]);
	return (
		<div class="flex h-[640px] w-full flex-col bg-card text-foreground">
			<AttachmentDropzone
				channelName="general"
				disabled={props.disabled}
				onFiles={(files) => {
					onFiles(files);
					setItems((current) => [
						...current,
						...files.map((file, index) =>
							toPending(file, current.length + index),
						),
					]);
				}}
				footer={
					<Composer
						platform="desktop"
						channelName="general"
						hasAttachments={items().length > 0}
						top={
							<AttachmentTray
								items={items()}
								max={10}
								onRemove={(id) =>
									setItems((current) =>
										current.filter((item) => item.id !== id),
									)
								}
							/>
						}
					/>
				}
			>
				<div class="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto pb-2">
					<MessageRow
						platform="desktop"
						author={{ name: "Lou" }}
						timestamp={new Date(2026, 9, 7, 9, 30)}
						now={NOW}
						locale="en-GB"
					>
						Send the kingfisher photos when you can
					</MessageRow>
				</div>
			</AttachmentDropzone>
		</div>
	);
};

const overlayOf = (canvasElement: HTMLElement) =>
	canvasElement.querySelector(
		"[data-attachment-dropzone-overlay]",
	) as HTMLElement;

const messageOf = (canvasElement: HTMLElement) =>
	canvasElement.querySelector("[data-message]") as HTMLElement;

export const Desktop: Story = {
	render: () => <Chat />,
	play: async ({ canvasElement, step }) => {
		onFiles.mockClear();
		const canvas = within(canvasElement);
		const overlay = overlayOf(canvasElement);
		const message = messageOf(canvasElement);
		await expect(overlay).not.toHaveAttribute("data-visible");
		await expect(overlay).toHaveAttribute("aria-hidden", "true");

		await step("Dragging files over the chat shows the overlay", async () => {
			const transfer = fileTransfer(...storyFiles());
			fireDrag(message, "dragenter", transfer);
			await expect(overlay).toHaveAttribute("data-visible");
			await expect(overlay).not.toHaveAttribute("aria-hidden");
			await expect(
				within(overlay).getByText("Drop files to attach"),
			).toBeInTheDocument();
			await expect(
				within(overlay).getByText("Upload to #general"),
			).toBeInTheDocument();
			await expect(canvas.getByRole("status")).toHaveTextContent(
				"Drop files to attach",
			);
			const over = fireDrag(message, "dragover", transfer);
			await expect(over.defaultPrevented).toBe(true);
		});

		await step("Crossing child elements keeps the overlay", async () => {
			const transfer = fileTransfer(...storyFiles());
			const content = message.querySelector(
				"[data-message-content]",
			) as HTMLElement;
			fireDrag(content, "dragenter", transfer);
			fireDrag(message, "dragleave", transfer);
			await expect(overlay).toHaveAttribute("data-visible");
		});

		await step("Leaving the window hides the overlay", async () => {
			const transfer = fileTransfer(...storyFiles());
			fireDrag(message, "dragleave", transfer);
			await expect(overlay).not.toHaveAttribute("data-visible");
			await expect(overlay).toHaveAttribute("aria-hidden", "true");
		});

		await step("Dropping files attaches them to the composer", async () => {
			const files = storyFiles();
			const transfer = fileTransfer(...files);
			fireDrag(message, "dragenter", transfer);
			await expect(overlay).toHaveAttribute("data-visible");
			const drop = fireDrag(message, "drop", transfer);
			await expect(drop.defaultPrevented).toBe(true);
			await expect(onFiles).toHaveBeenCalledTimes(1);
			const dropped = onFiles.mock.calls[0][0] as File[];
			await expect(dropped.map((file) => file.name)).toEqual(
				files.map((file) => file.name),
			);
			await expect(overlay).not.toHaveAttribute("data-visible");
			await expect(canvas.getByText("2/10 attachments")).toBeInTheDocument();
			await expect(
				canvas.getByRole("button", { name: "Remove kingfisher.png" }),
			).toBeInTheDocument();
		});
	},
};

export const IgnoresNonFileDrags: Story = {
	render: () => <Chat />,
	play: async ({ canvasElement }) => {
		onFiles.mockClear();
		const overlay = overlayOf(canvasElement);
		const message = messageOf(canvasElement);
		const transfer = textTransfer("Every single morning");
		fireDrag(message, "dragenter", transfer);
		const over = fireDrag(message, "dragover", transfer);
		await expect(over.defaultPrevented).toBe(false);
		await expect(overlay).not.toHaveAttribute("data-visible");
		fireDrag(message, "drop", transfer);
		await expect(onFiles).not.toHaveBeenCalled();
	},
};

export const RejectsDropsOutsideTheChat: Story = {
	render: () => (
		<div class="flex">
			<div data-testid="outside" class="h-[640px] w-60 bg-background" />
			<Chat />
		</div>
	),
	play: async ({ canvasElement }) => {
		onFiles.mockClear();
		const overlay = overlayOf(canvasElement);
		const outside = within(canvasElement).getByTestId("outside");
		const transfer = fileTransfer(...storyFiles());
		fireDrag(outside, "dragenter", transfer);
		await expect(overlay).toHaveAttribute("data-visible");
		const over = fireDrag(outside, "dragover", transfer);
		await expect(over.defaultPrevented).toBe(true);
		fireDrag(outside, "drop", transfer);
		await expect(onFiles).not.toHaveBeenCalled();
		await expect(overlay).not.toHaveAttribute("data-visible");
	},
};

export const Disabled: Story = {
	render: () => <Chat disabled />,
	play: async ({ canvasElement }) => {
		onFiles.mockClear();
		const overlay = overlayOf(canvasElement);
		const message = messageOf(canvasElement);
		const transfer = fileTransfer(...storyFiles());
		fireDrag(message, "dragenter", transfer);
		await expect(overlay).not.toHaveAttribute("data-visible");
		fireDrag(message, "drop", transfer);
		await expect(onFiles).not.toHaveBeenCalled();
	},
};

export const ReducedMotion: Story = {
	render: () => <Chat />,
	play: async ({ canvasElement }) => {
		const root = document.documentElement;
		const previous = root.dataset.reducedMotion;
		root.dataset.reducedMotion = "true";
		try {
			const overlay = overlayOf(canvasElement);
			const transfer = fileTransfer(...storyFiles());
			fireDrag(messageOf(canvasElement), "dragenter", transfer);
			await expect(overlay).toHaveAttribute("data-visible");
			await waitFor(() =>
				expect(getComputedStyle(overlay).transitionProperty).toBe("none"),
			);
			fireDrag(messageOf(canvasElement), "dragleave", transfer);
		} finally {
			if (previous === undefined) delete root.dataset.reducedMotion;
			else root.dataset.reducedMotion = previous;
		}
	},
};
