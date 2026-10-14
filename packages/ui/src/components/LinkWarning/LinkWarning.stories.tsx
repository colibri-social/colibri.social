import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { LinkWarning, type LinkWarningPlatform } from "./LinkWarning";

type Args = { onConfirm: (options: { trustHost: boolean }) => void };

const meta: Meta<Args> = {
	title: "Messaging/Link warning",
	args: { onConfirm: fn() },
};

export default meta;
type Story = StoryObj<Args>;

const URL_VALUE =
	"https://trails.example.org/routes/2026/autumn-ridge-loop?ref=colibri&utm_source=chat";

const Demo = (props: {
	platform: LinkWarningPlatform;
	disguised?: boolean;
	onConfirm: Args["onConfirm"];
}) => {
	const [open, setOpen] = createSignal(false);
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Open the link
			</Button>
			<LinkWarning
				open={open()}
				onOpenChange={setOpen}
				url={URL_VALUE}
				disguised={props.disguised}
				platform={props.platform}
				onConfirm={props.onConfirm}
			/>
		</div>
	);
};

const openWarning = async (canvasElement: HTMLElement) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Open the link" }),
	);
	const dialog = await screen.findByRole("dialog", {
		name: "Open external link?",
	});
	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 400));
	await expectNoLayoutIssues(dialog);
	return dialog;
};

export const Desktop: Story = {
	render: (args) => <Demo platform="desktop" onConfirm={args.onConfirm} />,
	play: async ({ canvasElement, args }) => {
		const dialog = await openWarning(canvasElement);
		await expect(
			dialog.querySelector("[data-link-warning-host]"),
		).toHaveTextContent("trails.example.org");
		await expect(
			dialog.querySelector("[data-link-warning-url]"),
		).toHaveTextContent(URL_VALUE);
		await userEvent.click(
			within(dialog).getByRole("checkbox", {
				name: "Always trust trails.example.org",
			}),
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Open link" }),
		);
		await expect(args.onConfirm).toHaveBeenCalledWith({ trustHost: true });
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Open external link?" }),
			).toBeNull(),
		);
	},
};

export const Mobile: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: (args) => <Demo platform="mobile" onConfirm={args.onConfirm} />,
	play: async ({ canvasElement, args }) => {
		const dialog = await openWarning(canvasElement);
		const url = dialog.querySelector("[data-link-warning-url]") as HTMLElement;
		await expect(url.scrollWidth).toBeLessThanOrEqual(url.clientWidth + 1);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Cancel" }),
		);
		await expect(args.onConfirm).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Open external link?" }),
			).toBeNull(),
		);
	},
};

export const OpenWithoutTrust: Story = {
	render: (args) => <Demo platform="desktop" onConfirm={args.onConfirm} />,
	play: async ({ canvasElement, args }) => {
		const dialog = await openWarning(canvasElement);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Open link" }),
		);
		await expect(args.onConfirm).toHaveBeenCalledWith({ trustHost: false });
	},
};

export const Disguised: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: (args) => (
		<Demo platform="mobile" disguised onConfirm={args.onConfirm} />
	),
	play: async ({ canvasElement }) => {
		const dialog = await openWarning(canvasElement);
		await expect(dialog).toHaveTextContent("different address");
	},
};
