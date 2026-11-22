import { createSignal, type JSX } from "solid-js";
import { expect, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { storyImages } from "../components/Banner/story-images";
import { Button } from "../components/Button/Button";
import { Drawer, DrawerContent } from "../components/Drawer/Drawer";
import { DropdownMenu } from "../components/DropdownMenu/DropdownMenu";
import { FullScreenSheet } from "../components/FullScreenSheet/FullScreenSheet";
import { Lightbox } from "../components/Lightbox/Lightbox";
import { Modal, ModalContent } from "../components/Modal/Modal";
import { OnboardingFlow } from "../components/Onboarding/OnboardingFlow";
import { WindowBar } from "../components/Shell/WindowBar";
import {
	EMULATED_WINDOW_CHROME,
	expectClearOfWindowChrome,
} from "./layout-test";

const meta: Meta = {
	title: "Foundations/Window chrome",
	parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

const Chrome = (props: { children: JSX.Element }) => (
	<div class="flex h-dvh flex-col bg-background text-foreground">
		<WindowBar
			macInset
			roundedCorners
			title="Colibri"
			class="[--titlebar-height:36px]"
		/>
		<div class="min-h-0 flex-1 p-4">{props.children}</div>
	</div>
);

const opened = () => {
	const [open, setOpen] = createSignal(true);
	return { open, setOpen };
};

const chromePlay = (selector: string) => async () => {
	await waitFor(() =>
		expect(
			Number.parseFloat(
				getComputedStyle(document.documentElement).getPropertyValue(
					"--window-chrome-top",
				),
			),
		).toBe(EMULATED_WINDOW_CHROME),
	);
	await waitFor(() => expect(document.querySelector(selector)).not.toBeNull());
	await new Promise((resolve) => setTimeout(resolve, 450));
	const surface = document.querySelector(selector) as HTMLElement;
	await expectClearOfWindowChrome(surface);
};

export const LightboxBelowChrome: Story = {
	name: "Lightbox",
	render: () => {
		const state = opened();
		return (
			<Chrome>
				<Lightbox
					items={[
						{ src: storyImages.sunsetBanner(), width: 1600, height: 1600 },
					]}
					open={state.open()}
					onOpenChange={state.setOpen}
				/>
			</Chrome>
		);
	},
	play: chromePlay('[role="dialog"]'),
};

export const FullScreenSheetBelowChrome: Story = {
	name: "Full screen sheet",
	render: () => {
		const state = opened();
		return (
			<Chrome>
				<FullScreenSheet
					open={state.open()}
					onOpenChange={state.setOpen}
					title="Space settings"
					closeLabel="Close"
				>
					<Button>Save</Button>
				</FullScreenSheet>
			</Chrome>
		);
	},
	play: chromePlay('[role="dialog"]'),
};

export const ModalBelowChrome: Story = {
	name: "Modal",
	render: () => {
		const state = opened();
		return (
			<Chrome>
				<Modal open={state.open()} onOpenChange={state.setOpen}>
					<ModalContent
						title="Invite people"
						closeLabel="Close"
						footer={<Button>Done</Button>}
					>
						<div class="h-[1400px]" />
					</ModalContent>
				</Modal>
			</Chrome>
		);
	},
	play: chromePlay('[role="dialog"]'),
};

export const DrawerBelowChrome: Story = {
	name: "Full-height drawer",
	render: () => {
		const state = opened();
		return (
			<Chrome>
				<Drawer open={state.open()} onOpenChange={state.setOpen}>
					<DrawerContent title="Members" fill>
						<Button>Invite</Button>
					</DrawerContent>
				</Drawer>
			</Chrome>
		);
	},
	play: chromePlay('[role="dialog"]'),
};

export const MenuNearTopEdge: Story = {
	name: "Menu near the top edge",
	render: () => (
		<Chrome>
			<DropdownMenu
				label="Space options"
				defaultOpen
				placement="top-start"
				trigger={<span>Options</span>}
				items={[
					{ label: "Mark as read", onSelect: () => {} },
					{ label: "Invite people", onSelect: () => {} },
					{ label: "Notification settings", onSelect: () => {} },
					{ label: "Leave Space", onSelect: () => {} },
				]}
			/>
		</Chrome>
	),
	play: chromePlay('[role="menu"]'),
};

export const OnboardingBelowChrome: Story = {
	name: "Onboarding flow",
	render: () => (
		<Chrome>
			<OnboardingFlow platform="mobile" title="Welcome">
				<Button>Get started</Button>
			</OnboardingFlow>
		</Chrome>
	),
	play: chromePlay("[data-onboarding]"),
};

export const OnboardingDialogBelowChrome: Story = {
	name: "Onboarding dialog",
	render: () => (
		<Chrome>
			<OnboardingFlow platform="desktop" title="Welcome" open>
				<Button>Get started</Button>
			</OnboardingFlow>
		</Chrome>
	),
	play: chromePlay('[role="dialog"]'),
};
