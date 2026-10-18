import { createSignal } from "solid-js";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../Button/Button";
import { Modal, ModalContent, ModalTrigger } from "../Modal/Modal";
import {
	type StatusChange,
	type StatusDraft,
	StatusField,
	type StatusFieldProps,
	statusExpiresAt,
	utf8Length,
} from "./StatusField";

const meta = {
	title: "Primitives/Status field",
	decorators: [
		(Story) => (
			<div class="flex min-h-[520px] max-w-sm flex-col gap-6 bg-background p-6 text-foreground">
				<Story />
			</div>
		),
	],
} satisfies Meta;

export default meta;
type Story = StoryObj;

const iphone = { viewport: { defaultViewport: "iphone" } };

const FIXED_NOW = new Date(2026, 9, 8, 14, 30);

const Harness = (props: Omit<StatusFieldProps, "onChange">) => {
	const [change, setChange] = createSignal<StatusChange>();
	return (
		<>
			<StatusField {...props} now={() => FIXED_NOW} onChange={setChange} />
			<output data-status-value="">{JSON.stringify(change() ?? null)}</output>
		</>
	);
};

const readChange = (canvasElement: HTMLElement): StatusChange | null =>
	JSON.parse(
		canvasElement.querySelector("[data-status-value]")?.textContent ?? "null",
	);

export const Desktop: Story = {
	render: () => (
		<Harness
			platform="desktop"
			defaultValue={{ text: "Building a nest!", emoji: "🐦" }}
		/>
	),
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		await step("The emoji button opens the picker and picks", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: "Status emoji 🐦" }),
			);
			const dialog = await screen.findByRole("dialog", {
				name: "Status emoji",
			});
			await userEvent.type(within(dialog).getByRole("searchbox"), "salute");
			const cell = await waitFor(
				() => {
					const element = dialog.querySelector<HTMLElement>("[data-cell]");
					if (!element) throw new Error("no results");
					return element;
				},
				{ timeout: 3000 },
			);
			await userEvent.click(cell);
			await waitFor(
				() =>
					expect(
						screen.queryByRole("dialog", { name: "Status emoji" }),
					).toBeNull(),
				{ timeout: 3000 },
			);
			await expect(
				canvas.getByRole("button", { name: "Status emoji 🫡" }),
			).toBeInTheDocument();
			await expect(readChange(canvasElement)?.emoji).toBe("🫡");
		});
		await step("Clear removes the text and the emoji", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: "Clear status" }),
			);
			await expect(canvas.getByLabelText("Status")).toHaveValue("");
			await expect(canvas.getByLabelText("Status")).toHaveFocus();
			await expect(
				canvas.getByRole("button", { name: "Choose a status emoji" }),
			).toBeInTheDocument();
			const change = readChange(canvasElement);
			await expect(change?.text).toBe("");
			await expect(change?.emoji).toBeUndefined();
		});
	},
};

export const ByteLimit: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByLabelText("Status") as HTMLInputElement;
		await userEvent.click(input);
		await userEvent.paste(
			"Grüße aus dem Nest, ein ziemlich langer Status 🪺🪺🪺🪺🪺🪺",
		);
		await expect(input.value).toBe(
			"Grüße aus dem Nest, ein ziemlich langer Status 🪺🪺🪺",
		);
		await expect(utf8Length(input.value)).toBe(61);
		await userEvent.type(input, "abcd");
		await expect(input.value).toBe(
			"Grüße aus dem Nest, ein ziemlich langer Status 🪺🪺🪺abc",
		);
		await expect(utf8Length(readChange(canvasElement)?.text ?? "")).toBe(64);
		const slot = canvasElement.querySelector("[data-ring-slot]");
		await expect(slot).toHaveAttribute("data-visible");
		await expect(
			canvasElement.querySelector("[data-character-ring]"),
		).toHaveAccessibleName("0 characters remaining");
	},
};

export const ClearAfter: Story = {
	render: () => (
		<Harness platform="desktop" defaultValue={{ text: "Out for lunch" }} />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole("button", { name: /Clear after/ });
		await expect(trigger).toHaveTextContent("Don't clear");
		await userEvent.click(trigger);
		const listbox = await screen.findByRole("listbox");
		await userEvent.click(
			within(listbox).getByRole("option", { name: "1 hour" }),
		);
		let change = readChange(canvasElement);
		await expect(change?.clearAfter).toBe("1h");
		await expect(change?.expiresAt).toBe(
			new Date(FIXED_NOW.getTime() + 60 * 60_000).toISOString(),
		);
		await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
		await userEvent.click(trigger);
		await userEvent.click(
			within(await screen.findByRole("listbox")).getByRole("option", {
				name: "This week",
			}),
		);
		change = readChange(canvasElement);
		await expect(change?.expiresAt).toBe(new Date(2026, 9, 12).toISOString());
		await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
		await userEvent.click(trigger);
		await userEvent.click(
			within(await screen.findByRole("listbox")).getByRole("option", {
				name: "Don't clear",
			}),
		);
		await expect(readChange(canvasElement)?.expiresAt).toBeUndefined();
	},
};

