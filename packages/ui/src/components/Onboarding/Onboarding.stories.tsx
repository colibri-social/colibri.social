import { CloseIcon } from "@solar-icons/solid/bold/close";
import { PenNewSquareIcon } from "@solar-icons/solid/bold/pen-new-square";
import { createSignal } from "solid-js";
import { expect, fn, spyOn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { BlueskyLogo } from "../../icons/animated/brand";
import { type Haptics, HapticsProvider } from "../../utils/haptics";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";
import { TextField } from "../TextField/TextField";
import { ImageUploadTile } from "./ImageUploadTile";
import { PagerDots } from "./PagerDots";
import { SelectableCard, SelectableCardGroup } from "./SelectableCard";

const haptics = {
	impact: fn(),
	selection: fn(),
	notification: fn(),
} satisfies Haptics;

type Args = {
	onChange: (value: string) => void;
	onFileChange: (file: File) => void;
};

const meta: Meta<Args> = {
	title: "Surfaces/Onboarding",
	parameters: { viewport: { defaultViewport: "iphone" } },
	args: {
		onChange: fn(),
		onFileChange: fn(),
	},
};

export default meta;
type Story = StoryObj<Args>;

const ProfileStart = (props: { onChange?: (value: string) => void }) => {
	const [choice, setChoice] = createSignal("bluesky");
	return (
		<HapticsProvider haptics={haptics}>
			<div class="flex min-h-dvh flex-col bg-background px-6 text-foreground">
				<div class="flex flex-1 flex-col items-center justify-center gap-8">
					<h1 class="m-0 text-center text-4xl leading-tight font-extrabold text-balance">
						Let's get your profile going.
					</h1>
					<SelectableCardGroup
						aria-label="How to set up your profile"
						value={choice()}
						onChange={(value) => {
							setChoice(value);
							props.onChange?.(value);
						}}
						class="w-full"
					>
						<SelectableCard
							value="bluesky"
							label="Import from Bluesky"
							icon={<BlueskyLogo />}
						/>
						<SelectableCard
							value="scratch"
							label="Start from scratch"
							icon={<PenNewSquareIcon />}
						/>
					</SelectableCardGroup>
					<Button>Next</Button>
				</div>
				<div class="flex justify-center pb-safe-offset-10">
					<PagerDots count={2} index={0} />
				</div>
			</div>
		</HapticsProvider>
	);
};

export const ProfileSetupStart: Story = {
	render: (args) => <ProfileStart onChange={args.onChange} />,
	play: async ({ canvasElement, args }) => {
		haptics.selection.mockClear();
		const canvas = within(canvasElement);
		const bluesky = canvas.getByRole("radio", { name: "Import from Bluesky" });
		const scratch = canvas.getByRole("radio", { name: "Start from scratch" });
		await expect(bluesky).toBeChecked();

		await userEvent.click(canvas.getByText("Start from scratch"));
		await expect(scratch).toBeChecked();
		await expect(args.onChange).toHaveBeenCalledTimes(1);
		await expect(args.onChange).toHaveBeenLastCalledWith("scratch");
		await expect(haptics.selection).toHaveBeenCalledTimes(1);

		await userEvent.click(canvas.getByText("Start from scratch"));
		await expect(args.onChange).toHaveBeenCalledTimes(1);
		await expect(haptics.selection).toHaveBeenCalledTimes(1);

		await expect(
			canvas.getByRole("img", { name: "Step 1 of 2" }),
		).toBeInTheDocument();
	},
};

export const KeyboardSelection: Story = {
	render: (args) => <ProfileStart onChange={args.onChange} />,
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const bluesky = canvas.getByRole("radio", { name: "Import from Bluesky" });
		const scratch = canvas.getByRole("radio", { name: "Start from scratch" });
		bluesky.focus();
		await userEvent.keyboard("{ArrowRight}");
		await waitFor(() => expect(scratch).toBeChecked());
		await expect(args.onChange).toHaveBeenLastCalledWith("scratch");
		await userEvent.keyboard("{ArrowLeft}");
		await waitFor(() => expect(bluesky).toBeChecked());
		await expect(args.onChange).toHaveBeenLastCalledWith("bluesky");
	},
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

		const file = new File(["icon"], "icon.png", { type: "image/png" });
		const transfer = new DataTransfer();
		transfer.items.add(file);
		input.files = transfer.files;
		input.dispatchEvent(new Event("change", { bubbles: true }));

		await expect(args.onFileChange).toHaveBeenCalledWith(file);
		await waitFor(() => expect(tile).toHaveAttribute("data-has-image"));
	},
};

export const UploadTiles: Story = {
	render: () => (
		<div class="flex items-center gap-8 bg-popover p-8">
			<ImageUploadTile label="Upload Space icon" />
			<ImageUploadTile label="Upload avatar" shape="circle" />
			<ImageUploadTile label="Upload Space icon" disabled />
		</div>
	),
};

export const Pager: Story = {
	render: () => (
		<div class="flex flex-col items-center gap-4 bg-background p-8">
			<PagerDots count={4} index={0} />
			<PagerDots count={4} index={1} />
			<PagerDots count={4} index={3} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const second = canvas.getByRole("img", { name: "Step 2 of 4" });
		const dots = second.querySelectorAll("[data-pager-dot]");
		await expect(dots[0]).toHaveAttribute("data-pager-dot", "completed");
		await expect(dots[1]).toHaveAttribute("data-pager-dot", "active");
		await expect(dots[2]).toHaveAttribute("data-pager-dot", "upcoming");
	},
};
