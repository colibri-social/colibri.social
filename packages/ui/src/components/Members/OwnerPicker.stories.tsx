import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { Checkbox } from "../Checkbox/Checkbox";
import type { MemberIdentityData } from "./MemberIdentity";
import { OwnerPicker } from "./OwnerPicker";

const meta = {
	title: "Surfaces/Ownership transfer",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const members: MemberIdentityData[] = [
	{ id: "did:plc:lou", name: "Lou", handle: "lou.gg", owner: true },
	{
		id: "did:plc:kris",
		name: "Kris",
		handle: "kris.kralsei.stream",
		presence: "online",
		role: {
			id: "mods",
			name: "Moderators",
			color: "#c4a7ff",
			badge: { kind: "icon", name: "shield-check", color: "#76c4e5" },
		},
	},
	{
		id: "did:plc:kim",
		name: "Kim",
		handle: "kim.example.com",
		avatarSrc: storyImages.tealIcon(),
	},
	{ id: "did:plc:bot", name: "Kitbot", handle: "kitbot.dev", bot: true },
	{ id: "did:plc:ana", name: "Ana", handle: "ana.bsky.social" },
];

const onTransfer = fn();

const TransferScreen = (props: { members?: MemberIdentityData[] }) => {
	const [owner, setOwner] = createSignal<string>();
	const [understood, setUnderstood] = createSignal(false);
	return (
		<div class="flex min-h-dvh flex-col gap-4 bg-popover p-4 text-foreground">
			<p class="m-0 rounded-control-lg border border-destructive bg-destructive/15 p-4 text-sm text-pretty text-muted-foreground">
				Transferring your ownership of this Space means losing all privileges
				associated with owning it. This can only be undone if the other member
				transfers the ownership back to you.
			</p>
			<OwnerPicker
				members={props.members ?? members}
				currentOwnerId="did:plc:lou"
				value={owner()}
				onChange={setOwner}
			/>
			<Checkbox
				label="I understand that this action can't be undone"
				checked={understood()}
				onChange={setUnderstood}
			/>
			<Button
				variant="destructive"
				block
				disabled={!owner() || !understood()}
				onClick={() => onTransfer(owner())}
			>
				Transfer ownership
			</Button>
		</div>
	);
};

const options = () => screen.queryAllByRole("option");

export const OwnershipTransfer: Story = {
	render: () => <TransferScreen />,
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole("combobox", { name: "New owner" });
		const transfer = canvas.getByRole("button", { name: "Transfer ownership" });
		await step("Results exclude the owner and bots", async () => {
			await userEvent.type(input, "k");
			await waitFor(() => expect(options().length).toBe(3));
			const names = options().map((option) => option.textContent);
			await expect(names.join(" ")).toContain("Kris");
			await expect(names.join(" ")).toContain("Kim");
			await expect(names.join(" ")).not.toContain("Kitbot");
			await userEvent.clear(input);
			await userEvent.type(input, "lou");
			await waitFor(() =>
				expect(
					document.querySelector("[data-owner-picker-empty]"),
				).toHaveTextContent('No members match "lou".'),
			);
		});
		await step("Keyboard picks a member by handle", async () => {
			await userEvent.clear(input);
			await userEvent.type(input, "@kim.ex");
			await waitFor(() => expect(options().length).toBe(1));
			await userEvent.keyboard("{ArrowDown}{Enter}");
			const selected = await waitFor(() => {
				const card = canvasElement.querySelector<HTMLElement>(
					"[data-owner-picker-selected]",
				);
				if (!card) throw new Error("no selection");
				return card;
			});
			await expect(selected.dataset.ownerPickerSelected).toBe("did:plc:kim");
			await expect(selected).toHaveTextContent("@kim.example.com");
			const avatar = selected.querySelector<HTMLElement>(
				"[data-member-identity] > *",
			) as HTMLElement;
			const cardBox = selected.getBoundingClientRect();
			const avatarBox = avatar.getBoundingClientRect();
			await expect(
				Math.abs(avatarBox.top - cardBox.top - (avatarBox.left - cardBox.left)),
			).toBeLessThanOrEqual(0.5);
			await expect(transfer).toBeDisabled();
		});
		await step("Consent enables the transfer", async () => {
			await userEvent.click(
				canvas.getByRole("checkbox", {
					name: "I understand that this action can't be undone",
				}),
			);
			await expect(transfer).toBeEnabled();
			await userEvent.click(transfer);
			await expect(onTransfer).toHaveBeenLastCalledWith("did:plc:kim");
		});
		await step("Change clears the pick and refocuses search", async () => {
			await userEvent.click(canvas.getByRole("button", { name: /^Change/ }));
			const search = await canvas.findByRole("combobox", { name: "New owner" });
			await waitFor(() => expect(search).toHaveFocus());
			await expect(transfer).toBeDisabled();
		});
	},
};

export const NoOneElse: Story = {
	render: () => <TransferScreen members={[members[0], members[3]]} />,
	play: async ({ canvasElement }) => {
		const input = within(canvasElement).getByRole("combobox", {
			name: "New owner",
		});
		await userEvent.type(input, "a");
		await waitFor(() =>
			expect(
				document.querySelector("[data-owner-picker-empty]"),
			).toHaveTextContent("There's no one else to transfer ownership to."),
		);
	},
};
