import {
	createSignal,
	type JSX,
	onCleanup,
	onMount,
	Show,
	splitProps,
} from "solid-js";
import { cx } from "../../utils/cx";
import { prefersReducedMotion } from "../../utils/motion";
import { createSlot } from "../../utils/slot";

const BAR_HEIGHT = 48;
const COMPACT_SCALE = 20 / 24;
const FADE_START = 0.7;

export type CollapsingTitleLayoutProps = {
	title: JSX.Element;
	actions?: JSX.Element;
	children?: JSX.Element;
	class?: string;
	contentClass?: string;
	safeTop?: boolean;
	onCollapsedChange?: (collapsed: boolean) => void;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const CollapsingTitleLayout = (props: CollapsingTitleLayoutProps) => {
	const [local, rest] = splitProps(props, [
		"title",
		"actions",
		"children",
		"class",
		"contentClass",
		"safeTop",
		"onCollapsedChange",
	]);
	const actions = createSlot(() => local.actions);
	const [collapsed, setCollapsed] = createSignal(false);
	let root: HTMLDivElement | undefined;
	let scroller: HTMLDivElement | undefined;
	let actionsBox: HTMLDivElement | undefined;
	let frame = 0;

	const update = () => {
		frame = 0;
		if (!root || !scroller) return;
		const progress = clamp01(scroller.scrollTop / BAR_HEIGHT);
		const fade = prefersReducedMotion()
			? progress >= 1
				? 1
				: 0
			: clamp01((progress - FADE_START) / (1 - FADE_START));
		root.style.setProperty("--collapse-progress", String(progress));
		root.style.setProperty("--collapse-fade", String(fade));
		const next = progress >= 1;
		if (next === collapsed()) return;
		setCollapsed(next);
		local.onCollapsedChange?.(next);
	};

	const schedule = () => {
		if (frame) return;
		frame = requestAnimationFrame(update);
	};

	onMount(() => {
		update();
		scroller?.addEventListener("scroll", schedule, { passive: true });
		const observer = new ResizeObserver(([entry]) => {
			root?.style.setProperty(
				"--collapse-actions-width",
				`${entry.borderBoxSize[0]?.inlineSize ?? 0}px`,
			);
		});
		if (actionsBox) observer.observe(actionsBox);
		onCleanup(() => {
			scroller?.removeEventListener("scroll", schedule);
			observer.disconnect();
			if (frame) cancelAnimationFrame(frame);
		});
	});

	return (
		<div
			{...rest}
			ref={root}
			data-collapsed={collapsed() || undefined}
			class={cx(
				"relative flex h-full min-h-0 flex-col bg-background text-foreground",
				local.class,
			)}
		>
			<div
				ref={scroller}
				data-collapsing-scroller=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<div
					data-compact-bar=""
					class={cx(
						"sticky top-0 z-10 h-12 bg-background",
						local.safeTop && "h-[calc(48px+var(--safe-area-top,0px))]",
					)}
				>
					<div
						aria-hidden="true"
						class="absolute inset-0 border-b border-border"
						style={{ opacity: "var(--collapse-fade, 0)" }}
					/>
					<h1
						class={cx(
							"absolute top-0 left-4 m-0 h-12 origin-left truncate text-2xl leading-12",
							local.safeTop &&
								"top-safe left-[calc(16px+var(--safe-area-left,0px))]",
						)}
						style={{
							"max-width": `min(calc(100% - 32px), calc((100% - 40px - var(--collapse-actions-width, 0px)) / ${COMPACT_SCALE}))`,
							"font-weight": "calc(800 - 100 * var(--collapse-progress, 0))",
							transform: `scale(calc(1 - ${1 - COMPACT_SCALE} * var(--collapse-progress, 0)))`,
						}}
					>
						{local.title}
					</h1>
					<Show when={actions.has()}>
						<div
							ref={actionsBox}
							class={cx(
								"absolute inset-y-0 right-4 flex items-center gap-1",
								local.safeTop &&
									"top-safe right-[calc(16px+var(--safe-area-right,0px))]",
							)}
						>
							{actions()}
						</div>
					</Show>
				</div>
				<div
					class={cx(
						"flex flex-col gap-4 px-4 pb-4",
						local.safeTop && "px-safe-offset-4",
						local.contentClass,
					)}
				>
					{local.children}
				</div>
			</div>
		</div>
	);
};
