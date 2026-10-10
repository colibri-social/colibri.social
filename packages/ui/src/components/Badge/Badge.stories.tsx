import { CrownIcon } from "@solar-icons/solid/bold/crown";
import { ShieldCheckIcon } from "@solar-icons/solid/bold/shield-check";
import { UsersGroupRoundedIcon } from "@solar-icons/solid/bold/users-group-rounded";
import { For } from "solid-js";
import {
	expect,
	fireEvent,
	screen,
	userEvent,
	waitFor,
	within,
} from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { PlayTesterBadge } from "../../icons/animated/brand";
import {
	AppBadge,
	Badge,
	BOT_BADGE_DEFINITION,
	BotBadge,
	Chip,
	CountBadge,
	FALLBACK_BADGE_DEFINITIONS,
	MentionChip,
	TeamBadge,
	UserBadge,
} from "./Badge";

const meta = {
	title: "Primitives/Badge & Chip",
	component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LabelBadge: Story = {
	render: () => (
		<div class="flex items-center gap-2 text-base font-semibold">
			Lou <Badge>TEAM</Badge>
		</div>
	),
};

export const BotLabel: Story = {
	render: () => (
		<div class="flex items-center gap-2 text-base font-semibold">
			Colibri helper <BotBadge describe={false} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const badge = canvasElement.querySelector<HTMLElement>(
			'[data-user-badge="bot"]',
		);
		await expect(badge?.textContent).toBe("BOT");
		const style = getComputedStyle(badge as Element);
		await expect(style.backgroundColor).toBe("rgb(250, 250, 250)");
		await expect(style.color).toBe("rgb(10, 10, 10)");
		await expect(style.fontWeight).toBe("700");
		await expect(style.fontSize).toBe("12px");
		await expect(style.paddingLeft).toBe("6px");
	},
};

export const UserBadges: Story = {
	render: () => (
		<div class="flex flex-col gap-3 text-base font-semibold">
			<For each={[BOT_BADGE_DEFINITION, ...FALLBACK_BADGE_DEFINITIONS]}>
				{(definition) => (
					<div class="flex items-center gap-2">
						Lou <UserBadge definition={definition} />
					</div>
				)}
			</For>
			<div class="flex items-center gap-2">
				Lou <TeamBadge size="sm" />
			</div>
			<div class="flex items-center gap-2">
				Lou{" "}
				<UserBadge
					definition={{
						identifier: "custom",
						name: "LABELER",
						description: "A badge without an appearance",
					}}
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const tester = canvasElement.querySelector<HTMLElement>(
			'[data-user-badge="play-store-tester"]',
		);
		await expect(tester?.textContent).toBe("PLAY STORE TESTER");
		const testerStyle = getComputedStyle(tester as Element);
		await expect(testerStyle.backgroundImage).toContain("linear-gradient");
		await expect(testerStyle.borderTopWidth).toBe("1px");
		await expect(testerStyle.borderTopLeftRadius).not.toBe("4px");
		const team = canvasElement.querySelector<HTMLElement>(
			'[data-user-badge="team"]',
		);
		await expect(team?.textContent).toBe("TEAM");
		const triggers = canvas.getAllByRole("button", { name: "TEAM" });
		(triggers[0] as HTMLElement).focus();
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(
				within(screen.getByRole("dialog", { name: "TEAM" })).getByText(
					"Official Colibri Maintainer",
				),
			).toBeVisible(),
		);
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "TEAM" })).toBeNull(),
		);
	},
};

export const Counts: Story = {
	render: () => (
		<div class="flex items-center gap-4">
			<CountBadge count={1} />
			<CountBadge count={12} />
			<CountBadge count={150} />
			<CountBadge count={0} />
		</div>
	),
};

export const Chips: Story = {
	render: () => (
		<div class="flex flex-wrap items-center gap-2">
			<Chip icon={<UsersGroupRoundedIcon />}>20 Members</Chip>
			<Chip icon={<CrownIcon />}>By @lou.gg</Chip>
			<Chip icon={<ShieldCheckIcon color="#5ac8fa" />}>Moderator</Chip>
		</div>
	),
};

