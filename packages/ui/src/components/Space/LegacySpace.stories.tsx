import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { Modal, ModalContent, ModalTrigger } from "../Modal/Modal";
import {
	LEGACY_MIGRATION_STEPS,
	LegacySpace,
	type LegacySpaceProps,
	type LegacySpaceVariant,
	legacySpaceTitle,
} from "./LegacySpace";

const meta = {
	title: "Surfaces/Legacy community",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const onMigrate = fn();
const onDismiss = fn();
const onRetry = fn();
const onClose = fn();

const Frame = (
	props: Partial<LegacySpaceProps> & { variant: LegacySpaceVariant },
) => (
	<div class="flex min-h-dvh flex-col justify-center bg-popover text-foreground">
		<LegacySpace
			name="Night Owls"
			iconSrc={storyImages.tealIcon()}
			memberCount={42}
			channelCount={7}
			onMigrate={onMigrate}
			onDismiss={onDismiss}
			onRetry={onRetry}
			onClose={onClose}
			{...props}
		/>
	</div>
);

export const WaitingForOwner: Story = {
	render: () => <Frame variant="waiting" ownerHandle="finch.bsky.social" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Night Owls isn't on Spaces yet" }),
		).toBeVisible();
		await expect(canvas.getByText("@finch.bsky.social")).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const WaitingWithoutOwner: Story = {
	render: () => <Frame variant="waiting" />,
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(/Ask the owner to move it to Spaces\./),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

const MoveFlow = () => {
	const [variant, setVariant] = createSignal<LegacySpaceVariant>("migratable");
	return (
		<Frame
			variant={variant()}
			onReview={() => setVariant("review")}
			onBack={() => setVariant("migratable")}
			onMigrate={() => {
				onMigrate();
				setVariant("moving");
			}}
			progress={{ step: "readingLegacyRepo", completed: 0 }}
		/>
	);
};

export const AdminReviewsAndMoves: Story = {
	render: () => <MoveFlow />,
	play: async ({ canvasElement }) => {
		onMigrate.mockClear();
		const canvas = within(canvasElement);
		await expectNoLayoutIssues(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Review the move" }),
		);
		await expect(canvas.getByText("Moves over")).toBeVisible();
		await expect(canvas.getByText("Stays behind")).toBeVisible();
		await expect(
			canvas.getByText(
				"Channels, categories and members (7 channels, 42 members)",
			),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Back" }));
		await userEvent.click(
			canvas.getByRole("button", { name: "Review the move" }),
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Move to Spaces" }),
		);
		await expect(onMigrate).toHaveBeenCalledTimes(1);
		await expect(
			canvas.getByRole("heading", { name: "Moving Night Owls" }),
		).toBeVisible();
	},
};

export const Moving: Story = {
	render: () => (
		<Frame
			variant="moving"
			progress={{ step: "migratingChannels", completed: 7 }}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const bar = canvas.getByRole("progressbar", { name: "Move progress" });
		await expect(bar).toHaveAttribute("aria-valuenow", "7");
		await expect(bar).toHaveAttribute(
			"aria-valuemax",
			String(LEGACY_MIGRATION_STEPS.length),
		);
		const steps = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-legacy-step]"),
		).map((step) => step.dataset.legacyStep);
		await expect(steps.slice(0, 8)).toEqual([
			"done",
			"done",
			"done",
			"done",
			"done",
			"done",
			"done",
			"active",
		]);
		await expect(steps.at(-1)).toBe("pending");
		await expectNoLayoutIssues(canvasElement);
	},
};

export const Failed: Story = {
	render: () => (
		<Frame
			variant="failed"
			progress={{ step: "mirroringMessages", completed: 9 }}
		/>
	),
	play: async ({ canvasElement }) => {
		onRetry.mockClear();
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "The move stopped partway" }),
		).toBeVisible();
		await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
		await expect(onRetry).toHaveBeenCalledTimes(1);
		await expectNoLayoutIssues(canvasElement);
	},
};

export const BlockedOwnerRepo: Story = {
	render: () => <Frame variant="blocked" blockedReason="ownerRepo" />,
	play: async ({ canvasElement }) => {
		onDismiss.mockClear();
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(/made with an early version of Colibri/),
		).toBeVisible();
		await expect(
			canvas.queryByRole("button", { name: "Try again" }),
		).not.toBeInTheDocument();
		await userEvent.click(
			canvas.getByRole("button", { name: "Remove from sidebar" }),
		);
		await expect(onDismiss).toHaveBeenCalledTimes(1);
		await expectNoLayoutIssues(canvasElement);
	},
};

export const BlockedUnreachable: Story = {
	render: () => <Frame variant="blocked" blockedReason="unreadable" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: "Try again" }),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Remove from sidebar" }),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const BlockedNoAdmin: Story = {
	render: () => <Frame variant="blocked" blockedReason="noAdmin" />,
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(/Nobody who can move this community/),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const DesktopModal: Story = {
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: () => (
		<Modal>
			<ModalTrigger as={Button}>Open</ModalTrigger>
			<ModalContent
				title={legacySpaceTitle("review", "Night Owls")}
				class="md:w-[440px]"
			>
				<LegacySpace
					variant="review"
					name="Night Owls"
					iconSrc={storyImages.tealIcon()}
					memberCount={42}
					channelCount={7}
					showTitle={false}
					class="px-0 py-2"
				/>
			</ModalContent>
		</Modal>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Move Night Owls to Spaces",
		});
		await expect(
			dialog.querySelector("[data-legacy-title]"),
		).not.toBeInTheDocument();
		await waitFor(() => expectNoLayoutIssues(dialog));
	},
};
