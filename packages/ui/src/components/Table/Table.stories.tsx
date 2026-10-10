import { MenuDotsVerticalIcon } from "@solar-icons/solid/bold/menu-dots-vertical";
import { UserIcon } from "@solar-icons/solid/bold/user";
import type { JSX } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Avatar } from "../Avatar/Avatar";
import {
	DropdownMenu,
	type DropdownMenuEntry,
} from "../DropdownMenu/DropdownMenu";
import { IconButton } from "../IconButton/IconButton";
import { Table, type TableColumn, type TableProps } from "./Table";
import { TableText } from "./TableText";

const meta = {
	title: "Primitives/Table",
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div class="min-h-dvh bg-popover p-4 text-foreground">
				<Story />
			</div>
		),
	],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Member = {
	id: string;
	name: string;
	handle: string;
	role: string;
	joined: string;
	banned?: boolean;
};

const roles = ["Owner", "Moderator", "Member", "Member", "Bird watcher"];
const names = [
	"Tim Tinkers",
	"Entropic Software",
	"Ada Lovelace",
	"Grace Hopper",
	"A member with a very long display name that will truncate",
];

const member = (index: number): Member => ({
	id: `member-${index}`,
	name: names[index % names.length],
	handle: `user${index}.bsky.social`,
	role: roles[index % roles.length],
	joined: `${(index % 28) + 1} Sep 2026`,
	banned: index === 3,
});

const members = Array.from({ length: 6 }, (_, index) => member(index));
const longList = Array.from({ length: 120 }, (_, index) => member(index));

const nameColumn: TableColumn<Member> = {
	id: "name",
	header: "Name",
	cell: (row) => (
		<span class="flex min-w-0 items-center gap-2">
			<Avatar size="xs" name={row.name} class="shrink-0" />
			<TableText text={row.name} class="font-semibold" />
		</span>
	),
};

const roleColumn: TableColumn<Member> = {
	id: "role",
	header: "Role",
	width: "8rem",
	truncate: true,
	cell: (row) => row.role,
};

const joinedColumn: TableColumn<Member> = {
	id: "joined",
	header: "Joined",
	width: "7rem",
	align: "end",
	cell: (row) => <span class="tabular-nums">{row.joined}</span>,
};

const columns = [nameColumn, roleColumn, joinedColumn];

const foldingColumns: TableColumn<Member>[] = [
	nameColumn,
	{ ...roleColumn, fold: { into: "name", below: "sm" } },
	joinedColumn,
];

const selected = fn((_action: string, _id: string) => {});

const memberEntries = (row: Member): DropdownMenuEntry[] => [
	{
		label: "View profile",
		icon: <UserIcon />,
		onSelect: () => selected("profile", row.id),
	},
	{ kind: "separator" },
	{
		label: "Remove from Space",
		tone: "destructive",
		onSelect: () => selected("remove", row.id),
	},
];

const MemberActions = (props: { row: Member }) => (
	<DropdownMenu
		platform="desktop"
		label={`Options for ${props.row.name}`}
		items={memberEntries(props.row)}
		triggerAs={IconButton}
		triggerProps={{
			variant: "ghost",
			size: "md",
			label: `More actions for ${props.row.name}`,
			icon: <MenuDotsVerticalIcon />,
		}}
	/>
);

const Frame = (props: { width?: number; children: JSX.Element }) => (
	<div
		data-frame=""
		style={{ width: `${props.width ?? 400}px`, "max-width": "100%" }}
	>
		{props.children}
	</div>
);

const MemberTable = (
	props: Partial<TableProps<Member>> & { width?: number },
) => (
	<Frame width={props.width}>
		<Table
			label="Members"
			rows={members}
			columns={columns}
			rowKey={(row) => row.id}
			{...props}
		/>
	</Frame>
);

const table = (canvas: HTMLElement, name = "Members") =>
	within(canvas).getByRole("table", { name });

const headerNames = (element: HTMLElement) =>
	within(element)
		.getAllByRole("columnheader")
		.map((header) => header.textContent?.trim());

const rowOf = (canvas: HTMLElement, id: string) => {
	const row = canvas.querySelector<HTMLElement>(`[data-table-row="${id}"]`);
	if (!row) throw new Error(`row ${id} missing`);
	return row;
};

