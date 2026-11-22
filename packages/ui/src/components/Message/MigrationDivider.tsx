import { cx } from "../../utils/cx";

export type MigrationDividerProps = {
	label: string;
	class?: string;
};

export const MigrationDivider = (props: MigrationDividerProps) => (
	<div
		data-migration-divider=""
		class={cx(
			"flex min-h-5 items-center gap-2 px-(--chat-row-padding,16px) select-none",
			props.class,
		)}
	>
		<span aria-hidden="true" class="h-px min-w-6 flex-1 bg-border" />
		<span class="max-w-[min(28rem,80%)] text-balance text-center text-xs leading-4 font-semibold text-muted-foreground">
			{props.label}
		</span>
		<span aria-hidden="true" class="h-px min-w-6 flex-1 bg-border" />
	</div>
);
