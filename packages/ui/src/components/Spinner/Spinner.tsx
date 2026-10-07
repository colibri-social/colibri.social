import { type JSX, splitProps } from "solid-js";
import { cx } from "../../utils/cx";

export type SpinnerProps = JSX.SvgSVGAttributes<SVGSVGElement> & {
	size?: number;
	label?: string;
};

export const Spinner = (props: SpinnerProps) => {
	const [local, rest] = splitProps(props, ["size", "label", "class"]);

	return (
		<svg
			viewBox="0 0 20 20"
			width={local.size ?? 20}
			height={local.size ?? 20}
			fill="none"
			role={local.label ? "img" : undefined}
			aria-label={local.label}
			aria-hidden={local.label ? undefined : "true"}
			class={cx(
				"shrink-0 animate-[ui-spin_calc(800ms*var(--motion-scale))_linear_infinite]",
				local.class,
			)}
			{...rest}
		>
			<path
				d="M17.5 10C17.4999 11.5838 16.9984 13.127 16.0674 14.4083C15.1364 15.6896 13.8237 16.6433 12.3174 17.1326C10.8111 17.622 9.1885 17.622 7.6822 17.1325C6.17591 16.643 4.86323 15.6893 3.9323 14.4079C3.00138 13.1266 2.49999 11.5834 2.5 9.99958C2.50001 8.41575 3.00142 6.87259 3.93237 5.59125C4.86331 4.30991 6.176 3.35617 7.6823 2.86673C9.1886 2.37729 10.8112 2.37727 12.3175 2.86667"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	);
};
