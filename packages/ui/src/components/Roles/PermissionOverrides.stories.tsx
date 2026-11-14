import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import { createSignal, type JSX, Match, Show, Switch } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { DestructiveRow, ListGroup } from "../List/List";
import type { MemberIdentityData } from "../Members/MemberIdentity";
import { AudiencePicker, type AudienceRole } from "../Selection/AudiencePicker";
import {
	EMPTY_PERMISSION_OVERRIDE,
	type PermissionOverrideEntry,
	PermissionOverrideList,
	type PermissionOverrideTarget,
	PermissionOverrideTargetList,
	type PermissionOverrideValue,
	permissionOverrideTargetName,
	sortPermissionOverrideEntries,
} from "./PermissionOverrides";
import type { ChannelPermissionScope } from "./RolePermissions";

const meta = {
	title: "Surfaces/Permission overrides",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const DESKTOP = { viewport: { defaultViewport: "responsive" } };

const roles: AudienceRole[] = [
	{
		id: "mods",
		name: "Moderators",
		color: "#c4a7ff",
		badge: { kind: "icon", name: "shield-check", color: "#76c4e5" },
	},
	{ id: "artists", name: "Artists", color: "#ff7a90" },
	{ id: "helpers", name: "Helpers", color: "#4ade80" },
];

const POSITIONS: Record<string, number> = {
	mods: 3,
	artists: 2,
	helpers: 1,
};

const members: MemberIdentityData[] = [
	{ id: "did:plc:ada", name: "Ada", handle: "ada.colibri.social" },
	{ id: "did:plc:juno", name: "Juno", handle: "juno.example.com" },
	{ id: "did:plc:kai", name: "Kai Moreno", handle: "kai.example.com" },
];

const everyone: PermissionOverrideTarget = {
	kind: "role",
	id: "everyone",
	role: { name: "Everyone" },
	isDefault: true,
};

const roleTarget = (role: AudienceRole): PermissionOverrideTarget => ({
	kind: "role",
	id: role.id,
	role,
});

const memberTarget = (
	member: MemberIdentityData,
): PermissionOverrideTarget => ({
	kind: "member",
	id: member.id,
	name: member.name,
	handle: member.handle,
	avatarSrc: member.avatarSrc,
});

const initialEntries: PermissionOverrideEntry[] = [
	{
		target: everyone,
		value: { allow: [], deny: ["message.send", "thread.create"] },
	},
	{
		target: roleTarget(roles[1]),
		value: { allow: ["message.send"], deny: [] },
	},
	{
		target: roleTarget(roles[0]),
		value: { allow: ["message.send", "thread.manage"], deny: [] },
	},
	{
		target: memberTarget(members[1]),
		value: { allow: [], deny: ["message.send", "mention.roles"] },
	},
];

const isDefaultTarget = (target: PermissionOverrideTarget) => {
	return target.kind === "role" && target.isDefault === true;
};

const positionOf = (target: PermissionOverrideTarget) => {
	return target.kind === "role" ? (POSITIONS[target.id] ?? 0) : 0;
};

const sorted = (entries: readonly PermissionOverrideEntry[]) => {
	return sortPermissionOverrideEntries(entries, positionOf);
};

const Surface = (props: { children: JSX.Element }) => (
	<div class="flex min-h-dvh flex-col gap-4 bg-popover p-4 text-foreground">
		{props.children}
	</div>
);

const PageHeader = (props: { title: string; onBack?: () => void }) => (
	<div class="flex h-10 items-center gap-2">
		<Show when={props.onBack}>
			<button
				type="button"
				aria-label="Back"
				onClick={() => props.onBack?.()}
				class="flex size-10 cursor-pointer items-center justify-center rounded-control-sm hover:bg-secondary [&>svg]:size-6"
			>
				<ArrowLeftIcon />
			</button>
		</Show>
		<h1 class="m-0 min-w-0 truncate text-lg font-semibold">{props.title}</h1>
	</div>
);

type Page =
	| { kind: "targets" }
	| { kind: "editor"; id: string }
	| { kind: "add" };

const FlowHarness = (props: {
	scope: ChannelPermissionScope;
	title: string;
	onChange?: (entries: PermissionOverrideEntry[]) => void;
}) => {
	const [entries, setEntries] = createSignal(sorted(initialEntries));
	const [page, setPage] = createSignal<Page>({ kind: "targets" });

	const commit = (next: PermissionOverrideEntry[]) => {
		const value = sorted(next);

		setEntries(value);
		props.onChange?.(value);
	};

	const entryOf = (id: string) => {
		return entries().find((entry) => entry.target.id === id);
	};

	const update = (id: string, value: PermissionOverrideValue) => {
		commit(
			entries().map((entry) =>
				entry.target.id === id ? { ...entry, value } : entry,
			),
		);
	};

	const remove = (id: string) => {
		commit(entries().filter((entry) => entry.target.id !== id));
		setPage({ kind: "targets" });
	};

	const add = (target: PermissionOverrideTarget) => {
		commit([...entries(), { target, value: EMPTY_PERMISSION_OVERRIDE }]);
		setPage({ kind: "editor", id: target.id });
	};

	const editing = () => {
		const current = page();
		return current.kind === "editor" ? entryOf(current.id) : undefined;
	};

	const used = (id: string) =>
		entries().some((entry) => entry.target.id === id);

	return (
		<Surface>
			<Switch>
				<Match when={page().kind === "targets"}>
					<PageHeader title={props.title} />
					<p class="m-0 text-sm text-pretty text-muted-foreground">
						Allow or deny permissions for a role or a single member. Inherit
						keeps whatever applies above.
					</p>
					<PermissionOverrideTargetList
						entries={entries()}
						onOpen={(target) => setPage({ kind: "editor", id: target.id })}
						onAdd={() => setPage({ kind: "add" })}
					/>
				</Match>
				<Match when={page().kind === "add"}>
					<PageHeader
						title="Add role or member"
						onBack={() => setPage({ kind: "targets" })}
					/>
					<AudiencePicker
						searchLabel="Search members and roles"
						roles={roles}
						members={members}
						selectedRoles={[]}
						selectedMembers={[]}
						canSelectRole={(id) => !used(id)}
						canSelectMember={(id) => !used(id)}
						onRolesChange={(ids) => {
							const role = roles.find((entry) => entry.id === ids[0]);
							if (role) add(roleTarget(role));
						}}
						onMembersChange={(ids) => {
							const member = members.find((entry) => entry.id === ids[0]);
							if (member) add(memberTarget(member));
						}}
					/>
				</Match>
				<Match when={editing()}>
					{(entry) => (
						<>
							<PageHeader
								title={permissionOverrideTargetName(entry().target)}
								onBack={() => setPage({ kind: "targets" })}
							/>
							<PermissionOverrideList
								scope={props.scope}
								value={entry().value}
								onChange={(value) => update(entry().target.id, value)}
							/>
							<Show when={!isDefaultTarget(entry().target)}>
								<ListGroup>
									<DestructiveRow
										label="Remove override"
										onClick={() => remove(entry().target.id)}
									/>
								</ListGroup>
							</Show>
						</>
					)}
				</Match>
			</Switch>
		</Surface>
	);
};

const EditorHarness = (props: {
	scope: ChannelPermissionScope;
	value?: PermissionOverrideValue;
	canChange?: (key: string) => boolean;
	onChange?: (value: PermissionOverrideValue) => void;
}) => {
	const [value, setValue] = createSignal(
		props.value ?? EMPTY_PERMISSION_OVERRIDE,
	);

	return (
		<Surface>
			<PermissionOverrideList
				scope={props.scope}
				value={value()}
				canChange={props.canChange}
				onChange={(next) => {
					setValue(next);
					props.onChange?.(next);
				}}
			/>
		</Surface>
	);
};

const rowOf = (canvas: HTMLElement, key: string) => {
	const row = canvas.querySelector<HTMLElement>(
		`[data-permission-override-row="${key}"]`,
	);
	if (!row) throw new Error(`no row for ${key}`);

	return row;
};

const stateOf = (canvas: HTMLElement, key: string) => {
	return rowOf(canvas, key).dataset.overrideState;
};

const choose = async (canvas: HTMLElement, key: string, label: string) => {
	await userEvent.click(within(rowOf(canvas, key)).getByLabelText(label));
};

const keysShown = (canvas: HTMLElement) => {
	return [
		...canvas.querySelectorAll<HTMLElement>("[data-permission-override-row]"),
	].map((row) => row.dataset.permissionOverrideRow);
};

const targetRow = (canvas: HTMLElement, id: string) => {
	const row = canvas.querySelector<HTMLElement>(
		`[data-override-target="${id}"]`,
	);
	if (!row) throw new Error(`no target row for ${id}`);

	return row;
};

const targetNames = (canvas: HTMLElement) => {
	return [
		...canvas.querySelectorAll<HTMLElement>("[data-override-target]"),
	].map((row) => row.dataset.overrideTarget);
};

export const ChannelOverrides: Story = {
	render: () => <FlowHarness scope="text" title="Channel permissions" />,
	play: async ({ canvasElement }) => {
		await expect(targetNames(canvasElement)).toEqual([
			"everyone",
			"mods",
			"artists",
			"did:plc:juno",
		]);
		await expect(within(canvasElement).getByText("2 allowed")).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const ChannelOverridesDesktop: Story = {
	parameters: DESKTOP,
	render: () => <FlowHarness scope="text" title="Channel permissions" />,
	play: async ({ canvasElement }) => expectNoLayoutIssues(canvasElement),
};

export const EditDefaultRole: Story = {
	render: () => <FlowHarness scope="text" title="Channel permissions" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(targetRow(canvasElement, "everyone"));
		await waitFor(() =>
			expect(stateOf(canvasElement, "message.send")).toBe("deny"),
		);
		await expect(canvas.queryByText("Remove override")).toBeNull();
		await choose(canvasElement, "channel.view", "Deny");
		await expect(stateOf(canvasElement, "channel.view")).toBe("deny");
		await choose(canvasElement, "message.send", "Inherit");
		await expect(stateOf(canvasElement, "message.send")).toBe("inherit");
		await expectNoLayoutIssues(canvasElement);
		await userEvent.click(canvas.getByLabelText("Back"));
		await expect(
			canvasElement.querySelector(
				'[data-override-target="everyone"] [data-override-summary]',
			)?.textContent,
		).toBe("2 denied");
	},
};

export const AddAndRemoveMember: Story = {
	render: () => <FlowHarness scope="text" title="Channel permissions" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole("button", { name: "Add" }));
		await userEvent.click(
			await canvas.findByRole("checkbox", { name: /Kai Moreno/ }),
		);
		await waitFor(() =>
			expect(stateOf(canvasElement, "message.send")).toBe("inherit"),
		);
		await choose(canvasElement, "message.send", "Allow");
		await expect(stateOf(canvasElement, "message.send")).toBe("allow");
		await userEvent.click(canvas.getByLabelText("Back"));
		await expect(targetNames(canvasElement)).toContain("did:plc:kai");
		await userEvent.click(targetRow(canvasElement, "did:plc:kai"));
		await userEvent.click(await canvas.findByText("Remove override"));
		await expect(targetNames(canvasElement)).not.toContain("did:plc:kai");
	},
};

