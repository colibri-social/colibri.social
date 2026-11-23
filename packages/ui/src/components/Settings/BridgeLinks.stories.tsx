import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { findSettledDrawer } from "../../foundations/drawer-test";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import type { SelectPlatform } from "../Select/Select";
import {
	BRIDGE_OPEN,
	BRIDGE_UNLINKED,
	type BridgeHistoryDepth,
	type BridgeLinkChannel,
	BridgeLinks,
	type BridgeRoom,
} from "./BridgeLinks";

const meta = {
	title: "Settings/Bridge links",
	component: BridgeLinks,
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
} satisfies Meta<typeof BridgeLinks>;

export default meta;
type Story = StoryObj<typeof meta>;

const desktop = { viewport: { defaultViewport: "desktop" } };

const rooms: BridgeRoom[] = [
	{ id: "r1", name: "general", parent: "Text Channels" },
	{ id: "r2", name: "development", parent: "Text Channels" },
	{ id: "r3", name: "news", parent: "Info" },
];

const freshChannels: BridgeLinkChannel[] = [
	{ id: "general", name: "general", room: BRIDGE_UNLINKED },
	{ id: "dev", name: "dev", room: BRIDGE_UNLINKED },
	{ id: "announcements", name: "announcements", room: BRIDGE_UNLINKED },
];

const savedChannels: BridgeLinkChannel[] = [
	{
		id: "general",
		name: "general",
		room: "r1",
		saved: {
			depth: "week",
			requestedAt: "2026-11-12T09:30:00.000Z",
			state: "done",
			imported: 1284,
		},
	},
	{ id: "dev", name: "dev", room: BRIDGE_OPEN },
	{ id: "announcements", name: "announcements", room: BRIDGE_UNLINKED },
];

const runningChannels: BridgeLinkChannel[] = [
	{
		id: "general",
		name: "general",
		room: "r1",
		saved: {
			depth: "month",
			requestedAt: "2026-11-22T18:00:00.000Z",
			state: "running",
			imported: 312,
			progress: 40,
			reached: "2026-11-04T00:00:00.000Z",
		},
	},
	{ id: "dev", name: "dev", room: "r2" },
];

const failedChannels: BridgeLinkChannel[] = [
	{
		id: "general",
		name: "general",
		room: "r1",
		saved: {
			depth: "all",
			requestedAt: "2026-11-20T08:15:00.000Z",
			state: "failed",
			imported: 57,
		},
	},
];

const onHistoryChange = fn();
const onRoomChange = fn();

const Stateful = (props: {
	platform: SelectPlatform;
	channels: BridgeLinkChannel[];
	rooms: BridgeRoom[];
}) => {
	const [channels, setChannels] = createSignal(props.channels);
	const patch = (id: string, change: Partial<BridgeLinkChannel>) => {
		setChannels((current) =>
			current.map((channel) =>
				channel.id === id ? { ...channel, ...change } : channel,
			),
		);
	};

	return (
		<BridgeLinks
			platform={props.platform}
			channels={channels()}
			rooms={props.rooms}
			onRoomChange={(id, room) => {
				onRoomChange(id, room);
				patch(id, { room, history: undefined });
			}}
			onHistoryChange={(id, depth: BridgeHistoryDepth) => {
				onHistoryChange(id, depth);
				patch(id, { history: depth });
			}}
		/>
	);
};

export const Fresh: Story = {
	parameters: desktop,
	args: { channels: freshChannels, rooms },
	render: () => (
		<Stateful platform="desktop" channels={freshChannels} rooms={rooms} />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		onRoomChange.mockClear();
		await expect(
			canvas.queryByRole("button", { name: /Import earlier messages/ }),
		).not.toBeInTheDocument();
		await userEvent.click(
			canvas.getByRole("button", { name: /Room linked to general/ }),
		);

		const listbox = await screen.findByRole("listbox");

		await expect(
			within(listbox)
				.getAllByRole("option")
				.map((option) => option.textContent?.trim()),
		).toEqual([
			"Not linked",
			"Let the bridge read and reply",
			"general (Text Channels)",
			"development (Text Channels)",
			"news (Info)",
		]);
		await expectNoLayoutIssues(listbox);
		await userEvent.click(
			within(listbox).getByRole("option", { name: "news (Info)" }),
		);
		await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
		await expect(onRoomChange).toHaveBeenCalledWith("general", "r3");
		await expect(
			canvas.getByRole("button", {
				name: /Import earlier messages into general/,
			}),
		).toHaveTextContent("Don't import");
		await expectNoLayoutIssues(canvasElement);
	},
};

