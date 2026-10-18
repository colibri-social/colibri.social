export const withoutTransitions = (apply: () => void) => {
	if (typeof document === "undefined") {
		apply();
		return;
	}
	const style = document.createElement("style");
	style.textContent =
		"*,*::before,*::after{transition:none!important;animation-duration:0s!important}";
	document.head.append(style);
	apply();
	void getComputedStyle(document.documentElement).backgroundColor;
	requestAnimationFrame(() => style.remove());
};
