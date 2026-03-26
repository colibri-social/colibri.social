const initLightbox = () => {
	const images =
		document.querySelectorAll<HTMLImageElement>("img[data-lightbox]");
	if (images.length === 0) return;

	const overlay = document.createElement("div");
	overlay.style.cssText = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
    z-index: 1000;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  `;

	const expandedImg = document.createElement("img");
	expandedImg.style.cssText = `
    max-width: 95%;
    max-height: 95%;
    object-fit: contain;
    border-radius: calc(var(--radius) * 1);
    border: 1px solid var(--border);
  `;

	overlay.appendChild(expandedImg);
	document.body.appendChild(overlay);

	const toggleScroll = (disable: boolean) => {
		document.body.style.overflow = disable ? "hidden" : "";
		// Optional: prevent layout shift if there's a scrollbar
		document.body.style.paddingRight = disable
			? `${window.innerWidth - document.documentElement.clientWidth}px`
			: "";
	};

	images.forEach((img) => {
		img.style.cursor = "zoom-in";
		img.addEventListener("click", () => {
			expandedImg.src = img.src;
			overlay.style.display = "flex";
			toggleScroll(true);
		});
	});

	overlay.addEventListener("click", () => {
		overlay.style.display = "none";
		toggleScroll(false);
	});
};

initLightbox();
document.addEventListener("astro:after-swap", initLightbox);
