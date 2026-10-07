import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { DeveloperModeCard } from "./DeveloperModeCard";

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
