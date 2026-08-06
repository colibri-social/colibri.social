import "../src/embed.css";

const root = document.querySelector<HTMLElement>(".colibri-embed");
const controls = document.getElementById("radius-controls");

const PER_STEP = ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];

const reset = () => {
	root?.style.removeProperty("--colibri-embed-radius");
	for (const step of PER_STEP) {
		root?.style.removeProperty(`--colibri-embed-radius-${step}`);
	}
};

controls?.addEventListener("click", (event) => {
	const button = (event.target as HTMLElement).closest("button");
	if (!button || !root) return;

	if (button.dataset.reset) {
		reset();
		return;
	}

	const base = button.getAttribute("data-radius");
	if (base) {
		root.style.setProperty("--colibri-embed-radius", base);
		return;
	}

	for (const step of PER_STEP) {
		const value = button.getAttribute(`data-radius-${step}`);
		if (value) root.style.setProperty(`--colibri-embed-radius-${step}`, value);
	}
});
