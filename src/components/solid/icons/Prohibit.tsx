import type { Component } from "solid-js";

export const Prohibit: Component<{
	className?: string;
	classList?: Record<string, boolean>;
}> = (props) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="20"
		height="20"
		fill="currentColor"
		viewBox="0 0 256 256"
		aria-hidden="true"
		class={props.className}
		classList={props.classList}
	>
		<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm88,104a87.56,87.56,0,0,1-20.41,56.28L71.72,60.4A88,88,0,0,1,216,128ZM40,128A87.56,87.56,0,0,1,60.41,71.72L184.28,195.6A88,88,0,0,1,40,128Z"></path>
	</svg>
);
