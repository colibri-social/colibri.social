const copyWithSelection = (text: string, anchor?: HTMLElement | null) => {
	const field = document.createElement("textarea");
	field.value = text;
	field.setAttribute("readonly", "");
	field.setAttribute("aria-hidden", "true");
	field.style.position = "fixed";
	field.style.inset = "0 auto auto 0";
	field.style.opacity = "0";
	field.style.pointerEvents = "none";
	const host = anchor?.closest("[role='dialog']") ?? document.body;
	const previous = document.activeElement as HTMLElement | null;
	host.append(field);
	field.select();
	let copied = false;
	try {
		copied = document.execCommand("copy");
	} catch {
		copied = false;
	}
	field.remove();
	previous?.focus({ preventScroll: true });
	return copied;
};

export const copyText = async (
	text: string,
	anchor?: HTMLElement | null,
): Promise<boolean> => {
	if (window.isSecureContext && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			return copyWithSelection(text, anchor);
		}
	}
	return copyWithSelection(text, anchor);
};
