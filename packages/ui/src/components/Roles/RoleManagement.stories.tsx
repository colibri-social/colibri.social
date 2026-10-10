import { createSignal } from "solid-js";
import {
	expect,
	fireEvent,
	fn,
	screen,
	userEvent,
	waitFor,
	within,
} from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { storyImages } from "../Banner/story-images";
import type { MemberIdentityData } from "../Members/MemberIdentity";
import { type SpaceRole, SpaceRoleList } from "./RoleList";
import { RoleMembers } from "./RoleMembers";
import { ROLE_PERMISSION_GROUPS, RolePermissionList } from "./RolePermissions";

const meta = {
	title: "Surfaces/Role management",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const spaceRoles: SpaceRole[] = [
	{ id: "owner", name: "Owner", color: "#ffd857", protected: true },
	{
		id: "mods",
		name: "Moderators",
		color: "#c4a7ff",
		badge: { kind: "icon", name: "shield-check", color: "#76c4e5" },
	},
	{ id: "artists", name: "Artists", color: "#ff7a90" },
	{ id: "helpers", name: "Helpers", color: "#4ade80" },
	{ id: "everyone", name: "Everyone", protected: true },
];

const onReorder = fn();

const RolesHarness = (props: { fail?: boolean }) => {
	const [roles, setRoles] = createSignal(spaceRoles);
	return (
		<div class="flex min-h-dvh flex-col gap-4 bg-popover p-4 text-foreground">
			<SpaceRoleList
				roles={roles()}
				onOpen={fn()}
				onReorder={async (ids) => {
					onReorder(ids);
					await new Promise((resolve) => setTimeout(resolve, 50));
					if (props.fail) throw new Error("rejected");
					const byId = new Map(roles().map((role) => [role.id, role]));
					setRoles(ids.map((id) => byId.get(id) as SpaceRole));
				}}
			/>
		</div>
	);
};

const sortableNames = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-sortable-item]")).map(
		(item) => item.textContent?.trim(),
	);

const viewNames = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-role-row]")).map((row) =>
		row.textContent?.trim(),
	);

const enterReorder = async (root: HTMLElement) => {
	await userEvent.click(within(root).getByRole("button", { name: "Reorder" }));
	await waitFor(() =>
		expect(root.querySelectorAll("[data-sortable-item]").length).toBe(3),
	);
};

const center = (element: Element) => {
	const box = element.getBoundingClientRect();
	return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

const drag = async (
	from: HTMLElement,
	to: HTMLElement,
	pointerType: "mouse" | "touch",
) => {
	const start = center(from);
	const end = center(to);
	await fireEvent.pointerDown(from, {
		pointerType,
		button: 0,
		clientX: start.x,
		clientY: start.y,
	});
	if (pointerType === "touch") {
		await new Promise((resolve) => setTimeout(resolve, 480));
	}
	const steps = 6;
	for (let step = 1; step <= steps; step++) {
		await fireEvent.pointerMove(document, {
			pointerType,
			clientX: start.x,
			clientY: start.y + ((end.y - start.y) * step) / steps,
		});
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}
	await fireEvent.pointerUp(document, {
		pointerType,
		clientX: end.x,
		clientY: end.y,
	});
};

export const Roles: Story = {
	render: () => <RolesHarness />,
	play: async ({ canvasElement }) => {
		await expect(viewNames(canvasElement)).toEqual([
			"Owner",
			"Moderators",
			"Artists",
			"Helpers",
			"Everyone",
		]);
		await expect(
			within(canvasElement).getByRole("button", { name: "Reorder" }),
		).toBeVisible();
	},
};

export const ReorderWithMouse: Story = {
	render: () => <RolesHarness />,
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		onReorder.mockClear();
		await enterReorder(canvasElement);
		await step("Protected roles stay fixed without a handle", async () => {
			const locked = canvasElement.querySelectorAll("[data-locked]");
			await expect(locked.length).toBe(2);
			for (const row of Array.from(locked)) {
				await expect(row.querySelector("[data-sortable-handle]")).toBeNull();
			}
			await expect(
				canvas.getByRole("button", { name: "Save order" }),
			).toBeDisabled();
		});
		await step("Dragging Moderators below Helpers reorders", async () => {
			const items = canvasElement.querySelectorAll<HTMLElement>(
				"[data-sortable-item]",
			);
			await drag(items[0], items[2], "mouse");
			await waitFor(() =>
				expect(sortableNames(canvasElement)).toEqual([
					"Artists",
					"Helpers",
					"Moderators",
				]),
			);
		});
		await step("Save sends the full order", async () => {
			await userEvent.click(canvas.getByRole("button", { name: "Save order" }));
			await waitFor(() =>
				expect(onReorder).toHaveBeenCalledWith([
					"owner",
					"artists",
					"helpers",
					"mods",
					"everyone",
				]),
			);
			await waitFor(() =>
				expect(canvasElement.querySelector("[data-sortable-item]")).toBeNull(),
			);
			await expect(viewNames(canvasElement)).toEqual([
				"Owner",
				"Artists",
				"Helpers",
				"Moderators",
				"Everyone",
			]);
		});
	},
};

