import { BellIcon } from "@solar-icons/solid/bold/bell";
import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import { For } from "solid-js";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { IconButton } from "../IconButton/IconButton";
import { SectionLabel } from "../List/List";
import { fixtureMembers, fixtureRoles } from "./fixtures";
import { groupMembers, MemberList, memberGroupHeaderClass } from "./MemberList";
import { MemberRow } from "./MemberRow";
import {
	MemberGroupHeaderSkeleton,
	MemberRowSkeleton,
} from "./MemberSkeletons";

const meta = {
	title: "Navigation/Members",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };
const onOpen = fn();

export const MobileScreen: Story = {
	parameters: iphone,
	render: () => (
		<div class="min-h-dvh bg-popover pb-safe-offset-6 text-foreground">
			<div class="flex h-12 items-center justify-between gap-2 p-2 pt-safe-offset-2">
				<IconButton
					variant="ghost"
					size="md"
					label="Back"
					icon={<ArrowLeftIcon />}
				/>
				<div class="flex items-center gap-1">
					<IconButton
						variant="ghost"
						size="md"
						label="Notifications"
						icon={<BellIcon />}
					/>
					<IconButton
						variant="ghost"
						size="md"
						label="Channel settings"
						icon={<SettingsIcon />}
					/>
				</div>
			</div>
			<div class="flex flex-col gap-2 border-b border-border px-4 pt-2 pb-4">
				<h1 class="m-0 flex items-center gap-2 text-xl font-bold">
					<span class="flex size-6 items-center justify-center [&>svg]:size-6">
						<ChatSquareDotsIcon />
					</span>
					general
				</h1>
				<p class="m-0 text-sm text-muted-foreground">
					A place for everything birds, canals and the occasional sandwich.
				</p>
			</div>
			<MemberList
				class="px-4 pt-4"
				variant="mobile"
				groups={groupMembers(fixtureMembers(), fixtureRoles)}
				onOpen={(member) => onOpen(member.id)}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		onOpen.mockClear();
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Online")).toBeInTheDocument();
		const online = canvasElement.querySelector(
			'[data-member-group="online"]',
		) as HTMLElement;
		await expect(online.getAttribute("aria-label")).toBe("Online, 3");
		await expect(within(online).getByText("· 3")).toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: /^Kris/ }));
		await expect(onOpen).toHaveBeenCalledTimes(1);
		await expect(onOpen).toHaveBeenCalledWith("kris");
	},
};

export const DesktopSidebar: Story = {
	render: () => (
		<div class="h-dvh w-72 overflow-y-auto border-l border-border bg-card text-foreground">
			<MemberList
				groups={groupMembers(fixtureMembers(), fixtureRoles)}
				onOpen={(member) => onOpen(member.id)}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const groups = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-member-group]"),
		).map((group) => group.dataset.memberGroup);
		await expect(groups).toEqual(["role", "online", "bots", "offline"]);
		const offline = canvasElement.querySelector(
			'[data-member-group="offline"]',
		) as HTMLElement;
		const rows = offline.querySelectorAll<HTMLElement>("[data-member-row]");
		await expect(rows.length).toBe(2);
		for (const row of rows) {
			await expect(row).toHaveAttribute("data-offline");
			const avatar = row.firstElementChild as HTMLElement;
			await expect(getComputedStyle(avatar).opacity).toBe("0.5");
			await expect(
				within(row).getByRole("img", { name: /Offline$/ }),
			).toBeInTheDocument();
		}
		const bots = canvasElement.querySelector(
			'[data-member-group="bots"]',
		) as HTMLElement;
		await expect(within(bots).getAllByText("BOT").length).toBe(2);

		const list = canvasElement.querySelector<HTMLElement>("[data-member-list]");
		const listStyle = getComputedStyle(list as HTMLElement);
		await expect(listStyle.paddingTop).toBe("16px");
		await expect(listStyle.paddingLeft).toBe("8px");
		await expect(listStyle.rowGap).toBe("16px");
		const firstGroup = canvasElement.querySelector<HTMLElement>(
			"[data-member-group]",
		);
		await expect(getComputedStyle(firstGroup as HTMLElement).rowGap).toBe(
			"8px",
		);
		const header = (firstGroup as HTMLElement).firstElementChild as HTMLElement;
		const headerText = header.querySelector("span") as HTMLElement;
		await expect(getComputedStyle(headerText).fontWeight).toBe("400");
		await expect(getComputedStyle(headerText).fontSize).toBe("14px");
		await expect(Math.round(header.getBoundingClientRect().height)).toBe(18);
		const row = canvasElement.querySelector<HTMLElement>("[data-member-row]");
		const rowStyle = getComputedStyle(row as HTMLElement);
		await expect(
			Math.round((row as HTMLElement).getBoundingClientRect().height),
		).toBe(44);
		await expect(rowStyle.borderTopLeftRadius).toBe("12px");
		await expect(rowStyle.paddingLeft).toBe("6px");
		await expect(rowStyle.paddingTop).toBe("6px");
		await expect(rowStyle.paddingBottom).toBe("6px");
		const avatar = (row as HTMLElement).firstElementChild as HTMLElement;
		await expect(Math.round(avatar.getBoundingClientRect().width)).toBe(32);
	},
};

