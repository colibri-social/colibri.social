import {
	type Accessor,
	createContext,
	createSignal,
	useContext,
} from "solid-js";

export type NestedLayers = {
	active: Accessor<boolean>;
	register: () => () => void;
};

export const NestedLayerContext = createContext<NestedLayers>();

export const createNestedLayers = (): NestedLayers => {
	const [count, setCount] = createSignal(0);
	return {
		active: () => count() > 0,
		register: () => {
			setCount((value) => value + 1);
			let released = false;
			return () => {
				if (released) return;
				released = true;
				setCount((value) => Math.max(0, value - 1));
			};
		},
	};
};

export const useParentLayers = () => useContext(NestedLayerContext);

export const NESTED_LAYER_ATTR = "data-nested-layer";

export const isInsideNestedLayer = (target: EventTarget | null) =>
	target instanceof Element && !!target.closest(`[${NESTED_LAYER_ATTR}]`);

export const topLayerAttrs = {
	[NESTED_LAYER_ATTR]: "",
	"data-kb-top-layer": "",
};

export const revealAncestors = (element: HTMLElement) => {
	for (
		let node = element.parentElement;
		node && node !== document.body;
		node = node.parentElement
	) {
		if (node.getAttribute("aria-hidden") === "true")
			node.removeAttribute("aria-hidden");
	}
};

export const revealLayer = (element: HTMLElement) => {
	queueMicrotask(() => revealAncestors(element));
};
