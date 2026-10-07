import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Avatar } from "./Avatar";

const SAMPLE_IMAGE =
	"data:image/svg+xml;utf8," +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9c66ff"/><stop offset="1" stop-color="#4ade80"/></linearGradient></defs><rect width="80" height="80" fill="url(#g)"/></svg>',
	);

const meta = {
	title: "Primitives/Avatar",
	component: Avatar,
	args: {
		name: "Lou Escher",
		size: "md",
	},
	argTypes: {
		size: {
			control: "select",
			options: ["xs", "sm", "base", "md", "lg", "xl"],
		},
		presence: {
			control: "select",
			options: [undefined, "online", "idle", "dnd", "offline"],
		},
		shape: { control: "select", options: ["circle", "square"] },
	},
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	args: { src: SAMPLE_IMAGE, presence: "online" },
};

export const Presence: Story = {
	render: () => (
		<div class="flex flex-col gap-6">
			{(["md", "lg", "xl"] as const).map((size) => (
				<div class="flex items-center gap-6">
					<Avatar
						name="Online"
						size={size}
						src={SAMPLE_IMAGE}
						presence="online"
					/>
					<Avatar name="Away" size={size} src={SAMPLE_IMAGE} presence="idle" />
					<Avatar name="Busy" size={size} src={SAMPLE_IMAGE} presence="dnd" />
					<Avatar
						name="Offline"
						size={size}
						src={SAMPLE_IMAGE}
						presence="offline"
					/>
				</div>
			))}
		</div>
	),
};

export const OnSurfaces: Story = {
	render: () => (
		<div class="flex gap-4">
			<div class="rounded-surface bg-card p-4 [--avatar-ring:var(--card)]">
				<Avatar name="On card" presence="dnd" />
			</div>
			<div class="rounded-surface bg-popover p-4 [--avatar-ring:var(--popover)]">
				<Avatar name="On popover" presence="idle" />
			</div>
			<div class="rounded-surface bg-secondary p-4 [--avatar-ring:var(--secondary)]">
				<Avatar name="On secondary" presence="online" />
			</div>
		</div>
	),
};

export const Sizes: Story = {
	render: () => (
		<div class="flex items-end gap-4">
			{(["xs", "sm", "base", "md", "lg", "xl"] as const).map((size) => (
				<Avatar
					name="Lou Escher"
					size={size}
					src={SAMPLE_IMAGE}
					data-size={size}
					presence="online"
				/>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const base = canvasElement.querySelector<HTMLElement>('[data-size="base"]');
		await expect(base?.getBoundingClientRect().width).toBe(32);
		await expect(base?.getBoundingClientRect().height).toBe(32);
	},
};

export const SpaceIcon: Story = {
	render: () => (
		<div class="flex items-end gap-4">
			<Avatar
				name="Colibri Social Flock"
				shape="square"
				size="md"
				color="var(--primary-fill)"
			/>
			<Avatar
				name="Colibri Social Flock"
				shape="square"
				size="lg"
				color="var(--primary-fill)"
			/>
			<Avatar
				name="Colibri Social Flock"
				shape="square"
				size="xl"
				src={SAMPLE_IMAGE}
			/>
		</div>
	),
};

export const BrokenImageFallsBack: Story = {
	args: { src: "https://invalid.invalid/avatar.png", name: "Fallback User" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText("FU")).toBeInTheDocument();
	},
};
