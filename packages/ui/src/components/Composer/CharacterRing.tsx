import { createEffect, type JSX, on, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { motionScale, prefersReducedMotion } from "../../utils/motion";

export const CHARACTER_LIMIT = 2048;

export const characterRingSlotClass = cx(
	"flex w-0 shrink-0 justify-end overflow-hidden data-visible:ml-0 data-visible:w-8",
	"transition-[width,margin] duration-[calc(var(--duration-pop,320ms)*var(--motion-scale))] ease-[var(--ease-pop,var(--ease-out-quick))]",
	"motion-reduce:transition-none reduced-motion:transition-none",
);

const RADIUS = 9;
const CIRCUMFERENCE = 100;
const TRACK_PX = 2;
const ARC_PX = 2.25;
const COUNT_FROM = 100;
const WARNING_AT = 0.6;
const COUNT_BUMP_MS = 140;
const SHAKE_MS = 320;
const PULSE_MS = 360;
const REVEAL_MS = 420;

export type CharacterRingTone = "default" | "warning" | "destructive";

const TONE_RANK: Record<CharacterRingTone, number> = {
	default: 0,
	warning: 1,
	destructive: 2,
};

export type CharacterRingProps = Omit<
	JSX.HTMLAttributes<HTMLSpanElement>,
	"children"
> & {
	length: number;
	max?: number;
	threshold?: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const ringIntensity = (length: number, max: number, threshold = 0.8) =>
	clamp01((length / max - threshold) / (1 - threshold));

export const ringColor = (intensity: number, over: boolean) => {
	if (over || intensity >= 1) return "var(--destructive)";
	if (intensity <= WARNING_AT) {
		const share = Math.round((intensity / WARNING_AT) * 100);
		return `color-mix(in oklab, var(--warning) ${share}%, var(--muted-foreground))`;
	}
	const share = Math.round(((intensity - WARNING_AT) / (1 - WARNING_AT)) * 100);
	return `color-mix(in oklab, var(--destructive) ${share}%, var(--warning))`;
};

export const CharacterRing = (props: CharacterRingProps) => {
	const [local, rest] = splitProps(props, [
		"length",
		"max",
		"threshold",
		"class",
	]);
	const max = () => local.max ?? CHARACTER_LIMIT;
	const threshold = () => local.threshold ?? 0.8;
	const ratio = () => local.length / max();
	const visible = () => ratio() >= threshold();
	const remaining = () => max() - local.length;
	const over = () => remaining() <= 0;
	const showCount = () => remaining() < COUNT_FROM;
	const intensity = () => ringIntensity(local.length, max(), threshold());
	const color = () => ringColor(intensity(), over());
	const tone = (): CharacterRingTone => {
		if (over()) return "destructive";
		if (intensity() >= WARNING_AT) return "warning";
		return "default";
	};
	const progress = () => (over() ? 1 : intensity());
	const sizePx = () => (showCount() ? 28 : 20);
	const userUnits = (px: number) => (px * 20) / sizePx();
	let root: HTMLSpanElement | undefined;
	let glyph: SVGSVGElement | undefined;
	let arc: SVGCircleElement | undefined;
	let count: HTMLSpanElement | undefined;
	let bump: Animation | undefined;
	let shake: Animation | undefined;
	let pulse: Animation | undefined;
	let reveal: Animation | undefined;

	const emphasize = (strength: number) => {
		if (!glyph) return;
		pulse?.cancel();
		pulse = glyph.animate(
			[
				{ scale: "1" },
				{ scale: `${1 + strength}`, offset: 0.35 },
				{ scale: "1" },
			],
			{
				duration: PULSE_MS * motionScale(),
				easing: "cubic-bezier(0.2, 0, 0, 1)",
				composite: "add",
			},
		);
	};

	createEffect(
		on(visible, (shown, wasShown) => {
			if (!shown || wasShown === undefined || wasShown) return;
			if (prefersReducedMotion() || !arc) return;
			reveal?.cancel();
			const target = CIRCUMFERENCE * (1 - progress());
			reveal = arc.animate(
				[
					{ strokeDashoffset: `${CIRCUMFERENCE}` },
					{ strokeDashoffset: `${target}` },
				],
				{
					duration: REVEAL_MS * motionScale(),
					easing: "cubic-bezier(0.2, 0, 0, 1)",
				},
			);
		}),
	);

	createEffect(
		on(tone, (next, previous) => {
			if (previous === undefined) return;
			if (TONE_RANK[next] <= TONE_RANK[previous]) return;
			root?.setAttribute("data-crossed", next);
			if (prefersReducedMotion()) return;
			emphasize(next === "destructive" ? 0.1 : 0.06);
		}),
	);

	createEffect(
		on(
			() => local.length,
			(length, previous) => {
				if (previous === undefined || prefersReducedMotion()) return;
				if (count && showCount()) {
					bump?.cancel();
					const rising = length > previous;
					bump = count.animate(
						[
							{
								transform: `translateY(${rising ? "30%" : "-30%"})`,
								opacity: 0.4,
							},
							{ transform: "translateY(0)", opacity: 1 },
						],
						{
							duration: COUNT_BUMP_MS * motionScale(),
							easing: "cubic-bezier(0.2, 0, 0, 1)",
						},
					);
				}
				if (root && length > previous && max() - length <= 0) {
					shake?.cancel();
					shake = root.animate(
						[
							{ transform: "translateX(0)" },
							{ transform: "translateX(-2px)" },
							{ transform: "translateX(2px)" },
							{ transform: "translateX(-1px)" },
							{ transform: "translateX(1px)" },
							{ transform: "translateX(0)" },
						],
						{ duration: SHAKE_MS * motionScale(), easing: "ease-out" },
					);
				}
			},
		),
	);

	return (
		<span
			{...rest}
			ref={root}
			role="img"
			aria-label={
				remaining() < 0
					? `${-remaining()} characters over the limit`
					: `${remaining()} characters remaining`
			}
			aria-hidden={visible() ? undefined : "true"}
			data-character-ring=""
			data-visible={visible() || undefined}
			data-tone={tone()}
			data-intensity={intensity().toFixed(2)}
			data-progress={progress().toFixed(2)}
			class={cx(
				"relative inline-flex size-8 shrink-0 items-center justify-center",
				"opacity-0 transition-opacity duration-[calc(var(--duration-color)*var(--motion-scale))] ease-[var(--ease-out-quick)] data-visible:opacity-100",
				"motion-reduce:transition-none reduced-motion:transition-none",
				local.class,
			)}
		>
			<svg
				ref={glyph}
				viewBox="0 0 20 20"
				aria-hidden="true"
				class="-rotate-90 transition-[width,height] duration-[calc(var(--duration-pop,320ms)*var(--motion-scale))] ease-[var(--ease-pop,var(--ease-out-quick))] motion-reduce:transition-none reduced-motion:transition-none"
				style={{
					width: showCount() ? "28px" : "20px",
					height: showCount() ? "28px" : "20px",
				}}
			>
				<circle
					cx="10"
					cy="10"
					r={RADIUS}
					fill="none"
					stroke="color-mix(in oklab, var(--muted-foreground) 22%, transparent)"
					stroke-width={userUnits(TRACK_PX)}
				/>
				<circle
					ref={arc}
					data-ring-progress=""
					cx="10"
					cy="10"
					r={RADIUS}
					fill="none"
					stroke-linecap="round"
					pathLength={CIRCUMFERENCE}
					stroke-dasharray={`${CIRCUMFERENCE}`}
					stroke-dashoffset={`${CIRCUMFERENCE * (1 - progress())}`}
					class="transition-[stroke-dashoffset,stroke,stroke-width] duration-[calc(220ms*var(--motion-scale))] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none reduced-motion:transition-none"
					style={{
						stroke: color(),
						"stroke-width": `${userUnits(ARC_PX)}`,
						"stroke-opacity": progress() > 0.005 ? "1" : "0",
					}}
				/>
			</svg>
			<span
				ref={count}
				aria-hidden="true"
				data-ring-count=""
				class={cx(
					"absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums",
					"transition-[opacity,color] duration-[calc(var(--duration-color)*var(--motion-scale))] ease-[var(--ease-out-quick)] motion-reduce:transition-none reduced-motion:transition-none",
					showCount() ? "opacity-100" : "opacity-0",
				)}
				style={{ color: color() }}
			>
				{remaining()}
			</span>
		</span>
	);
};
