import { TestTubeMinimalisticIcon } from "@solar-icons/solid/bold/test-tube-minimalistic";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { SettingsNotice } from "./SettingsNotice";

const BETA_TITLE = "Bridges are in beta";
const BETA_DESCRIPTION =
	"Bridges are free to use while they are in beta. After that, they will cost $5 a month per Space.";

const meta = {
	title: "Settings/Settings notice",
	component: SettingsNotice,
	parameters: { viewport: { defaultViewport: "iphone" } },
	args: {
		icon: undefined,
		title: BETA_TITLE,
		description: BETA_DESCRIPTION,
	},
} satisfies Meta<typeof SettingsNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BridgesBeta: Story = {
	render: (args) => (
		<div class="min-h-dvh bg-background p-4 text-foreground">
			<SettingsNotice {...args} icon={<TestTubeMinimalisticIcon />} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const notice = canvas.getByRole("status", { name: BETA_TITLE });

		await expect(notice).toHaveTextContent(BETA_DESCRIPTION);
		await expect(notice.querySelector("svg")).not.toBeNull();
		await expectNoLayoutIssues(notice);
	},
};

export const InBridgesIntro: Story = {
	render: (args) => (
		<div class="min-h-dvh bg-popover p-4 text-foreground">
			<div class="flex flex-col gap-3">
				<p class="m-0 text-sm text-muted-foreground">
					Bridges sync Colibri channels with other platforms.
				</p>
				<SettingsNotice {...args} icon={<TestTubeMinimalisticIcon />} />
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expectNoLayoutIssues(
			canvas.getByRole("status", { name: BETA_TITLE })
				.parentElement as HTMLElement,
		);
	},
};

export const DesktopWidth: Story = {
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: (args) => (
		<div class="min-h-dvh bg-background p-4 text-foreground">
			<div class="max-w-2xl">
				<SettingsNotice {...args} icon={<TestTubeMinimalisticIcon />} />
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expectNoLayoutIssues(
			canvas.getByRole("status", { name: BETA_TITLE }),
		);
	},
};
