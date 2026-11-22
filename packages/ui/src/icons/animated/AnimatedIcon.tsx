import {
	createEffect,
	createUniqueId,
	type JSX,
	on,
	onCleanup,
	onMount,
	splitProps,
} from "solid-js";
import { cx } from "../../utils/cx";
import { prefersReducedMotion } from "../../utils/motion";
import type { SolarPath } from "../solar/paths";

export type HoverEffect =
	| "wiggle"
	| "swing"
	| "bounce"
	| "hop"
	| "spin"
	| "tilt"
	| "nudge"
	| "pop"
	| "fly"
	| "shake"
	| "pulse"
	| "draw";

export type LoopEffect = "spin" | "heartbeat" | "pulse";

export type AnimatedIconHandle = {
	play: (effect?: string) => Promise<void>;
};

export type AnimatedIconProps = Omit<
	JSX.SvgSVGAttributes<SVGSVGElement>,
	"ref" | "children"
> & {
	size?: number | string;
	label?: string;
	loop?: boolean;
	trigger?: AnimatedIconTrigger;
	ref?: (handle: AnimatedIconHandle) => void;
};

export type AnimatedIconTrigger = "hover" | "press";

export const AnimatedIcon = (
	props: AnimatedIconProps & {
		name: string;
		trigger?: AnimatedIconTrigger;
		viewBox?: string;
		children: JSX.Element;
	},
) => {
	const [local, rest] = splitProps(props, [
		"name",
		"trigger",
		"viewBox",
		"size",
		"label",
		"loop",
		"ref",
		"class",
		"children",
	]);
	let svg: SVGSVGElement | undefined;

	const runOnce = async (attribute: string, value: string) => {
		if (!svg || prefersReducedMotion()) return;
		svg.removeAttribute(attribute);
		void svg.getBoundingClientRect();
		svg.setAttribute(attribute, value);
		const running = svg
			.getAnimations({ subtree: true })
			.filter(
				(animation) =>
					animation instanceof CSSAnimation &&
					(animation.effect as KeyframeEffect | null)?.getTiming()
						.iterations !== Number.POSITIVE_INFINITY,
			);
		await Promise.allSettled(running.map((animation) => animation.finished));
		if (svg.getAttribute(attribute) === value) svg.removeAttribute(attribute);
	};

	onMount(() => {
		const host = svg?.closest<HTMLElement>("[data-icon-host]") ?? svg;
		if (!host) return;
		const pressOnly = () => local.trigger === "press";
		const onEnter = (event: PointerEvent) => {
			if (event.pointerType === "mouse" && !pressOnly()) {
				void runOnce("data-hover", "");
			}
		};
		const onDown = (event: PointerEvent) => {
			if (event.pointerType !== "mouse" || pressOnly()) {
				void runOnce("data-hover", "");
			}
		};
		host.addEventListener("pointerenter", onEnter as EventListener);
		host.addEventListener("pointerdown", onDown as EventListener);
		onCleanup(() => {
			host.removeEventListener("pointerenter", onEnter as EventListener);
			host.removeEventListener("pointerdown", onDown as EventListener);
		});
	});

	const play = (effect = "default") => runOnce("data-attention", effect);

	let stopLoop: (() => void) | undefined;

	createEffect(
		on(
			() => !!local.loop,
			(looping) => {
				const element = svg;
				if (!element) return;
				stopLoop?.();
				stopLoop = undefined;
				if (looping) {
					element.setAttribute("data-loop", "");
					return;
				}
				if (!element.hasAttribute("data-loop")) return;
				const loops = element
					.getAnimations({ subtree: true })
					.filter(
						(animation) =>
							(animation.effect as KeyframeEffect | null)?.getTiming()
								.iterations === Number.POSITIVE_INFINITY,
					);
				if (loops.length === 0 || prefersReducedMotion()) {
					element.removeAttribute("data-loop");
					return;
				}
				let cancelled = false;
				for (const animation of loops) {
					const effect = animation.effect as KeyframeEffect;
					const iteration = effect.getComputedTiming().currentIteration ?? 0;
					effect.updateTiming({ iterations: iteration + 1 });
				}
				void Promise.allSettled(
					loops.map((animation) => animation.finished),
				).then(() => {
					if (!cancelled) element.removeAttribute("data-loop");
				});
				stopLoop = () => {
					cancelled = true;
					for (const animation of loops) {
						(animation.effect as KeyframeEffect).updateTiming({
							iterations: Number.POSITIVE_INFINITY,
						});
					}
				};
			},
		),
	);

	onCleanup(() => stopLoop?.());

	return (
		<svg
			{...rest}
			ref={(element) => {
				svg = element;
				local.ref?.({ play });
			}}
			viewBox={local.viewBox ?? "0 0 24 24"}
			width={local.size ?? 24}
			height={local.size ?? 24}
			fill="none"
			role={local.label ? "img" : undefined}
			aria-label={local.label}
			aria-hidden={local.label ? undefined : "true"}
			data-animated-icon={local.name}
			class={cx("shrink-0 overflow-visible", local.class)}
		>
			{local.children}
		</svg>
	);
};

