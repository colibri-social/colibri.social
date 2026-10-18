import { CloudCrossIcon } from "@solar-icons/solid/bold/cloud-cross";
import { createSignal, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { Button } from "../Button/Button";
import { StatusScreen } from "../StatusScreen/StatusScreen";

export type ErrorStateProps = {
	title?: JSX.Element;
	description?: JSX.Element;
	code?: string;
	onRetry?: () => unknown;
	retrying?: boolean;
	retryLabel?: string;
	actions?: JSX.Element;
	report?: JSX.Element;
	variant?: "screen" | "inline";
	class?: string;
};

const DEFAULT_TITLE = "Something went wrong";
const DEFAULT_DESCRIPTION = "This didn't load. Try again in a moment.";

export const ErrorState = (props: ErrorStateProps) => {
	const actions = createSlot(() => props.actions);
	const report = createSlot(() => props.report);
	const [pending, setPending] = createSignal(false);
	const busy = () => !!props.retrying || pending();
	const retry = () => {
		if (busy() || !props.onRetry) return;
		const result = props.onRetry();
		if (!(result instanceof Promise)) return;
		setPending(true);
		void result.then(
			() => setPending(false),
			() => setPending(false),
		);
	};
	const retryButton = (block: boolean) => (
		<Show when={props.onRetry}>
			<Button
				block={block}
				variant="secondary"
				loading={busy()}
				onClick={retry}
			>
				{props.retryLabel ?? "Try again"}
			</Button>
		</Show>
	);
	const code = () => (
		<Show when={props.code}>
			{(value) => (
				<span
					data-error-code=""
					class="mt-1 block font-mono text-xs text-muted-foreground"
				>
					{`Error code: ${value()}`}
				</span>
			)}
		</Show>
	);

	return (
		<Show
			when={props.variant === "inline"}
			fallback={
				<StatusScreen
					tone="destructive"
					icon={<CloudCrossIcon />}
					title={props.title ?? DEFAULT_TITLE}
					description={
						<>
							<span class="block">
								{props.description ?? DEFAULT_DESCRIPTION}
							</span>
							{code()}
						</>
					}
					actions={
						props.onRetry || actions.has() || report.has() ? (
							<>
								{retryButton(true)}
								{actions()}
								<Show when={report.has()}>
									<div class="mt-4 flex w-full">{report()}</div>
								</Show>
							</>
						) : undefined
					}
					class={props.class}
				/>
			}
		>
			<div
				data-error-state="inline"
				role="status"
				class={cx(
					"flex min-w-0 flex-col items-center gap-3 px-4 py-6 text-center",
					props.class,
				)}
			>
				<div class="flex min-w-0 flex-col gap-1">
					<p class="m-0 text-sm font-semibold text-balance text-foreground">
						{props.title ?? DEFAULT_TITLE}
					</p>
					<p class="m-0 text-xs leading-prose text-pretty text-muted-foreground">
						{props.description ?? DEFAULT_DESCRIPTION}
					</p>
					{code()}
				</div>
				{retryButton(false)}
				{actions()}
			</div>
		</Show>
	);
};
