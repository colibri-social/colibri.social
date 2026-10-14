import { createSignal, For } from "solid-js";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { MessageRow } from "../Message/MessageRow";
import {
	MessageSelectFrame,
	MessageSelectionBar,
	MovedFromLine,
} from "./MessageSelection";

const meta = {
	title: "Messaging/Message selection",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const NOW = new Date("2026-10-11T12:00:00Z");

const MESSAGES = [
	{ id: "a", name: "Mira Okafor", text: "Has anyone tried the new trail map?" },
	{
		id: "b",
		name: "Mira Okafor",
		text: "It has the elevation profile now, which is great for planning longer loops through the valley.",
		continuation: true,
	},
	{ id: "c", name: "Priya Raman", text: "Yes! The offline mode works too." },
	{
		id: "d",
		name: "A display name that goes on for quite a while to test truncation",
		text: "Short one.",
	},
];

const onMove = fn();
const onCancel = fn();
const onOpenSource = fn();

const SelectionDemo = () => {
	const [selected, setSelected] = createSignal<ReadonlySet<string>>(
		new Set(["a"]),
	);
	const [selecting, setSelecting] = createSignal(true);
	const toggle = (id: string) =>
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	return (
		<div class="flex h-dvh flex-col bg-background">
			<div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
				<For each={MESSAGES}>
					{(message) => (
						<MessageSelectFrame
							selecting={selecting()}
							selected={selected().has(message.id)}
							onToggle={() => toggle(message.id)}
						>
							<MessageRow
								author={{ name: message.name }}
								timestamp={NOW}
								now={NOW}
								locale="en-GB"
								continuation={message.continuation}
							>
								{message.text}
								{message.id === "c" ? (
									<MovedFromLine name="general" onOpen={onOpenSource} />
								) : null}
							</MessageRow>
						</MessageSelectFrame>
					)}
				</For>
			</div>
			{selecting() ? (
				<MessageSelectionBar
					count={selected().size}
					safeBottom
					onMove={onMove}
					onCancel={() => {
						onCancel();
						setSelecting(false);
						setSelected(new Set<string>());
					}}
				/>
			) : null}
		</div>
	);
};

export const SelectMessages: Story = {
	render: () => <SelectionDemo />,
	play: async ({ canvasElement }) => {
		onMove.mockClear();
		onCancel.mockClear();
		onOpenSource.mockClear();
		const canvas = within(canvasElement);
		const toggles = canvas.getAllByRole("button", { name: "Select message" });
		await expect(toggles).toHaveLength(4);
		await expect(toggles[0]).toHaveAttribute("aria-pressed", "true");
		await expect(canvas.getByText("1 message selected")).toBeVisible();
		await userEvent.click(toggles[1] as HTMLElement);
		await userEvent.click(toggles[3] as HTMLElement);
		await expect(canvas.getByText("3 messages selected")).toBeVisible();
		await userEvent.click(toggles[3] as HTMLElement);
		await expect(canvas.getByText("2 messages selected")).toBeVisible();
		await expect(onOpenSource).not.toHaveBeenCalled();
		const frames = canvasElement.querySelectorAll("[data-message-select]");
		for (const frame of frames) {
			await expect(getComputedStyle(frame).paddingLeft).toBe("40px");
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
		await expectNoLayoutIssues(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Move to" }));
		await expect(onMove).toHaveBeenCalledOnce();
		await userEvent.click(
			canvas.getByRole("button", { name: "Cancel selection" }),
		);
		await expect(onCancel).toHaveBeenCalledOnce();
		await expect(
			canvas.queryByRole("button", { name: "Select message" }),
		).toBeNull();
		await userEvent.click(
			canvas.getByRole("button", { name: "Moved from general" }),
		);
		await expect(onOpenSource).toHaveBeenCalledOnce();
	},
};

export const BarWithNothingSelected: Story = {
	render: () => (
		<div class="flex h-dvh flex-col justify-end bg-background">
			<MessageSelectionBar count={0} onMove={onMove} onCancel={onCancel} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("0 messages selected")).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Move to" }),
		).toBeDisabled();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const LongMovedFromName: Story = {
	render: () => (
		<div class="w-80 bg-background p-4">
			<MovedFromLine name="a-channel-name-that-keeps-going-and-going-past-the-edge" />
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(/^Moved from a-channel/),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};