export const ReorderWithTouchHold: Story = {
	render: () => <RolesHarness />,
	play: async ({ canvasElement }) => {
		await enterReorder(canvasElement);
		const items = canvasElement.querySelectorAll<HTMLElement>(
			"[data-sortable-item]",
		);
		const quick = center(items[2]);
		await fireEvent.pointerDown(items[2], {
			pointerType: "touch",
			button: 0,
			clientX: quick.x,
			clientY: quick.y,
		});
		await fireEvent.pointerMove(document, {
			pointerType: "touch",
			clientX: quick.x,
			clientY: quick.y - 40,
		});
		await fireEvent.pointerUp(document, { pointerType: "touch" });
		await expect(sortableNames(canvasElement)).toEqual([
			"Moderators",
			"Artists",
			"Helpers",
		]);
		await drag(items[2], items[0], "touch");
		await waitFor(() =>
			expect(sortableNames(canvasElement)).toEqual([
				"Helpers",
				"Moderators",
				"Artists",
			]),
		);
	},
};

export const ReorderWithKeyboard: Story = {
	render: () => <RolesHarness />,
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		await enterReorder(canvasElement);
		const status = () =>
			canvasElement.querySelector('[data-sortable-list] [role="status"]');
		await step("Space picks up, arrows move, Space drops", async () => {
			const handle = canvas.getByRole("button", { name: "Move Moderators" });
			handle.focus();
			await userEvent.keyboard(" ");
			await expect(handle).toHaveAttribute("aria-pressed", "true");
			await waitFor(() =>
				expect(status()).toHaveTextContent(
					"Picked up Moderators, position 1 of 3",
				),
			);
			await userEvent.keyboard("{ArrowDown}");
			await waitFor(() =>
				expect(sortableNames(canvasElement)).toEqual([
					"Artists",
					"Moderators",
					"Helpers",
				]),
			);
			await waitFor(() =>
				expect(document.activeElement).toBe(
					canvas.getByRole("button", { name: "Move Moderators" }),
				),
			);
			await expect(status()).toHaveTextContent(
				"Moderators moved to position 2 of 3",
			);
			await userEvent.keyboard("{ArrowDown}");
			await userEvent.keyboard(" ");
			await waitFor(() =>
				expect(status()).toHaveTextContent(
					"Moderators dropped at position 3 of 3",
				),
			);
			await expect(
				canvas.getByRole("button", { name: "Move Moderators" }),
			).toHaveAttribute("aria-pressed", "false");
		});
		await step("Escape cancels back to the start position", async () => {
			const handle = canvas.getByRole("button", { name: "Move Helpers" });
			handle.focus();
			await userEvent.keyboard(" ");
			await userEvent.keyboard("{ArrowUp}");
			await waitFor(() =>
				expect(sortableNames(canvasElement)).toEqual([
					"Helpers",
					"Artists",
					"Moderators",
				]),
			);
			await userEvent.keyboard("{Escape}");
			await waitFor(() =>
				expect(sortableNames(canvasElement)).toEqual([
					"Artists",
					"Helpers",
					"Moderators",
				]),
			);
			await expect(status()).toHaveTextContent("Reorder cancelled");
		});
		await step("Cancel discards the draft", async () => {
			await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
			await expect(viewNames(canvasElement)).toEqual([
				"Owner",
				"Moderators",
				"Artists",
				"Helpers",
				"Everyone",
			]);
		});
	},
};

export const ReorderSaveFails: Story = {
	render: () => <RolesHarness fail />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await enterReorder(canvasElement);
		const handle = canvas.getByRole("button", { name: "Move Helpers" });
		handle.focus();
		await userEvent.keyboard(" ");
		await userEvent.keyboard("{ArrowUp}");
		await userEvent.keyboard(" ");
		await userEvent.click(canvas.getByRole("button", { name: "Save order" }));
		const alert = await canvas.findByRole("alert", {}, { timeout: 3000 });
		await expect(alert).toHaveTextContent("couldn't be saved");
		await expect(sortableNames(canvasElement)).toEqual([
			"Moderators",
			"Helpers",
			"Artists",
		]);
	},
};

const onPermissions = fn();

