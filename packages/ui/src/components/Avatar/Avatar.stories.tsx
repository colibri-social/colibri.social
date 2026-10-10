import { For } from "solid-js";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Avatar } from "./Avatar";
import {
	DEFAULT_AVATAR_SET,
	defaultAvatar,
	defaultAvatarFor,
	defaultAvatarUrl,
} from "./default-avatars/default-avatars";

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
	args: {
		src: "https://invalid.invalid/avatar.png",
		name: "Fallback User",
		fallback: "initials",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText("FU")).toBeInTheDocument();
	},
};

export const BrokenImageShowsDefaultAvatar: Story = {
	args: {
		src: "https://invalid.invalid/avatar.png",
		name: "Fallback User",
		seed: "did:plc:fallbackuser",
	},
	play: async ({ canvasElement }) => {
		const expected = defaultAvatarFor("did:plc:fallbackuser");
		const illustration = await new Promise<HTMLImageElement>((resolve) => {
			const check = () => {
				const found = canvasElement.querySelector<HTMLImageElement>(
					"[data-default-avatar]",
				);
				if (found) resolve(found);
				else requestAnimationFrame(check);
			};
			check();
		});
		await expect(illustration).toHaveAttribute("data-default-avatar", expected);
		await expect(illustration).toHaveAttribute("aria-hidden", "true");
		await expect(within(canvasElement).getByText("Fallback User")).toHaveClass(
			"sr-only",
		);
	},
};

const SEEDS = [
	"did:plc:ewvi7nxzyoun6zhxrhs64oiz",
	"did:plc:z72i7hdynmk6r22z27h6tvur",
	"did:plc:44ybard66vv44zksje25o7dz",
	"did:plc:vc7f4oafdgxsihk4cry2xpze",
	"did:web:colibri.social",
	"did:plc:oky5czdrnfjpqslsw2a5iclo",
];

export const DefaultAvatarAssignment: Story = {
	render: () => (
		<div class="flex flex-wrap items-center gap-4">
			<For each={SEEDS}>
				{(seed) => <Avatar name={seed} seed={seed} size="lg" />}
			</For>
			<Avatar name="Space without icon" shape="square" size="lg" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const illustrations = Array.from(
			canvasElement.querySelectorAll("[data-default-avatar]"),
		).map((node) => node.getAttribute("data-default-avatar"));
		await expect(illustrations).toEqual(
			SEEDS.map((seed) => defaultAvatarFor(seed)),
		);
		await expect(
			within(canvasElement).getByText("SW", { selector: "span" }),
		).toBeInTheDocument();
		await expect(defaultAvatarFor(SEEDS[0])).toBe(defaultAvatarFor(SEEDS[0]));
		await expect(defaultAvatarFor(SEEDS[0], ["feather-quill"])).toBe(
			"feather-quill",
		);
	},
};

const DEFAULT_AVATAR_SIZES = [88, 40, 20];

export const DefaultAvatars: Story = {
	render: () => (
		<div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
			<For each={DEFAULT_AVATAR_SET}>
				{(id) => (
					<figure
						class="m-0 flex items-center gap-4"
						data-default-avatar-option={id}
					>
						<For each={DEFAULT_AVATAR_SIZES}>
							{(size) => (
								<img
									src={defaultAvatarUrl(id)}
									alt=""
									width={size}
									height={size}
									class="shrink-0 rounded-full"
								/>
							)}
						</For>
						<figcaption class="text-sm">
							<span class="block font-semibold">{defaultAvatar(id).label}</span>
							<span class="block font-mono text-xs text-muted-foreground select-text">
								{id}
							</span>
						</figcaption>
					</figure>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		const ids = Array.from(
			canvasElement.querySelectorAll("[data-default-avatar-option]"),
		).map((node) => node.getAttribute("data-default-avatar-option"));
		await expect(ids).toEqual([
			"feather-quill",
			"feather-iridescent",
			"feather-pair",
			"feather-fan",
			"feather-falling",
		]);
		const images = Array.from(canvasElement.querySelectorAll("img"));
		await Promise.all(images.map((image) => image.decode()));
		for (const image of images) {
			await expect(image.naturalWidth).toBeGreaterThan(0);
		}
	},
};