export const VoiceChannelScope: Story = {
	render: () => <EditorHarness scope="voice" />,
	play: async ({ canvasElement }) => {
		const keys = keysShown(canvasElement);

		await expect(keys).toContain("voice.speak");
		await expect(keys).toContain("voice.connect");
		await expect(keys).not.toContain("message.send");
		await expect(keys).not.toContain("thread.create");
		await expectNoLayoutIssues(canvasElement);
	},
};

const iconOffsets = (canvas: HTMLElement) => {
	return [
		...canvas.querySelectorAll<HTMLElement>("[data-override-state] svg"),
	].map((icon) => {
		const slot = icon.closest("label");
		if (!slot) throw new Error("icon outside its segment");

		const own = icon.getBoundingClientRect();
		const outer = slot.getBoundingClientRect();
		const style = getComputedStyle(slot);
		const left = outer.left + Number.parseFloat(style.paddingLeft);
		const right = outer.right - Number.parseFloat(style.paddingRight);

		return {
			clipped:
				own.width < 16 || own.left < left - 0.5 || own.right > right + 0.5,
			x: own.left + own.width / 2 - (outer.left + outer.width / 2),
			y: own.top + own.height / 2 - (outer.top + outer.height / 2),
		};
	});
};

export const TextChannelScope: Story = {
	render: () => <EditorHarness scope="text" />,
	play: async ({ canvasElement }) => {
		const keys = keysShown(canvasElement);

		for (const offset of iconOffsets(canvasElement)) {
			await expect(Math.abs(offset.x)).toBeLessThan(0.5);
			await expect(Math.abs(offset.y)).toBeLessThan(0.5);
			await expect(offset.clipped).toBe(false);
		}

		await expect(keys).toContain("message.send");
		await expect(keys.some((key) => key?.startsWith("voice."))).toBe(false);
		await expect(keys).not.toContain("community.manage");
	},
};

