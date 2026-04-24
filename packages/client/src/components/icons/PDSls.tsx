import type { Component } from "solid-js";

export const PDSls: Component<{ className?: string; size?: number }> = ({
	className,
	size,
}) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size || "24"}
		height={size || "24"}
		viewBox="0 0 24 24"
		fill="currentColor"
		aria-hidden="true"
		class={className}
	>
		<path stroke="none" d="M0 0h24v24H0z" fill="none" />
		<path d="M14 1a3 3 0 0 1 2.348 4.868l2 3.203q .317 -.071 .652 -.071a3 3 0 1 1 -2.347 1.132l-2 -3.203a3 3 0 0 1 -1.304 0l-2.001 3.203c.408 .513 .652 1.162 .652 1.868s-.244 1.356 -.653 1.868l2.002 3.203q .315 -.071 .651 -.071a3 3 0 1 1 -2.347 1.132l-2.003 -3.203a3 3 0 0 1 -1.302 0l-2.002 3.203a3 3 0 1 1 -1.696 -1.06l2.002 -3.204a3 3 0 0 1 2.998 -4.798l2.002 -3.202a3 3 0 0 1 2.348 -4.868" />
	</svg>
);
