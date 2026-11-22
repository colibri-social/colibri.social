export const bindPlayDemand = (
	host: HTMLElement,
	setDemand: (wanted: boolean) => void,
) => {
	const start = (event: PointerEvent) => {
		if (event.pointerType === "mouse") setDemand(true);
	};
	const press = (event: PointerEvent) => {
		if (event.pointerType !== "mouse") setDemand(true);
	};
	const release = (event: PointerEvent) => {
		if (event.pointerType !== "mouse") setDemand(false);
	};
	const stop = () => setDemand(false);
	const focusOut = (event: FocusEvent) => {
		const next = event.relatedTarget;
		if (next instanceof Node && host.contains(next)) return;
		setDemand(false);
	};
	const focusIn = (event: FocusEvent) => {
		if ((event.target as HTMLElement).matches?.(":focus-visible")) {
			setDemand(true);
		}
	};
	host.addEventListener("pointerenter", start);
	host.addEventListener("pointerleave", stop);
	host.addEventListener("pointerdown", press);
	host.addEventListener("pointerup", release);
	host.addEventListener("pointercancel", stop);
	host.addEventListener("focusin", focusIn);
	host.addEventListener("focusout", focusOut);
	return () => {
		host.removeEventListener("pointerenter", start);
		host.removeEventListener("pointerleave", stop);
		host.removeEventListener("pointerdown", press);
		host.removeEventListener("pointerup", release);
		host.removeEventListener("pointercancel", stop);
		host.removeEventListener("focusin", focusIn);
		host.removeEventListener("focusout", focusOut);
	};
};
