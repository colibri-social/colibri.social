import { Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { Card, type CardTone } from "../Card/Card";
import { type ActivityProvider, PROVIDER_MARKS } from "./provider-marks";

export type { ActivityProvider };

export const ACTIVITY_PROMPT_COPY = {
	title: "Share what you're listening to",
	description: (provider: string) =>
		`Let others see what you're listening to on ${provider}.`,
	enable: "Turn on",
	dismiss: "Hide",
	dismissed: "You can turn this on any time in Chat settings.",
} as const;

export type ActivityOptInPromptProps = {
	provider?: ActivityProvider;
	dismissed?: boolean;
	busy?: boolean;
	tone?: CardTone;
	onEnable?: () => void;
	onDismiss?: () => void;
	class?: string;
};

export const ActivityOptInPrompt = (props: ActivityOptInPromptProps) => (
	<Show
		when={!props.dismissed && props.provider}
		fallback={
			<Show when={props.dismissed}>
				<p
					data-activity-prompt="dismissed"
					class={cx("m-0 text-xs leading-4 text-muted-foreground", props.class)}
				>
					{ACTIVITY_PROMPT_COPY.dismissed}
				</p>
			</Show>
		}
	>
		{(provider) => (
			<Card
				tone={props.tone}
				data-activity-prompt={provider()}
				aria-label={ACTIVITY_PROMPT_COPY.title}
				role="group"
				class={cx("flex flex-col gap-3 p-3", props.class)}
			>
				<div class="flex min-w-0 items-center gap-3">
					<img
						src={PROVIDER_MARKS[provider()]}
						alt={provider()}
						width={56}
						height={56}
						draggable={false}
						class="size-14 shrink-0 rounded-badge bg-muted object-cover outline-1 -outline-offset-1 outline-white/8 light:outline-black/8"
					/>
					<div class="flex min-w-0 flex-col gap-1">
						<span class="text-base leading-5 font-bold text-foreground">
							{ACTIVITY_PROMPT_COPY.title}
						</span>
						<span class="text-sm leading-[1.5] text-muted-foreground">
							{ACTIVITY_PROMPT_COPY.description(provider())}
						</span>
					</div>
				</div>
				<div class="flex gap-2">
					<Button block loading={props.busy} onClick={() => props.onEnable?.()}>
						{ACTIVITY_PROMPT_COPY.enable}
					</Button>
					<Button
						block
						variant="secondary"
						disabled={props.busy}
						onClick={() => props.onDismiss?.()}
					>
						{ACTIVITY_PROMPT_COPY.dismiss}
					</Button>
				</div>
			</Card>
		)}
	</Show>
);
