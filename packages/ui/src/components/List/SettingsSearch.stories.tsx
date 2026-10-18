import { BellIcon } from "@solar-icons/solid/bold/bell";
import { EyeIcon } from "@solar-icons/solid/bold/eye";
import { LockIcon } from "@solar-icons/solid/bold/lock";
import { Logout2Icon } from "@solar-icons/solid/bold/logout-2";
import { MicrophoneIcon } from "@solar-icons/solid/bold/microphone";
import { PaletteIcon } from "@solar-icons/solid/bold/palette";
import { UserIcon } from "@solar-icons/solid/bold/user";
import { VideocameraIcon } from "@solar-icons/solid/bold/videocamera";
import { createSignal, type JSX } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { SearchField } from "../TextField/TextField";
import {
	DestructiveRow,
	ListGroup,
	NavRow,
	SidebarNav,
	SidebarNavItem,
	SidebarNavSection,
	ToggleRow,
} from "./List";
import { SettingsSearch, SettingsSearchEmpty } from "./settings-search";

const meta = {
	title: "Navigation/Settings search",
	component: SettingsSearch,
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta<typeof SettingsSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

const highlightCount = () =>
	typeof CSS !== "undefined" && "highlights" in CSS
		? (CSS.highlights.get("settings-search")?.size ?? 0)
		: 0;

const isShown = (element: HTMLElement) =>
	element.closest("[hidden]") === null && element.offsetParent !== null;

export const UserSettingsRoot: Story = {
	args: { query: "", children: undefined },
	render: () => {
		const [query, setQuery] = createSignal("");
		return (
			<div class="flex min-h-dvh flex-col gap-6 bg-popover p-4 text-foreground">
				<SearchField
					aria-label="Search settings"
					placeholder="Search settings"
					value={query()}
					onChange={setQuery}
				/>
				<SettingsSearch query={query()}>
					<ListGroup label="Account">
						<NavRow label="Profile" icon={<UserIcon />} />
						<NavRow
							label="Privacy & safety"
							icon={<LockIcon />}
							keywords={["blocked users", "direct messages"]}
						/>
					</ListGroup>
					<ListGroup label="App">
						<NavRow label="Appearance" icon={<PaletteIcon />} value="Dark" />
						<NavRow label="Notifications" icon={<BellIcon />} />
						<ToggleRow
							title="Reduce motion"
							description="Turn off animations and parallax."
						/>
					</ListGroup>
					<ListGroup>
						<DestructiveRow label="Log out" icon={<Logout2Icon />} />
					</ListGroup>
					<SettingsSearchEmpty />
				</SettingsSearch>
			</div>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const search = canvas.getByRole("searchbox", { name: "Search settings" });
		const account = canvas.getByText("Account");
		const app = canvas.getByText("App");
		const profile = canvas.getByRole("button", { name: "Profile" });
		const privacy = canvas.getByRole("button", { name: "Privacy & safety" });
		const motion = canvas.getByRole("switch", { name: /Reduce motion/ });
		const logout = canvas.getByRole("button", { name: "Log out" });

		await step("Matches a label and hides empty sections", async () => {
			await userEvent.type(search, "app");
			await waitFor(() => expect(isShown(app)).toBe(true));
			await expect(
				isShown(canvas.getByRole("button", { name: /Appearance/ })),
			).toBe(true);
			await expect(isShown(account)).toBe(false);
			await expect(isShown(logout)).toBe(false);
			await expect(isShown(motion)).toBe(false);
			const appearance = canvas.getByRole("button", { name: /Appearance/ });
			await expect(getComputedStyle(appearance).borderTopWidth).toBe("0px");
		});

		await step("Matches a description", async () => {
			await userEvent.clear(search);
			await userEvent.type(search, "animations");
			await waitFor(() => expect(isShown(motion)).toBe(true));
			await expect(isShown(profile)).toBe(false);
			if ("highlights" in CSS) {
				await waitFor(() => {
					const ranges = [
						...(CSS.highlights.get("settings-search") ?? []),
					] as Range[];
					expect(
						ranges.some((range) =>
							range.startContainer.parentElement?.closest(
								"[data-search-description]",
							),
						),
					).toBe(true);
				});
			}
		});

		await step("Matches keywords and folds accents", async () => {
			await userEvent.clear(search);
			await userEvent.type(search, "Blöcked");
			await waitFor(() => expect(isShown(privacy)).toBe(true));
			await expect(isShown(profile)).toBe(false);
		});

		await step("Highlights the matched text in labels", async () => {
			await userEvent.clear(search);
			await userEvent.type(search, "pro");
			await waitFor(() => expect(isShown(profile)).toBe(true));
			if ("highlights" in CSS) {
				await waitFor(() => expect(highlightCount()).toBeGreaterThan(0));
			}
		});

		await step("Shows an empty state", async () => {
			await userEvent.clear(search);
			await userEvent.type(search, "zebra");
			const empty = await canvas.findByRole("status");
			await expect(empty).toHaveTextContent('No settings match "zebra"');
			await expect(highlightCount()).toBe(0);
		});

		await step("Clearing restores everything", async () => {
			await userEvent.clear(search);
			await waitFor(() => expect(isShown(logout)).toBe(true));
			await expect(isShown(account)).toBe(true);
			await expect(isShown(motion)).toBe(true);
			await expect(canvas.queryByRole("status")).toBeNull();
			const rows = [profile, privacy];
			await expect(getComputedStyle(rows[1]).borderTopWidth).toBe("1px");
		});
	},
};

export const DesktopSidebar: Story = {
	args: { query: "", children: undefined },
	render: () => {
		const [query, setQuery] = createSignal("");
		const [active, setActive] = createSignal("profile");
		const item = (
			id: string,
			label: string,
			icon: JSX.Element,
			keywords?: string[],
		) => (
			<SidebarNavItem
				label={label}
				icon={icon}
				keywords={keywords}
				active={active() === id}
				onClick={() => setActive(id)}
			/>
		);
		return (
			<div class="flex w-64 flex-col gap-4 rounded-surface bg-card p-4 text-foreground">
				<SearchField
					aria-label="Search settings"
					placeholder="Search"
					value={query()}
					onChange={setQuery}
				/>
				<SettingsSearch query={query()}>
					<SidebarNav aria-label="Settings">
						<SidebarNavSection label="User settings">
							{item("profile", "Profile", <UserIcon />)}
							{item("privacy", "Privacy & safety", <EyeIcon />, ["blocked"])}
						</SidebarNavSection>
						<SidebarNavSection label="App settings">
							{item("voice", "Voice", <MicrophoneIcon />, [
								"microphone",
								"input",
							])}
							{item("video", "Video", <VideocameraIcon />, ["camera"])}
							{item("notifications", "Notifications", <BellIcon />)}
						</SidebarNavSection>
					</SidebarNav>
					<SettingsSearchEmpty class="py-6" />
				</SettingsSearch>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const search = canvas.getByRole("searchbox", { name: "Search settings" });
		const userSection = canvas.getByText("User settings");
		const voice = canvas.getByRole("button", { name: "Voice" });
		await userEvent.type(search, "camera");
		const video = canvas.getByRole("button", { name: "Video" });
		await waitFor(() => expect(isShown(video)).toBe(true));
		await expect(isShown(voice)).toBe(false);
		await expect(isShown(userSection)).toBe(false);
		await userEvent.click(video);
		await expect(video).toHaveAttribute("aria-current", "page");
		await userEvent.clear(search);
		await waitFor(() => expect(isShown(userSection)).toBe(true));
	},
};
