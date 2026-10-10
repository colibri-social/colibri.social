import { createSignal } from "solid-js";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { SectionLabel } from "../List/List";
import { FeaturedBridgeCard } from "./FeaturedBridgeCard";

const meta = {
	title: "Surfaces/Featured bridge",
	component: FeaturedBridgeCard,
	parameters: { viewport: { defaultViewport: "iphone" } },
	decorators: [
		(Story) => (
			<div class="flex flex-col gap-2 bg-popover p-4 text-foreground">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof FeaturedBridgeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const onConnect = fn();
const onHaveCode = fn();

export const FeaturedBridges: Story = {
	args: { name: "", author: "", features: [] },
	render: () => (
		<section class="flex flex-col gap-2">
			<SectionLabel
				label="Featured bridges"
				action={{ label: "I have a code", onClick: onHaveCode }}
			/>
			<div class="flex flex-col gap-4">
				<FeaturedBridgeCard
					name="Matrix"
					verified
					author="Colibri Social"
					features={[
						{ label: "Bi-directional messages", support: "full" },
						{ label: "Bi-directional message moderation", support: "full" },
					]}
					onAction={() => onConnect("matrix")}
				/>
				<FeaturedBridgeCard
					name="Slack"
					verified
					author="Colibri Social"
					features={[
						{ label: "Import messages from Slack", support: "partial" },
						{ label: "No moderation", support: "none" },
					]}
					onAction={() => onConnect("slack")}
				/>
				<FeaturedBridgeCard
					name="Minecraft"
					author="@blockbuilder.example.com"
					features={[
						{ label: "Bi-directional messages", support: "full" },
						{
							label: "Can't moderate messages in Minecraft",
							support: "partial",
						},
					]}
					onAction={() => onConnect("minecraft")}
				/>
			</div>
		</section>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const cards = canvasElement.querySelectorAll("[data-featured-bridge]");
		await expect(cards).toHaveLength(3);
		await expect(
			canvas.getByRole("heading", { name: "Matrix Verified" }),
		).toBeVisible();
		const slack = cards[1] as HTMLElement;
		await expect(
			slack.querySelector('[data-bridge-feature-icon="partial"]'),
		).not.toBeNull();
		await expect(
			slack.querySelector('[data-bridge-feature-icon="none"]'),
		).not.toBeNull();
		await expect(within(slack).getByText(/Not supported/)).toBeInTheDocument();
		await expect(
			within(cards[2] as HTMLElement).queryByRole("img", { name: "Verified" }),
		).toBeNull();
		await userEvent.click(
			canvas.getByRole("button", { name: "Connect Slack" }),
		);
		await expect(onConnect).toHaveBeenCalledWith("slack");
		const action = canvas.getByRole("button", { name: "I have a code" });
		await userEvent.click(action);
		await expect(onHaveCode).toHaveBeenCalled();
		await expect(getComputedStyle(action).fontWeight).toBe("600");
		const button = canvas.getByRole("button", { name: "Connect Matrix" });
		await expect(button.getBoundingClientRect().height).toBe(36);
		await expect(button.getBoundingClientRect().width).toBeCloseTo(
			(cards[0] as HTMLElement).getBoundingClientRect().width - 34,
			0,
		);
	},
};

export const Connecting: Story = {
	args: { name: "", author: "", features: [] },
	render: () => {
		const [loading, setLoading] = createSignal(false);
		return (
			<FeaturedBridgeCard
				name="Matrix"
				verified
				author="Colibri Social"
				features={[{ label: "Bi-directional messages", support: "full" }]}
				actionLoading={loading()}
				onAction={() => setLoading(true)}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button", {
			name: "Connect Matrix",
		});
		await userEvent.click(button);
		await expect(button).toBeDisabled();
	},
};
