import { createSignal } from "solid-js";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { TextField } from "../TextField/TextField";
import { FullScreenSheet } from "./FullScreenSheet";

const meta: Meta = {
	title: "Surfaces/Full screen sheet",
	parameters: { viewport: { defaultViewport: "iphone" } },
};

export default meta;
type Story = StoryObj;

const Demo = () => {
	const [open, setOpen] = createSignal(false);
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button onClick={() => setOpen(true)}>Open sheet</Button>
			<output data-testid="state">{open() ? "open" : "closed"}</output>
			<FullScreenSheet
				open={open()}
				onOpenChange={setOpen}
				title="Create your Space"
				description="A Space is where you and other people hang out."
				footer={<Button block>Create Space</Button>}
			>
				<TextField label="Space name" placeholder="My Space" />
			</FullScreenSheet>
		</div>
	);
};

const DirtyDemo = () => {
	const [open, setOpen] = createSignal(false);
	const [name, setName] = createSignal("");
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button onClick={() => setOpen(true)}>Open sheet</Button>
			<output data-testid="state">{open() ? "open" : "closed"}</output>
			<FullScreenSheet
				open={open()}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next) setName("");
				}}
				title="Create your Space"
				dirty={name().length > 0}
				discardDescription="This Space won't be created."
				footer={<Button block>Create Space</Button>}
			>
				<TextField label="Space name" value={name()} onChange={setName} />
			</FullScreenSheet>
		</div>
	);
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const openSheet = async (canvasElement: HTMLElement) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Open sheet" }),
	);
	const dialog = await screen.findByRole("dialog", {
		name: "Create your Space",
	});
	await waitFor(() =>
		expect(Math.round(dialog.getBoundingClientRect().top)).toBe(0),
	);
	return dialog;
};

const grabArea = (dialog: HTMLElement) =>
	dialog.querySelector("[data-full-screen-sheet-grab]") as HTMLElement;

const drag = async (
	target: HTMLElement,
	distance: number,
	steps: number,
	stepMs: number,
	restMs = 0,
) => {
	const box = target.getBoundingClientRect();
	const x = box.left + box.width / 2;
	const y = box.top + box.height - 10;
	const send = (type: string, dy: number) =>
		target.dispatchEvent(
			new PointerEvent(type, {
				pointerId: 9,
				pointerType: "touch",
				isPrimary: true,
				clientX: x,
				clientY: y + dy,
				bubbles: true,
			}),
		);
	send("pointerdown", 0);
	for (let step = 1; step <= steps; step++) {
		send("pointermove", (distance * step) / steps);
		await wait(stepMs);
	}
	if (restMs) await wait(restMs);
	send("pointerup", distance);
};

export const Mobile: Story = {
	render: () => <Demo />,
	play: async ({ canvasElement }) => {
		const dialog = await openSheet(canvasElement);
		await expectNoLayoutIssues(dialog);
		const box = dialog.getBoundingClientRect();
		await expect(Math.round(box.height)).toBe(window.innerHeight);
		await expect(Math.round(box.width)).toBe(
			document.documentElement.clientWidth,
		);
		const footer = dialog.querySelector(
			"[data-full-screen-sheet-footer]",
		) as HTMLElement;
		await expect(
			Math.round(footer.getBoundingClientRect().bottom),
		).toBeLessThanOrEqual(window.innerHeight);
		await expect(document.activeElement).toBe(dialog);
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(within(canvasElement).getByTestId("state")).toHaveTextContent(
				"closed",
			),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await waitFor(
			() => expect(canvasElement.closest("[aria-hidden='true']")).toBeNull(),
			{ timeout: 3000 },
		);
	},
};

export const SwipeDownCloses: Story = {
	render: () => <Demo />,
	play: async ({ canvasElement }) => {
		const dialog = await openSheet(canvasElement);
		await drag(grabArea(dialog), 60, 3, 16, 150);
		await wait(350);
		await expect(within(canvasElement).getByTestId("state")).toHaveTextContent(
			"open",
		);
		await expect(dialog.style.transform).toBe("");
		await drag(grabArea(dialog), 140, 4, 8);
		await waitFor(() =>
			expect(within(canvasElement).getByTestId("state")).toHaveTextContent(
				"closed",
			),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
			timeout: 1500,
		});
		await wait(100);
	},
};

export const SlowDragPastQuarterCloses: Story = {
	render: () => <Demo />,
	play: async ({ canvasElement }) => {
		const dialog = await openSheet(canvasElement);
		const distance = Math.round(dialog.getBoundingClientRect().height * 0.35);
		await drag(grabArea(dialog), distance, 10, 20, 150);
		await waitFor(() =>
			expect(within(canvasElement).getByTestId("state")).toHaveTextContent(
				"closed",
			),
		);
	},
};