export const DescendersFit: Story = {
	render: () => <Chip>By @lou.gg</Chip>,
	play: async ({ canvasElement }) => {
		const label = canvasElement.querySelector(".truncate") as HTMLElement;
		await expect(label.scrollHeight).toBeLessThanOrEqual(label.clientHeight);
	},
};

export const Mention: Story = {
	render: () => (
		<p class="max-w-[300px] text-base leading-6">
			<MentionChip>@Lou</MentionChip> I am the crow whisperer, and{" "}
			<MentionChip>@someone.with.a.long.handle</MentionChip> agrees.
		</p>
	),
};

export const MentionKinds: Story = {
	render: () => (
		<div class="flex flex-col gap-3 text-base leading-6">
			<p>
				Known user: <MentionChip kind="user">@Lou</MentionChip>
			</p>
			<p>
				Unknown user: <MentionChip kind="unknown">@left.the.space</MentionChip>
			</p>
			<p>
				Bridged user:{" "}
				<MentionChip kind="bridged" platform="Matrix">
					@crowfriend
				</MentionChip>
			</p>
			<p>
				Role:{" "}
				<MentionChip kind="role" roleColor="#5ac8fa">
					@Moderators
				</MentionChip>{" "}
				<MentionChip kind="role" roleColor="#4ade80">
					@Birders
				</MentionChip>
			</p>
			<p>
				Deleted role: <MentionChip kind="role">@Unknown Role</MentionChip>
			</p>
		</div>
	),
	play: async ({ canvasElement }) => {
		const user = canvasElement.querySelector('[data-mention-kind="user"]')!;
		const bridged = canvasElement.querySelector(
			'[data-mention-kind="bridged"]',
		)!;
		await expect(getComputedStyle(user).cursor).toBe("pointer");
		await expect(getComputedStyle(bridged).cursor).not.toBe("pointer");
		await expect(bridged).toHaveAttribute("title", "On Matrix");
	},
};

const tap = async (element: HTMLElement) => {
	await fireEvent.pointerDown(element, { pointerType: "touch", button: 0 });
	await fireEvent.pointerUp(element, { pointerType: "touch", button: 0 });
	await fireEvent.click(element, { detail: 1 });
};

export const BadgeInfoOnProfile: Story = {
	render: () => (
		<div class="flex items-center gap-2 p-16 text-2xl font-bold">
			Lou
			<TeamBadge size="sm" />
			<AppBadge
				name="Play Store tester"
				description="Helped test the Colibri App for the Play Store release"
				icon={<PlayTesterBadge size={16} />}
			/>
		</div>
	),
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const team = canvas.getByRole("button", { name: "TEAM" });
		const app = canvas.getByRole("button", { name: "Play Store tester" });

		await step("Hover shows a tooltip on desktop", async () => {
			await userEvent.hover(app);
			const tooltip = await screen.findByRole("tooltip", {}, { timeout: 3000 });
			await expect(tooltip).toHaveTextContent("Play Store tester");
			await expect(tooltip).toHaveTextContent(
				"Helped test the Colibri App for the Play Store release",
			);
			await userEvent.click(app);
			await expect(screen.queryByRole("dialog")).toBeNull();
			await userEvent.unhover(app);
			await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
		});

		await step("Keyboard focus shows the tooltip", async () => {
			team.focus();
			await waitFor(
				() =>
					expect(screen.getByRole("tooltip")).toHaveTextContent(
						"Official Colibri Maintainer",
					),
				{ timeout: 3000 },
			);
			team.blur();
			await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
		});

		await step("A tap opens a popover on touch", async () => {
			await tap(app);
			const dialog = await screen.findByRole("dialog", {
				name: "Play Store tester",
			});
			await expect(dialog).toHaveTextContent(
				"Helped test the Colibri App for the Play Store release",
			);
			await expect(app).toHaveAttribute("aria-expanded", "true");
			await expect(screen.queryByRole("tooltip")).toBeNull();
			await tap(app);
			await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
			await expect(app).toHaveAttribute("aria-expanded", "false");
		});
	},
};
