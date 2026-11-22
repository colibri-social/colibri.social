import { type Accessor, createSignal } from "solid-js";

const shared = new Map<string, Accessor<boolean>>();

const createSharedMediaQuery = (query: string): Accessor<boolean> => {
	const list = matchMedia(query);
	const [matches, setMatches] = createSignal(list.matches);

	list.addEventListener("change", (event) => setMatches(event.matches));

	return matches;
};

const createMediaQuery = (query: string): Accessor<boolean> => {
	if (typeof matchMedia === "undefined") {
		const [matches] = createSignal(false);

		return matches;
	}

	let accessor = shared.get(query);

	if (!accessor) {
		accessor = createSharedMediaQuery(query);
		shared.set(query, accessor);
	}

	return accessor;
};

export default createMediaQuery;
