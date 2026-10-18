import { EyeClosedIcon } from "@solar-icons/solid/bold/eye-closed";
import { ShieldWarningIcon } from "@solar-icons/solid/bold/shield-warning";
import { UserBlockIcon } from "@solar-icons/solid/bold/user-block";
import { createSignal, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { TextAction } from "./shared";

export type HiddenReason = "moderator" | "blocked";

export const HIDDEN_REASON_TEXT: Record<HiddenReason, string> = {
	moderator: "Hidden by a moderator",
	blocked: "Message from someone you blocked",
};

export type HiddenMessageProps = {
	reason: HiddenReason;
	children: JSX.Element;
	shown?: boolean;
	defaultShown?: boolean;
	onShownChange?: (shown: boolean) => void;
	class?: string;
};

const ReasonIcon = (props: { reason: HiddenReason }) => (
	<Show when={props.reason === "blocked"} fallback={<ShieldWarningIcon />}>
		<UserBlockIcon />
	</Show>
);

export const HiddenMessage = (props: HiddenMessageProps) => {
	const [internal, setInternal] = createSignal(props.defaultShown ?? false);
	const shown = () => props.shown ?? internal();
	const setShown = (next: boolean) => {
		setInternal(next);
		props.onShownChange?.(next);
	};

	return (
		<Show
			when={shown()}
			fallback={
				<div
					data-hidden-message=""
					class={cx(
						"flex w-full max-w-[480px] items-center gap-2.5 rounded-control border border-dashed border-border px-3 py-2",
						props.class,
					)}
				>
					<span class="flex shrink-0 text-muted-foreground [&>svg]:size-5">
						<ReasonIcon reason={props.reason} />
					</span>
					<span class="min-w-0 flex-1 text-sm text-muted-foreground">
						{HIDDEN_REASON_TEXT[props.reason]}
					</span>
					<TextAction onClick={() => setShown(true)}>Show</TextAction>
				</div>
			}
		>
			<div
				data-hidden-message=""
				class={cx("flex flex-col gap-1.5", props.class)}
			>
				{props.children}
				<span class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					{HIDDEN_REASON_TEXT[props.reason]}
					<TextAction icon={<EyeClosedIcon />} onClick={() => setShown(false)}>
						Hide again
					</TextAction>
				</span>
			</div>
		</Show>
	);
};
