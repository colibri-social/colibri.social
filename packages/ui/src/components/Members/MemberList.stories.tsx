import { createMemo, createSignal } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../Button/Button";
import { ProfilePopover } from "../Profile/ProfilePopover";
import {
	createManyMembers,
	fixtureMembers,
	fixtureRoles,
	moderatorRole,
} from "./fixtures";
import { groupMembers, type Member, MemberList } from "./MemberList";

const meta = {
	title: "Navigation/Member list",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };

const MANY = createManyMembers(5000);

const frames = (count = 2) =>
	new Promise<void>((resolve) => {
		const step = (left: number) => {
			if (left <= 0) {
				resolve();
				return;
			}
			requestAnimationFrame(() => step(left - 1));
		};
		step(count);
	});

const scrollerOf = (canvas: HTMLElement) =>
	canvas.querySelector<HTMLElement>("[data-scroller]") as HTMLElement;

const rowsOf = (scope: ParentNode) =>
	Array.from(scope.querySelectorAll<HTMLElement>("[data-member-row]"));

const visibleRows = (scroller: HTMLElement) => {
	const box = scroller.getBoundingClientRect();
	return rowsOf(scroller)
		.filter((row) => {
			const rect = row.getBoundingClientRect();
			return rect.top >= box.top && rect.bottom <= box.bottom;
		})
		.sort(
			(a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
		);
};

const nameOf = (row: HTMLElement) =>
	row.querySelector("[data-member-name]")?.textContent ?? "";

const scrollTo = async (scroller: HTMLElement, top: number) => {
	scroller.scrollTop = top;
	await frames(4);
};

const scrollAndRest = async (scroller: HTMLElement, top: number) => {
	await scrollTo(scroller, top);
	await new Promise((resolve) => setTimeout(resolve, 250));
};

const onOpen = () => {};

export const ManyMembersDesktop: Story = {
	render: () => (
		<div
			data-scroller=""
			class="h-[800px] w-72 overflow-y-auto border-l border-border bg-card text-foreground"
		>
			<MemberList
				groups={groupMembers(MANY, [moderatorRole])}
				onOpen={onOpen}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const scroller = scrollerOf(canvasElement);
		await waitFor(() =>
			expect(
				canvasElement.querySelector("[data-member-list][data-virtual]"),
			).not.toBeNull(),
		);
		await frames(3);
		await expect(rowsOf(canvasElement).length).toBeLessThan(80);
		const heading = within(canvasElement).getByRole("heading", {
			name: /^Moderators, \d+$/,
		});
		await expect(heading).toBeInTheDocument();

		await scrollTo(scroller, scroller.scrollHeight / 2);
		const rows = visibleRows(scroller);
		await expect(rows.length).toBeGreaterThan(10);
		await expect(rowsOf(canvasElement).length).toBeLessThan(80);
		for (let index = 1; index < rows.length; index++) {
			const previous = rows[index - 1] as HTMLElement;
			const current = rows[index] as HTMLElement;
			const gap =
				current.getBoundingClientRect().top -
				previous.getBoundingClientRect().bottom;
			await expect(gap === 0 || gap === 42).toBe(true);
			if (gap === 0)
				await expect(nameOf(previous) < nameOf(current)).toBe(true);
		}

		await scrollTo(scroller, scroller.scrollHeight);
		await waitFor(() => {
			const last = visibleRows(scroller).at(-1) as HTMLElement;
			expect(last).toHaveAttribute("data-offline");
		});
		const offline = groupMembers(MANY, [moderatorRole]).at(-1);
		await expect(nameOf(visibleRows(scroller).at(-1) as HTMLElement)).toBe(
			offline?.members.at(-1)?.name,
		);
	},
};

export const ManyMembersMobile: Story = {
	parameters: iphone,
	render: () => (
		<div
			data-scroller=""
			class="h-dvh overflow-y-auto bg-popover px-4 pt-4 text-foreground"
		>
			<MemberList
				variant="mobile"
				groups={groupMembers(MANY, [moderatorRole])}
				onOpen={onOpen}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const scroller = scrollerOf(canvasElement);
		await frames(3);
		await expect(rowsOf(canvasElement).length).toBeLessThan(60);
		const first = rowsOf(canvasElement)[0] as HTMLElement;
		const card = first.parentElement as HTMLElement;
		await expect(getComputedStyle(card).borderTopLeftRadius).toBe("10px");
		await expect(getComputedStyle(card).borderBottomLeftRadius).toBe("0px");
		await scrollTo(scroller, scroller.scrollHeight / 3);
		await expect(rowsOf(canvasElement).length).toBeLessThan(60);
		await expect(visibleRows(scroller).length).toBeGreaterThan(5);
	},
};

const ParityColumn = (props: {
	virtual: boolean;
	variant: "desktop" | "mobile";
}) => (
	<div
		data-scroller=""
		data-mode={props.virtual ? "virtual" : "static"}
		class={
			props.variant === "mobile"
				? "h-[760px] w-[370px] overflow-y-auto bg-popover px-4 pt-4"
				: "h-[760px] w-72 overflow-y-auto bg-card"
		}
	>
		<MemberList
			variant={props.variant}
			virtualizeAfter={props.virtual ? 0 : Number.POSITIVE_INFINITY}
			groups={groupMembers(fixtureMembers(), fixtureRoles)}
		/>
	</div>
);

const geometryOf = (column: HTMLElement) => {
	const origin = column.getBoundingClientRect();
	const rows = rowsOf(column).map((row) => {
		const rect = row.getBoundingClientRect();
		return [
			nameOf(row),
			rect.top - origin.top,
			rect.left - origin.left,
			rect.width,
			rect.height,
		];
	});
	const labels = Array.from(
		column.querySelectorAll<HTMLElement>("[data-member-list] .truncate"),
	)
		.filter((label) => !label.closest("[data-member-row]"))
		.map((label) => {
			const rect = label.getBoundingClientRect();
			return [
				label.textContent,
				rect.top - origin.top,
				rect.left - origin.left,
			];
		});
	return { rows, labels };
};

const expectParity = async (canvas: HTMLElement) => {
	await frames(3);
	const columns = Array.from(
		canvas.querySelectorAll<HTMLElement>("[data-mode]"),
	);
	const staticColumn = columns.find(
		(column) => column.dataset.mode === "static",
	) as HTMLElement;
	const virtualColumn = columns.find(
		(column) => column.dataset.mode === "virtual",
	) as HTMLElement;
	await expect(virtualColumn.querySelector("[data-virtual]")).not.toBeNull();
	const a = geometryOf(staticColumn);
	const b = geometryOf(virtualColumn);
	await expect(b.rows.length).toBe(a.rows.length);
	await expect(b.labels.length).toBe(a.labels.length);
	a.rows.forEach((row, index) => {
		const other = b.rows[index] as typeof row;
		expect(other[0]).toBe(row[0]);
		for (let part = 1; part < row.length; part++)
			expect(
				Math.abs((other[part] as number) - (row[part] as number)),
			).toBeLessThan(0.5);
	});
	a.labels.forEach((label, index) => {
		const other = b.labels[index] as typeof label;
		expect(other[0]).toBe(label[0]);
		expect(Math.abs((other[1] as number) - (label[1] as number))).toBeLessThan(
			0.5,
		);
		expect(Math.abs((other[2] as number) - (label[2] as number))).toBeLessThan(
			0.5,
		);
	});
};

export const VirtualParityDesktop: Story = {
	render: () => (
		<div class="flex gap-6 bg-background p-4 text-foreground">
			<ParityColumn virtual={false} variant="desktop" />
			<ParityColumn virtual variant="desktop" />
		</div>
	),
	play: async ({ canvasElement }) => expectParity(canvasElement),
};

export const VirtualParityMobile: Story = {
	render: () => (
		<div class="flex gap-6 bg-background p-4 text-foreground">
			<ParityColumn virtual={false} variant="mobile" />
			<ParityColumn virtual variant="mobile" />
		</div>
	),
	play: async ({ canvasElement }) => expectParity(canvasElement),
};

export const PresenceKeepsPosition: Story = {
	render: () => {
		const [members, setMembers] = createSignal(createManyMembers(1200));
		const groups = createMemo(() => groupMembers(members(), [moderatorRole]));
		const sendModeratorsOffline = () =>
			setMembers((list) =>
				list.map((member) =>
					member.hoistedRoleId && member.presence !== "offline"
						? { ...member, presence: "offline" as const }
						: member,
				),
			);
		const bringOneOnline = () =>
			setMembers((list) => {
				const index = list.findIndex(
					(member) => member.presence === "offline" && !member.hoistedRoleId,
				);
				return list.map((member, position) =>
					position === index
						? { ...member, presence: "online" as const, name: "Aaa early bird" }
						: member,
				);
			});
		return (
			<div class="flex flex-col gap-2 bg-background p-2 text-foreground">
				<div class="flex gap-2">
					<Button variant="secondary" onClick={sendModeratorsOffline}>
						Moderators go offline
					</Button>
					<Button variant="secondary" onClick={bringOneOnline}>
						Someone comes online
					</Button>
				</div>
				<div
					data-scroller=""
					class="h-[700px] w-72 overflow-y-auto border-l border-border bg-card"
				>
					<MemberList groups={groups()} onOpen={onOpen} />
				</div>
			</div>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const scroller = scrollerOf(canvasElement);
		await frames(3);
		await scrollTo(scroller, 4000);
		const check = async (button: string) => {
			const anchor = visibleRows(scroller)[3] as HTMLElement;
			const name = nameOf(anchor);
			const before = anchor.getBoundingClientRect().top;
			await userEvent.click(canvas.getByRole("button", { name: button }));
			await frames(4);
			const after = rowsOf(canvasElement).find(
				(row) => nameOf(row) === name,
			) as HTMLElement;
			await expect(after).toBeDefined();
			await expect(
				Math.abs(after.getBoundingClientRect().top - before),
			).toBeLessThan(1);
		};
		await step("Members above leave their group", async () => {
			await check("Moderators go offline");
		});
		await step("A member joins a group above", async () => {
			await check("Someone comes online");
		});
	},
};

const PROFILE = {
	displayName: "Member",
	handle: "member.colibri.social",
};

export const PopoverOnVirtualRow: Story = {
	render: () => {
		const [anchor, setAnchor] = createSignal<HTMLElement>();
		const [member, setMember] = createSignal<Member>();
		return (
			<div class="flex bg-background text-foreground">
				<div
					data-scroller=""
					class="h-[700px] w-72 overflow-y-auto border-l border-border bg-card"
				>
					<MemberList
						groups={groupMembers(createManyMembers(2000), [moderatorRole])}
						onOpen={(next, event) => {
							setAnchor(event.currentTarget as HTMLElement);
							setMember(next);
						}}
					/>
				</div>
				<ProfilePopover
					anchor={anchor}
					open={!!member()}
					onOpenChange={(open) => {
						if (!open) setMember(undefined);
					}}
					profile={{ ...PROFILE, displayName: member()?.name ?? "" }}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const scroller = scrollerOf(canvasElement);
		await frames(3);
		await scrollAndRest(scroller, 3000);
		const row = visibleRows(scroller)[2] as HTMLElement;
		const name = nameOf(row);
		await userEvent.click(row);
		const popover = await waitFor(() => {
			const element = document.querySelector<HTMLElement>(
				"[data-profile-popover]",
			);
			expect(element).not.toBeNull();
			return element as HTMLElement;
		});
		await expect(popover).toHaveAccessibleName(`${name}'s profile`);
		const near = () =>
			Math.abs(
				popover.getBoundingClientRect().top - row.getBoundingClientRect().top,
			);
		await expect(near()).toBeLessThan(120);
		await scrollTo(scroller, 12_000);
		await expect(row.isConnected).toBe(true);
		await scrollAndRest(scroller, 3000);
		await expect(row.isConnected).toBe(true);
		await expect(near()).toBeLessThan(120);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(popover).toHaveAttribute("data-closed"));
		await expect(popover.isConnected).toBe(true);
		await expect(popover).toHaveAccessibleName(`${name}'s profile`);
		await expect(popover).toHaveTextContent(name);
		await expect(
			popover.querySelector("[data-profile-popover-skeleton]"),
		).toBeNull();
		await waitFor(() => expect(popover.isConnected).toBe(false));
		await waitFor(() => expect(document.activeElement).toBe(row));
	},
};
