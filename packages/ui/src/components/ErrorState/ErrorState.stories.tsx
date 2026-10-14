import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { ErrorState } from "./ErrorState";
import { NotFound } from "./NotFound";

type Args = { onRetry: () => void; onBack: () => void };

const meta: Meta<Args> = {
	title: "Surfaces/Error state",
	args: { onRetry: fn(), onBack: fn() },
	parameters: { viewport: { defaultViewport: "iphone" } },
};

export default meta;
type Story = StoryObj<Args>;

export const LoadFailed: Story = {
	render: (args) => (
		<div class="flex h-[640px] w-full max-w-[402px] flex-col bg-background">
			<ErrorState
				title="Couldn't reach Colibri"
				description="Check your connection and try again."
				code="NetworkFailed"
				onRetry={args.onRetry}
			/>
		</div>
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Couldn't reach Colibri" }),
		).toBeVisible();
		await expect(
			canvas.getByText("Error code: NetworkFailed"),
		).toBeInTheDocument();
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
		await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
		await expect(args.onRetry).toHaveBeenCalledOnce();
	},
};

export const RetryInFlight: Story = {
	render: () => {
		let resolve: () => void = () => {};
		return (
			<div class="flex h-[640px] w-full max-w-[402px] flex-col bg-background">
				<ErrorState
					onRetry={() =>
						new Promise<void>((done) => {
							resolve = done;
						})
					}
				/>
				<button type="button" onClick={() => resolve()}>
					Finish
				</button>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const retry = canvas.getByRole("button", { name: "Try again" });
		await userEvent.click(retry);
		await waitFor(() => expect(retry).toHaveAttribute("aria-busy", "true"));
		await userEvent.click(canvas.getByRole("button", { name: "Finish" }));
		await waitFor(() => expect(retry).not.toHaveAttribute("aria-busy"));
	},
};

export const InlineInSidebar: Story = {
	render: (args) => (
		<div class="flex h-[480px] w-[288px] flex-col border border-muted bg-background">
			<ErrorState
				variant="inline"
				title="Channels didn't load"
				description="Check your connection and try again."
				onRetry={args.onRetry}
			/>
		</div>
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
		await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
		await expect(args.onRetry).toHaveBeenCalledOnce();
	},
};

export const WithExtraAction: Story = {
	render: (args) => (
		<div class="flex h-[640px] w-full max-w-[320px] flex-col bg-background">
			<ErrorState
				onRetry={args.onRetry}
				actions={
					<Button block variant="tertiary" onClick={args.onBack}>
						Back to channels
					</Button>
				}
			/>
		</div>
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Back to channels" }),
		);
		await expect(args.onBack).toHaveBeenCalledOnce();
	},
};

export const PageNotFound: Story = {
	render: (args) => (
		<div class="flex h-[640px] w-full max-w-[402px] flex-col bg-background">
			<NotFound
				path="/app/somewhere/that-does-not-exist-with-a-very-long-segment"
				onAction={args.onBack}
			/>
		</div>
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Page not found" }),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
		await userEvent.click(canvas.getByRole("button", { name: "Go to Spaces" }));
		await expect(args.onBack).toHaveBeenCalledOnce();
	},
};
