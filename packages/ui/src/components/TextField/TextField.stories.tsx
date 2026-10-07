import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { PipetteIcon } from "@solar-icons/solid/bold/pipette";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { createSignal, For, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { IconButton } from "../IconButton/IconButton";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover/Popover";
import { SearchField, TextArea, TextField } from "./TextField";

const meta = {
	title: "Primitives/TextField",
	component: TextField,
	args: {
		label: "Space name",
		placeholder: "My Awesome Space",
		onChange: fn(),
	},
	decorators: [(Story) => <div class="w-full max-w-[370px]">{Story()}</div>],
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Filled: Story = {
	args: { defaultValue: "Alice's Space" },
};

export const WithError: Story = {
	args: {
		label: "Handle or Username",
		defaultValue: "alice",
		error: "No account found for this handle.",
	},
};

export const Disabled: Story = {
	args: { disabled: true, defaultValue: "Read only value" },
};

export const WithLeading: Story = {
	args: {
		label: "Status",
		placeholder: "What are you up to?",
		leading: <SmileCircleIcon />,
	},
};

const STATUS_EMOJIS = ["🐦", "🪺", "🎧", "💻", "☕", "🌙", "🎮", "📚"];

const StatusField = () => {
	const [emoji, setEmoji] = createSignal<string>();
	const [open, setOpen] = createSignal(false);

	return (
		<TextField
			label="Status"
			placeholder="What are you up to?"
			defaultValue="Building a nest!"
			leading={
				<Popover open={open()} onOpenChange={setOpen} placement="bottom-start">
					<PopoverTrigger
						as={IconButton}
						variant="ghost"
						size="sm"
						label={
							emoji() ? `Status emoji ${emoji()}` : "Choose a status emoji"
						}
						class="-ml-1.5 text-lg text-muted-foreground"
						icon={
							<Show when={emoji()} fallback={<SmileCircleIcon />}>
								{emoji()}
							</Show>
						}
					/>
					<PopoverContent title="Status emoji">
						<div class="grid grid-cols-4 gap-1">
							<For each={STATUS_EMOJIS}>
								{(item) => (
									<button
										type="button"
										aria-label={item}
										class="pressable flex size-10 cursor-pointer items-center justify-center rounded-control text-2xl hover:bg-secondary data-pressed:bg-secondary"
										onClick={() => {
											setEmoji(item);
											setOpen(false);
										}}
									>
										{item}
									</button>
								)}
							</For>
						</div>
					</PopoverContent>
				</Popover>
			}
		/>
	);
};

export const WithEmojiButton: Story = {
	render: () => <StatusField />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Choose a status emoji" }),
		);
		const dialog = await screen.findByRole("dialog");
		await userEvent.click(within(dialog).getByRole("button", { name: "🐦" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		await expect(
			canvas.getByRole("button", { name: "Status emoji 🐦" }),
		).toBeInTheDocument();
	},
};

export const WithTrailingAction: Story = {
	render: () => (
		<div class="flex flex-col gap-6">
			<TextField
				label="Display name"
				defaultValue="Lou"
				trailingAction={
					<IconButton
						label="Pick name color"
						variant="inverse"
						size="lg"
						icon={<PipetteIcon />}
					/>
				}
			/>
			<TextField
				aria-label="Invite link"
				readOnly
				defaultValue="https://colibri.social/invite/23asfgdpk1"
				trailingAction={
					<IconButton
						label="Copy invite link"
						variant="primary"
						size="lg"
						icon={<CopyIcon />}
					/>
				}
			/>
		</div>
	),
};

export const Typing: Story = {
	args: { label: "Channel name", placeholder: "Awesome Channel" },
	play: async ({ canvasElement, args }) => {
		const input = within(canvasElement).getByLabelText("Channel name");
		await userEvent.type(input, "general");
		await expect(input).toHaveValue("general");
		await expect(args.onChange).toHaveBeenLastCalledWith("general");
	},
};

export const Area: StoryObj<typeof TextArea> = {
	render: () => (
		<TextArea
			label="Bio"
			placeholder="Tell people about yourself"
			maxLength={256}
			showCount
		/>
	),
};

export const AreaAutoResize: StoryObj<typeof TextArea> = {
	render: () => (
		<TextArea
			label="Channel description"
			placeholder="What is this channel about?"
			rows={2}
			autoResize
		/>
	),
};

export const Search: StoryObj<typeof SearchField> = {
	render: () => (
		<SearchField aria-label="Search spaces" placeholder="Search spaces..." />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole("searchbox");
		await userEvent.type(input, "birds");
		await expect(input).toHaveValue("birds");
		await userEvent.keyboard("{Escape}");
		await expect(input).toHaveValue("");
		await userEvent.type(input, "crows");
		await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
		await expect(input).toHaveValue("");
		await expect(input).toHaveFocus();
	},
};
