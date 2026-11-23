import { BugIcon } from "@solar-icons/solid/bold/bug";
import { LockKeyholeIcon } from "@solar-icons/solid/bold/lock-keyhole";
import { PaletteIcon } from "@solar-icons/solid/bold/palette";
import { RefreshCircleIcon } from "@solar-icons/solid/bold/refresh-circle";
import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	EMULATED_WINDOW_CHROME,
	emulateWindowChrome,
	expectClearOfWindowChrome,
	expectNoLayoutIssues,
} from "../../foundations/layout-test";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import type { ReleaseNoteView } from "../SettingsPages/WhatsNewSettings";
import { WhatsNewDialog, type WhatsNewDialogPlatform } from "./WhatsNewDialog";

type Args = { onOpenAll: () => void };

const meta: Meta<Args> = {
	title: "Surfaces/What's new popup",
	args: { onOpenAll: fn() },
};

export default meta;
type Story = StoryObj<Args>;

const desktop = {
	viewport: {
		defaultViewport: "desktop",
		options: {
			desktop: {
				name: "Desktop",
				styles: { width: "1200px", height: "900px" },
				type: "desktop",
			},
		},
	},
};

const NOTE: ReleaseNoteView = {
	version: "0.8.0",
	date: "November 23, 2026",
	title: "Colibri Spaces",
	heroImage: storyImages.sunsetBanner(),
	items: [
		{
			kind: "feature",
			icon: <PaletteIcon />,
			title: "A new look",
			body: "The whole app has a fresh design that feels smoother to use.",
		},
		{
			kind: "feature",
			icon: <LockKeyholeIcon />,
			title: "Private channels",
			body: "A channel can limit who reads it and, separately, who posts in it.",
		},
		{
			kind: "feature",
			icon: <RefreshCircleIcon />,
			title: "Settings everywhere",
			body: "Read positions, mutes and your Space order stay in sync on all your devices.",
		},
		{
			kind: "fix",
			icon: <BugIcon />,
			title: "Threads open where you left them",
			body: "Going back from a thread no longer leaves it open on the side.",
		},
	],
};

const Demo = (props: {
	platform: WhatsNewDialogPlatform;
	onOpenAll?: () => void;
}) => {
	const [open, setOpen] = createSignal(false);
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Show updates
			</Button>
			<WhatsNewDialog
				open={open()}
				onOpenChange={setOpen}
				note={NOTE}
				platform={props.platform}
				onOpenAll={
					props.onOpenAll
						? () => {
								props.onOpenAll?.();
								setOpen(false);
							}
						: undefined
				}
			/>
		</div>
	);
};

const openPopup = async (canvasElement: HTMLElement) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Show updates" }),
	);
	const dialog = await screen.findByRole("dialog", { name: "Colibri Spaces" });
	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 400));
	await expect(
		within(dialog).getByText("Version 0.8.0, November 23, 2026"),
	).toBeVisible();
	await expect(
		dialog.querySelectorAll("[data-release-note-item]"),
	).toHaveLength(4);
	await expect(dialog.querySelector(".solar-palette-bold")).not.toBeNull();
	await expect(
		within(dialog).getByRole("heading", { name: "Fixed" }),
	).toBeTruthy();
	await expectNoLayoutIssues(dialog);
	return dialog;
};

const closed = () =>
	waitFor(() =>
		expect(screen.queryByRole("dialog", { name: "Colibri Spaces" })).toBeNull(),
	);

export const Desktop: Story = {
	parameters: desktop,
	render: (args) => <Demo platform="desktop" onOpenAll={args.onOpenAll} />,
	play: async ({ canvasElement, args }) => {
		const dialog = await openPopup(canvasElement);
		const box = dialog.getBoundingClientRect();
		await expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Got it" }),
		);
		await closed();
		await expect(args.onOpenAll).not.toHaveBeenCalled();
	},
};

export const DesktopShortWindow: Story = {
	parameters: {
		viewport: {
			defaultViewport: "short",
			options: {
				short: {
					name: "Short",
					styles: { width: "1000px", height: "520px" },
					type: "desktop",
				},
			},
		},
	},
	render: (args) => <Demo platform="desktop" onOpenAll={args.onOpenAll} />,
	play: async ({ canvasElement }) => {
		const restore = emulateWindowChrome();
		try {
			const dialog = await openPopup(canvasElement);
			const box = dialog.getBoundingClientRect();
			await expect(box.top).toBeGreaterThanOrEqual(EMULATED_WINDOW_CHROME);
			await expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
			const scroller = dialog.querySelector<HTMLElement>(
				"[data-whats-new-scroll]",
			);
			await expect(scroller?.scrollHeight).toBeGreaterThan(
				scroller?.clientHeight ?? 0,
			);
			await expect(
				within(dialog).getByRole("button", { name: "Got it" }),
			).toBeVisible();
			await expectClearOfWindowChrome(document.body);
		} finally {
			restore();
		}
	},
};

export const Mobile: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: (args) => <Demo platform="mobile" onOpenAll={args.onOpenAll} />,
	play: async ({ canvasElement, args }) => {
		const dialog = await openPopup(canvasElement);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "See all updates" }),
		);
		await expect(args.onOpenAll).toHaveBeenCalledOnce();
		await closed();
	},
};

export const MobileWithoutLink: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <Demo platform="mobile" />,
	play: async ({ canvasElement }) => {
		const dialog = await openPopup(canvasElement);
		await expect(
			within(dialog).queryByRole("button", { name: "See all updates" }),
		).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Got it" }),
		);
		await closed();
	},
};