const LongContentDemo = () => {
	const [open, setOpen] = createSignal(true);
	return (
		<FullScreenSheet
			open={open()}
			onOpenChange={setOpen}
			title="Forward message"
			description="Pick a channel to share this message in."
			footer={<Button block>Forward</Button>}
		>
			<div
				data-testid="preview"
				class="min-w-0 overflow-hidden rounded-control bg-secondary px-3 py-2 text-sm text-muted-foreground"
			>
				v0.4.1 hotfix: push notifications on Android 15
			</div>
			<div class="flex flex-col gap-2">
				{Array.from({ length: 40 }, (_, index) => (
					<button
						type="button"
						class="h-11 rounded-control border-0 bg-card px-3 text-left text-sm text-foreground"
					>
						{`channel-${index + 1}`}
					</button>
				))}
			</div>
		</FullScreenSheet>
	);
};

export const LongContentKeepsCardsWhole: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <LongContentDemo />,
	play: async () => {
		const dialog = await screen.findByRole("dialog");
		await waitFor(() => expect(dialog).toBeVisible());
		await new Promise((resolve) => setTimeout(resolve, 500));
		const preview = dialog.querySelector(
			'[data-testid="preview"]',
		) as HTMLElement;
		await expect(preview.scrollHeight).toBeLessThanOrEqual(
			preview.clientHeight + 1,
		);
		await expectNoLayoutIssues(dialog);
	},
};

export const AsksBeforeDiscarding: Story = {
	render: () => <DirtyDemo />,
	play: async ({ canvasElement }) => {
		const dialog = await openSheet(canvasElement);
		await userEvent.type(within(dialog).getByLabelText("Space name"), "Hive");
		const state = () => within(canvasElement).getByTestId("state");
		const prompt = () =>
			screen.findByRole(
				"dialog",
				{ name: "Discard changes?" },
				{ timeout: 3000 },
			);
		const closed = () =>
			waitFor(
				() =>
					expect(
						screen.queryByRole("dialog", { name: "Discard changes?" }),
					).toBeNull(),
				{ timeout: 3000 },
			);

		await drag(grabArea(dialog), 400, 4, 8);
		let ask = await prompt();
		await expect(ask).toHaveTextContent("This Space won't be created.");
		await expect(state()).toHaveTextContent("open");
		await userEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
		await closed();
		await waitFor(() => expect(dialog.style.transform).toBe(""));
		await expect(state()).toHaveTextContent("open");

		await userEvent.click(
			within(dialog).getByRole("button", { name: "Close" }),
		);
		ask = await prompt();
		await waitFor(() => expectNoLayoutIssues(ask), { timeout: 3000 });
		await userEvent.click(
			within(ask).getByRole("button", { name: "Discard changes" }),
		);
		await waitFor(() => expect(state()).toHaveTextContent("closed"));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
			timeout: 1500,
		});
		await waitFor(
			() => expect(canvasElement.closest("[aria-hidden='true']")).toBeNull(),
			{ timeout: 3000 },
		);
	},
};

const ComposerDemo = () => {
	const [open, setOpen] = createSignal(false);
	return (
		<div class="flex min-h-dvh flex-col gap-3 bg-background p-4">
			<TextField label="Message" placeholder="Message #general" />
			<Button onClick={() => setOpen(true)}>Open sheet</Button>
			<FullScreenSheet
				open={open()}
				onOpenChange={setOpen}
				title="Forward message"
				closeLabel="Cancel forwarding"
			>
				<TextField label="Search channels" placeholder="Search" />
			</FullScreenSheet>
		</div>
	);
};

export const DismissesKeyboard: Story = {
	render: () => <ComposerDemo />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const field = canvas.getByRole("textbox", { name: "Message" });
		field.focus();
		await expect(document.activeElement).toBe(field);
		const button = canvas.getByRole("button", { name: "Open sheet" });
		button.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				pointerType: "touch",
				isPrimary: true,
			}),
		);
		button.click();
		await expect(document.activeElement).not.toBe(field);
		const sheet = await screen.findByRole("dialog", {
			name: "Forward message",
		});
		await wait(500);
		await expect(sheet.contains(document.activeElement)).toBe(true);
		await expectNoLayoutIssues(sheet);
		const search = within(sheet).getByRole("textbox", {
			name: "Search channels",
		});
		search.focus();
		await expect(document.activeElement).toBe(search);
	},
};
