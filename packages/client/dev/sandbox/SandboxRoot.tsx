import { Gallery } from "./Gallery";
import { Shell } from "./Shell";

export const SandboxRoot = () => {
	const embedded = new URLSearchParams(window.location.search).has("embed");

	return embedded ? <Gallery /> : <Shell />;
};
