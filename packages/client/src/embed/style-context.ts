export const mirrorEmbedStyleContext = (
	target: HTMLElement,
	root: HTMLElement | undefined,
): void => {
	if (!root) return;

	for (const name of Array.from(root.classList)) target.classList.add(name);
	if (root.dataset.theme) target.dataset.theme = root.dataset.theme;

	for (let i = 0; i < root.style.length; i += 1) {
		const property = root.style.item(i);
		if (!property.startsWith("--")) continue;
		target.style.setProperty(property, root.style.getPropertyValue(property));
	}
};
