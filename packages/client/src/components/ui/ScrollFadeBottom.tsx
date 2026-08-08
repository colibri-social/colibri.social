import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { createScrollFade } from "../../hooks/createScrollFade";
import { cx } from "../../utils/cva";

export type ScrollFadeBottomProps = ComponentProps<"div"> & {
	wrapperClass?: string;
};

export const ScrollFadeBottom = (props: ScrollFadeBottomProps) => {
	const [local, rest] = splitProps(props, [
		"wrapperClass",
		"class",
		"children",
	]);
	const { ref, canScrollDown } = createScrollFade();

	return (
		<div
			class={cx("relative flex flex-col w-full min-h-0", local.wrapperClass)}
		>
			<div
				ref={ref}
				class={cx("h-full overflow-y-auto overscroll-contain", local.class)}
				{...rest}
			>
				{local.children}
			</div>
			<div
				class="scroll-edge-fade pointer-events-none absolute inset-x-0 bottom-0 h-4 transition-opacity duration-150"
				classList={{ "opacity-0": !canScrollDown() }}
				aria-hidden="true"
			/>
		</div>
	);
};
