import { createUniqueId, type JSX } from "solid-js";
import { cx } from "../../utils/cx";

export type SettingsNoticeProps = {
	icon: JSX.Element;
	title: string;
	description: string;
	class?: string;
};

export const SettingsNotice = (props: SettingsNoticeProps) => {
	const titleId = createUniqueId();

	return (
		<section
			data-settings-notice=""
			role="status"
			aria-labelledby={titleId}
			class={cx(
				"flex w-full min-w-0 items-start gap-3 rounded-surface bg-secondary p-3 text-sm",
				props.class,
			)}
		>
			<span
				aria-hidden="true"
				class="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground [&>svg]:size-4"
			>
				{props.icon}
			</span>
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<p id={titleId} class="m-0 font-semibold text-pretty text-foreground">
					{props.title}
				</p>
				<p class="m-0 text-pretty text-muted-foreground">{props.description}</p>
			</div>
		</section>
	);
};
