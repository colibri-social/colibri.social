import { BellIcon } from "@solar-icons/solid/bold/bell";
import { onCleanup } from "solid-js";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../Button/Button";
import { Toaster, type ToasterPlatform } from "./Toaster";
import { clearToasts, type ToastId, toast } from "./toast-store";

type ToastStoryArgs = { platform: ToasterPlatform };

const meta = {
	title: "Overlays/Toast",
	component: Toaster,
	args: { platform: "desktop" },
	argTypes: {
		platform: { control: "inline-radio", options: ["desktop", "mobile"] },
	},
	decorators: [
		(Story, context) => {
			clearToasts();
			onCleanup(clearToasts);
			return (
				<div class="min-h-[480px] bg-background p-4">
					<Toaster platform={(context.args as ToastStoryArgs).platform} />
					<Story />
				</div>
			);
		},
	],
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = () =>
	Array.from(document.querySelectorAll<HTMLElement>("li[data-toast]"));
const activeItems = () =>
	items().filter((item) => !item.hasAttribute("data-dismissed"));
const list = () => document.querySelector<HTMLElement>("[data-toaster] ol");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const drag = async (
	element: HTMLElement,
	dx: number,
	dy: number,
	pointerType = "mouse",
) => {
	const rect = element.getBoundingClientRect();
	const x = rect.left + rect.width / 2;
	const y = rect.top + rect.height / 2;
	const init = { pointerId: 7, pointerType, button: 0, bubbles: true };
	element.dispatchEvent(
		new PointerEvent("pointerdown", { ...init, clientX: x, clientY: y }),
	);
	const steps = 6;
	for (let step = 1; step <= steps; step++) {
		element.dispatchEvent(
			new PointerEvent("pointermove", {
				...init,
				clientX: x + (dx * step) / steps,
				clientY: y + (dy * step) / steps,
			}),
		);
		await wait(16);
	}
	element.dispatchEvent(
		new PointerEvent("pointerup", {
			...init,
			clientX: x + dx,
			clientY: y + dy,
		}),
	);
};

const Playground = () => {
	let loadingId: ToastId | undefined;
	return (
		<div class="flex max-w-md flex-wrap gap-2">
			<Button variant="secondary" onClick={() => toast("Copied DID")}>
				Default
			</Button>
			<Button
				variant="secondary"
				onClick={() => toast.success("Profile saved")}
			>
				Success
			</Button>
			<Button
				variant="secondary"
				onClick={() =>
					toast.error("Couldn't send message", {
						description: "Check your connection and try again.",
						action: { label: "Retry" },
					})
				}
			>
				Error
			</Button>
			<Button
				variant="secondary"
				onClick={() =>
					toast.warning("Joined without a microphone", {
						description: "Check your input device in settings.",
						action: { label: "Settings" },
					})
				}
			>
				Warning
			</Button>
			<Button
				variant="secondary"
				onClick={() => toast.info("Voice moved to a closer region")}
			>
				Info
			</Button>
			<Button
				variant="secondary"
				onClick={() => {
					loadingId = toast.loading("Verifying AppView");
					const id = loadingId;
					setTimeout(() => toast.success("AppView verified", { id }), 1600);
				}}
			>
				Loading then success
			</Button>
			<Button
				variant="secondary"
				onClick={() =>
					toast("Message deleted", {
						action: { label: "Undo" },
					})
				}
			>
				With action
			</Button>
			<Button
				variant="secondary"
				onClick={() =>
					toast.custom(
						(id) => (
							<button
								type="button"
								onClick={() => toast.dismiss(id)}
								class="flex w-full cursor-pointer items-start gap-3 p-3 text-left hover:bg-popover-highlight"
							>
								<BellIcon class="mt-0.5 size-5 shrink-0 text-primary" />
								<span class="flex min-w-0 flex-col gap-0.5">
									<span class="eyebrow text-muted-foreground">Mention</span>
									<span class="text-sm font-semibold">
										Ada mentioned you in #general
									</span>
									<span class="truncate text-sm text-muted-foreground">
										Can you take a look at the release notes?
									</span>
								</span>
							</button>
						),
						{ announce: "Ada mentioned you in #general" },
					)
				}
			>
				Custom
			</Button>
			<Button variant="tertiary" onClick={() => toast.dismiss()}>
				Dismiss all
			</Button>
		</div>
	);
};

export const Desktop: Story = {
	render: () => <Playground />,
};

export const Mobile: Story = {
	args: { platform: "mobile" },
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <Playground />,
};

export const Stacking: Story = {
	render: () => <Playground />,
	play: async () => {
		toast("First");
		toast("Second");
		toast("Third");
		toast.success("Fourth");
		await waitFor(() => expect(activeItems()).toHaveLength(4));
		await waitFor(() =>
			expect(document.querySelector("li[data-front]")).toHaveAttribute(
				"data-type",
				"success",
			),
		);
		const hidden = activeItems().filter(
			(item) => item.getAttribute("aria-hidden") === "true",
		);
		await expect(hidden).toHaveLength(1);
		const ol = list() as HTMLElement;
		await expect(ol).not.toHaveAttribute("data-expanded");
		const collapsedHeight = ol.getBoundingClientRect().height;
		await userEvent.hover(activeItems()[0]);
		await waitFor(() => expect(ol).toHaveAttribute("data-expanded"));
		await waitFor(() =>
			expect(ol.getBoundingClientRect().height).toBeGreaterThan(
				collapsedHeight + 40,
			),
		);
		await userEvent.unhover(activeItems()[0]);
		await waitFor(() => expect(ol).not.toHaveAttribute("data-expanded"));
	},
};

export const UpdateById: Story = {
	render: () => <Playground />,
	play: async () => {
		const id = toast.loading("Verifying AppView");
		await waitFor(() => expect(activeItems()).toHaveLength(1));
		await expect(activeItems()[0]).toHaveAttribute("data-type", "loading");
		toast.success("AppView verified", {
			id,
			description: "Requests now go to appview.example.",
		});
		await waitFor(() =>
			expect(activeItems()[0]).toHaveAttribute("data-type", "success"),
		);
		await expect(activeItems()).toHaveLength(1);
		await expect(activeItems()[0]).toHaveTextContent("AppView verified");
		await waitFor(() => expect(activeItems()[0]).toHaveAttribute("data-card"));
		await waitFor(() =>
			expect(document.querySelector("[role='status']")).toHaveTextContent(
				"AppView verified. Requests now go to appview.example.",
			),
		);
	},
};

export const Dismiss: Story = {
	render: () => <Playground />,
	play: async () => {
		const id = toast("Copied DID");
		toast("Copied handle");
		await waitFor(() => expect(activeItems()).toHaveLength(2));
		toast.dismiss(id);
		await waitFor(() => expect(activeItems()).toHaveLength(1));
		await waitFor(() => expect(items()).toHaveLength(1));
		await expect(items()[0]).toHaveTextContent("Copied handle");
		toast.dismiss();
		await waitFor(() => expect(items()).toHaveLength(0));
	},
};

export const AutoCloseAndPause: Story = {
	render: () => <Playground />,
	play: async () => {
		const onAutoClose = fn();
		toast("Short lived", { duration: 400, onAutoClose });
		await waitFor(() => expect(activeItems()).toHaveLength(1));
		await userEvent.hover(activeItems()[0]);
		await wait(700);
		await expect(activeItems()).toHaveLength(1);
		await userEvent.unhover(activeItems()[0]);
		await waitFor(() => expect(onAutoClose).toHaveBeenCalledOnce(), {
			timeout: 2000,
		});
		await waitFor(() => expect(items()).toHaveLength(0));
	},
};

export const Action: Story = {
	render: () => <Playground />,
	play: async () => {
		const onUndo = fn();
		toast("Message deleted", { action: { label: "Undo", onClick: onUndo } });
		await waitFor(() => expect(activeItems()).toHaveLength(1));
		const button = activeItems()[0].querySelector(
			"[data-toast-action]",
		) as HTMLButtonElement;
		await expect(button).toHaveTextContent("Undo");
		const title = activeItems()[0].querySelector("p") as HTMLElement;
		await expect(button.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			title.getBoundingClientRect().bottom,
		);
		await userEvent.click(button);
		await expect(onUndo).toHaveBeenCalledOnce();
		await waitFor(() => expect(items()).toHaveLength(0));
	},
};

export const SwipeDesktop: Story = {
	render: () => <Playground />,
	play: async () => {
		toast("Swipe me away");
		await waitFor(() =>
			expect(activeItems()[0]).toHaveAttribute("data-mounted"),
		);
		await drag(activeItems()[0], -60, 0);
		await wait(450);
		await expect(activeItems()).toHaveLength(1);
		await drag(activeItems()[0], 90, 0);
		await waitFor(() => expect(activeItems()).toHaveLength(0));
		await waitFor(() => expect(items()).toHaveLength(0));
	},
};

export const CloseButtonDesktop: Story = {
	render: () => <Playground />,
	play: async () => {
		toast("Copied DID");
		await waitFor(() =>
			expect(activeItems()[0]).toHaveAttribute("data-mounted"),
		);
		const close = activeItems()[0].querySelector<HTMLElement>(
			"[data-toast-close]",
		) as HTMLElement;
		await expect(close).toHaveAccessibleName("Dismiss notification");
		await expect(close).toHaveClass("opacity-0");
		await userEvent.hover(activeItems()[0]);
		await waitFor(() => expect(close).toHaveClass("opacity-100"));
		await userEvent.click(close);
		await waitFor(() => expect(activeItems()).toHaveLength(0));
		toast("Copied handle");
		await waitFor(() =>
			expect(activeItems()[0]).toHaveAttribute("data-mounted"),
		);
		const next = activeItems()[0].querySelector<HTMLElement>(
			"[data-toast-close]",
		) as HTMLElement;
		await userEvent.unhover(activeItems()[0]);
		await userEvent.keyboard("{Alt>}t{/Alt}");
		await userEvent.tab();
		await expect(next).toHaveFocus();
		await waitFor(() => expect(next).toHaveClass("opacity-100"));
	},
};

export const NoCloseButtonMobile: Story = {
	args: { platform: "mobile" },
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <Playground />,
	play: async () => {
		toast("Copied DID");
		await waitFor(() => expect(activeItems()).toHaveLength(1));
		await expect(
			activeItems()[0].querySelector("[data-toast-close]"),
		).not.toBeInTheDocument();
	},
};

export const SwipeMobile: Story = {
	args: { platform: "mobile" },
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <Playground />,
	play: async () => {
		toast("Swipe up to dismiss");
		await waitFor(() =>
			expect(activeItems()[0]).toHaveAttribute("data-mounted"),
		);
		await drag(activeItems()[0], 0, 40, "touch");
		await wait(450);
		await expect(activeItems()).toHaveLength(1);
		await drag(activeItems()[0], 0, -70, "touch");
		await waitFor(() => expect(activeItems()).toHaveLength(0));
	},
};

export const TapToExpandMobile: Story = {
	args: { platform: "mobile" },
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <Playground />,
	play: async () => {
		toast("Copied DID");
		toast.success("Profile saved");
		await waitFor(() => expect(activeItems()).toHaveLength(2));
		const ol = list() as HTMLElement;
		await userEvent.pointer({ keys: "[TouchA]", target: activeItems()[0] });
		await waitFor(() => expect(ol).toHaveAttribute("data-expanded"));
		await userEvent.pointer({ keys: "[TouchA]", target: document.body });
		await waitFor(() => expect(ol).not.toHaveAttribute("data-expanded"));
	},
};
