import { createSignal, onCleanup, onMount } from "solid-js";

const createMediaQuery = (query: string) => {
	const initial =
		typeof matchMedia !== "undefined" && matchMedia(query).matches;
	const [matches, setMatches] = createSignal(initial);

	onMount(() => {
		const onChange = (event: MediaQueryListEvent) => {
			setMatches(event.matches);
		};

		const result = matchMedia(query);
		result.addEventListener("change", onChange);
		setMatches(result.matches);

		onCleanup(() => {
			result.removeEventListener("change", onChange);
		});
	});

	return matches;
};

export default createMediaQuery;
