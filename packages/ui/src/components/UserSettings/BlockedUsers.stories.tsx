import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { BLOCK_USER_COPY, BlockUserDialog } from "../Members/BlockUserDialog";
import { LargeModalContent, Modal } from "../Modal/Modal";
import {
	BLOCKED_USERS_COPY,
	type BlockedUser,
	BlockedUsers,
} from "./BlockedUsers";

const meta = {
	title: "Settings/Blocked users",
	component: BlockedUsers,
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta<typeof BlockedUsers>;

export default meta;
type Story = StoryObj<typeof meta>;

const LONG_NAME =
	"Bartholomew Featherstonehaugh-Montgomery of the Very Long Display Name";
const LONG_HANDLE = "bartholomew.featherstonehaugh-montgomery.example.social";

const USERS: BlockedUser[] = [
	{
		id: "did:plc:kris",
		name: "Kris",
		handle: "kris.bsky.social",
		detail: "Blocked 2 days ago",
	},
	{
		id: "did:plc:bartholomew",
		name: LONG_NAME,
		handle: LONG_HANDLE,
		detail: "Blocked 3 weeks ago",
	},
	{
		id: "did:plc:robin",
		name: "Robin",
		handle: "robin.example.com",
		detail: "Blocked on 12 Aug 2026",
	},
];

const unblocked = fn();

const Page = (props: { children: unknown }) => (
	<div data-story-page="" class="min-h-dvh bg-background p-4 text-foreground">
		{props.children as never}
	</div>
);

const pageRoot = (canvasElement: HTMLElement) => {
	return canvasElement.querySelector("[data-story-page]") as HTMLElement;
};

const BlockedUsersDemo = () => {
	const [users, setUsers] = createSignal(USERS);

	const unblock = (id: string) => {
		unblocked(id);
		setUsers((current) =>
			current.map((user) =>
				user.id === id ? { ...user, unblocking: true } : user,
			),
		);
		setTimeout(() => {
			setUsers((current) => current.filter((user) => user.id !== id));
		}, 600);
	};

	return <BlockedUsers users={users()} onUnblock={unblock} />;
};

export const List: Story = {
	args: { users: USERS, onUnblock: () => {} },
	render: () => (
		<Page>
			<BlockedUsersDemo />
		</Page>
	),
	play: async ({ canvasElement }) => {
		unblocked.mockClear();
		const canvas = within(canvasElement);
		await expect(canvas.getByText(BLOCKED_USERS_COPY.intro)).toBeVisible();
		await expectNoLayoutIssues(pageRoot(canvasElement));
		await userEvent.click(
			canvas.getByRole("button", {
				name: BLOCKED_USERS_COPY.unblockLabel("Kris"),
			}),
		);
		await expect(unblocked).toHaveBeenCalledWith("did:plc:kris");
		await waitFor(() =>
			expect(
				canvas.queryByRole("button", {
					name: BLOCKED_USERS_COPY.unblockLabel("Kris"),
				}),
			).not.toBeInTheDocument(),
		);
		await expectNoLayoutIssues(pageRoot(canvasElement));
	},
};

export const Unblocking: Story = {
	args: {
		users: USERS.map((user, index) => ({ ...user, unblocking: index === 0 })),
		onUnblock: () => {},
	},
	render: (args) => (
		<Page>
			<BlockedUsers {...args} />
		</Page>
	),
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole("button", {
			name: BLOCKED_USERS_COPY.unblockLabel("Kris"),
		});
		await expect(button).toBeDisabled();
		await expectNoLayoutIssues(pageRoot(canvasElement));
	},
};

export const Empty: Story = {
	args: { users: [], onUnblock: () => {} },
	render: (args) => (
		<Page>
			<BlockedUsers {...args} />
		</Page>
	),
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(BLOCKED_USERS_COPY.empty),
		).toBeVisible();
		await expectNoLayoutIssues(pageRoot(canvasElement));
	},
};

export const InSettingsModal: Story = {
	args: { users: USERS, onUnblock: () => {} },
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: () => (
		<Modal defaultOpen>
			<LargeModalContent title={BLOCKED_USERS_COPY.title}>
				<BlockedUsersDemo />
			</LargeModalContent>
		</Modal>
	),
	play: async () => {
		const dialog = await screen.findByRole("dialog");
		await waitFor(() =>
			expect(within(dialog).getByText(BLOCKED_USERS_COPY.intro)).toBeVisible(),
		);
		await expectNoLayoutIssues(dialog);
	},
};

const confirmed = fn();

const BlockDialogDemo = (props: { name: string }) => {
	const [open, setOpen] = createSignal(true);
	return (
		<Page>
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Block someone
			</Button>
			<BlockUserDialog
				open={open()}
				onOpenChange={setOpen}
				name={props.name}
				onConfirm={async () => {
					confirmed(props.name);
					await new Promise((resolve) => setTimeout(resolve, 400));
				}}
			/>
		</Page>
	);
};

const playBlockDialog = async (name: string) => {
	confirmed.mockClear();
	const dialog = await screen.findByRole("dialog", {
		name: BLOCK_USER_COPY.title(name),
	});
	await waitFor(() =>
		expect(within(dialog).getByText(BLOCK_USER_COPY.description)).toBeVisible(),
	);
	await expectNoLayoutIssues(dialog);
	const confirm = within(dialog).getByRole("button", {
		name: BLOCK_USER_COPY.confirm,
	});
	await expect(document.activeElement).toBe(confirm);
	await userEvent.click(confirm);
	await expect(confirmed).toHaveBeenCalledWith(name);
	await waitFor(() =>
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
	);
};

export const BlockConfirmMobile: Story = {
	args: { users: [], onUnblock: () => {} },
	render: () => <BlockDialogDemo name="Kris" />,
	play: async () => {
		await playBlockDialog("Kris");
	},
};

export const BlockConfirmDesktop: Story = {
	...BlockConfirmMobile,
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: () => <BlockDialogDemo name={LONG_NAME} />,
	play: async () => {
		await playBlockDialog(LONG_NAME);
	},
};