export const Mobile: Story = {
	parameters: iphone,
	render: () => (
		<Harness platform="mobile" defaultValue={{ text: "Listening to rain" }} />
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "Choose a status emoji",
			}),
		);
		const drawer = await screen.findByRole("dialog", { name: "Status emoji" });
		await expect(drawer).toHaveAttribute("data-corvu-drawer-content");
	},
};

const SetStatusModal = (props: { platform: "desktop" | "mobile" }) => {
	const [open, setOpen] = createSignal(false);
	const [draft, setDraft] = createSignal<StatusDraft>({
		text: "Building a nest!",
		emoji: "🐦",
		clearAfter: "never",
		showWhileOffline: false,
	});
	const [saved, setSaved] = createSignal<StatusChange>();
	const save = () => {
		const expiresAt = statusExpiresAt(draft().clearAfter, FIXED_NOW);
		setSaved({ ...draft(), expiresAt: expiresAt?.toISOString() });
		setOpen(false);
	};
	return (
		<>
			<Modal open={open()} onOpenChange={setOpen}>
				<ModalTrigger as={Button}>Set status</ModalTrigger>
				<ModalContent
					title="Set your status"
					footer={
						<>
							<Button variant="secondary" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button onClick={save}>Save</Button>
						</>
					}
				>
					<StatusField
						platform={props.platform}
						value={draft()}
						onChange={({ text, emoji, clearAfter, showWhileOffline }) =>
							setDraft({ text, emoji, clearAfter, showWhileOffline })
						}
					/>
				</ModalContent>
			</Modal>
			<output data-status-saved="">{JSON.stringify(saved() ?? null)}</output>
		</>
	);
};

const setStatusPlay: Story["play"] = async ({ canvasElement }) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Set status" }),
	);
	const dialog = await screen.findByRole("dialog", {
		name: "Set your status",
	});
	const input = within(dialog).getByLabelText("Status");
	await userEvent.clear(input);
	await userEvent.type(input, "Flying south");
	const offlineToggle = within(dialog).getByRole("switch", {
		name: /Show while offline/,
	});
	await expect(offlineToggle).not.toBeChecked();
	await userEvent.click(offlineToggle);
	await expect(offlineToggle).toBeChecked();
	await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
	await waitFor(
		() =>
			expect(
				screen.queryByRole("dialog", { name: "Set your status" }),
			).toBeNull(),
		{ timeout: 3000 },
	);
	const saved = JSON.parse(
		canvasElement.querySelector("[data-status-saved]")?.textContent ?? "null",
	);
	await expect(saved).toEqual({
		text: "Flying south",
		emoji: "🐦",
		clearAfter: "never",
		showWhileOffline: true,
	});
};

export const SetStatusModalDesktop: Story = {
	render: () => <SetStatusModal platform="desktop" />,
	play: setStatusPlay,
};

export const SetStatusModalMobile: Story = {
	parameters: iphone,
	render: () => <SetStatusModal platform="mobile" />,
	play: setStatusPlay,
};

const isTopmost = (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	const hit = document.elementFromPoint(
		box.left + box.width / 2,
		box.top + Math.min(box.height / 2, 40),
	);
	return !!hit && element.contains(hit);
};

export const EmojiDrawerOverMobileModal: Story = {
	parameters: iphone,
	render: () => <SetStatusModal platform="mobile" />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Set status" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Set your status",
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: /Status emoji/ }),
		);
		const sheet = await screen.findByRole(
			"dialog",
			{ name: "Status emoji" },
			{ timeout: 3000 },
		);
		await waitFor(() => expect(isTopmost(sheet)).toBe(true), {
			timeout: 3000,
		});
		const cell = await waitFor(
			() => {
				const element = sheet.querySelector<HTMLElement>("[data-cell]");
				if (!element) throw new Error("no cell");
				return element;
			},
			{ timeout: 3000 },
		);
		await userEvent.click(cell);
		await waitFor(
			() =>
				expect(
					screen.queryByRole("dialog", { name: "Status emoji" }),
				).toBeNull(),
			{ timeout: 4000 },
		);
		await expect(
			screen.getByRole("dialog", { name: "Set your status" }),
		).toBeInTheDocument();
	},
};

export const EmojiPopoverStaysInViewport: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col justify-end p-4">
			<SetStatusModal platform="desktop" />
		</div>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Set status" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Set your status",
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: /Status emoji/ }),
		);
		await new Promise((resolve) => setTimeout(resolve, 300));
		const popover = await screen.findByRole(
			"dialog",
			{ name: "Status emoji" },
			{ timeout: 3000 },
		);
		await waitFor(
			() => {
				const box = popover.getBoundingClientRect();
				expect(box.top).toBeGreaterThanOrEqual(0);
				expect(box.left).toBeGreaterThanOrEqual(0);
				expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
				expect(box.right).toBeLessThanOrEqual(window.innerWidth);
			},
			{ timeout: 3000 },
		);
		const grid = popover.querySelector<HTMLElement>(".overflow-y-auto");
		await expect(grid).not.toBeNull();
	},
};
