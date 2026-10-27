import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import type { ScreenShareSettings } from "../SettingsPages/VoiceVideoSettings";
import { CallControls } from "./CallControls";
import {
	ScreenSharePicker,
	type ScreenSharePickerMode,
	type ScreenShareSource,
	type ScreenShareSurface,
} from "./ScreenSharePicker";
import { VoiceStatusPanel } from "./VoiceStatusPanel";

const meta = {
	title: "Voice/Screen share",
	parameters: {
		layout: "fullscreen",
		viewport: { defaultViewport: "desktop" },
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const spy = {
	share: fn(),
	retry: fn(),
	settings: fn(),
	toggle: fn(),
};

const resetSpies = () => {
	for (const value of Object.values(spy)) value.mockClear();
};

const thumbnail = (hue: number, width: number, height: number) => {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (context) {
		context.fillStyle = `hsl(${hue} 60% 45%)`;
		context.fillRect(0, 0, width, height);
		context.fillStyle = `hsl(${hue} 60% 75%)`;
		context.fillRect(width * 0.1, height * 0.15, width * 0.5, height * 0.1);
	}
	return canvas.toDataURL();
};

const SOURCES: ScreenShareSource[] = [
	{
		id: "app:figma",
		kind: "application",
		name: "Figma",
		thumbnail: thumbnail(280, 320, 200),
		aspectRatio: 1.6,
	},
	{
		id: "app:zed",
		kind: "application",
		name: "Zed",
		thumbnail: thumbnail(200, 320, 200),
		aspectRatio: 1.6,
	},
	{ id: "app:music", kind: "application", name: "Music" },
	{
		id: "window:1",
		kind: "window",
		name: "Design System",
		application: "Figma",
		thumbnail: thumbnail(280, 320, 200),
		aspectRatio: 1.6,
	},
	{
		id: "window:2",
		kind: "window",
		name: "A very long window title that keeps going past the tile edge",
		application: "Zed",
		thumbnail: thumbnail(200, 200, 320),
		aspectRatio: 0.625,
	},
	{
		id: "display:1",
		kind: "display",
		name: "Built-in Retina Display",
		thumbnail: thumbnail(30, 320, 180),
		aspectRatio: 16 / 9,
	},
];

const PickerDemo = (props: {
	mode?: ScreenSharePickerMode;
	sources?: ScreenShareSource[];
	loading?: boolean;
	failed?: boolean;
}) => {
	const [open, setOpen] = createSignal(false);
	const [surface, setSurface] = createSignal<ScreenShareSurface>("screen");
	const [settings, setSettings] = createSignal<ScreenShareSettings>({
		resolution: "1080",
		framerate: 30,
		shareAudio: false,
	});
	return (
		<div class="min-h-dvh bg-background p-4 text-foreground">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Share screen
			</Button>
			<output data-testid="surface">{surface()}</output>
			<ScreenSharePicker
				surface={surface()}
				onSurfaceChange={setSurface}
				open={open()}
				onOpenChange={setOpen}
				mode={props.mode ?? "native"}
				platform="desktop"
				sources={props.sources}
				loading={props.loading}
				failed={props.failed}
				onRetry={spy.retry}
				settings={settings()}
				onSettingsChange={(patch) => {
					spy.settings(patch);
					setSettings({ ...settings(), ...patch });
				}}
				onShare={(source) => {
					spy.share(source?.id);
					setOpen(false);
				}}
			/>
		</div>
	);
};

const openPicker = async (canvasElement: HTMLElement) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Share screen" }),
	);
	const dialog = await screen.findByRole("dialog", {
		name: "Share your screen",
	});
	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 300));
	return dialog;
};

export const Picker: Story = {
	render: () => <PickerDemo sources={SOURCES} />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openPicker(canvasElement);
		await expectNoLayoutIssues(dialog);
		const share = within(dialog).getByRole("button", { name: "Share" });
		await expect(share).toBeDisabled();
		await userEvent.click(within(dialog).getByRole("tab", { name: "Windows" }));
		const tile = dialog.querySelector<HTMLElement>(
			'[data-screen-source="window:2"]',
		);
		await expect(tile).not.toBeNull();
		const tileBox = tile?.getBoundingClientRect();
		const gridBox = tile?.parentElement?.getBoundingClientRect();
		await expect(tileBox && gridBox && tileBox.right <= gridBox.right + 1).toBe(
			true,
		);
		await userEvent.click(tile as HTMLElement);
		await expect(tile).toHaveAttribute("aria-pressed", "true");
		await expect(share).toBeEnabled();
		await userEvent.click(share);
		await expect(spy.share).toHaveBeenCalledWith("window:2");
	},
};

export const PickerQuality: Story = {
	name: "Picker quality",
	render: () => <PickerDemo sources={SOURCES} />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openPicker(canvasElement);
		await userEvent.click(
			within(dialog).getByRole("switch", { name: /Share sound/ }),
		);
		await expect(spy.settings).toHaveBeenCalledWith({ shareAudio: true });
		await userEvent.click(within(dialog).getByRole("tab", { name: "Screens" }));
		const tile = dialog.querySelector<HTMLElement>(
			'[data-screen-source="display:1"]',
		);
		await userEvent.dblClick(tile as HTMLElement);
		await expect(spy.share).toHaveBeenCalledWith("display:1");
	},
};

