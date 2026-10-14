import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { CategoryDrawer } from "./CategoryDrawer";

const meta = {
	title: "Navigation/Category drawer",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const spy = {
	markRead: fn(),
	edit: fn(),
	create: fn(),
};

const Demo = (props: { name: string; manage: boolean }) => {
	const [open, setOpen] = createSignal(false);
	const [muted, setMuted] = createSignal(false);
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Hold category
			</Button>
			<CategoryDrawer
				open={open()}
				onOpenChange={setOpen}
				name={props.name}
				onMarkAsRead={spy.markRead}
				muted={muted()}
				onMutedChange={setMuted}
				onEdit={props.manage ? spy.edit : undefined}
				onCreateChannel={props.manage ? spy.create : undefined}
				developerMode={props.manage}
				developer={{
					copyLabel: "Copy AT-URI",
					copyValue:
						"at://did:plc:colibrisocialflock/social.colibri.beta.category/3kcommunity",
				}}
			/>
		</div>
	);
};

const openDrawer = async (canvasElement: HTMLElement, name: string) => {
	await waitFor(() =>
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
	);
	await waitFor(() =>
		expect(getComputedStyle(document.body).pointerEvents).not.toBe("none"),
	);
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Hold category" }),
	);
	const dialog = await screen.findByRole("dialog", { name: `${name} options` });
	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 400));
	return dialog;
};

export const Manager: Story = {
	render: () => <Demo name="Community" manage />,
	play: async ({ canvasElement }) => {
		spy.edit.mockClear();
		const dialog = await openDrawer(canvasElement, "Community");
		await expectNoLayoutIssues(dialog);
		const groups = Array.from(dialog.querySelectorAll("section")).map((group) =>
			Array.from(group.querySelectorAll("button")).map((button) =>
				button.textContent?.trim(),
			),
		);
		await expect(groups.slice(0, 2)).toEqual([
			["Mark as read", "Mute category"],
			["Edit category", "Create channel"],
		]);
		for (const row of groups.slice(0, 2).flat()) {
			const button = within(dialog).getByRole("button", { name: row });
			await expect(button.querySelectorAll("svg").length).toBe(1);
		}
		await expect(
			within(dialog).queryByRole("button", { name: "Delete category" }),
		).toBeNull();
		await expect(within(dialog).getByText("Developer mode")).toBeVisible();
		await expect(
			within(dialog).getByRole("link", { name: "Show on PDSls" }),
		).toHaveAttribute(
			"href",
			"https://pdsls.dev/at://did:plc:colibrisocialflock/social.colibri.beta.category/3kcommunity",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Edit category" }),
		);
		await expect(spy.edit).toHaveBeenCalledOnce();
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const Member: Story = {
	render: () => (
		<Demo
			name="Archived projects from the spring and summer seasons of last year"
			manage={false}
		/>
	),
	play: async ({ canvasElement }) => {
		const dialog = await openDrawer(
			canvasElement,
			"Archived projects from the spring and summer seasons of last year",
		);
		await expectNoLayoutIssues(dialog);
		await expect(
			within(dialog).queryByRole("button", { name: "Edit category" }),
		).toBeNull();
		await expect(
			within(dialog).queryByRole("button", { name: "Create channel" }),
		).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Mute category" }),
		);
		const reopened = await openDrawer(
			canvasElement,
			"Archived projects from the spring and summer seasons of last year",
		);
		await expect(
			within(reopened).getByRole("button", { name: "Unmute category" }),
		).toBeVisible();
	},
};
