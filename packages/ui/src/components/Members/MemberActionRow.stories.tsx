import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CloseCircleIcon } from "@solar-icons/solid/bold/close-circle";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { inviteMenuEntries } from "../ContextMenu/InviteMenu";
import { MenuDrawer } from "../DropdownMenu/DropdownMenu";
import { IconButton } from "../IconButton/IconButton";
import { ListGroup } from "../List/List";
import { MemberActionRow } from "./MemberActionRow";

const meta = {
	title: "Navigation/Member action row",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const approve = fn();
const dismiss = fn();
const unban = fn();

const LONG_NAME =
	"Bartholomew Featherstonehaugh-Montgomery of the Very Long Display Name";
const LONG_HANDLE = "bartholomew.featherstonehaugh-montgomery.example.social";

export const JoinRequests: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col gap-6 bg-background p-4">
			<ListGroup label="Pending" count={2}>
				<MemberActionRow
					member={{
						id: "did:plc:a",
						name: "Ana Torres",
						handle: "ana.bsky.social",
					}}
					detail="Requested 2 hours ago"
					stackDetail
					actions={
						<>
							<IconButton
								variant="ghost"
								label="Approve Ana Torres"
								icon={<CheckCircleIcon />}
								onClick={approve}
							/>
							<IconButton
								variant="ghost"
								label="Dismiss Ana Torres"
								icon={<CloseCircleIcon />}
								onClick={dismiss}
							/>
						</>
					}
				/>
				<MemberActionRow
					member={{ id: "did:plc:b", name: LONG_NAME, handle: LONG_HANDLE }}
					detail="Requested 3 days ago"
					stackDetail
					actions={
						<>
							<IconButton
								variant="ghost"
								label={`Approve ${LONG_NAME}`}
								icon={<CheckCircleIcon />}
							/>
							<IconButton
								variant="ghost"
								label={`Dismiss ${LONG_NAME}`}
								icon={<CloseCircleIcon />}
							/>
						</>
					}
				/>
			</ListGroup>
		</div>
	),
	play: async ({ canvasElement }) => {
		approve.mockClear();
		dismiss.mockClear();
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Approve Ana Torres" }),
		);
		await expect(approve).toHaveBeenCalledOnce();
		await userEvent.click(
			canvas.getByRole("button", { name: "Dismiss Ana Torres" }),
		);
		await expect(dismiss).toHaveBeenCalledOnce();
		const handles = canvasElement.querySelectorAll<HTMLElement>(
			"[data-member-action-handle]",
		);
		const details = canvasElement.querySelectorAll<HTMLElement>(
			"[data-member-action-detail]",
		);
		await expect(handles).toHaveLength(2);
		await expect(details).toHaveLength(2);
		for (const [index, handle] of [...handles].entries()) {
			const detail = details[index] as HTMLElement;
			await expect(handle.scrollWidth).toBeLessThanOrEqual(handle.clientWidth);
			await expect(detail.scrollWidth).toBeLessThanOrEqual(detail.clientWidth);
			await expect(detail.getBoundingClientRect().top).toBeGreaterThanOrEqual(
				handle.getBoundingClientRect().bottom - 1,
			);
		}
		await expect(handles[1]?.textContent).toContain(LONG_HANDLE);
		await expectNoLayoutIssues(canvasElement);
	},
};

export const BanWithReason: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col gap-6 bg-background p-4">
			<ListGroup label="Banned" count={1}>
				<MemberActionRow
					member={{ id: "did:plc:c", name: LONG_NAME, handle: LONG_HANDLE }}
					detail="Banned 3 days ago by @lou"
					note="Posted scam links in #general, then kept reposting them from a second account after the first warning."
					actions={
						<Button variant="secondary" onClick={unban}>
							Unban
						</Button>
					}
				/>
			</ListGroup>
		</div>
	),
	play: async ({ canvasElement }) => {
		unban.mockClear();
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Unban" }));
		await expect(unban).toHaveBeenCalledOnce();
		await expectNoLayoutIssues(canvasElement);
	},
};

const copy = fn();
const remove = fn();

export const InviteMenuDrawer: Story = {
	render: () => {
		const [open, setOpen] = createSignal(false);
		return (
			<div class="flex min-h-dvh flex-col gap-4 bg-background p-4">
				<Button icon={<LinkIcon />} onClick={() => setOpen(true)}>
					Invite options
				</Button>
				<MenuDrawer
					open={open()}
					onOpenChange={setOpen}
					label="Invite colibri-hq options"
					items={inviteMenuEntries({ onCopyLink: copy, onDelete: remove })}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		copy.mockClear();
		remove.mockClear();
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Invite options" }),
		);
		const drawer = await screen.findByRole("dialog", {
			name: "Invite colibri-hq options",
		});
		await expectNoLayoutIssues(drawer);
		await userEvent.click(
			within(drawer).getByRole("button", { name: "Delete invite link" }),
		);
		await expect(remove).toHaveBeenCalledOnce();
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	},
};

const openMember = fn();

export const OpenableMembers: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col gap-6 bg-popover p-4">
			<ListGroup label="Members" count={2}>
				<MemberActionRow
					member={{
						id: "did:plc:mira",
						name: "Mira Okafor",
						handle: "mira.bsky.social",
						role: { name: "Moderator", color: "#57c7ff" },
					}}
					onOpen={() => openMember("mira")}
				/>
				<MemberActionRow
					member={{ id: "did:plc:long", name: LONG_NAME, handle: LONG_HANDLE }}
					onOpen={() => openMember("long")}
				/>
			</ListGroup>
		</div>
	),
	play: async ({ canvasElement }) => {
		openMember.mockClear();
		const canvas = within(canvasElement);
		await expectNoLayoutIssues(canvasElement);
		const row = canvas.getByRole("button", { name: /Mira Okafor/ });
		await expect(row.tagName).toBe("BUTTON");
		await userEvent.click(row);
		await expect(openMember).toHaveBeenCalledWith("mira");
	},
};
