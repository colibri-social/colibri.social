import { createSignal, onCleanup } from "solid-js";
import {
	expect,
	fn,
	screen,
	spyOn,
	userEvent,
	waitFor,
	within,
} from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import type { DiagnosticsSection } from "../SettingsPages/DebugInformation";
import { Toaster } from "../Toast/Toaster";
import { clearToasts, toast } from "../Toast/toast-store";
import { CALL_DEBUG_COPY, CallDebugDialog } from "./CallDebugDialog";

const meta = {
	title: "Voice/Call details",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_SECTIONS: DiagnosticsSection[] = [
	{
		title: "Node",
		fields: [
			{
				kind: "value",
				label: "Host",
				value: "https://fsn-1.nodes.colibri.social",
			},
			{ kind: "value", label: "Node", value: "fsn-1" },
			{ kind: "value", label: "Region", value: "eu-central" },
			{ kind: "value", label: "Relay only", value: "no" },
			{ kind: "value", label: "Redirects", value: "1" },
			{
				kind: "list",
				label: "Skipped nodes",
				items: ["https://hel-1.nodes.colibri.social"],
			},
		],
	},
	{
		title: "Connection",
		fields: [
			{
				kind: "value",
				label: "Sending",
				value:
					"connected | rtt 24 ms | local srflx udp | remote host udp | available 2480 kbps",
			},
			{
				kind: "value",
				label: "Receiving",
				value:
					"connected | rtt 26 ms | local srflx udp | remote host udp | available 3120 kbps",
			},
		],
	},
	{
		title: "Audio",
		fields: [
			{
				kind: "value",
				label: "You, microphone",
				value:
					"sending | live | opus | 34 kbps | lost 0 | jitter 2 ms | level 0.18",
			},
			{
				kind: "value",
				label: "did:plc:wren4kq7m2x3v5n6b8c9d0f1, microphone",
				value:
					"receiving | live | opus | 31 kbps | lost 4 | jitter 7 ms | level 0.06",
			},
			{
				kind: "value",
				label: "did:plc:finch2h3j4k5l6m7n8p9q0r1s, screen sound",
				value:
					"receiving | live | opus | 96 kbps | lost 0 | jitter 3 ms | level 0.32",
			},
		],
	},
	{
		title: "Video",
		fields: [
			{
				kind: "list",
				label: "Streams",
				items: [
					"screen recv | AV1 | 1920x1080 | 30 fps | 2.84 Mbps | decoder libdav1d hw no | nack 2 pli 0 lost 0 | dropped 0 freezes 0 keyframes 3",
				],
			},
		],
	},
];

const sampleText = SAMPLE_SECTIONS.map(
	(section) =>
		`## ${section.title}\n${section.fields
			.map((field) =>
				field.kind === "value"
					? `${field.label}: ${field.value}`
					: `${field.label}: ${field.items.join(", ")}`,
			)
			.join("\n")}`,
).join("\n\n");

const copied = fn();

const DialogDemo = (props: { loading?: boolean }) => {
	const [open, setOpen] = createSignal(false);

	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Show call details
			</Button>
			<CallDebugDialog
				open={open()}
				onOpenChange={setOpen}
				sections={props.loading ? undefined : SAMPLE_SECTIONS}
				copyValue={props.loading ? undefined : sampleText}
				onCopy={copied}
			/>
		</div>
	);
};

const openDialog = async (canvasElement: HTMLElement) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Show call details" }),
	);

	const dialog = await screen.findByRole("dialog", {
		name: CALL_DEBUG_COPY.title,
	});

	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 300));

	return dialog;
};

export const Dialog: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <DialogDemo />,
	play: async ({ canvasElement }) => {
		copied.mockClear();

		const write = spyOn(navigator.clipboard, "writeText").mockResolvedValue();

		const dialog = await openDialog(canvasElement);

		await expectNoLayoutIssues(dialog);
		await expect(within(dialog).getByText("fsn-1")).toBeVisible();
		await userEvent.click(
			within(dialog).getByRole("button", { name: CALL_DEBUG_COPY.copy }),
		);
		await waitFor(() => expect(copied).toHaveBeenCalledOnce());
		await expect(write).toHaveBeenCalledWith(sampleText);
		write.mockRestore();
		await expect(
			within(dialog).getByRole("button", { name: CALL_DEBUG_COPY.copied }),
		).toBeVisible();
	},
};

export const DialogDesktop: Story = {
	name: "Dialog desktop",
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => <DialogDemo />,
	play: async ({ canvasElement }) => {
		const dialog = await openDialog(canvasElement);

		await expectNoLayoutIssues(dialog);
	},
};

export const Loading: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <DialogDemo loading />,
	play: async ({ canvasElement }) => {
		const dialog = await openDialog(canvasElement);

		await expect(
			within(dialog).getByText(CALL_DEBUG_COPY.loading),
		).toBeVisible();
		await expect(
			within(dialog).getByRole("button", { name: CALL_DEBUG_COPY.copy }),
		).toBeDisabled();
		await expectNoLayoutIssues(dialog);
	},
};

const retry = fn();

const NodesDownDemo = () => {
	clearToasts();
	onCleanup(clearToasts);

	const show = () => {
		toast("Calls are having trouble right now", {
			description: "Try again in a minute.",
			action: { label: "Try again", onClick: retry },
		});
	};

	return (
		<div class="min-h-[480px] bg-background p-4">
			<Toaster platform="desktop" />
			<Button variant="secondary" onClick={show}>
				Show notice
			</Button>
		</div>
	);
};

export const NodesDownToast: Story = {
	name: "Nodes down toast",
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => <NodesDownDemo />,
	play: async ({ canvasElement }) => {
		retry.mockClear();
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Show notice" }),
		);

		const item = await waitFor(() => {
			const found = document.querySelector<HTMLElement>(
				"li[data-toast]:not([data-dismissed])",
			);

			if (!found) throw new Error("no toast yet");

			return found;
		});

		await expect(item).toHaveTextContent("Calls are having trouble right now");
		await expect(item).toHaveTextContent("Try again in a minute.");

		const action = item.querySelector(
			"[data-toast-action]",
		) as HTMLButtonElement;

		await expect(action).toHaveTextContent("Try again");
		await userEvent.click(action);
		await expect(retry).toHaveBeenCalledOnce();
	},
};