export const PickerOpensOnFirstFilledTab: Story = {
	name: "Picker opens on the first filled tab",
	render: () => (
		<PickerDemo
			sources={SOURCES.filter((source) => source.kind === "display")}
		/>
	),
	play: async ({ canvasElement }) => {
		const dialog = await openPicker(canvasElement);
		await expect(
			within(dialog).getByRole("tab", { name: "Screens" }),
		).toHaveAttribute("aria-selected", "true");
		await userEvent.click(within(dialog).getByRole("tab", { name: "Apps" }));
		await expect(
			within(dialog).getByText("No apps with open windows."),
		).toBeVisible();
		await expectNoLayoutIssues(dialog);
	},
};

export const PickerLoading: Story = {
	name: "Picker loading",
	render: () => <PickerDemo loading />,
	play: async ({ canvasElement }) => {
		const dialog = await openPicker(canvasElement);
		await expect(
			dialog.querySelector("[data-screen-sources-loading]"),
		).not.toBeNull();
		await expectNoLayoutIssues(dialog);
	},
};

export const PickerFailed: Story = {
	name: "Picker failed",
	render: () => <PickerDemo failed sources={[]} />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openPicker(canvasElement);
		await expectNoLayoutIssues(dialog);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Try again" }),
		);
		await expect(spy.retry).toHaveBeenCalledTimes(1);
	},
};

export const PickerBrowser: Story = {
	name: "Picker in the browser",
	render: () => <PickerDemo mode="browser" />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openPicker(canvasElement);
		await expectNoLayoutIssues(dialog);
		await expect(within(dialog).queryByRole("tab")).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Continue" }),
		);
		await expect(spy.share).toHaveBeenCalledWith(undefined);
	},
};

export const PickerSystem: Story = {
	name: "Picker with the system dialog",
	render: () => <PickerDemo mode="system" />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openPicker(canvasElement);
		await expectNoLayoutIssues(dialog);
		await expect(
			within(dialog).getByRole("radio", { name: /Whole screen/ }),
		).toBeChecked();
		await userEvent.click(within(dialog).getByText("One window"));
		await expect(
			within(dialog).getByRole("radio", { name: /One window/ }),
		).toBeChecked();
		await expect(
			within(canvasElement).getByTestId("surface"),
		).toHaveTextContent("window");
		await expect(
			within(dialog).getByRole("switch", { name: /Share sound/ }),
		).toBeVisible();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Continue" }),
		);
		await expect(spy.share).toHaveBeenCalledWith(undefined);
	},
};

const MenuDemo = (props: { sharing?: boolean }) => {
	const [settings, setSettings] = createSignal<ScreenShareSettings>({
		resolution: "1080",
		framerate: 30,
		shareAudio: false,
	});
	const menu = () => ({
		settings: settings(),
		sharing: props.sharing,
		onSettingsChange: (patch: Partial<ScreenShareSettings>) => {
			spy.settings(patch);
			setSettings({ ...settings(), ...patch });
		},
	});
	return (
		<div class="flex min-h-dvh flex-col items-start gap-8 bg-background p-8 text-foreground">
			<div data-testid="panel" class="w-72 rounded-control-lg bg-card">
				<VoiceStatusPanel
					state="connected"
					quality="good"
					channelName="Hangout"
					spaceName="Colibri"
					screenSharing={props.sharing}
					onDisconnect={() => {}}
					onToggleMute={() => {}}
					onToggleDeafen={() => {}}
					onToggleCamera={() => {}}
					onToggleScreenShare={spy.toggle}
					screenShareMenu={menu()}
				/>
			</div>
			<div data-testid="controls">
				<CallControls
					screenSharing={props.sharing}
					onToggleMute={() => {}}
					onToggleDeafen={() => {}}
					onToggleCamera={() => {}}
					onToggleScreenShare={spy.toggle}
					screenShareMenu={menu()}
					onLeave={() => {}}
				/>
			</div>
		</div>
	);
};

export const QualityMenu: Story = {
	name: "Quality menu",
	render: () => <MenuDemo />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const canvas = within(canvasElement);
		const panel = canvas.getByTestId("panel");
		await expectNoLayoutIssues(panel);
		const control = panel.querySelector<HTMLElement>(
			"[data-screen-share-control]",
		);
		const trigger = panel.querySelector<HTMLElement>(
			"[data-screen-share-menu]",
		);
		const share = within(panel).getByRole("button", { name: "Share screen" });
		const shareBox = share.getBoundingClientRect();
		const controlBox = control?.getBoundingClientRect();
		await expect(controlBox?.width).toBeCloseTo(shareBox.width, 0);
		await userEvent.click(share);
		await expect(spy.toggle).toHaveBeenCalledTimes(1);
		await userEvent.click(trigger as HTMLElement);
		const menu = await screen.findByRole("menu", {
			name: "Screen share settings",
		});
		await expectNoLayoutIssues(menu);
		await userEvent.click(
			within(menu).getByRole("menuitemradio", { name: "60 per second" }),
		);
		await expect(spy.settings).toHaveBeenCalledWith({ framerate: 60 });
		await expect(spy.toggle).toHaveBeenCalledTimes(1);
	},
};

export const QualityMenuWhileSharing: Story = {
	name: "Quality menu while sharing",
	render: () => <MenuDemo sharing />,
	play: async ({ canvasElement }) => {
		const controls = within(canvasElement).getByTestId("controls");
		await expectNoLayoutIssues(controls);
		await userEvent.click(
			controls.querySelector("[data-screen-share-menu]") as HTMLElement,
		);
		const menu = await screen.findByRole("menu", {
			name: "Screen share settings",
		});
		await expect(
			within(menu).getByRole("menuitemcheckbox", {
				name: "Sound (restart to change)",
			}),
		).toHaveAttribute("aria-disabled", "true");
	},
};
