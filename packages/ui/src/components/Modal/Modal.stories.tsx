import { AccessibilityIcon } from "@solar-icons/solid/bold/accessibility";
import { BellIcon } from "@solar-icons/solid/bold/bell";
import { PaletteIcon } from "@solar-icons/solid/bold/palette";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { UserIdIcon } from "@solar-icons/solid/bold/user-id";
import { createSignal, For, type JSX } from "solid-js";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../Button/Button";
import { TextField } from "../TextField/TextField";
import { LargeModalContent, Modal, ModalContent, ModalTrigger } from "./Modal";

const meta = {
	title: "Overlays/Modal",
	component: Modal,
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {
	render: () => (
		<Modal>
			<ModalTrigger as={Button}>Open modal</ModalTrigger>
			<ModalContent title="Modal title" footer={<Button>Button</Button>} />
		</Modal>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open modal" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Modal title" });
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Close" }),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const SmallOnMobile: Story = {
	...Small,
	parameters: { viewport: { defaultViewport: "iphone" } },
	play: undefined,
};

export const ShortForm: Story = {
	render: () => (
		<Modal>
			<ModalTrigger as={Button}>Set status</ModalTrigger>
			<ModalContent title="Set your status" footer={<Button>Save</Button>}>
				<TextField
					label="Status"
					placeholder="What are you up to?"
					defaultValue="Building a nest!"
					leading={<SmileCircleIcon />}
				/>
			</ModalContent>
		</Modal>
	),
};

export const Confirmation: Story = {
	render: () => (
		<Modal>
			<ModalTrigger as={Button} variant="destructive">
				Delete space
			</ModalTrigger>
			<ModalContent
				title="Delete Awesome Space?"
				description="Everything in this Space is removed for every member. This cannot be undone."
				footer={
					<>
						<Button variant="secondary">Cancel</Button>
						<Button variant="destructive">Delete space</Button>
					</>
				}
			/>
		</Modal>
	),
};

const sections: {
	title: string;
	items: { icon: JSX.Element; label: string }[];
}[] = [
	{ title: "Account", items: [{ icon: <UserIdIcon />, label: "Profile" }] },
	{
		title: "App settings",
		items: [
			{ icon: <PaletteIcon />, label: "Appearance" },
			{ icon: <AccessibilityIcon />, label: "Accessibility" },
			{ icon: <BellIcon />, label: "Notifications" },
		],
	},
];

const SettingsSidebar = (props: {
	active: string;
	onSelect: (label: string) => void;
}) => (
	<For each={sections}>
		{(section) => (
			<div class="flex flex-col gap-2">
				<p class="text-sm font-medium text-muted-foreground">{section.title}</p>
				<For each={section.items}>
					{(item) => (
						<button
							type="button"
							onClick={() => props.onSelect(item.label)}
							aria-current={props.active === item.label ? "page" : undefined}
							class="flex h-8 items-center gap-2 rounded-control-sm pr-3 pl-1.5 text-left text-sm font-semibold text-muted-foreground hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-foreground [&>svg]:size-6"
						>
							{item.icon}
							{item.label}
						</button>
					)}
				</For>
			</div>
		)}
	</For>
);

export const Large: Story = {
	render: () => {
		const [active, setActive] = createSignal("Profile");
		return (
			<Modal>
				<ModalTrigger as={Button}>Open settings</ModalTrigger>
				<LargeModalContent
					title={active()}
					sidebar={<SettingsSidebar active={active()} onSelect={setActive} />}
				>
					<p class="text-sm text-muted-foreground">
						{active()} settings go here.
					</p>
				</LargeModalContent>
			</Modal>
		);
	},
};