export const SavedImports: Story = {
	name: "Saved imports",
	parameters: desktop,
	args: { channels: savedChannels, rooms },
	render: () => (
		<Stateful platform="desktop" channels={savedChannels} rooms={rooms} />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const history = canvas.getByRole("button", {
			name: /Import earlier messages into general/,
		});

		onHistoryChange.mockClear();
		await expect(history).toHaveTextContent("Last 7 days");
		await expect(
			canvas.getByText("Imported 12 Nov 2026, 1,284 messages."),
		).toBeVisible();
		await userEvent.click(history);

		const listbox = await screen.findByRole("listbox");

		await expectNoLayoutIssues(listbox);
		await userEvent.click(
			within(listbox).getByRole("option", { name: "Last 7 days" }),
		);
		await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
		await expect(onHistoryChange).toHaveBeenCalledWith("general", "week");
		await expect(
			canvas.getByText("A new import starts when you save."),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const SavedImportsMobile: Story = {
	name: "Saved imports, mobile",
	args: { channels: savedChannels, rooms },
	render: () => (
		<Stateful platform="mobile" channels={savedChannels} rooms={rooms} />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		onHistoryChange.mockClear();
		await userEvent.click(
			canvas.getByRole("button", {
				name: /Import earlier messages into general/,
			}),
		);

		const drawer = await findSettledDrawer(
			/Import earlier messages into general/,
		);

		await expectNoLayoutIssues(drawer);
		await userEvent.click(
			within(drawer).getByRole("radio", { name: /Last 7 days/ }),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await expect(onHistoryChange).toHaveBeenCalledWith("general", "week");
		await expectNoLayoutIssues(canvasElement);
	},
};

export const RunningImport: Story = {
	name: "Running import",
	parameters: desktop,
	args: { channels: runningChannels, rooms },
	render: () => (
		<Stateful platform="desktop" channels={runningChannels} rooms={rooms} />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const progress = canvas.getByRole("progressbar", {
			name: "History import",
		});

		await expect(progress).toHaveAttribute("aria-valuenow", "40");
		await expect(
			canvas.getByText(
				"Importing since 22 Nov 2026: 40%, 312 messages, up to 4 Nov 2026.",
			),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", {
				name: /Import earlier messages into general/,
			}),
		).toHaveTextContent("Last 30 days");
		await expectNoLayoutIssues(canvasElement);
	},
};

export const FailedImport: Story = {
	name: "Failed import",
	parameters: desktop,
	args: { channels: failedChannels, rooms },
	render: () => (
		<Stateful platform="desktop" channels={failedChannels} rooms={rooms} />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const status = canvas.getByText(
			"The import from 20 Nov 2026 stopped after 57 messages. Choose a range again to retry.",
		);

		await expect(status).toHaveClass("text-destructive");
		await expect(
			canvas.getByRole("button", {
				name: /Import earlier messages into general/,
			}),
		).toHaveTextContent("All history");
		await expectNoLayoutIssues(canvasElement);
	},
};

export const NoRoomsYet: Story = {
	name: "No rooms yet",
	args: { channels: freshChannels, rooms: [] },
	render: () => (
		<Stateful platform="mobile" channels={freshChannels} rooms={[]} />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByRole("status", {
				name: "Waiting for the bridge to report its channels",
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: /#general/ }),
		).toHaveTextContent("Not linked");
		await expectNoLayoutIssues(canvasElement);
	},
};

export const Loading: Story = {
	args: { channels: [], rooms: [], loading: true },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByRole("status", { name: "" }),
		).toHaveTextContent("Loading channels");
		await expectNoLayoutIssues(canvasElement);
	},
};
