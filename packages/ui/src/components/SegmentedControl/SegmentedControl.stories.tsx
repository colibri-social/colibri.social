import { createSignal } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { SegmentedControl } from "./SegmentedControl";

const meta = {
	title: "Primitives/Segmented control",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const options = [
	{ value: "trending", label: "Trending" },
	{ value: "favorites", label: "Favorites" },
	{ value: "categories", label: "Categories" },
];

const onChange = fn();

export const Basic: Story = {
	render: () => {
		const [value, setValue] = createSignal("trending");
		return (
			<div class="flex w-80 flex-col gap-4 bg-popover p-4">
				<SegmentedControl
					aria-label="GIF tabs"
					options={options}
					value={value()}
					onChange={(next) => {
						onChange(next);
						setValue(next);
					}}
				/>
				<SegmentedControl
					aria-label="Small"
					size="sm"
					options={options}
					defaultValue="favorites"
				/>
				<SegmentedControl
					aria-label="Disabled"
					disabled
					options={options}
					defaultValue="trending"
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const group = canvas.getByRole("radiogroup", { name: "GIF tabs" });
		const favorites = within(group).getByRole("radio", { name: "Favorites" });
		await userEvent.click(favorites);
		await expect(onChange).toHaveBeenCalledWith("favorites");
		await expect(favorites).toBeChecked();
		const indicator = group.querySelector<HTMLElement>("[role=presentation]");
		const item = favorites.parentElement;
		await waitFor(() =>
			expect(indicator?.style.width).toBe(`${item?.offsetWidth}px`),
		);
		await userEvent.keyboard("{ArrowRight}");
		await expect(onChange).toHaveBeenLastCalledWith("categories");
	},
};
