import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { SidebarNavSection } from "../List/List";
import { DeveloperModeCard } from "./DeveloperModeCard";
import { DeveloperNavSection } from "./DeveloperNavSection";

const meta = {
	title: "Surfaces/Developer mode",
	component: DeveloperModeCard,
	parameters: { viewport: { defaultViewport: "iphone" } },
	decorators: [
		(Story) => (
			<div class="bg-popover p-4">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof DeveloperModeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpaceDid: Story = {
	args: {
		copyLabel: "Copy DID",
		copyValue: "did:plc:colibrisocialflock",
		pdslsHref: "https://pdsls.dev/at://did:plc:colibrisocialflock",
		onCopy: fn(),
	},
	play: async ({ canvasElement, args }) => {
		const writeText = fn(async (_value: string) => {});
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		const canvas = within(canvasElement);
		const copy = canvas.getByRole("button", { name: "Copy DID" });
		await userEvent.click(copy);
		await expect(writeText).toHaveBeenCalledWith("did:plc:colibrisocialflock");
		await waitFor(() => expect(copy).toHaveAttribute("data-copied"));
		await expect(args.onCopy).toHaveBeenCalledTimes(1);
		await expect(canvas.getByRole("status")).toHaveTextContent("Copied");
		await expect(
			copy.querySelector('[data-animated-icon="copy"]'),
		).toBeInTheDocument();
		await waitFor(() => expect(copy).not.toHaveAttribute("data-copied"), {
			timeout: 3000,
		});
		await expect(
			canvas.getByRole("link", { name: "Show on PDSls" }),
		).toHaveAttribute("target", "_blank");
	},
};

export const MessageAtUri: Story = {
	args: {
		copyLabel: "Copy AT-URI",
		copyValue: "at://did:plc:example/social.colibri.message/3k",
		pdslsHref:
			"https://pdsls.dev/at://did:plc:example/social.colibri.message/3k",
	},
};

export const StackedInSidebar: Story = {
	args: {
		stacked: true,
		copyLabel: "Copy AT-URI",
		copyValue: "at://did:plc:colibrisocialflock",
		pdslsHref: "https://pdsls.dev/at://did:plc:colibrisocialflock",
	},
	decorators: [
		(Story) => (
			<div class="w-64">
				<Story />
			</div>
		),
	],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const copy = canvas.getByRole("button", { name: "Copy AT-URI" });
		const pdsls = canvas.getByRole("link", { name: "Show on PDSls" });
		const copyBox = copy.getBoundingClientRect();
		const pdslsBox = pdsls.getBoundingClientRect();
		await expect(pdslsBox.top).toBeGreaterThanOrEqual(copyBox.bottom);
		await expect(Math.round(pdslsBox.width)).toBe(Math.round(copyBox.width));
		await expect(copyBox.height).toBeGreaterThanOrEqual(36);
		await expect(Math.round(pdslsBox.height)).toBe(Math.round(copyBox.height));
		await expect(
			copy.querySelector(".truncate")?.scrollWidth,
		).toBeLessThanOrEqual(copy.querySelector(".truncate")?.clientWidth ?? 0);
	},
};

export const SidebarSection: Story = {
	render: () => (
		<nav class="flex h-96 w-72 flex-col gap-6 bg-card p-4">
			<div class="mt-auto flex flex-col gap-6">
				<DeveloperNavSection copyValue="at://did:plc:colibrisocialflock/social.colibri.beta.role/bots" />
				<SidebarNavSection label="Danger zone" />
			</div>
		</nav>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Developer mode")).toBeInTheDocument();
		await expect(
			canvas.getByRole("link", { name: "Show on PDSls" }),
		).toHaveAttribute(
			"href",
			"https://pdsls.dev/at://did:plc:colibrisocialflock/social.colibri.beta.role/bots",
		);
		await expect(
			canvas.getByRole("button", { name: "Copy AT-URI" }),
		).toBeInTheDocument();
	},
};
