import { createSignal, For } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { TextField } from "../TextField/TextField";
import {
	UNSAVED_CHANGES_TEXT,
	UnsavedChangesBar,
	type UnsavedChangesBarPlatform,
} from "./UnsavedChangesBar";

const meta = {
	title: "Settings/Unsaved changes bar",
	component: UnsavedChangesBar,
} satisfies Meta<typeof UnsavedChangesBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const FIELDS = ["Name", "Pronouns", "Website", "Location", "Bio", "Team"];

const SettingsForm = (props: { platform: UnsavedChangesBarPlatform }) => {
	const [saved, setSaved] = createSignal("Colibri");
	const [name, setName] = createSignal(saved());
	const [saving, setSaving] = createSignal(false);
	const [attention, setAttention] = createSignal(0);
	const dirty = () => name() !== saved();
	const save = async () => {
		setSaving(true);
		await new Promise((resolve) => setTimeout(resolve, 300));
		setSaved(name());
		setSaving(false);
		setAttention(0);
	};
	const cancel = () => {
		setName(saved());
		setAttention(0);
	};
	return (
		<div
			data-story-scroll=""
			class="h-[420px] w-full max-w-[640px] overflow-y-auto rounded-surface border border-border bg-popover p-4"
		>
			<div class="flex min-h-full flex-col gap-6">
				<TextField label="Name" value={name()} onChange={setName} />
				<For each={FIELDS.slice(1)}>
					{(label) => <TextField label={label} value="" />}
				</For>
				<Button
					variant="secondary"
					data-attempt-leave=""
					onClick={() => {
						if (dirty()) setAttention((count) => count + 1);
					}}
				>
					Try to leave
				</Button>
				<UnsavedChangesBar
					platform={props.platform}
					visible={dirty() || saving()}
					saving={saving()}
					attention={attention()}
					onCancel={cancel}
					onSave={() => void save()}
				/>
			</div>
		</div>
	);
};

const bar = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-unsaved-changes-bar]");

const scroller = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-story-scroll]") as HTMLElement;

const overlaps = (a: DOMRect, b: DOMRect) =>
	a.bottom > b.top + 0.5 && a.top < b.bottom - 0.5;

const playForm = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	expect(bar(canvasElement)?.dataset.visible).toBeUndefined();
	expect(bar(canvasElement)?.hasAttribute("inert")).toBe(true);
	expect(canvas.queryByText(UNSAVED_CHANGES_TEXT)).toBeNull();

	const name = canvas.getByLabelText("Name");
	await userEvent.clear(name);
	await userEvent.type(name, "Colibri HQ");
	await waitFor(() =>
		expect(bar(canvasElement)?.dataset.visible).toBeDefined(),
	);
	expect(canvas.getByText(UNSAVED_CHANGES_TEXT)).toBeVisible();

	await userEvent.click(canvas.getByRole("button", { name: "Try to leave" }));
	await waitFor(() =>
		expect(bar(canvasElement)?.dataset.attention).toBeDefined(),
	);

	await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
	await waitFor(() =>
		expect(bar(canvasElement)?.dataset.visible).toBeUndefined(),
	);
	expect(name).toHaveValue("Colibri");

	await userEvent.type(name, " Social");
	await waitFor(() =>
		expect(bar(canvasElement)?.dataset.visible).toBeDefined(),
	);
	await userEvent.click(canvas.getByRole("button", { name: "Save" }));
	await waitFor(() =>
		expect(bar(canvasElement)?.dataset.visible).toBeUndefined(),
	);
	expect(name).toHaveValue("Colibri Social");

	await userEvent.type(name, "!");
	await waitFor(() =>
		expect(bar(canvasElement)?.dataset.visible).toBeDefined(),
	);
	const scroll = scroller(canvasElement);
	scroll.scrollTop = scroll.scrollHeight;
	await waitFor(() => {
		const last = canvas
			.getByRole("button", { name: "Try to leave" })
			.getBoundingClientRect();
		const card = bar(canvasElement)?.getBoundingClientRect();
		expect(card).toBeDefined();
		expect(overlaps(last, card as DOMRect)).toBe(false);
	});
	await expectNoLayoutIssues(scroll);
};

export const Desktop: Story = {
	args: { visible: true, onCancel: () => {}, onSave: () => {} },
	render: () => <SettingsForm platform="desktop" />,
	play: async ({ canvasElement }) => playForm(canvasElement),
};

export const Mobile: Story = {
	args: { visible: true, onCancel: () => {}, onSave: () => {} },
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <SettingsForm platform="mobile" />,
	play: async ({ canvasElement }) => playForm(canvasElement),
};

export const Saving: Story = {
	args: {
		visible: true,
		saving: true,
		onCancel: () => {},
		onSave: () => {},
	},
	render: (args) => (
		<div class="flex h-40 w-full max-w-[640px] flex-col">
			<UnsavedChangesBar {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByRole("button", { name: "Save" })).toHaveAttribute(
			"aria-busy",
			"true",
		);
		expect(canvas.getByRole("button", { name: "Cancel" })).toBeDisabled();
		await expectNoLayoutIssues(canvasElement);
	},
};
