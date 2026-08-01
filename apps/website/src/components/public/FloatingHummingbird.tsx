import type { Hummingbird } from "@colibri-social/client/hummingbird";
import { createSignal, onCleanup, onMount, Show } from "solid-js";

export default function FloatingHummingbird(props: {
	size: number;
	flipped?: boolean;
}) {
	const [bird, setBird] = createSignal<typeof Hummingbird>();
	const [paused, setPaused] = createSignal(false);
	let host: HTMLDivElement | undefined;

	onMount(() => {
		void import("@colibri-social/client/hummingbird").then((module) =>
			setBird(() => module.Hummingbird),
		);

		if (typeof IntersectionObserver === "undefined" || !host) return;

		const observer = new IntersectionObserver(
			(entries) => setPaused(!entries.some((entry) => entry.isIntersecting)),
			{ rootMargin: "15%" },
		);
		observer.observe(host);
		onCleanup(() => observer.disconnect());
	});

	return (
		<div ref={host} style={{ width: `${props.size}px`, "aspect-ratio": "1" }}>
			<Show when={bird()} keyed>
				{(Bird) => (
					<Bird
						size={props.size}
						flipped={props.flipped}
						paused={paused()}
						dart
					/>
				)}
			</Show>
		</div>
	);
}
