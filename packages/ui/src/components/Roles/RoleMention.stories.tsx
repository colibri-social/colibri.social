import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import {
	createManyMembers,
	fixtureMembers,
	moderatorRole,
} from "../Members/fixtures";
import type { Member } from "../Members/MemberList";
import { ProfilePopover } from "../Profile/ProfilePopover";
import { RichTextProvider, type RichTextResolvers } from "../RichText/context";
import { build, f, mark } from "../RichText/fixtures";
import { RichTextRenderer } from "../RichText/RichText";
import { RoleMention } from "./RoleMention";

type Args = { onOpenMember: (member: Member) => void };

const meta: Meta<Args> = {
	title: "Messaging/Role mention",
	args: { onOpenMember: fn() },
};

export default meta;
type Story = StoryObj<Args>;

const value = build([
	"Heads up ",
	mark("@Moderators", f.role("mods")),
	", the spam wave is back in general.",
]);

const Demo = (props: {
	platform: "mobile" | "desktop";
	members?: Member[];
	onOpenMember: (member: Member) => void;
	profiles?: boolean;
}) => {
	const [profile, setProfile] = createSignal<Member>();
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	const [profileOpen, setProfileOpen] = createSignal(false);
	const resolvers: RichTextResolvers = {
		platform: props.platform,
		role: (rkey) =>
			rkey === "mods"
				? { rkey, name: "Moderators", color: moderatorRole.color }
				: undefined,
		wrapRole: (role, chip) => (
			<RoleMention
				platform={props.platform}
				role={{ ...moderatorRole, name: role.name, color: role.color }}
				members={props.members}
				onOpenMember={(member, event) => {
					props.onOpenMember(member);
					if (!props.profiles) return;
					setAnchor(event.currentTarget as HTMLElement);
					setProfile(member);
					setProfileOpen(true);
				}}
			>
				{chip}
			</RoleMention>
		),
	};
	return (
		<div class="p-4">
			<RichTextProvider value={resolvers}>
				<RichTextRenderer value={value} platform={props.platform} />
			</RichTextProvider>
			<ProfilePopover
				open={profileOpen()}
				onOpenChange={setProfileOpen}
				anchor={anchor}
				placement="right-start"
				profile={
					profile()
						? {
								displayName: profile()?.name ?? "",
								handle: "member.colibri.social",
								avatarSeed: profile()?.id,
								presence: "online",
							}
						: undefined
				}
			/>
		</div>
	);
};

const hoverBackgrounds = (element: HTMLElement) => {
	const found: string[] = [];
	for (const sheet of Array.from(document.styleSheets)) {
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		const queue = Array.from(rules);
		while (queue.length > 0) {
			const rule = queue.shift();
			if (rule && "cssRules" in rule && !(rule instanceof CSSStyleRule)) {
				queue.push(...Array.from((rule as CSSGroupingRule).cssRules));
				continue;
			}
			if (!(rule instanceof CSSStyleRule)) continue;
			if (!rule.selectorText.includes(":hover")) continue;
			const background = rule.style.backgroundColor;
			if (!background) continue;
			try {
				if (element.matches(rule.selectorText.replace(/(?<!\\):hover/g, "")))
					found.push(background);
			} catch {}
		}
	}
	return found;
};

const openChip = async (canvasElement: HTMLElement) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", {
			name: "Show members of Moderators",
		}),
	);
};

export const Desktop: Story = {
	render: (args) => (
		<div class="min-h-dvh pt-[420px] pl-4">
			<Demo
				platform="desktop"
				members={fixtureMembers()}
				onOpenMember={args.onOpenMember}
				profiles
			/>
		</div>
	),
	play: async ({ canvasElement, args }) => {
		await openChip(canvasElement);
		const popover = await screen.findByRole("dialog", {
			name: "Moderators members",
		});
		await expect(popover.offsetWidth).toBe(320);
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expectNoLayoutIssues(popover);
		await expect(popover).toHaveTextContent(/\d+ members · \d+ online/);
		const first = popover.querySelector<HTMLElement>("[data-member-row]");
		if (!first) throw new Error("No member rows");
		await expect(hoverBackgrounds(first)).toContain("var(--popover-highlight)");
		await userEvent.click(first);
		await expect(args.onOpenMember).toHaveBeenCalledOnce();
		const profile = await screen.findByRole("dialog", { name: /'s profile$/ });
		await waitFor(() => {
			const row = first.getBoundingClientRect();
			const box = profile.getBoundingClientRect();
			expect(Math.abs(box.top - row.top)).toBeLessThan(2);
			expect(box.left).toBeGreaterThanOrEqual(row.right);
		});
		await expect(popover).toBeInTheDocument();
		await expect(first.isConnected).toBe(true);
		await userEvent.click(profile);
		await expect(
			screen.getByRole("dialog", { name: "Moderators members" }),
		).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: /'s profile$/ }),
			).not.toBeInTheDocument(),
		);
		await expect(
			screen.getByRole("dialog", { name: "Moderators members" }),
		).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Moderators members" }),
			).not.toBeInTheDocument(),
		);
	},
};

export const DesktopManyMembers: Story = {
	render: (args) => (
		<Demo
			platform="desktop"
			members={createManyMembers(400)}
			onOpenMember={args.onOpenMember}
		/>
	),
	play: async ({ canvasElement }) => {
		await openChip(canvasElement);
		const popover = await screen.findByRole("dialog", {
			name: "Moderators members",
		});
		await waitFor(() =>
			expect(popover.getBoundingClientRect().height).toBeLessThanOrEqual(420),
		);
		await expect(popover).toHaveTextContent("400 members");
	},
};

export const Mobile: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: (args) => (
		<Demo
			platform="mobile"
			members={fixtureMembers()}
			onOpenMember={args.onOpenMember}
		/>
	),
	play: async ({ canvasElement, args }) => {
		await openChip(canvasElement);
		const drawer = await screen.findByRole("dialog", {
			name: "Moderators members",
		});
		await waitFor(() => expect(drawer).toBeVisible());
		await new Promise((resolve) => setTimeout(resolve, 400));
		await expectNoLayoutIssues(drawer);
		const header = drawer.querySelector<HTMLElement>(
			"[data-role-mention-header]",
		);
		if (!header) throw new Error("Missing header");
		const box = drawer.getBoundingClientRect();
		const inner = header.getBoundingClientRect();
		await expect(Math.round(inner.left - box.left)).toBe(16);
		await expect(inner.top - box.top).toBeGreaterThanOrEqual(16);
		await expect(
			document.activeElement?.closest("[data-member-row]"),
		).toBeNull();
		const first = drawer.querySelector<HTMLElement>("[data-member-row]");
		if (!first) throw new Error("No member rows");
		await userEvent.click(first);
		await expect(args.onOpenMember).toHaveBeenCalledOnce();
	},
};

export const Loading: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: (args) => <Demo platform="mobile" onOpenMember={args.onOpenMember} />,
	play: async ({ canvasElement }) => {
		await openChip(canvasElement);
		const drawer = await screen.findByRole("dialog", {
			name: "Moderators members",
		});
		await waitFor(() =>
			expect(
				drawer.querySelectorAll("[aria-hidden='true']").length,
			).toBeGreaterThan(0),
		);
	},
};

export const Empty: Story = {
	render: (args) => (
		<Demo platform="desktop" members={[]} onOpenMember={args.onOpenMember} />
	),
	play: async ({ canvasElement }) => {
		await openChip(canvasElement);
		await screen.findByText("No one has this role yet.");
	},
};
