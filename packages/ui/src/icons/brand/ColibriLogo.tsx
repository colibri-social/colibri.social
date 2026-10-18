import { splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import colibriLogoUrl from "./colibri-logo.svg";

export type ColibriLogoProps = {
	size?: number;
	label?: string;
	class?: string;
};

export const ColibriLogo = (props: ColibriLogoProps) => {
	const [local] = splitProps(props, ["size", "label", "class"]);
	return (
		<img
			src={colibriLogoUrl}
			alt={local.label ?? ""}
			aria-hidden={local.label ? undefined : "true"}
			width={local.size ?? 24}
			height={local.size ?? 24}
			draggable={false}
			data-colibri-logo=""
			class={cx("block shrink-0 select-none", local.class)}
		/>
	);
};
