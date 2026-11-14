import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import {
	SETTINGS_ENTRY_INFO,
	type SettingsEntries,
	type SettingsEntryId,
	SettingsIndex,
} from "./SettingsIndex";
import { STORAGE_NOTICE_COPY, StorageNotice } from "./StorageNotice";

const meta = {
	title: "Settings/Storage notice",
	component: StorageNotice,
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta<typeof StorageNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

const ENTRIES: SettingsEntryId[] = [
	"profile",
	"emojiPacks",
	"atmosphereAccount",
	"blockedUsers",
	"voiceVideo",
	"appearance",
];

const entries = Object.fromEntries(
	ENTRIES.map((id) => [id, { onSelect: () => {} }]),
) as SettingsEntries;

export const Hosted: Story = {
	args: { state: "hosted" },
	render: (args) => (
		<div class="min-h-dvh bg-background p-4 text-foreground">
			<StorageNotice {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const notice = canvas.getByRole("status", {
			name: STORAGE_NOTICE_COPY.hosted.title,
		});

		await expect(notice).toHaveTextContent(
			STORAGE_NOTICE_COPY.hosted.description,
		);
		await expect(canvas.queryByRole("progressbar")).toBeNull();
		await expectNoLayoutIssues(notice);
	},
};

export const Moving: Story = {
	args: { state: "moving", progress: { done: 2, total: 5 } },
	render: (args) => (
		<div class="min-h-dvh bg-background p-4 text-foreground">
			<StorageNotice {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const notice = canvas.getByRole("status", {
			name: STORAGE_NOTICE_COPY.moving.title,
		});
		const bar = canvas.getByRole("progressbar", {
			name: STORAGE_NOTICE_COPY.progressLabel,
		});

		await expect(bar).toHaveAttribute("aria-valuenow", "40");
		await expect(notice).toHaveTextContent("40%");
		await expectNoLayoutIssues(notice);
	},
};

export const MovingWithoutProgress: Story = {
	args: { state: "moving" },
	render: (args) => (
		<div class="min-h-dvh bg-background p-4 text-foreground">
			<StorageNotice {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"0",
		);
		await expectNoLayoutIssues(canvas.getByRole("status"));
	},
};

export const InSettingsIndex: Story = {
	args: { state: "hosted" },
	render: (args) => (
		<div class="min-h-dvh bg-background p-4 text-foreground">
			<SettingsIndex
				entries={entries}
				accountNotice={<StorageNotice {...args} />}
			/>
		</div>
	),
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const index = canvasElement.querySelector(
			"[data-settings-index]",
		) as HTMLElement;

		await step("the notice follows the Account rows", async () => {
			const notice = canvas.getByRole("status", {
				name: STORAGE_NOTICE_COPY.hosted.title,
			});
			const lastAccountRow = canvas.getByRole("button", {
				name: SETTINGS_ENTRY_INFO.blockedUsers.label,
			});
			const nextSection = canvas.getByRole("button", {
				name: SETTINGS_ENTRY_INFO.voiceVideo.label,
			});

			await expect(
				lastAccountRow.compareDocumentPosition(notice) &
					Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
			await expect(
				notice.compareDocumentPosition(nextSection) &
					Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
			await expectNoLayoutIssues(index);
		});

		await step("searching hides the notice", async () => {
			const search = canvas.getByRole("searchbox", { name: "Search settings" });

			await userEvent.type(search, "theme");
			await waitFor(() =>
				expect(
					canvas.queryByRole("status", {
						name: STORAGE_NOTICE_COPY.hosted.title,
					}),
				).toBeNull(),
			);
			await userEvent.clear(search);
		});
	},
};

export const InDesktopSidebar: Story = {
	args: { state: "moving", progress: { done: 1, total: 3 } },
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: (args) => (
		<div class="min-h-dvh bg-background p-4 text-foreground">
			<div class="w-60">
				<SettingsIndex
					variant="desktop"
					entries={entries}
					accountNotice={<StorageNotice {...args} />}
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const nav = canvas.getByRole("navigation", { name: "Settings" });
		const notice = within(nav).getByRole("status", {
			name: STORAGE_NOTICE_COPY.moving.title,
		});

		await expect(notice).toHaveTextContent("33%");
		await expectNoLayoutIssues(nav);
	},
};
