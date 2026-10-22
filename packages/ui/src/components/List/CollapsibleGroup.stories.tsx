import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { HashtagIcon } from "@solar-icons/solid/bold/hashtag";
import { createSignal, For } from "solid-js";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { CollapsibleGroup } from "./CollapsibleGroup";
import { CheckboxRow, ListGroup, NavRow } from "./List";

const meta = {
	title: "Navigation/Collapsible group",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const GROUPS = [
	{
		name: "general",
		hint: "this channel",
		threads: [
			{ name: "Release prep", age: "2m" },
			{ name: "Icon review", age: "1h" },
		],
	},
	{
		name: "design-system-and-component-library-discussions",
		threads: [
			{ name: "Tokens", age: "3h" },
			{ name: "Spacing scale", age: "1d" },
			{ name: "A very long thread name that keeps going and going", age: "2w" },
			{ name: "Dark mode", age: "3w" },
		],
	},
	{ name: "random", threads: [] },
];

const onSelect = fn();

export const ChannelsWithThreads: Story = {
	render: () => {
		const [open, setOpen] = createSignal<ReadonlySet<string>>(
			new Set(["general"]),
		);
		const toggle = (name: string, expanded: boolean) =>
			setOpen((current) => {
				const next = new Set(current);
				if (expanded) next.add(name);
				else next.delete(name);
				return next;
			});
		return (
			<div data-testid="groups" class="w-full max-w-sm">
				<ListGroup>
					<For each={GROUPS}>
						{(group) => (
							<CollapsibleGroup
								icon={<HashtagIcon />}
								label={group.name}
								hint={group.hint}
								count={group.threads.length}
								expanded={open().has(group.name)}
								onExpandedChange={(expanded) => toggle(group.name, expanded)}
								onSelect={group.hint ? undefined : () => onSelect(group.name)}
								toggleLabel={`Threads in #${group.name}`}
							>
								<NavRow
									class="pl-9"
									icon={<AddCircleIcon />}
									label={`New thread in #${group.name}`}
									chevron={false}
								/>
								<For each={group.threads}>
									{(thread) => (
										<NavRow
											class="pl-9"
											icon={<ChatRoundDotsIcon />}
											label={thread.name}
											value={thread.age}
											chevron={false}
										/>
									)}
								</For>
							</CollapsibleGroup>
						)}
					</For>
				</ListGroup>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		onSelect.mockClear();
		const canvas = within(canvasElement);
		const root = canvas.getByTestId("groups");
		await expect(canvas.getByText("Release prep")).toBeVisible();
		await expect(canvas.queryByText("Tokens")).toBeNull();

		const designToggle = canvas.getByRole("button", {
			name: "Threads in #design-system-and-component-library-discussions",
		});
		await expect(designToggle).toHaveAttribute("aria-expanded", "false");
		await userEvent.click(designToggle);
		await expect(designToggle).toHaveAttribute("aria-expanded", "true");
		await expect(canvas.getByText("Tokens")).toBeVisible();
		await expectNoLayoutIssues(root);

		await userEvent.click(
			canvas
				.getByText("design-system-and-component-library-discussions")
				.closest("button") as HTMLElement,
		);
		await expect(onSelect).toHaveBeenCalledWith(
			"design-system-and-component-library-discussions",
		);

		const general = canvas.getByText("general").closest("button");
		await expect(general).toHaveAttribute("aria-expanded", "true");
		await userEvent.click(general as HTMLElement);
		await expect(canvas.queryByText("Release prep")).toBeNull();
		await expect(onSelect).toHaveBeenCalledTimes(1);
	},
};

export const Selectable: Story = {
	render: () => {
		const [open, setOpen] = createSignal(true);
		const [picked, setPicked] = createSignal<ReadonlySet<string>>(new Set());
		const pick = (key: string, checked: boolean) =>
			setPicked((current) => {
				const next = new Set(current);
				if (checked) next.add(key);
				else next.delete(key);
				return next;
			});
		const group = GROUPS[1] as (typeof GROUPS)[number];
		return (
			<div data-testid="selectable" class="w-full max-w-sm">
				<ListGroup>
					<CollapsibleGroup
						icon={<HashtagIcon />}
						label={group.name}
						count={group.threads.length}
						expanded={open()}
						onExpandedChange={setOpen}
						checked={picked().has(group.name)}
						onSelect={() => pick(group.name, !picked().has(group.name))}
						toggleLabel={`Threads in #${group.name}`}
					>
						<For each={group.threads}>
							{(thread) => (
								<CheckboxRow
									class="min-w-0 gap-2 pl-9"
									value={thread.name}
									leading={
										<span
											aria-hidden="true"
											class="flex size-6 items-center justify-center [&>svg]:size-6"
										>
											<ChatRoundDotsIcon />
										</span>
									}
									label={
										<span class="block min-w-0 truncate">{thread.name}</span>
									}
									description={thread.age}
									checked={picked().has(thread.name)}
									onChange={(checked) => pick(thread.name, checked)}
								/>
							)}
						</For>
					</CollapsibleGroup>
				</ListGroup>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const root = canvas.getByTestId("selectable");
		const channel = canvas.getByRole("button", {
			name: "design-system-and-component-library-discussions",
		});
		await expect(channel).toHaveAttribute("aria-pressed", "false");
		await userEvent.click(channel);
		await expect(channel).toHaveAttribute("aria-pressed", "true");
		await expect(canvas.getByText("Tokens")).toBeVisible();
		await userEvent.click(canvas.getByText("Tokens"));
		await expect(
			canvas.getByRole("checkbox", { name: /Tokens/ }),
		).toBeChecked();
		await expectNoLayoutIssues(root);
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Threads in #design-system-and-component-library-discussions",
			}),
		);
		await expect(canvas.queryByText("Tokens")).toBeNull();
		await expect(channel).toHaveAttribute("aria-pressed", "true");
	},
};
