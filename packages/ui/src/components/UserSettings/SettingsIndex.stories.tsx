import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { LargeModalContent, Modal, ModalTrigger } from "../Modal/Modal";
import {
	SETTINGS_ENTRY_INFO,
	type SettingsEntries,
	type SettingsEntryId,
	SettingsIndex,
} from "./SettingsIndex";

const meta = {
	title: "Settings/Settings index",
	component: SettingsIndex,
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta<typeof SettingsIndex>;

export default meta;
type Story = StoryObj<typeof meta>;

const MAIN_ORDER: SettingsEntryId[] = [
	"profile",
	"emojiPacks",
	"atmosphereAccount",
	"voiceVideo",
	"appearance",
	"chat",
	"notifications",
	"advanced",
	"whatsNew",
	"feedback",
	"documentation",
	"support",
	"experiments",
];

const DEVELOPER_ORDER: SettingsEntryId[] = [
	"copyDid",
	"pdsls",
	"debugInfo",
	"logs",
];

const selected = fn();

const entriesFor = (ids: SettingsEntryId[]): SettingsEntries =>
	Object.fromEntries(
		ids.map((id) => [
			id,
			id === "atmosphereAccount" || id === "pdsls"
				? { href: "https://example.com/", external: true }
				: { onSelect: () => selected(id) },
		]),
	);

const label = (id: SettingsEntryId) => SETTINGS_ENTRY_INFO[id].label;

const rowLabels = (root: HTMLElement) =>
	Array.from(root.querySelectorAll("[data-search-label]"))
		.filter((element) => element.closest("[hidden]") === null)
		.map((element) => element.textContent?.trim());

export const Mobile: Story = {
	args: {
		entries: entriesFor([...MAIN_ORDER, ...DEVELOPER_ORDER]),
		onLogOut: fn(),
	},
	render: (args) => (
		<div class="min-h-dvh bg-background p-4 text-foreground">
			<SettingsIndex {...args} />
		</div>
	),
	play: async ({ canvasElement, args, step }) => {
		const canvas = within(canvasElement);
		const index = canvasElement.querySelector(
			"[data-settings-index]",
		) as HTMLElement;

		await step(
			"rows follow Figma without Accessibility and Language",
			async () => {
				await expect(rowLabels(index)).toEqual([
					...MAIN_ORDER.map(label),
					"Log out",
					...DEVELOPER_ORDER.map(label),
				]);
				await expect(canvas.queryByText("Accessibility")).toBeNull();
				await expect(canvas.queryByText("Language")).toBeNull();
			},
		);

		await step("rows are 40px and span the column", async () => {
			const width = index.getBoundingClientRect().width;
			for (const name of ["Profile", "Appearance", "Logs"]) {
				const row = canvas.getByText(name).closest("a, button") as HTMLElement;
				const box = row.getBoundingClientRect();
				await expect(Math.round(box.height)).toBe(40);
				await expect(Math.round(box.width)).toBe(Math.round(width));
			}
			await expectNoLayoutIssues(index);
		});

		await step("rows call their handlers", async () => {
			selected.mockClear();
			await userEvent.click(canvas.getByRole("button", { name: "Chat" }));
			await expect(selected).toHaveBeenCalledWith("chat");
			await userEvent.click(canvas.getByRole("button", { name: "Log out" }));
			await expect(args.onLogOut).toHaveBeenCalledOnce();
			const atmosphere = canvas.getByRole("link", {
				name: "My Atmosphere Account",
			});
			await expect(atmosphere).toHaveAttribute("target", "_blank");
		});

		await step("search narrows the rows", async () => {
			const search = canvas.getByRole("searchbox", { name: "Search settings" });
			await userEvent.type(search, "theme");
			await waitFor(() => expect(rowLabels(index)).toEqual(["Appearance"]));
			await userEvent.clear(search);
			await userEvent.type(search, "zzz");
			await waitFor(() =>
				expect(canvas.getByRole("status")).toHaveTextContent(
					'No settings match "zzz"',
				),
			);
			await userEvent.clear(search);
			await waitFor(() => expect(rowLabels(index)).toContain("Logs"));
		});
	},
};

export const MobileWithoutDeveloperMode: Story = {
	args: {
		entries: entriesFor(MAIN_ORDER.filter((id) => id !== "emojiPacks")),
		onLogOut: fn(),
	},
	render: (args) => (
		<div class="min-h-dvh bg-background p-4 text-foreground">
			<SettingsIndex {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByText("Developer mode")).toBeNull();
		await expect(canvas.queryByText("My emoji packs")).toBeNull();
		await expect(canvas.getByText("Log out")).toBeVisible();
	},
};

export const Desktop: Story = {
	args: {
		variant: "desktop",
		entries: entriesFor([...MAIN_ORDER, ...DEVELOPER_ORDER]),
		onLogOut: fn(),
	},
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: (args) => {
		const [active, setActive] = createSignal<SettingsEntryId>("appearance");
		const entries = () =>
			Object.fromEntries(
				Object.entries(args.entries).map(([id, action]) => [
					id,
					action?.href
						? action
						: { onSelect: () => setActive(id as SettingsEntryId) },
				]),
			) as SettingsEntries;
		return (
			<Modal defaultOpen>
				<ModalTrigger as={Button}>Open settings</ModalTrigger>
				<LargeModalContent
					title={SETTINGS_ENTRY_INFO[active()].label}
					sidebar={
						<SettingsIndex {...args} entries={entries()} active={active()} />
					}
				>
					<p class="m-0 text-sm text-muted-foreground">
						{SETTINGS_ENTRY_INFO[active()].label} settings go here.
					</p>
				</LargeModalContent>
			</Modal>
		);
	},
	play: async ({ step }) => {
		const dialog = await screen.findByRole("dialog", { name: "Appearance" });
		const nav = within(dialog).getByRole("navigation", { name: "Settings" });

		await step("the active page is marked", async () => {
			await expect(
				within(nav).getByRole("button", { name: "Appearance" }),
			).toHaveAttribute("aria-current", "page");
		});

		await step("picking a page switches it", async () => {
			await userEvent.click(within(nav).getByRole("button", { name: "Chat" }));
			await waitFor(() =>
				expect(
					within(nav).getByRole("button", { name: "Chat" }),
				).toHaveAttribute("aria-current", "page"),
			);
			await expect(
				within(nav).getByRole("button", { name: "Appearance" }),
			).not.toHaveAttribute("aria-current");
		});

		await step("log out sits between Other and Developer mode", async () => {
			const labels = rowLabels(nav as HTMLElement);
			const logOut = labels.indexOf("Log out");
			await expect(labels[logOut - 1]).toBe("Experiments");
			await expect(labels[logOut + 1]).toBe("Copy DID");
		});

		await step("the sidebar fits without overflow", async () => {
			await expectNoLayoutIssues(dialog);
		});
	},
};