export const RowStates: Story = {
	render: () => (
		<div class="flex w-80 flex-col gap-6 bg-background p-4 text-foreground">
			<div class="flex flex-col bg-card p-2">
				<For each={fixtureMembers().slice(0, 4)}>
					{(member) => (
						<MemberRow
							name={member.name}
							avatarSrc={member.avatarSrc}
							avatarColor={member.avatarColor}
							presence={member.presence}
							status={member.status}
							role={member.role}
							owner={member.owner}
							onOpen={() => onOpen(member.id)}
						/>
					)}
				</For>
				<MemberRow
					name="Colibri helper"
					avatarColor="#404040"
					presence="online"
					status="Type /help"
					bot
					onOpen={() => onOpen("helper")}
				/>
				<MemberRow
					name="Pim"
					avatarColor="#525252"
					presence="online"
					status="Back on Monday"
					statusShowWhileOffline
					offline
				/>
			</div>
			<div class="flex flex-col overflow-hidden rounded-control bg-secondary">
				<MemberRow
					variant="mobile"
					name="Lou"
					presence="online"
					status="Building a nest"
					onOpen={() => onOpen("lou")}
				/>
				<MemberRow variant="mobile" name="Ola" presence="offline" offline />
			</div>
		</div>
	),
};

export const SizeParity: Story = {
	render: () => (
		<div class="flex w-80 flex-col gap-2 bg-card p-2 text-foreground">
			<div data-pair="status">
				<MemberRow name="Lou" presence="online" status="Building a nest" />
				<MemberRowSkeleton status />
			</div>
			<div data-pair="plain">
				<MemberRow name="Mara" presence="online" />
				<MemberRowSkeleton />
			</div>
			<div data-pair="offline">
				<MemberRow name="Pim" presence="offline" status="Away" offline />
				<MemberRowSkeleton status />
			</div>
			<div data-pair="mobile">
				<MemberRow variant="mobile" name="Kris" presence="online" />
				<MemberRowSkeleton variant="mobile" />
			</div>
			<div data-pair="header" class="flex flex-col">
				<SectionLabel class={memberGroupHeaderClass} label="Online" count={3} />
				<MemberGroupHeaderSkeleton />
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		for (const pair of canvasElement.querySelectorAll("[data-pair]")) {
			const [real, skeleton] = Array.from(pair.children) as HTMLElement[];
			const a = (real as HTMLElement).getBoundingClientRect();
			const b = (skeleton as HTMLElement).getBoundingClientRect();
			await expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
			await expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
		}
	},
};

export const GroupingHelper: Story = {
	render: () => <div />,
	play: async () => {
		const groups = groupMembers(fixtureMembers(), fixtureRoles);
		await expect(groups.map((group) => group.label)).toEqual([
			"Moderators",
			"Online",
			"Bots",
			"Offline",
		]);
		await expect(groups.map((group) => group.members.length)).toEqual([
			3, 3, 2, 2,
		]);
		await expect(groups[1]?.members.map((member) => member.id)).toEqual([
			"kris",
			"mara",
			"noor",
		]);
	},
};

export const RoleColorsAndBadges: Story = {
	render: () => (
		<div class="h-dvh w-72 overflow-y-auto border-l border-border bg-card text-foreground">
			<MemberList
				groups={groupMembers(fixtureMembers(), fixtureRoles)}
				onOpen={(member) => onOpen(member.id)}
			/>
		</div>
	),
	play: async ({ canvasElement, step }) => {
		const nameOf = (name: string) =>
			Array.from(
				canvasElement.querySelectorAll<HTMLElement>("[data-member-name]"),
			).find((element) => element.textContent === name) as HTMLElement;

		await step("Names use the top role color, else plain", async () => {
			await expect(getComputedStyle(nameOf("Lou")).color).toBe(
				"rgb(196, 167, 255)",
			);
			await expect(getComputedStyle(nameOf("Kris")).color).toBe(
				"rgb(255, 216, 87)",
			);
			await expect(getComputedStyle(nameOf("Mara")).color).toBe(
				"rgb(255, 255, 255)",
			);
		});

		await step("The role group header shows the role badge", async () => {
			const group = canvasElement.querySelector(
				'[data-member-group="role"]',
			) as HTMLElement;
			const header = group.firstElementChild as HTMLElement;
			const badge = within(header).getByRole("button", {
				name: "Moderators role",
			});
			await expect(badge).toBeVisible();
			await expect(Math.round(header.getBoundingClientRect().height)).toBe(18);
		});

		await step(
			"Rows show the badge after the name without nesting buttons",
			async () => {
				const row = nameOf("Lou").closest("[data-member-row]") as HTMLElement;
				const badge = row.querySelector<HTMLElement>("[data-role-badge]");
				await expect(badge).not.toBeNull();
				await expect(badge).toHaveAttribute("role", "img");
				await expect(badge).toHaveAccessibleName("Moderators role");
				await expect(row.querySelectorAll("button").length).toBe(0);
				const glyph = badge?.querySelector("[data-role-badge-glyph]");
				await expect(
					Math.round(glyph?.getBoundingClientRect().width ?? 0),
				).toBe(16);
				await expect(
					nameOf("Lou").compareDocumentPosition(badge as Node) &
						Node.DOCUMENT_POSITION_FOLLOWING,
				).toBeTruthy();
			},
		);
	},
};

export const StatusWhileOffline: Story = {
	render: () => (
		<div class="flex w-80 flex-col gap-6 bg-background p-4 text-foreground">
			<div class="flex flex-col bg-card p-2">
				<MemberRow
					name="Ola"
					avatarColor="#525252"
					presence="offline"
					status="Out on the water"
					offline
				/>
				<MemberRow
					name="Pim"
					avatarColor="#525252"
					presence="offline"
					status="Back on Monday"
					statusShowWhileOffline
					offline
				/>
				<MemberRow name="Lou" presence="online" status="Building a nest" />
			</div>
			<MemberList groups={groupMembers(fixtureMembers(), fixtureRoles)} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByText("Out on the water")).toBeNull();
		await expect(canvas.getAllByText("Back on Monday").length).toBe(2);
		await expect(canvas.getAllByText("Building a nest").length).toBeGreaterThan(
			0,
		);
	},
};
