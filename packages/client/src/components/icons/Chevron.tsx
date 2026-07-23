import type { Component } from "solid-js";

export const Chevron: Component<{ className?: string; size?: number }> = ({
	className,
	size,
}) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size || "32"}
		height={size || "32"}
		fill="currentColor"
		viewBox="0 0 256 256"
		class={className}
		aria-hidden="true"
	>
		<path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path>
	</svg>
);
