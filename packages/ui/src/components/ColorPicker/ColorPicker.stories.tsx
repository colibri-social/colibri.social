import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ColorPicker, ColorPickerPanel, ThemeColorPicker } from "./ColorPicker";

const meta = {
	title: "Primitives/Color picker",
	component: ColorPicker,
	decorators: [
		(Story) => (
			<div class="flex min-h-[520px] w-full max-w-sm flex-col gap-6 bg-background p-6">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const ROLE_PRESETS = [
	"#ef4444",
	"#f59e0b",
	"#84cc16",
	"#10b981",
	"#06b6d4",
	"#6366f1",
	"#ffffff",
];

export const Panel: Story = {
	args: { label: "Color", value: "#6d5ae6", onChange: fn() },
	render: (args) => {
		const [color, setColor] = createSignal("#6d5ae6");
		return (
			<div class="flex flex-col gap-3 rounded-surface border border-border bg-popover p-3">
				<ColorPickerPanel
					value={color()}
					onChange={(next) => {
						setColor(next);
						args.onChange(next);
					}}
				/>
				<p data-testid="value" class="text-sm text-muted-foreground">
					{color()}
				</p>
			</div>
		);
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const hex = canvas.getByRole("textbox", { name: "Hex color" });
		await userEvent.clear(hex);
		await userEvent.type(hex, "f00");
		await waitFor(() =>
			expect(canvas.getByTestId("value")).toHaveTextContent("#ff0000"),
		);
		await expect(args.onChange).toHaveBeenCalledWith("#ff0000");
		await userEvent.tab();
		await waitFor(() => expect(hex).toHaveValue("ff0000"));

		await userEvent.clear(hex);
		await userEvent.type(hex, "12");
		await userEvent.tab();
		await expect(
			await canvas.findByText("Use 3 or 6 hex digits"),
		).toBeVisible();

		await userEvent.click(canvas.getByRole("button", { name: "#10b981" }));
		await waitFor(() =>
			expect(canvas.getByTestId("value")).toHaveTextContent("#10b981"),
		);
		await expect(
			canvas.getByRole("button", { name: "#10b981" }),
		).toHaveAttribute("aria-pressed", "true");
		await expect(hex).toHaveValue("10b981");

		const area = canvas.getByRole("slider", {
			name: "Saturation and brightness",
		});
		const before = area.getAttribute("aria-valuenow");
		area.focus();
		await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
		await waitFor(() =>
			expect(area.getAttribute("aria-valuenow")).not.toBe(before),
		);

		const hue = canvas.getByRole("slider", { name: "Hue" });
		hue.focus();
		await userEvent.keyboard("{End}");
		await waitFor(() => expect(hue).toHaveAttribute("aria-valuenow", "360"));
	},
};

export const GreyKeepsHue: Story = {
	args: { label: "Color", value: "#6d5ae6", onChange: fn() },
	render: () => {
		const [color, setColor] = createSignal("#6d5ae6");
		return (
			<div class="rounded-surface border border-border bg-popover p-3">
				<ColorPickerPanel value={color()} onChange={setColor} />
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const hue = canvas.getByRole("slider", { name: "Hue" });
		const before = hue.getAttribute("aria-valuenow");
		await userEvent.click(canvas.getByRole("button", { name: "#ffffff" }));
		await waitFor(() =>
			expect(canvas.getByRole("textbox", { name: "Hex color" })).toHaveValue(
				"ffffff",
			),
		);
		await expect(hue).toHaveAttribute("aria-valuenow", before ?? "");
	},
};

export const ThemeColors: Story = {
	args: { label: "Theme color", value: "#4ade80", onChange: fn() },
	render: () => {
		const [colors, setColors] = createSignal(["#4ade80", "#76c4e5"]);
		return (
			<div class="flex flex-col gap-2">
				<p class="text-sm font-medium text-muted-foreground">Theme color(s)</p>
				<ThemeColorPicker colors={colors()} onChange={setColors} />
				<output data-theme-output="" class="sr-only">
					{colors().join(" ")}
				</output>
			</div>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const output = () =>
			canvasElement.querySelector("[data-theme-output]")?.textContent ?? "";

		await step("pick a preset for the primary color", async () => {
			const primary = canvas.getByRole("button", {
				name: /Primary theme color/,
			});
			await userEvent.click(primary);
			const dialog = await screen.findByRole("dialog", {
				name: "Primary theme color",
			});
			await userEvent.click(
				within(dialog).getByRole("button", { name: "#f59e0b" }),
			);
			await waitFor(() =>
				expect(primary).toHaveAccessibleName("Primary theme color, #f59e0b"),
			);
			await userEvent.keyboard("{Escape}");
			await waitFor(() =>
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
			);
		});

		await step("remove the second color", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: "Remove secondary theme color" }),
			);
			await expect(
				canvas.queryByRole("button", { name: /Secondary theme color/ }),
			).not.toBeInTheDocument();
			const add = canvas.getByRole("button", { name: "Add color" });
			await waitFor(() => expect(add).toHaveFocus());
			await expect(output()).toBe("#f59e0b");
		});

		await step("add a second color and open its picker", async () => {
			await userEvent.click(canvas.getByRole("button", { name: "Add color" }));
			const dialog = await screen.findByRole("dialog", {
				name: "Secondary theme color",
			});
			await waitFor(() => expect(output().split(" ")).toHaveLength(2));
			await expect(
				canvas.queryByRole("button", { name: "Add color" }),
			).not.toBeInTheDocument();
			await userEvent.click(
				within(dialog).getByRole("button", { name: "#10b981" }),
			);
			await waitFor(() => expect(output()).toBe("#f59e0b #10b981"));
			await userEvent.keyboard("{Escape}");
			await waitFor(() =>
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
			);
		});
	},
};

export const ToggleClosesOnTrigger: Story = {
	args: { label: "Color", value: "#bd0249", onChange: fn() },
	render: () => {
		const [color, setColor] = createSignal("#bd0249");
		return (
			<ColorPicker
				variant="row"
				label="Color"
				value={color()}
				onChange={setColor}
				presets={ROLE_PRESETS}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const row = canvas.getByRole("button", { name: /Color/ });
		await userEvent.click(row);
		await screen.findByRole("dialog", { name: "Color" });
		await userEvent.click(row);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const RoleColor: Story = {
	args: { label: "Color", value: "#bd0249", onChange: fn() },
	render: () => {
		const [color, setColor] = createSignal("#bd0249");
		return (
			<ColorPicker
				variant="row"
				label="Color"
				value={color()}
				onChange={setColor}
				presets={ROLE_PRESETS}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const row = canvas.getByRole("button", { name: /Color/ });
		await expect(row).toHaveTextContent("#bd0249");
		await userEvent.click(row);
		const dialog = await screen.findByRole("dialog", { name: "Color" });
		await userEvent.click(
			within(dialog).getByRole("button", { name: "#06b6d4" }),
		);
		await waitFor(() => expect(row).toHaveTextContent("#06b6d4"));
	},
};

export const MobileDrawer: Story = {
	args: { label: "Color", value: "#bd0249", onChange: fn() },
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => {
		const [color, setColor] = createSignal("#bd0249");
		return (
			<ColorPicker
				platform="mobile"
				variant="row"
				label="Color"
				value={color()}
				onChange={setColor}
				presets={ROLE_PRESETS}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: /Color/ }));
		const dialog = await screen.findByRole("dialog");
		await expect(
			within(dialog).getByRole("textbox", { name: "Hex color" }),
		).toBeVisible();
	},
};
