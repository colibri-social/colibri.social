import { AddIcon } from "@solar-icons/solid/bold/add";
import { For } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { CollapsingTitleLayout } from "./CollapsingTitleLayout";
import { NavHeader } from "./NavHeader";

const meta = {
	title: "Navigation/Header",
	component: NavHeader,
	parameters: { viewport: { defaultViewport: "iphone" } },
	args: {
		title: "Notifications",
		kind: "back",
		onNavigate: fn(),
	},
	argTypes: {
		kind: { control: "inline-radio", options: ["back", "close"] },
	},
} satisfies Meta<typeof NavHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Close: Story = {
	args: { kind: "close", title: "Settings" },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole("button", { name: "Close" });
		await userEvent.click(button);
		await expect(args.onNavigate).toHaveBeenCalledOnce();
		await expect(
			canvas.getByRole("heading", { level: 1, name: "Settings" }),
		).toBeInTheDocument();
	},
};

export const BackWithSave: Story = {
	args: {
		title: "Edit profile",
		action: { type: "text", label: "Save", onClick: fn() },
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Back" }));
		await expect(args.onNavigate).toHaveBeenCalledOnce();
		await userEvent.click(canvas.getByRole("button", { name: "Save" }));
		await expect(
			args.action?.type === "text" ? args.action.onClick : undefined,
		).toHaveBeenCalledOnce();
	},
};

export const BackWithDisabledCreate: Story = {
	args: {
		title: "New community",
		action: { type: "text", label: "Create", disabled: true, onClick: fn() },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("button", { name: "Create" })).toBeDisabled();
	},
};

export const BackWithSavingAction: Story = {
	args: {
		title: "Edit profile",
		action: { type: "text", label: "Save", loading: true },
	},
};

export const BackWithIconAction: Story = {
	args: {
		title: "Channels",
		action: {
			type: "icon",
			label: "Add channel",
			icon: <AddIcon />,
			onClick: fn(),
		},
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Add channel" }));
		await expect(args.action?.onClick).toHaveBeenCalledOnce();
	},
};

export const LongTitle: Story = {
	args: {
		title:
			"Notification preferences for the Colibri design and engineering community",
		action: { type: "text", label: "Save" },
	},
	play: async ({ canvasElement }) => {
		const heading = within(canvasElement).getByRole("heading", { level: 1 });
		await expect(heading.scrollWidth).toBeGreaterThan(heading.clientWidth);
	},
};

const inboxItems = Array.from({ length: 30 }, (_, index) => ({
	id: index,
	title: `Mention in #general ${index + 1}`,
	body: "Hey, could you take a look at the latest build when you have a minute?",
}));

export const CollapsingInbox: Story = {
	render: () => (
		<div class="h-[700px] overflow-hidden">
			<CollapsingTitleLayout
				title="Inbox"
				actions={
					<button
						type="button"
						class="text-sm font-semibold text-primary-highlight"
					>
						Mark all read
					</button>
				}
			>
				<ul class="m-0 flex list-none flex-col gap-2 p-0">
					<For each={inboxItems}>
						{(item) => (
							<li class="flex flex-col gap-1 rounded-surface bg-popover p-3">
								<span class="text-sm font-semibold">{item.title}</span>
								<span class="text-sm text-muted-foreground">{item.body}</span>
							</li>
						)}
					</For>
				</ul>
			</CollapsingTitleLayout>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getAllByRole("heading", { level: 1, name: "Inbox" }),
		).toHaveLength(1);
		await expect(canvas.getAllByText("Inbox")).toHaveLength(1);
		const root = canvasElement.querySelector<HTMLElement>(
			"[data-collapsing-scroller]",
		)?.parentElement;
		const scroller = root?.firstElementChild;
		if (!root || !(scroller instanceof HTMLElement)) {
			throw new Error("Collapsing layout did not render");
		}
		const progress = () => root.style.getPropertyValue("--collapse-progress");
		await expect(root).not.toHaveAttribute("data-collapsed");
		await expect(progress()).toBe("0");
		scroller.scrollTop = 200;
		await waitFor(() => expect(root).toHaveAttribute("data-collapsed"));
		await expect(progress()).toBe("1");
		scroller.scrollTop = 0;
		await waitFor(() => expect(root).not.toHaveAttribute("data-collapsed"));
		await expect(progress()).toBe("0");
	},
};
