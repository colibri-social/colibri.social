import { createSignal } from "solid-js";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { Modal, ModalContent } from "../Modal/Modal";
import {
	SPACE_NOTIFICATION_COPY,
	type SpaceNotificationChoice,
	SpaceNotificationSettings,
} from "./SpaceNotificationSettings";

const meta = {
	title: "Settings/Space notifications",
	component: SpaceNotificationSettings,
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta<typeof SpaceNotificationSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

const State = () => {
	const [level, setLevel] = createSignal<SpaceNotificationChoice>("default");
	const [muted, setMuted] = createSignal(false);
	return {
		props: {
			get level() {
				return level();
			},
			defaultLevel: "mentionsAndReplies" as const,
			onLevelChange: setLevel,
			get muted() {
				return muted();
			},
			onMutedChange: setMuted,
		},
		level,
	};
};

const interact = async (dialog: HTMLElement) => {
	const scope = within(dialog);
	await expect(
		scope.getByRole("radio", { name: /Follow my default/ }),
	).toBeChecked();
	await waitFor(() =>
		expect(
			scope.getByText(
				"Uses your notification setting, currently mentions and replies.",
			),
		).toBeVisible(),
	);
	await userEvent.click(scope.getByText("Nothing"));
	await waitFor(() =>
		expect(scope.getByRole("radio", { name: /^Nothing/ })).toBeChecked(),
	);
	await userEvent.click(scope.getByText("Follow my default"));
	await waitFor(() =>
		expect(
			scope.getByRole("radio", { name: /Follow my default/ }),
		).toBeChecked(),
	);
	await userEvent.click(scope.getByText("Mute this Space"));
	await expect(
		scope.getByRole("switch", { name: /Mute this Space/ }),
	).toBeChecked();
};

export const InDrawer: Story = {
	args: {
		level: "default",
		defaultLevel: "all",
		onLevelChange: () => {},
		muted: false,
		onMutedChange: () => {},
	},
	render: () => {
		const state = State();
		return (
			<Drawer initialOpen>
				<DrawerContent
					aria-label={SPACE_NOTIFICATION_COPY.title}
					header={
						<div class="flex min-w-0 flex-col items-center gap-0.5 text-center">
							<h2 class="m-0 truncate text-xl leading-tight font-bold text-foreground">
								{SPACE_NOTIFICATION_COPY.title}
							</h2>
							<span class="max-w-full truncate text-sm text-muted-foreground">
								Hummingbird Club
							</span>
						</div>
					}
				>
					<SpaceNotificationSettings {...state.props} />
				</DrawerContent>
			</Drawer>
		);
	},
	play: async () => {
		const dialog = await screen.findByRole("dialog");
		await interact(dialog);
		const content = dialog.querySelector(
			"[data-space-notification-settings]",
		) as HTMLElement;
		await waitFor(() =>
			expect(content.getBoundingClientRect().bottom).toBeLessThanOrEqual(
				window.innerHeight + 1,
			),
		);
		await expectNoLayoutIssues(content);
	},
};

export const InModal: Story = {
	...InDrawer,
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: () => {
		const state = State();
		return (
			<Modal defaultOpen>
				<ModalContent
					title={SPACE_NOTIFICATION_COPY.title}
					description="Hummingbird Club"
					class="md:w-[440px]"
				>
					<SpaceNotificationSettings {...state.props} />
				</ModalContent>
			</Modal>
		);
	},
	play: async () => {
		const dialog = await screen.findByRole("dialog", {
			name: SPACE_NOTIFICATION_COPY.title,
		});
		await interact(dialog);
		await expectNoLayoutIssues(dialog);
	},
};
