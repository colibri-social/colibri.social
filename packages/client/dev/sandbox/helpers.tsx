import type { ParentComponent } from "solid-js";

export const Demo: ParentComponent<{ label: string }> = (props) => (
	<div class="flex flex-col gap-2">
		<span class="text-muted-foreground text-xs uppercase tracking-wide">
			{props.label}
		</span>
		<div class="flex flex-wrap items-center gap-3">{props.children}</div>
	</div>
);
