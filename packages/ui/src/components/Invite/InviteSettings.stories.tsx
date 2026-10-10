import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../Button/Button";
import { Drawer, DrawerContent, DrawerTrigger } from "../Drawer/Drawer";
import { InviteLinkShare, type InviteLinkShareProps } from "./InviteSettings";
import type { InviteRequest } from "./invite-settings";

const meta = {
	title: "Surfaces/Invite settings",
	component: InviteLinkShare,
	decorators: [
		(Story) => (
			<div class="min-h-dvh bg-popover p-4 text-foreground">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof InviteLinkShare>;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };
const FIRST = "https://colibri.social/invite/23asfgdpk1";
const SECOND = "https://colibri.social/invite/9xq2mwlz7c";

const generated = fn((_request: InviteRequest) => {});

const InviteHarness = (props: {
	platform: "mobile" | "desktop";
	fail?: boolean;
}) => {
	const [url, setUrl] = createSignal(FIRST);
	const onGenerate: InviteLinkShareProps["onGenerate"] = async (request) => {
		generated(request);
		await new Promise((resolve) => setTimeout(resolve, 120));
		if (props.fail) throw new Error("offline");
		setUrl(SECOND);
	};
	return (
		<InviteLinkShare
			platform={props.platform}
			url={url()}
			title="Join Awesome Space on Colibri"
			onGenerate={onGenerate}
			class="pb-safe-offset-4"
		/>
	);
};

const MobileDrawer = (props: { fail?: boolean }) => (
	<Drawer>
		<DrawerTrigger as={Button} variant="secondary">
			Invite people
		</DrawerTrigger>
		<DrawerContent title="Invite people to Awesome Space">
			<InviteHarness platform="mobile" fail={props.fail} />
		</DrawerContent>
	</Drawer>
);

const openDrawer = async (canvasElement: HTMLElement) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Invite people" }),
	);
	const dialog = await screen.findByRole(
		"dialog",
		{ name: "Invite people to Awesome Space" },
		{ timeout: 3000 },
	);
	const settings = await within(dialog).findByRole("button", {
		name: "Invite settings",
	});
	return { dialog, settings };
};

const linkValue = (root: HTMLElement) =>
	(
		within(root).getByRole("textbox", {
			name: "Invite link",
		}) as HTMLInputElement
	).value;

export const MobileRevealsInDrawer: Story = {
	parameters: iphone,
	args: { url: FIRST, onGenerate: () => {} },
	render: () => <MobileDrawer />,
	play: async ({ canvasElement }) => {
		generated.mockClear();
		const { dialog, settings } = await openDrawer(canvasElement);
		await expect(settings).toHaveAttribute("aria-expanded", "false");
		await expect(
			within(dialog).queryByRole("region", { name: "Invite settings" }),
		).toBeNull();
		const before = dialog.getBoundingClientRect().height;
		await userEvent.click(settings);
		await expect(settings).toHaveAttribute("aria-expanded", "true");
		const region = await within(dialog).findByRole("region", {
			name: "Invite settings",
		});
		await expect(settings).toHaveAttribute(
			"aria-controls",
			region.querySelector("[data-invite-settings]")?.id,
		);
		await waitFor(
			() =>
				expect(dialog.getBoundingClientRect().height).toBeGreaterThan(before),
			{ timeout: 3000 },
		);
		await userEvent.click(
			within(region).getByRole("button", { name: /Expires after/ }),
		);
		const sheet = await screen.findByRole(
			"dialog",
			{ name: /Expires after/ },
			{ timeout: 3000 },
		);
		await userEvent.click(within(sheet).getByRole("radio", { name: "1 day" }));
		await waitFor(
			() =>
				expect(
					within(region).getByRole("button", { name: /Expires after/ }),
				).toHaveTextContent("1 day"),
			{ timeout: 3000 },
		);
		await waitFor(
			() =>
				expect(
					screen.queryByRole("dialog", { name: /Expires after/ }),
				).toBeNull(),
			{ timeout: 3000 },
		);
		const startedAt = Date.now();
		await userEvent.click(
			within(region).getByRole("button", { name: "Create new link" }),
		);
		await waitFor(() => expect(generated).toHaveBeenCalledTimes(1));
		const request = generated.mock.calls[0][0];
		await expect(request.maxUses).toBeUndefined();
		const expiresIn = Date.parse(request.expiresAt as string) - startedAt;
		await expect(Math.abs(expiresIn - 24 * 60 * 60_000)).toBeLessThan(10_000);
		await waitFor(() => expect(linkValue(dialog)).toBe(SECOND), {
			timeout: 3000,
		});
		await expect(settings).toHaveAttribute("aria-expanded", "false");
		await expect(
			within(dialog).getByText("New invite link created"),
		).toBeInTheDocument();
	},
};

