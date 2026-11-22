import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";

export type SpaceAttention = {
	title: string;
	description: string;
	actionLabel: string;
	onAction: () => void;
};

export const hostSignInAttention = (
	spaceName: string,
	account: string,
	onSignIn: () => void,
): SpaceAttention => ({
	title: `Sign in to keep ${spaceName} running`,
	description: `Sign in as ${account}, the account that hosts this Space. Until then, new messages can't be saved.`,
	actionLabel: `Sign in as ${account}`,
	onAction: onSignIn,
});

export const SpaceAttentionMark = (props: { class?: string }) => (
	<span
		data-space-attention=""
		aria-hidden="true"
		class={cx(
			"flex size-[18px] shrink-0 items-center justify-center rounded-full bg-warning font-extrabold text-[12px] text-background leading-none",
			props.class,
		)}
	>
		!
	</span>
);

export const SpaceAttentionNotice = (props: {
	attention: SpaceAttention;
	onAction?: () => void;
	class?: string;
}) => (
	<div
		role="status"
		data-space-attention-notice=""
		class={cx(
			"flex flex-col gap-2 rounded-control-sm border border-warning/40 bg-warning/10 p-3",
			props.class,
		)}
	>
		<span class="font-semibold text-foreground text-sm">
			{props.attention.title}
		</span>
		<span class="text-foreground/85 text-sm leading-prose">
			{props.attention.description}
		</span>
		<Button
			class="h-8"
			onClick={() => {
				props.onAction?.();
				props.attention.onAction();
			}}
		>
			{props.attention.actionLabel}
		</Button>
	</div>
);