export const Permissions: Story = {
	render: () => {
		const [value, setValue] = createSignal<string[]>(["channel.create"]);
		return (
			<div class="flex min-h-dvh flex-col bg-popover p-4 text-foreground">
				<RolePermissionList
					value={value()}
					onChange={(next) => {
						onPermissions(next);
						setValue(next);
					}}
					canGrant={(key) => key !== "community.delete"}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const groups = canvasElement.querySelectorAll("section");
		await expect(groups.length).toBe(ROLE_PERMISSION_GROUPS.length);
		await expect(
			canvasElement.querySelectorAll('[data-dangerous] [role="img"]').length,
		).toBe(5);
		await userEvent.click(canvas.getByRole("switch", { name: /Kick members/ }));
		await expect(onPermissions).toHaveBeenLastCalledWith([
			"channel.create",
			"member.kick",
		]);
		await userEvent.click(
			canvas.getByRole("switch", { name: /Create channels/ }),
		);
		await expect(onPermissions).toHaveBeenLastCalledWith(["member.kick"]);
		const blocked = canvas.getByRole("switch", { name: /Delete Space/ });
		await expect(blocked).toBeDisabled();
		await expect(canvasElement).toHaveTextContent(
			"You can't grant a permission you don't have.",
		);
	},
};

const people: MemberIdentityData[] = [
	{
		id: "did:plc:kris",
		name: "Kris",
		handle: "kris.kralsei.stream",
		presence: "online",
	},
	{
		id: "did:plc:tim",
		name: "Tim",
		handle: "timtinkers.online",
		avatarSrc: storyImages.tealIcon(),
		presence: "idle",
	},
	{ id: "did:plc:lou", name: "Lou", handle: "lou.gg", presence: "dnd" },
	{ id: "did:plc:ana", name: "Ana", handle: "ana.bsky.social" },
	{ id: "did:plc:juno", name: "Juno", handle: "juno.example.com" },
];

const onAdd = fn();
const onRemove = fn();

const MembersHarness = (props: { platform?: "desktop" | "mobile" }) => {
	const [ids, setIds] = createSignal(["did:plc:kris", "did:plc:tim"]);
	const members = () => people.filter((person) => ids().includes(person.id));
	return (
		<div class="flex min-h-dvh flex-col bg-popover p-4 text-foreground">
			<RoleMembers
				roleName="Moderators"
				members={members()}
				candidates={people}
				platform={props.platform}
				onRemove={async (member) => {
					onRemove(member.id);
					await new Promise((resolve) => setTimeout(resolve, 30));
					setIds((current) => current.filter((id) => id !== member.id));
				}}
				onAdd={async (added) => {
					onAdd(added);
					setIds((current) => [...current, ...added]);
				}}
			/>
		</div>
	);
};

const memberRows = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-role-member]")).map(
		(row) => row.dataset.roleMember,
	);

export const MembersDesktop: Story = {
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => <MembersHarness />,
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		onAdd.mockClear();
		await step("Remove takes a member out of the role", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: "Remove Tim from Moderators" }),
			);
			await waitFor(() =>
				expect(memberRows(canvasElement)).toEqual(["did:plc:kris"]),
			);
			await expect(onRemove).toHaveBeenLastCalledWith("did:plc:tim");
		});
		await step("The picker adds several members at once", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: "Add members" }),
			);
			const dialog = await screen.findByRole("dialog", {
				name: "Add members to Moderators",
			});
			const picker = within(dialog);
			await expect(picker.queryByRole("checkbox", { name: "Kris" })).toBeNull();
			await userEvent.click(picker.getByRole("checkbox", { name: "Lou" }));
			await userEvent.click(picker.getByRole("checkbox", { name: "Ana" }));
			const add = picker.getByRole("button", { name: "Add 2 members" });
			await userEvent.type(
				picker.getByRole("searchbox", { name: "Search members" }),
				"juno",
			);
			await waitFor(() =>
				expect(picker.queryByRole("checkbox", { name: "Lou" })).toBeNull(),
			);
			await userEvent.click(add);
			await waitFor(
				() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
				{ timeout: 3000 },
			);
			await expect(onAdd).toHaveBeenLastCalledWith([
				"did:plc:lou",
				"did:plc:ana",
			]);
			await expect(memberRows(canvasElement)).toEqual([
				"did:plc:kris",
				"did:plc:lou",
				"did:plc:ana",
			]);
		});
	},
};

export const MembersMobile: Story = {
	render: () => <MembersHarness platform="mobile" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Add members" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Add members to Moderators",
		});
		await waitFor(() =>
			expect(document.activeElement?.getAttribute("type")).not.toBe("search"),
		);
		const picker = within(dialog);
		await expect(
			picker.getByRole("button", { name: "Add members" }),
		).toBeDisabled();
		await userEvent.click(picker.getByRole("checkbox", { name: "Juno" }));
		await expect(
			picker.getByRole("button", { name: "Add 1 member" }),
		).toBeEnabled();
	},
};

export const MembersEmpty: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col bg-popover p-4 text-foreground">
			<RoleMembers
				roleName="Artists"
				members={[]}
				candidates={people}
				onAdd={fn()}
				onRemove={fn()}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement).toHaveTextContent(
			"No one has the Artists role yet.",
		);
	},
};