export const MobileCreateFails: Story = {
	parameters: iphone,
	args: { url: FIRST, onGenerate: () => {} },
	render: () => <MobileDrawer fail />,
	play: async ({ canvasElement }) => {
		const { dialog, settings } = await openDrawer(canvasElement);
		await userEvent.click(settings);
		const region = await within(dialog).findByRole("region", {
			name: "Invite settings",
		});
		await userEvent.click(
			within(region).getByRole("button", { name: "Create new link" }),
		);
		const alert = await within(region).findByRole(
			"alert",
			{},
			{ timeout: 3000 },
		);
		await expect(alert).toHaveTextContent("couldn't be created");
		await expect(settings).toHaveAttribute("aria-expanded", "true");
		await expect(linkValue(dialog)).toBe(FIRST);
	},
};

export const DesktopModal: Story = {
	args: { url: FIRST, onGenerate: () => {} },
	render: () => (
		<div class="w-[400px]">
			<InviteHarness platform="desktop" />
		</div>
	),
	play: async ({ canvasElement }) => {
		generated.mockClear();
		const canvas = within(canvasElement);
		const settings = canvas.getByRole("button", { name: "Invite settings" });
		await expect(settings).not.toHaveAttribute("aria-expanded");
		await userEvent.click(settings);
		const modal = await screen.findByRole(
			"dialog",
			{ name: "Invite settings" },
			{ timeout: 3000 },
		);
		const selects = within(modal).getAllByRole("button", {
			name: /Expires after|Max uses/,
		});
		const [expiry, uses] = selects.map((element) =>
			element.getBoundingClientRect(),
		);
		await expect(Math.round(expiry.top)).toBe(Math.round(uses.top));
		await userEvent.click(
			within(modal).getByRole("button", { name: /Max uses/ }),
		);
		const listbox = await screen.findByRole("listbox");
		await userEvent.click(
			within(listbox).getByRole("option", { name: "10 uses" }),
		);
		await userEvent.click(
			within(modal).getByRole("button", { name: "Create new link" }),
		);
		await waitFor(() => expect(generated).toHaveBeenCalledTimes(1));
		const request = generated.mock.calls[0][0];
		await expect(request.maxUses).toBe(10);
		await expect(typeof request.expiresAt).toBe("string");
		await waitFor(
			() =>
				expect(
					screen.queryByRole("dialog", { name: "Invite settings" }),
				).toBeNull(),
			{ timeout: 3000 },
		);
		await waitFor(() => expect(linkValue(canvasElement)).toBe(SECOND));
		await waitFor(() => expect(settings).toHaveFocus(), { timeout: 3000 });
	},
};

export const DesktopNeverExpires: Story = {
	args: { url: FIRST, onGenerate: () => {} },
	render: () => (
		<div class="w-[400px]">
			<InviteHarness platform="desktop" />
		</div>
	),
	play: async ({ canvasElement }) => {
		generated.mockClear();
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Invite settings" }),
		);
		const modal = await screen.findByRole(
			"dialog",
			{ name: "Invite settings" },
			{ timeout: 3000 },
		);
		await userEvent.click(
			within(modal).getByRole("button", { name: /Expires after/ }),
		);
		const listbox = await screen.findByRole("listbox");
		await userEvent.click(
			within(listbox).getByRole("option", { name: "Never" }),
		);
		await userEvent.click(
			within(modal).getByRole("button", { name: "Create new link" }),
		);
		await waitFor(() => expect(generated).toHaveBeenCalledTimes(1));
		await expect(generated.mock.calls[0][0]).toEqual({});
	},
};