export const CategoryScopeDesktop: Story = {
	parameters: DESKTOP,
	render: () => (
		<EditorHarness
			scope="category"
			value={{ allow: ["voice.connect"], deny: ["channel.view"] }}
		/>
	),
	play: async ({ canvasElement }) => {
		const keys = keysShown(canvasElement);

		await expect(keys).toContain("message.send");
		await expect(keys).toContain("voice.speak");
		await expect(stateOf(canvasElement, "channel.view")).toBe("deny");
		await expect(stateOf(canvasElement, "voice.connect")).toBe("allow");
		await expectNoLayoutIssues(canvasElement);
	},
};

const HELD = new Set(["channel.view", "message.send", "thread.create"]);

export const LockedPermissions: Story = {
	render: () => (
		<EditorHarness
			scope="text"
			canChange={(key) => HELD.has(key)}
			onChange={fn()}
		/>
	),
	play: async ({ canvasElement }) => {
		const locked = within(rowOf(canvasElement, "thread.manage"));

		for (const option of ["Deny", "Inherit", "Allow"]) {
			await expect(locked.getByLabelText(option)).toBeDisabled();
		}

		await expect(
			within(rowOf(canvasElement, "message.send")).getByLabelText("Deny"),
		).toBeEnabled();
		await expect(
			locked.getByText(/You can't change a permission you don't have/),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const TargetList: Story = {
	render: () => (
		<Surface>
			<PermissionOverrideTargetList
				entries={sorted(initialEntries)}
				onOpen={fn()}
				onAdd={fn()}
			/>
			<PermissionOverrideTargetList
				entries={[{ target: everyone, value: EMPTY_PERMISSION_OVERRIDE }]}
				onOpen={fn()}
				disabled
			/>
		</Surface>
	),
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByText("No changes")).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};
