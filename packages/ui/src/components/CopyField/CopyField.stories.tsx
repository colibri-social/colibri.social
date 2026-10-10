import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../Button/Button";
import { Drawer, DrawerContent, DrawerTrigger } from "../Drawer/Drawer";
import { CopyField, InviteLinkPanel } from "./CopyField";

const meta = {
	title: "Primitives/Copy field",
	component: CopyField,
	parameters: { viewport: { defaultViewport: "iphone" } },
	decorators: [
		(Story) => (
			<div class="bg-popover p-4 text-foreground">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof CopyField>;

export default meta;
type Story = StoryObj<typeof meta>;

const INVITE = "https://colibri.social/invite/23asfgdpk1";

const stubClipboard = () => {
	const writeText = fn(async (_value: string) => {});
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	});
	return writeText;
};

const stubShare = (share: ((data: ShareData) => Promise<void>) | undefined) => {
	Object.defineProperty(navigator, "share", {
		configurable: true,
		writable: true,
		value: share,
	});
	Object.defineProperty(navigator, "canShare", {
		configurable: true,
		writable: true,
		value: undefined,
	});
};

export const Basic: Story = {
	args: { value: INVITE, "aria-label": "Invite link", onCopy: fn() },
	play: async ({ canvasElement, args }) => {
		const writeText = stubClipboard();
		const canvas = within(canvasElement);
		const input = canvas.getByRole("textbox", { name: "Invite link" });
		await expect(input).toHaveAttribute("readonly");
		await expect(input).toHaveValue(INVITE);
		await userEvent.click(input);
		const field = input as HTMLInputElement;
		await expect((field.selectionEnd ?? 0) - (field.selectionStart ?? 0)).toBe(
			INVITE.length,
		);
		const button = canvas.getByRole("button", { name: "Copy link" });
		await expect(button.getBoundingClientRect().width).toBe(40);
		await expect(button.getBoundingClientRect().height).toBe(40);
		await userEvent.click(button);
		await expect(writeText).toHaveBeenCalledWith(INVITE);
		await expect(args.onCopy).toHaveBeenCalledWith(INVITE);
		await waitFor(() => expect(button).toHaveAttribute("data-copied"));
		await expect(button).toHaveAccessibleName("Copied");
		await expect(canvas.getByRole("status")).toHaveTextContent("Link copied");
		await waitFor(() => expect(button).not.toHaveAttribute("data-copied"), {
			timeout: 3000,
		});
	},
};

const onSettings = fn();

export const InviteDrawer: Story = {
	args: { value: INVITE },
	render: () => (
		<Drawer>
			<DrawerTrigger as={Button} variant="secondary">
				Invite people
			</DrawerTrigger>
			<DrawerContent title="Invite people to Awesome Space">
				<InviteLinkPanel
					url={INVITE}
					title="Join Awesome Space on Colibri"
					onSettings={onSettings}
					class="pb-safe-offset-4"
				/>
			</DrawerContent>
		</Drawer>
	),
	play: async ({ canvasElement }) => {
		const share = fn(async (_data: ShareData) => {});
		stubShare(share);
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Invite people" }),
		);
		const dialog = await screen.findByRole("dialog");
		const shareButton = await within(dialog).findByRole("button", {
			name: "Share invite",
		});
		const settings = within(dialog).getByRole("button", {
			name: "Invite settings",
		});
		const shareBox = shareButton.getBoundingClientRect();
		const settingsBox = settings.getBoundingClientRect();
		await expect(shareBox.top).toBe(settingsBox.top);
		await expect(Math.abs(shareBox.width - settingsBox.width)).toBeLessThan(1);
		await userEvent.click(shareButton);
		await expect(share).toHaveBeenCalledWith({
			title: "Join Awesome Space on Colibri",
			text: undefined,
			url: INVITE,
		});
		await userEvent.click(settings);
		await expect(onSettings).toHaveBeenCalled();
		stubShare(undefined);
	},
};

export const ShareFallsBackToCopy: Story = {
	args: { value: INVITE },
	render: () => <InviteLinkPanel url={INVITE} />,
	play: async ({ canvasElement }) => {
		stubShare(undefined);
		const writeText = stubClipboard();
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole("button", { name: "Invite settings" }),
		).toBeNull();
		await userEvent.click(canvas.getByRole("button", { name: "Share invite" }));
		await expect(writeText).toHaveBeenCalledWith(INVITE);
		await waitFor(() =>
			expect(
				canvas.getByRole("button", { name: "Link copied" }),
			).toBeInTheDocument(),
		);
	},
};

export const ShareCancelledDoesNotCopy: Story = {
	args: { value: INVITE },
	render: () => <InviteLinkPanel url={INVITE} />,
	play: async ({ canvasElement }) => {
		stubShare(async () => {
			throw new DOMException("Cancelled", "AbortError");
		});
		const writeText = stubClipboard();
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Share invite" }),
		);
		await expect(writeText).not.toHaveBeenCalled();
		stubShare(undefined);
	},
};

const customShare = fn(() => "shared" as const);

export const CustomShareHandler: Story = {
	args: { value: INVITE },
	render: () => <InviteLinkPanel url={INVITE} onShare={customShare} />,
	play: async ({ canvasElement }) => {
		const writeText = stubClipboard();
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Share invite" }),
		);
		await expect(customShare).toHaveBeenCalledWith({
			title: undefined,
			text: undefined,
			url: INVITE,
		});
		await expect(writeText).not.toHaveBeenCalled();
	},
};