export type PartProps = {
	name?: string;
	hover?: HoverEffect;
	attention?: HoverEffect;
	loop?: LoopEffect;
	origin?: string;
	vars?: Record<`--fx-${string}`, string>;
	children: JSX.Element;
};

const partAttributes = (props: Omit<PartProps, "children">) => ({
	"data-part": props.name ?? "",
	"data-hover-fx": props.hover,
	"data-attention-fx": props.attention,
	"data-loop-fx": props.loop,
	style: {
		...(props.origin ? { "transform-origin": props.origin } : {}),
		...(props.vars ?? {}),
	},
});

export const Part = (props: PartProps) => (
	<g {...partAttributes(props)}>{props.children}</g>
);

export const SolarShape = (
	props: Omit<PartProps, "children"> & { path: SolarPath; mask?: string },
) => (
	<path
		{...partAttributes(props)}
		d={props.path.d}
		fill="currentColor"
		fill-rule={props.path.evenOdd ? "evenodd" : undefined}
		clip-rule={props.path.evenOdd ? "evenodd" : undefined}
		mask={props.mask}
	/>
);

export const LinearShape = (
	props: Omit<PartProps, "children"> & {
		d: string;
		strokeWidth?: number;
		linecap?: "round" | "butt" | "square";
	},
) => (
	<path
		{...partAttributes(props)}
		d={props.d}
		fill="none"
		stroke="currentColor"
		stroke-width={props.strokeWidth ?? 1.5}
		stroke-linecap={props.linecap ?? "round"}
		stroke-linejoin="round"
		pathLength="1"
	/>
);

export const SLASH_PATH = "M21 3.31L3.75 20.56";

export const Slashed = (props: {
	on: boolean;
	path?: string;
	children: JSX.Element;
}) => {
	const maskId = `slash-${createUniqueId()}`;
	const slashPath = () => props.path ?? SLASH_PATH;

	return (
		<g data-slashed={props.on ? "on" : "off"}>
			<mask
				id={maskId}
				maskUnits="userSpaceOnUse"
				x="-2"
				y="-2"
				width="28"
				height="28"
			>
				<rect x="-2" y="-2" width="28" height="28" fill="white" />
				<path
					d={slashPath()}
					stroke="black"
					stroke-width="3"
					stroke-linecap="round"
					pathLength="1"
					data-slash=""
				/>
			</mask>
			<g mask={`url(#${maskId})`}>{props.children}</g>
			<path
				d={slashPath()}
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				pathLength="1"
				data-slash=""
			/>
		</g>
	);
};

export const Swap = (props: {
	showSecond: boolean;
	first: JSX.Element;
	second: JSX.Element;
}) => (
	<g data-swap={props.showSecond ? "second" : "first"}>
		<g data-swap-first="">{props.first}</g>
		<g data-swap-second="">{props.second}</g>
	</g>
);

export const Turn = (props: {
	angle: number;
	origin?: string;
	children: JSX.Element;
}) => (
	<g
		data-turn=""
		style={{
			transform: `rotate(${props.angle}deg)`,
			"transform-origin": props.origin ?? "12px 12px",
		}}
	>
		{props.children}
	</g>
);
