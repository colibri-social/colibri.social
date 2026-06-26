import type { ParentComponent } from "solid-js";

export const Badge: ParentComponent<{
	text: string;
	size: "lg" | "base" | "sm" | "xs";
	style: "bot";
}> = (props) => {
	return (
		<span
			classList={{
				"bg-primary": props.style === "bot",
				"text-lg": props.size === "lg",
				"text-base": props.size === "base",
				"text-sm": props.size === "sm",
				"text-xs": props.size === "xs",
			}}
			class="text-foreground px-1.5 rounded-sm"
		>
			{props.children}
			<span class="font-bold!">{props.text}</span>
		</span>
	);
};
