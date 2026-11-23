import { createSignal } from "solid-js";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import type { SelectPlatform } from "../Select/Select";
import { BridgeLinkStep } from "./BridgeLinkStep";
import {
	BRIDGE_UNLINKED,
	type BridgeLinkChannel,
	type BridgeRoom,
} from "./BridgeLinks";

const meta = {
	title: "Settings/Bridge link step",
	component: BridgeLinkStep,
	parameters: { viewport: { defaultViewport: "iphone" } },
	decorators: [
		(Story) => (
			<div class="min-h-dvh bg-popover p-4 text-foreground">
				<div class="mx-auto w-full max-w-[640px]">
					<Story />
				</div>
			</div>
		),
	],
} satisfies Meta<typeof BridgeLinkStep>;

export default meta;
type Story = StoryObj<typeof meta>;

const desktop = { viewport: { defaultViewport: "desktop" } };

const rooms: BridgeRoom[] = [
	{ id: "r1", name: "general", parent: "Text Channels" },
	{ id: "r2", name: "development", parent: "Text Channels" },
	{ id: "r3", name: "news", parent: "Info" },
];

const channels: BridgeLinkChannel[] = [
	{ id: "general", name: "general", room: BRIDGE_UNLINKED },
	{ id: "dev", name: "dev", room: BRIDGE_UNLINKED },
	{ id: "announcements", name: "announcements", room: BRIDGE_UNLINKED },
	{ id: "off-topic", name: "off-topic", room: BRIDGE_UNLINKED },
];

const onSave = fn();
const onSkip = fn();

const Stateful = (props: { platform: SelectPlatform; rooms: BridgeRoom[] }) => {
	const [current, setCurrent] = createSignal(channels);

	return (
		<BridgeLinkStep
			platform={props.platform}
			channels={current()}
			rooms={props.rooms}
			onRoomChange={(id, room) =>
				setCurrent((list) =>
					list.map((channel) =>
						channel.id === id ? { ...channel, room } : channel,
					),
				)
			}
			onSave={onSave}
			onSkip={onSkip}
		/>
	);
};

const checkActions = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);

	onSave.mockClear();
	onSkip.mockClear();
	await expect(
		canvas.getByRole("heading", { name: "Choose channels to link" }),
	).toBeVisible();
	await userEvent.click(canvas.getByRole("button", { name: "Save" }));
	await userEvent.click(canvas.getByRole("button", { name: "Skip" }));
	await expect(onSave).toHaveBeenCalledTimes(1);
	await expect(onSkip).toHaveBeenCalledTimes(1);
};

export const Desktop: Story = {
	parameters: desktop,
	args: { channels, rooms },
	render: () => <Stateful platform="desktop" rooms={rooms} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const save = canvas.getByRole("button", { name: "Save" });
		const skip = canvas.getByRole("button", { name: "Skip" });

		await checkActions(canvasElement);
		await expect(save.getBoundingClientRect().left).toBeGreaterThan(
			skip.getBoundingClientRect().right,
		);
		await expect(save.getBoundingClientRect().top).toBeCloseTo(
			skip.getBoundingClientRect().top,
			0,
		);
		await expectNoLayoutIssues(canvasElement);
	},
};

export const Mobile: Story = {
	args: { channels, rooms },
	render: () => <Stateful platform="mobile" rooms={rooms} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const save = canvas.getByRole("button", { name: "Save" });
		const skip = canvas.getByRole("button", { name: "Skip" });

		await checkActions(canvasElement);
		await expect(save.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			skip.getBoundingClientRect().top,
		);
		await expect(save.getBoundingClientRect().width).toBe(
			skip.getBoundingClientRect().width,
		);
		await expectNoLayoutIssues(canvasElement);
	},
};

export const NoRoomsYet: Story = {
	name: "No rooms yet",
	args: { channels, rooms: [] },
	render: () => <Stateful platform="mobile" rooms={[]} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByRole("status", {
				name: "Waiting for the bridge to report its channels",
			}),
		).toBeVisible();
		await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const NoRoomsYetDesktop: Story = {
	name: "No rooms yet, desktop",
	parameters: desktop,
	args: { channels, rooms: [] },
	render: () => <Stateful platform="desktop" rooms={[]} />,
	play: async ({ canvasElement }) => {
		await expectNoLayoutIssues(canvasElement);
	},
};