const expectNoHorizontalOverflow = async (root: HTMLElement) => {
	for (const element of root.querySelectorAll<HTMLElement>(
		"[data-table-scroller], table",
	))
		await expect(element.scrollWidth).toBeLessThanOrEqual(
			element.clientWidth + 1,
		);
};

const rightClick = (element: Element) => {
	const rect = element.getBoundingClientRect();
	element.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: rect.left + 12,
			clientY: rect.top + rect.height / 2,
		}),
	);
};

export const Plain: Story = {
	render: () => <MemberTable />,
	play: async ({ canvasElement }) => {
		const element = table(canvasElement);
		await expect(element.tagName).toBe("TABLE");
		await expect(headerNames(element)).toEqual(["Name", "Role", "Joined"]);
		await expect(within(element).getAllByRole("row")).toHaveLength(
			members.length + 1,
		);
		const first = rowOf(canvasElement, "member-0");
		const cells = within(first).getAllByRole("cell");
		await expect(cells).toHaveLength(3);
		await expect(cells[0]).toHaveTextContent("Tim Tinkers");
		await expect(cells[1]).toHaveTextContent("Owner");
		await expect(cells[2]).toHaveTextContent("1 Sep 2026");
		await expect(getComputedStyle(cells[2]).textAlign).toBe("end");
		await expectNoHorizontalOverflow(canvasElement);
	},
};

export const FoldingColumns: Story = {
	render: () => (
		<div class="flex flex-col gap-6">
			<div data-case="narrow">
				<MemberTable
					label="Narrow members"
					columns={foldingColumns}
					width={383}
				/>
			</div>
			<div data-case="wide">
				<MemberTable
					label="Wide members"
					columns={foldingColumns}
					width={384}
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const narrow = table(canvasElement, "Narrow members");
		const wide = table(canvasElement, "Wide members");
		await expect(headerNames(narrow)).toEqual(["Name", "Joined"]);
		await expect(headerNames(wide)).toEqual(["Name", "Role", "Joined"]);

		const narrowRow = within(narrow).getAllByRole("row")[1];
		const folded = narrowRow.querySelector<HTMLElement>(
			'[data-table-folded="role"]',
		);
		await expect(folded).toBeVisible();
		await expect(folded).toHaveTextContent("Role: Owner");
		await expect(within(narrowRow).getAllByRole("cell")).toHaveLength(2);

		const wideRow = within(wide).getAllByRole("row")[1];
		await expect(
			wideRow.querySelector('[data-table-folded="role"]'),
		).not.toBeVisible();
		await expect(within(wideRow).getAllByRole("cell")).toHaveLength(3);

		await expectNoHorizontalOverflow(canvasElement);
	},
};

export const RowActions: Story = {
	render: () => (
		<div class="flex flex-col gap-6">
			<MemberTable
				label="Members"
				actions={(row) => <MemberActions row={row} />}
			/>
			<MemberTable
				label="Members on hover"
				actionsVisibility="hover"
				actions={(row) => <MemberActions row={row} />}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		selected.mockClear();
		const element = table(canvasElement);
		await expect(headerNames(element)).toEqual([
			"Name",
			"Role",
			"Joined",
			"Actions",
		]);
		const buttons = within(element).getAllByRole("button");
		await expect(buttons).toHaveLength(members.length);
		const after = getComputedStyle(buttons[0], "::after");
		await expect(after.position).toBe("absolute");
		await expect(Number.parseFloat(after.width)).toBeGreaterThanOrEqual(40);
		await expect(Number.parseFloat(after.height)).toBeGreaterThanOrEqual(40);

		buttons[0].focus();
		await userEvent.tab();
		await expect(document.activeElement).toBe(buttons[1]);
		await userEvent.keyboard("{Enter}");
		const menu = await screen.findByRole(
			"menu",
			{ name: `More actions for ${members[1].name}` },
			{ timeout: 3000 },
		);
		await expect(
			within(menu).getByRole("menuitem", { name: "View profile" }),
		).toBeInTheDocument();
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull(), {
			timeout: 3000,
		});
		await waitFor(() => expect(buttons[1]).toHaveFocus());

		const hover = table(canvasElement, "Members on hover");
		const hidden = within(hover).getAllByRole("button")[0];
		const wrapper = hidden.parentElement as HTMLElement;
		await expect(Number(getComputedStyle(wrapper).opacity)).toBe(0);
		hidden.focus();
		await waitFor(() =>
			expect(Number(getComputedStyle(wrapper).opacity)).toBe(1),
		);
	},
};

