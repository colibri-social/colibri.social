import { createSignal } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { ErrorReport, type ErrorReportAccount } from "./ErrorReport";
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

const REFERENCE = "3f9a2c71e4b04d8a9c1e6b2f7d5a0e13";

const stubClipboard = () => {
	const writeText = fn(async (_value: string) => {});
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	});
	return writeText;
};

const CrashScreen = (props: {
	account?: ErrorReportAccount;
	onRetry: () => void;
	height?: number;
}) => {
	const [account, setAccount] = createSignal(props.account);
	const send = () => {
		setAccount("sending");
		setTimeout(() => setAccount("sent"), 300);
	};
	return (
		<div
			class="flex w-full max-w-[402px] flex-col bg-background"
			style={{ height: `${props.height ?? 874}px` }}
		>
			<ErrorState
				title="Something went wrong"
				description="Colibri hit a problem it couldn't recover from. Try again to reload."
				code="Unexpected"
				onRetry={props.onRetry}
				report={
					<ErrorReport
						reference={REFERENCE}
						account={account()}
						onSendAccount={send}
					/>
				}
			/>
		</div>
	);
};

export const CrashWithReport: Story = {
	render: (args) => <CrashScreen account="offer" onRetry={args.onRetry} />,
	play: async ({ canvasElement }) => {
		const writeText = stubClipboard();
		const canvas = within(canvasElement);
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
		const report = canvas.getByRole("region", { name: "Error report" });
		await expect(
			within(report).getByRole("textbox", { name: "Error reference" }),
		).toHaveValue(REFERENCE);
		await userEvent.click(
			within(report).getByRole("button", { name: "Copy reference" }),
		);
		await expect(writeText).toHaveBeenCalledWith(REFERENCE);
		await waitFor(() =>
			expect(within(report).getAllByRole("status")[0]).toHaveTextContent(
				"Reference copied",
			),
		);
		const send = within(report).getByRole("button", {
			name: "Send my account with this report",
		});
		const retry = canvas.getByRole("button", { name: "Try again" });
		await expect(
			send.getBoundingClientRect().top - retry.getBoundingClientRect().bottom,
		).toBeGreaterThanOrEqual(16);
		await userEvent.click(send);
		await waitFor(() =>
			expect(
				within(report).getByText(
					"Your account was added to this report. Thank you.",
				),
			).toBeVisible(),
		);
		await expect(
			within(report).queryByRole("button", {
				name: "Send my account with this report",
			}),
		).toBeNull();
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
	},
};

export const CrashWithAccountIncluded: Story = {
	render: (args) => <CrashScreen account="included" onRetry={args.onRetry} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("Your account is already included in this report."),
		).toBeVisible();
		await expect(
			canvas.queryByRole("button", {
				name: "Send my account with this report",
			}),
		).toBeNull();
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
	},
};

export const CrashOnShortScreen: Story = {
	render: (args) => (
		<CrashScreen account="offer" onRetry={args.onRetry} height={420} />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const screen = canvasElement.querySelector(
			"[data-status-screen]",
		) as HTMLElement;
		await expect(screen.scrollHeight).toBeGreaterThan(screen.clientHeight);
		screen.scrollTop = 0;
		const heading = canvas.getByRole("heading", {
			name: "Something went wrong",
		});
		await expect(heading.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			screen.getBoundingClientRect().top,
		);
		screen.scrollTop = screen.scrollHeight;
		const send = canvas.getByRole("button", {
			name: "Send my account with this report",
		});
		await waitFor(() =>
			expect(send.getBoundingClientRect().bottom).toBeLessThanOrEqual(
				screen.getBoundingClientRect().bottom,
			),
		);
	},
};
