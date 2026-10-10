import { createSignal } from "solid-js";

const [domFocused, setDomFocused] = createSignal(true);
const [hostActive, setHostActive] = createSignal<boolean | undefined>(
	undefined,
);
const [reducedMotion, setReducedMotion] = createSignal(false);

let installed = false;
let reconcileTimer: ReturnType<typeof setTimeout> | undefined;

const topDocument = (): Document => {
	try {
		const top = window.top?.document;
		if (top) return top;
	} catch {}
	return document;
};

const topWindow = (): Window => {
	try {
		if (window.top?.document) return window.top;
	} catch {}
	return window;
};

const documentActive = () => {
	const doc = topDocument();
	if (doc.visibilityState === "hidden") return false;
	return typeof doc.hasFocus === "function" ? doc.hasFocus() : true;
};

const readReducedMotion = () => {
	if (document.documentElement.dataset.reducedMotion === "true") return true;
	if (!window.matchMedia) return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const reconcile = () => {
	clearTimeout(reconcileTimer);
	reconcileTimer = setTimeout(() => setDomFocused(documentActive()));
};

const onFocus = () => {
	clearTimeout(reconcileTimer);
	setDomFocused(true);
};

const onHidden = () => {
	if (topDocument().visibilityState === "hidden") {
		clearTimeout(reconcileTimer);
		setDomFocused(false);
		return;
	}
	reconcile();
};

const install = () => {
	if (installed || typeof window === "undefined") return;
	installed = true;
	const windows = new Set([window, topWindow()]);
	for (const target of windows) {
		target.addEventListener("focus", onFocus);
		target.addEventListener("blur", reconcile);
	}
	const documents = new Set([document, topDocument()]);
	for (const target of documents) {
		target.addEventListener("visibilitychange", onHidden);
	}
	setDomFocused(topDocument().visibilityState !== "hidden");
	setReducedMotion(readReducedMotion());
	window
		.matchMedia?.("(prefers-reduced-motion: reduce)")
		.addEventListener?.("change", () => setReducedMotion(readReducedMotion()));
	new MutationObserver(() => setReducedMotion(readReducedMotion())).observe(
		document.documentElement,
		{ attributes: true, attributeFilter: ["data-reduced-motion"] },
	);
};

export const setAppActive = (active: boolean | undefined) => {
	setHostActive(active);
};

export const appActive = () => {
	install();
	return hostActive() ?? domFocused();
};

export const reducedMotionActive = () => {
	install();
	return reducedMotion();
};

export const animationsAllowed = () => appActive() && !reducedMotionActive();

const ANIMATED_SOURCE =
	/\.(?:gif|webp|apng)(?:[?#]|$)|^data:image\/(?:gif|webp|apng)|[@=/](?:gif|webp)(?:[?#&]|$)/i;

export const isAnimatedSource = (src: string | undefined) =>
	!!src && ANIMATED_SOURCE.test(src);