export const ContextMenu: Story = {
	render: () => (
		<MemberTable
			actions={(row) => <MemberActions row={row} />}
			contextMenu={(row) => memberEntries(row)}
			contextMenuLabel={(row) => `Options for ${row.name}`}
		/>
	),
	play: async ({ canvasElement }) => {
		selected.mockClear();
		const element = table(canvasElement);
		const header = within(element).getAllByRole("columnheader")[0];
		const headerEvent = new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
		});
		header.dispatchEvent(headerEvent);
		await new Promise((resolve) => setTimeout(resolve, 200));
		await expect(screen.queryByRole("menu")).toBeNull();
		await expect(headerEvent.defaultPrevented).toBe(false);

		const row = rowOf(canvasElement, "member-2");
		rightClick(within(row).getAllByRole("cell")[1]);
		const menu = await screen.findByRole(
			"menu",
			{ name: `Options for ${members[2].name}` },
			{ timeout: 3000 },
		);
		await waitFor(() => expect(row).toHaveAttribute("data-menu-open"));
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "View profile" }),
		);
		await expect(selected).toHaveBeenCalledWith("profile", "member-2");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull(), {
			timeout: 3000,
		});
		await waitFor(() => expect(row).not.toHaveAttribute("data-menu-open"));
	},
};

export const RowStates: Story = {
	render: () => (
		<MemberTable
			rowState={(row) =>
				row.banned
					? { dimmed: true, description: "Banned from this Space" }
					: undefined
			}
		/>
	),
	play: async ({ canvasElement }) => {
		const banned = rowOf(canvasElement, "member-3");
		await expect(banned).toHaveAttribute("data-dimmed");
		const first = within(banned).getAllByRole("cell")[0];
		await expect(first).toHaveTextContent("Banned from this Space");
		await expect(within(first).getByText(/Banned from this Space/)).toHaveClass(
			"sr-only",
		);
		await expect(rowOf(canvasElement, "member-2")).not.toHaveAttribute(
			"data-dimmed",
		);
	},
};

export const Loading: Story = {
	render: () => (
		<MemberTable
			loading
			skeletonRows={5}
			loadingLabel="Loading members"
			actions={(row) => <MemberActions row={row} />}
		/>
	),
	play: async ({ canvasElement }) => {
		const element = table(canvasElement);
		await expect(element).toHaveAttribute("aria-busy", "true");
		await expect(headerNames(element)).toEqual([
			"Name",
			"Role",
			"Joined",
			"Actions",
		]);
		await expect(
			element.querySelectorAll("[data-table-skeleton]"),
		).toHaveLength(5);
		await expect(
			within(canvasElement).getByText("Loading members"),
		).toHaveAttribute("role", "status");
		await expect(element.querySelector("[data-table-row]")).toBeNull();
	},
};

export const Empty: Story = {
	render: () => (
		<MemberTable
			rows={[]}
			empty={
				<p data-empty="" class="m-0 text-sm text-muted-foreground">
					No members match this search.
				</p>
			}
		/>
	),
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).queryByRole("table")).toBeNull();
		await expect(
			within(canvasElement).getByText("No members match this search."),
		).toBeVisible();
	},
};

export const LongList: Story = {
	render: () => (
		<MemberTable
			rows={longList}
			columns={foldingColumns}
			maxHeight="320px"
			actions={(row) => <MemberActions row={row} />}
		/>
	),
	play: async ({ canvasElement }) => {
		const scroller = canvasElement.querySelector<HTMLElement>(
			"[data-table-scroller]",
		);
		if (!scroller) throw new Error("scroller missing");
		await expect(scroller.getBoundingClientRect().height).toBeLessThanOrEqual(
			321,
		);
		await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
		scroller.scrollTop = 1200;
		await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(1000));
		const head = scroller.querySelector("thead") as HTMLElement;
		const top = scroller.getBoundingClientRect().top + scroller.clientTop;
		await expect(
			Math.abs(head.getBoundingClientRect().top - top),
		).toBeLessThanOrEqual(1);
		await expectNoHorizontalOverflow(canvasElement);
	},
};
