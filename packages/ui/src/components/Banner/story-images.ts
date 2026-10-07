export const paintImage = (
	width: number,
	height: number,
	stops: [string, string],
) => {
	if (typeof document === "undefined") return "";
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) return "";
	const gradient = context.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, stops[0]);
	gradient.addColorStop(1, stops[1]);
	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);
	return canvas.toDataURL("image/png");
};

export const storyImages = {
	violetIcon: () => paintImage(96, 96, ["#8e51ff", "#5b21b6"]),
	tealIcon: () => paintImage(96, 96, ["#2dd4bf", "#0f766e"]),
	amberIcon: () => paintImage(96, 96, ["#fbbf24", "#c2410c"]),
	sunsetBanner: () => paintImage(600, 300, ["#f472b6", "#7c3aed"]),
};
