import { expect, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Banner } from "./Banner";
import { storyImages } from "./story-images";

const meta = {
	title: "Surfaces/Banner",
	component: Banner,
	parameters: { viewport: { defaultViewport: "iphone" } },
	decorators: [
		(Story) => (
			<div class="flex flex-col gap-3 bg-background p-4">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

const Labeled = (props: {
	label: string;
	children: import("solid-js").JSX.Element;
}) => (
	<div class="flex flex-col gap-1.5">
		<p class="text-xs font-semibold text-muted-foreground">{props.label}</p>
		<div class="overflow-hidden rounded-surface border border-border">
			{props.children}
		</div>
	</div>
);

export const Image: Story = {
	args: {
		src: storyImages.sunsetBanner(),
		alt: "Sunset banner",
		color: "#11111b",
	},
	play: async ({ canvasElement }) => {
		const banner = canvasElement.querySelector("[data-banner]");
		await expect(banner).toHaveAttribute("data-fill", "image");
		const image = within(canvasElement).getByRole("img", {
			name: "Sunset banner",
		});
		await waitFor(() => expect(image).toHaveClass("opacity-100"));
	},
};

export const SavedColorBeatsTint: Story = {
	args: { tintFrom: storyImages.tealIcon(), color: "#11111b" },
	play: async ({ canvasElement }) => {
		const banner = canvasElement.querySelector("[data-banner]");
		await expect(banner).toHaveAttribute("data-fill", "color");
	},
};

export const TintFromIcon: Story = {
	args: { tintFrom: storyImages.tealIcon() },
	play: async ({ canvasElement }) => {
		const banner = canvasElement.querySelector("[data-banner]");
		await waitFor(() => expect(banner).toHaveAttribute("data-fill", "tint"));
		const layer = () =>
			Array.from(
				canvasElement.querySelectorAll<HTMLElement>("[data-banner-layer]"),
			).at(-1);
		await waitFor(() =>
			expect(layer()?.getAttribute("style") ?? "").toContain("linear-gradient"),
		);
	},
};

export const ThemeColor: Story = {
	args: { color: "#11111b", ratio: "user" },
	play: async ({ canvasElement }) => {
		const banner = canvasElement.querySelector("[data-banner]");
		await expect(banner).toHaveAttribute("data-fill", "color");
	},
};

export const ThemeGradient: Story = {
	args: { color: "linear-gradient(135deg, #8e51ff, #e64980)", ratio: "user" },
};

export const Placeholder: Story = {
	args: {},
	play: async ({ canvasElement }) => {
		const banner = canvasElement.querySelector("[data-banner]");
		await expect(banner).toHaveAttribute("data-fill", "placeholder");
	},
};

export const Ratios: Story = {
	render: () => (
		<>
			<Labeled label="User (3/1)">
				<Banner ratio="user" tintFrom={storyImages.violetIcon()} />
			</Labeled>
			<Labeled label="Space (2/1)">
				<Banner ratio="space" tintFrom={storyImages.amberIcon()} />
			</Labeled>
		</>
	),
	play: async ({ canvasElement }) => {
		const banners =
			canvasElement.querySelectorAll<HTMLElement>("[data-banner]");
		const [user, space] = Array.from(banners).map((banner) =>
			banner.getBoundingClientRect(),
		);
		await expect(Math.round(user.width / user.height)).toBe(3);
		await expect(Math.round(space.width / space.height)).toBe(2);
	},
};
