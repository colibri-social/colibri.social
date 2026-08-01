import {
	createSignal,
	onCleanup,
	onMount,
	type ParentComponent,
} from "solid-js";

/**
 * Transitions between the natural heights of whatever it wraps, so the sign-in
 * panel grows and shrinks as the flow moves between steps instead of snapping.
 */
export const AnimatedHeight: ParentComponent<{ class?: string }> = (props) => {
	const [height, setHeight] = createSignal<number>();
	const [animate, setAnimate] = createSignal(false);

	let inner: HTMLDivElement | undefined;

	onMount(() => {
		if (!inner) return;

		const observer = new ResizeObserver(() => {
			if (!inner) return;
			setHeight(inner.getBoundingClientRect().height);
		});

		observer.observe(inner);
		setHeight(inner.getBoundingClientRect().height);
		requestAnimationFrame(() => setAnimate(true));

		onCleanup(() => observer.disconnect());
	});

	return (
		<div
			class={`shrink-0 overflow-hidden ${props.class ?? ""}`}
			classList={{
				"transition-[height] duration-500 ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none":
					animate(),
			}}
			style={height() === undefined ? undefined : { height: `${height()}px` }}
		>
			<div ref={inner}>{props.children}</div>
		</div>
	);
};
