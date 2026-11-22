import { createSignal } from "solid-js";
import {
	expect,
	fireEvent,
	screen,
	userEvent,
	waitFor,
	within,
} from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	DropdownMenu,
	type DropdownMenuEntry,
} from "../DropdownMenu/DropdownMenu";
import { Slider } from "./Slider";

const meta = {
	title: "Primitives/Slider",
	component: Slider,
	decorators: [
		(Story) => (
			<div class="flex w-full max-w-sm flex-col gap-8 bg-background p-6">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

const percent = (value: number) => `${value}%`;

export const Volume: Story = {
	render: () => {
		const [volume, setVolume] = createSignal([100]);
		return (
			<>
				<Slider
					label="Microphone volume"
					showValue
					value={volume()}
					onChange={setVolume}
					maxValue={200}
					formatValue={percent}
					marks={[{ value: 100 }]}
				/>
				<p data-testid="value" class="text-sm text-muted-foreground">
					{volume()[0]}
				</p>
			</>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const thumb = canvas.getByRole("slider", { name: "Microphone volume" });
		await expect(thumb).toHaveAttribute("aria-valuetext", "100%");
		thumb.focus();
		await userEvent.keyboard("{ArrowRight}{ArrowRight}");
		await waitFor(() =>
			expect(canvas.getByTestId("value")).toHaveTextContent("102"),
		);
		await expect(thumb).toHaveAttribute("aria-valuetext", "102%");
		await expect(
			canvasElement.querySelector("[data-slider-mark]"),
		).toHaveAttribute("data-active");
		await userEvent.keyboard("{Home}");
		await waitFor(() =>
			expect(canvas.getByTestId("value")).toHaveTextContent("0"),
		);
		await expect(
			canvasElement.querySelector("[data-slider-mark]"),
		).not.toHaveAttribute("data-active");
	},
};

export const DragGrowsThumb: Story = {
	render: () => {
		const [value, setValue] = createSignal([20]);
		return (
			<>
				<Slider aria-label="Brightness" value={value()} onChange={setValue} />
				<p data-testid="value" class="text-sm text-muted-foreground">
					{value()[0]}
				</p>
			</>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const root =
			canvasElement.querySelector<HTMLElement>(
				"[data-slider-rail]",
			)?.parentElement;
		if (!root) throw new Error("Missing track");
		const rect = root.getBoundingClientRect();
		const y = rect.top + rect.height / 2;
		await fireEvent.pointerDown(root, {
			pointerId: 1,
			button: 0,
			clientX: rect.left + rect.width * 0.75,
			clientY: y,
		});
		await waitFor(() =>
			expect(canvas.getByTestId("value")).toHaveTextContent("75"),
		);
		await expect(root.closest("[data-dragging]")).not.toBeNull();
		await fireEvent.pointerUp(window, { pointerId: 1 });
		await waitFor(() =>
			expect(canvasElement.querySelector("[data-dragging]")).toBeNull(),
		);
	},
};

const pressThumb = async (thumb: HTMLElement) => {
	const rect = thumb.getBoundingClientRect();
	const point = {
		pointerId: 1,
		button: 0,
		clientX: rect.left + rect.width / 2,
		clientY: rect.top + rect.height / 2,
	};
	await fireEvent.pointerDown(thumb, point);
	await fireEvent.pointerUp(thumb, point);
};

export const ResetAndSnap: Story = {
	render: () => {
		const [volume, setVolume] = createSignal([150]);
		return (
			<>
				<Slider
					label="Output volume"
					description="Double-press the thumb to reset to 100%."
					showValue
					value={volume()}
					defaultValue={[100]}
					onChange={setVolume}
					maxValue={200}
					formatValue={percent}
					marks={[{ value: 100 }]}
				/>
				<p data-testid="value" class="text-sm text-muted-foreground">
					{volume()[0]}
				</p>
			</>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const value = () => canvas.getByTestId("value");
		const thumb = canvas.getByRole("slider", { name: "Output volume" });
		const capture = Element.prototype.setPointerCapture;
		Element.prototype.setPointerCapture = () => {};
		try {
			await step("Double-press resets to the default", async () => {
				await pressThumb(thumb);
				await expect(value()).toHaveTextContent("150");
				await pressThumb(thumb);
				await waitFor(() => expect(value()).toHaveTextContent("100"));
			});

			await step(
				"Keyboard steps past the default without snapping",
				async () => {
					thumb.focus();
					await userEvent.keyboard("{ArrowRight}");
					await waitFor(() => expect(value()).toHaveTextContent("101"));
				},
			);

			await step("Dragging near the default snaps to it", async () => {
				const track =
					canvasElement.querySelector<HTMLElement>(
						"[data-slider-rail]",
					)?.parentElement;
				if (!track) throw new Error("Missing track");
				const rect = track.getBoundingClientRect();
				const y = rect.top + rect.height / 2;
				await fireEvent.pointerDown(track, {
					pointerId: 2,
					button: 0,
					clientX: rect.left + rect.width * 0.52,
					clientY: y,
				});
				await waitFor(() => expect(value()).toHaveTextContent("100"));
				await fireEvent.pointerUp(window, { pointerId: 2 });
				await fireEvent.pointerDown(track, {
					pointerId: 3,
					button: 0,
					clientX: rect.left + rect.width * 0.7,
					clientY: y,
				});
				await waitFor(() => expect(value()).toHaveTextContent("140"));
				await fireEvent.pointerUp(window, { pointerId: 3 });
			});
		} finally {
			Element.prototype.setPointerCapture = capture;
		}
	},
};

export const Range: Story = {
	render: () => {
		const [range, setRange] = createSignal([20, 80]);
		return (
			<Slider
				label="Price range"
				showValue
				value={range()}
				onChange={setRange}
				minStepsBetweenThumbs={5}
				thumbLabels={["Minimum price", "Maximum price"]}
				formatValue={(value) => `$${value}`}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const minimum = canvas.getByRole("slider", { name: /Minimum price/ });
		const maximum = canvas.getByRole("slider", { name: /Maximum price/ });
		await expect(minimum).toHaveAttribute("aria-valuetext", "$20");
		await expect(maximum).toHaveAttribute("aria-valuetext", "$80");
		await expect(canvas.getByText("$20 to $80")).toBeVisible();
	},
};

export const SteppedWithMarks: Story = {
	render: () => (
		<Slider
			label="Message density"
			defaultValue={[50]}
			step={25}
			marks={[
				{ value: 0, label: "Compact" },
				{ value: 25 },
				{ value: 50, label: "Default" },
				{ value: 75 },
				{ value: 100, label: "Roomy" },
			]}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const thumb = canvas.getByRole("slider", { name: "Message density" });
		thumb.focus();
		await userEvent.keyboard("{ArrowRight}");
		await waitFor(() => expect(thumb).toHaveAttribute("aria-valuenow", "75"));
		await expect(canvas.getByText("Roomy")).toBeVisible();
	},
};

export const WithDescription: Story = {
	render: () => (
		<Slider
			label="Speaker volume"
			description="Applies to every call."
			showValue
			defaultValue={[70]}
			maxValue={200}
			formatValue={percent}
		/>
	),
};

export const Disabled: Story = {
	render: () => <Slider label="Volume" disabled defaultValue={[40]} />,
	play: async ({ canvasElement }) => {
		const slider = canvasElement.querySelector("[data-disabled]");
		await expect(slider).not.toBeNull();
	},
};

export const SnapOff: Story = {
	render: () => {
		const [volume, setVolume] = createSignal([150]);
		return (
			<>
				<Slider
					label="Output volume"
					description="Double-press resets, dragging never snaps."
					showValue
					value={volume()}
					defaultValue={[100]}
					snap={false}
					onChange={setVolume}
					maxValue={200}
					formatValue={percent}
					marks={[{ value: 100 }]}
				/>
				<p data-testid="value" class="text-sm text-muted-foreground">
					{volume()[0]}
				</p>
			</>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const value = () => canvas.getByTestId("value");
		const thumb = canvas.getByRole("slider", { name: "Output volume" });
		const capture = Element.prototype.setPointerCapture;
		Element.prototype.setPointerCapture = () => {};
		try {
			await step("Dragging near the default does not snap", async () => {
				const track =
					canvasElement.querySelector<HTMLElement>(
						"[data-slider-rail]",
					)?.parentElement;
				if (!track) throw new Error("Missing track");
				const rect = track.getBoundingClientRect();
				await fireEvent.pointerDown(track, {
					pointerId: 2,
					button: 0,
					clientX: rect.left + rect.width * 0.52,
					clientY: rect.top + rect.height / 2,
				});
				await waitFor(() => expect(value()).toHaveTextContent("104"));
				await fireEvent.pointerUp(window, { pointerId: 2 });
			});

			await step("Double-press still resets", async () => {
				await pressThumb(thumb);
				await pressThumb(thumb);
				await waitFor(() => expect(value()).toHaveTextContent("100"));
			});
		} finally {
			Element.prototype.setPointerCapture = capture;
		}
	},
};

export const HoverArrowKeys: Story = {
	render: () => {
		const [volume, setVolume] = createSignal([50]);
		const [committed, setCommitted] = createSignal<number>();
		return (
			<>
				<Slider
					label="Notification volume"
					showValue
					value={volume()}
					onChange={setVolume}
					onChangeEnd={(values) => setCommitted(values[0])}
					formatValue={percent}
				/>
				<input
					aria-label="Nickname"
					class="h-9 rounded-control-sm border border-border bg-input px-3 text-sm text-foreground"
				/>
				<p data-testid="value" class="text-sm text-muted-foreground">
					{volume()[0]}
				</p>
				<p data-testid="committed" class="text-sm text-muted-foreground">
					{committed() ?? ""}
				</p>
			</>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const value = () => canvas.getByTestId("value");
		const thumb = canvas.getByRole("slider", { name: "Notification volume" });
		const slider = thumb.closest<HTMLElement>("[role='group']") ?? thumb;
		const input = canvas.getByRole("textbox", { name: "Nickname" });
		(document.activeElement as HTMLElement | null)?.blur();

		await step("Arrows step the hovered slider without focus", async () => {
			await userEvent.hover(slider);
			await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowUp}");
			await waitFor(() => expect(value()).toHaveTextContent("53"));
			await expect(thumb).not.toHaveFocus();
			await userEvent.keyboard("{ArrowLeft}");
			await waitFor(() => expect(value()).toHaveTextContent("52"));
			await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
			await waitFor(() => expect(value()).toHaveTextContent("62"));
			await userEvent.keyboard("{PageDown}");
			await waitFor(() => expect(value()).toHaveTextContent("52"));
			await userEvent.keyboard("{End}");
			await waitFor(() => expect(value()).toHaveTextContent("100"));
			await userEvent.keyboard("{Home}");
			await waitFor(() => expect(value()).toHaveTextContent("0"));
			await expect(canvas.getByTestId("committed")).toHaveTextContent("");
		});

		await step("Modifier shortcuts pass through", async () => {
			await userEvent.keyboard("{Control>}{ArrowRight}{/Control}");
			await expect(value()).toHaveTextContent("0");
		});

		await step("Leaving commits and stops stepping", async () => {
			await userEvent.unhover(slider);
			await waitFor(() =>
				expect(canvas.getByTestId("committed")).toHaveTextContent("0"),
			);
			await userEvent.keyboard("{ArrowRight}");
			await expect(value()).toHaveTextContent("0");
		});

		await step("A focused text input keeps its arrows", async () => {
			input.focus();
			await userEvent.hover(slider);
			await userEvent.keyboard("{ArrowRight}");
			await expect(value()).toHaveTextContent("0");
			await userEvent.unhover(slider);
			input.blur();
		});

		await step("A focused thumb steps once", async () => {
			thumb.focus();
			await userEvent.hover(slider);
			await userEvent.keyboard("{ArrowRight}");
			await waitFor(() => expect(value()).toHaveTextContent("1"));
			await userEvent.unhover(slider);
		});
	},
};

export const HoverArrowKeysInMenu: Story = {
	render: () => {
		const [volume, setVolume] = createSignal(60);
		const items: DropdownMenuEntry[] = [
			{
				kind: "slider",
				label: "Stream volume",
				get value() {
					return volume();
				},
				max: 200,
				formatValue: percent,
				onChange: setVolume,
			},
			{ label: "Mute stream" },
			{ label: "Hide stream" },
		];
		return (
			<div class="flex min-h-[360px] justify-start bg-background p-8">
				<DropdownMenu
					platform="desktop"
					label="Call options"
					placement="bottom-start"
					triggerClass="flex h-9 cursor-pointer items-center rounded-control-sm border border-border bg-secondary px-3 text-sm font-semibold text-foreground"
					trigger="Call options"
					items={items}
				/>
				<span data-testid="value" class="sr-only">
					{volume()}
				</span>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Call options" }));
		const menu = await screen.findByRole("menu");
		const thumb = within(menu).getByRole("slider", { name: "Stream volume" });
		const slider = thumb.closest<HTMLElement>("[role='group']") ?? thumb;
		const focused = document.activeElement;
		const highlighted = () => menu.querySelector("[data-highlighted]");
		const highlightBefore = highlighted();

		await userEvent.hover(slider);
		await userEvent.keyboard("{ArrowDown}{ArrowDown}");
		await waitFor(() =>
			expect(canvas.getByTestId("value")).toHaveTextContent("58"),
		);
		await expect(document.activeElement).toBe(focused);
		await expect(highlighted()).toBe(highlightBefore);
		await expect(screen.getByRole("menu")).toBeInTheDocument();
		await userEvent.unhover(slider);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	},
};
