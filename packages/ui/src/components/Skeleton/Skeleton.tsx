import {
	createEffect,
	createSignal,
	For,
	type JSX,
	on,
	onCleanup,
	Show,
	splitProps,
} from "solid-js";
import { cx } from "../../utils/cx";
import { motionScale, prefersReducedMotion } from "../../utils/motion";
import { createSlot } from "../../utils/slot";
import type { AvatarSize } from "../Avatar/Avatar";

export type SkeletonProps = JSX.HTMLAttributes<HTMLSpanElement> & {
	width?: number | string;
	height?: number | string;
};

const toLength = (value: number | string | undefined) =>
	typeof value === "number" ? `${value}px` : value;

export const Skeleton = (props: SkeletonProps) => {
	const [local, rest] = splitProps(props, [
		"width",
		"height",
		"class",
		"style",
	]);
	return (
		<span
			{...rest}
			aria-hidden="true"
			data-skeleton=""
			class={cx("rounded-badge", local.class)}
			style={{
				width: toLength(local.width),
				height: toLength(local.height),
				...(typeof local.style === "object" ? local.style : {}),
			}}
		/>
	);
};

export type SkeletonTextSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl";

const textMetrics: Record<SkeletonTextSize, { font: number; leading: number }> =
	{
		xs: { font: 12, leading: 16 },
		sm: { font: 14, leading: 20 },
		base: { font: 16, leading: 24 },
		lg: { font: 18, leading: 28 },
		xl: { font: 20, leading: 28 },
		"2xl": { font: 24, leading: 32 },
	};

export type SkeletonTextProps = {
	size?: SkeletonTextSize;
	leading?: number;
	lines?: number;
	width?: number | string;
	lastLineWidth?: number | string;
	class?: string;
};

export const SkeletonText = (props: SkeletonTextProps) => {
	const metrics = () => textMetrics[props.size ?? "base"];
	const leading = () => props.leading ?? metrics().leading;
	const barHeight = () => Math.round(metrics().font * 0.72);
	const lines = () => Array.from({ length: props.lines ?? 1 }, (_, i) => i);
	const widthFor = (index: number) => {
		const count = props.lines ?? 1;
		if (count > 1 && index === count - 1) return props.lastLineWidth ?? "62%";
		return props.width ?? "100%";
	};

	return (
		<span
			aria-hidden="true"
			data-skeleton-text=""
			class={cx("flex min-w-0 flex-col", props.class)}
		>
			<For each={lines()}>
				{(index) => (
					<span class="flex items-center" style={{ height: `${leading()}px` }}>
						<Skeleton
							class="rounded-full"
							width={toLength(widthFor(index))}
							height={barHeight()}
						/>
					</span>
				)}
			</For>
		</span>
	);
};

export const SKELETON_AVATAR_SIZES: Record<AvatarSize, number> = {
	xs: 20,
	sm: 24,
	base: 32,
	md: 40,
	lg: 56,
	xl: 88,
};

export type SkeletonCircleProps = {
	size: number;
	class?: string;
};

export const SkeletonCircle = (props: SkeletonCircleProps) => (
	<Skeleton
		class={cx("rounded-full", props.class)}
		width={props.size}
		height={props.size}
	/>
);

export type AvatarSkeletonProps = {
	size?: AvatarSize;
	shape?: "circle" | "square";
	class?: string;
};

export const AvatarSkeleton = (props: AvatarSkeletonProps) => {
	const pixels = () => SKELETON_AVATAR_SIZES[props.size ?? "md"];
	return (
		<Skeleton
			class={cx(
				props.shape === "square" ? "rounded-[28%]" : "rounded-full",
				props.class,
			)}
			width={pixels()}
			height={pixels()}
		/>
	);
};

export type SkeletonGroupProps = JSX.HTMLAttributes<HTMLDivElement> & {
	label?: string;
};

export const SkeletonGroup = (props: SkeletonGroupProps) => {
	const [local, rest] = splitProps(props, ["label", "children"]);
	return (
		<div {...rest} aria-busy="true" data-skeleton-group="">
			<span role="status" aria-live="polite" class="sr-only">
				{local.label ?? "Loading"}
			</span>
			{local.children}
		</div>
	);
};

type LoadablePhase = "waiting" | "skeleton" | "content";

export type LoadableProps = {
	loading: boolean;
	skeleton: JSX.Element;
	children?: JSX.Element;
	delay?: number;
	fade?: number;
	label?: string;
	class?: string;
};

export const Loadable = (props: LoadableProps) => {
	const skeleton = createSlot(() => props.skeleton);
	const [phase, setPhase] = createSignal<LoadablePhase>(
		props.loading ? "waiting" : "content",
	);
	const [leaving, setLeaving] = createSignal(false);
	const [entering, setEntering] = createSignal(false);
	let delayTimer: ReturnType<typeof setTimeout> | undefined;
	let fadeTimer: ReturnType<typeof setTimeout> | undefined;

	const clearTimers = () => {
		clearTimeout(delayTimer);
		clearTimeout(fadeTimer);
	};
	onCleanup(clearTimers);

	createEffect(
		on(
			() => props.loading,
			(loading) => {
				clearTimers();
				if (loading) {
					setLeaving(false);
					setEntering(false);
					setPhase("waiting");
					delayTimer = setTimeout(
						() => setPhase("skeleton"),
						props.delay ?? 150,
					);
					return;
				}
				const crossfade = phase() === "skeleton" && !prefersReducedMotion();
				setPhase("content");
				if (!crossfade) {
					setLeaving(false);
					setEntering(false);
					return;
				}
				setLeaving(true);
				setEntering(true);
				fadeTimer = setTimeout(
					() => {
						setLeaving(false);
						setEntering(false);
					},
					(props.fade ?? 150) * motionScale(),
				);
			},
		),
	);

	return (
		<div
			data-loadable=""
			data-phase={phase()}
			aria-busy={props.loading || undefined}
			class={cx("grid", props.class)}
			style={{ "--skeleton-fade": `${props.fade ?? 150}ms` }}
		>
			<Show when={props.loading}>
				<span role="status" aria-live="polite" class="sr-only">
					{props.label ?? "Loading"}
				</span>
			</Show>
			<Show when={phase() !== "content" || leaving()}>
				<div
					aria-hidden="true"
					data-loadable-skeleton=""
					class="pointer-events-none [grid-area:1/1] min-w-0"
					style={{
						opacity: phase() === "skeleton" ? 1 : 0,
					}}
				>
					{skeleton()}
				</div>
			</Show>
			<Show when={phase() === "content"}>
				<div
					data-loadable-content=""
					data-entering={entering() || undefined}
					class="[grid-area:1/1] min-w-0"
				>
					{props.children}
				</div>
			</Show>
		</div>
	);
};
