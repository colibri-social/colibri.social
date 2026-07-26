import { type Accessor, createSignal } from "solid-js";

// One MediaQueryList and one listener per distinct query for the whole app,
// rather than one per call site. A handful of queries — the mobile breakpoint
// above all — are read from hundreds of components at once (every member row,
// every message), and the per-instance version made each of those allocate its
// own `matchMedia` subscription.
const shared = new Map<string, Accessor<boolean>>();

const createSharedMediaQuery = (query: string): Accessor<boolean> => {
	const list = matchMedia(query);
	const [matches, setMatches] = createSignal(list.matches);

	// Never cleaned up on purpose: the accessor is cached for the lifetime of the
	// document, so there is no owner to tie it to and nothing to unsubscribe.
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
