import type { Component } from "solid-js";

export const PlusSmall: Component<{ className?: string }> = ({ className }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="16"
		height="16"
		fill="currentColor"
		viewBox="0 0 256 256"
		aria-hidden="true"
		class={className}
	>
		<path d="M222,128a6,6,0,0,1-6,6H134v82a6,6,0,0,1-12,0V134H40a6,6,0,0,1,0-12h82V40a6,6,0,0,1,12,0v82h82A6,6,0,0,1,222,128Z"></path>
	</svg>
);
