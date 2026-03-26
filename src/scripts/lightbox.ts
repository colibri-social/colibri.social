const initLightbox = () => {
	const images =
		document.querySelectorAll<HTMLImageElement>("img[data-lightbox]");
	if (images.length === 0) return;

	const overlay = document.createElement("div");
	overlay.setAttribute("role", "dialog");
	overlay.setAttribute("aria-modal", "true");
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

	const closeBtn = document.createElement("button");
	closeBtn.innerHTML = "&times;";
	closeBtn.setAttribute("aria-label", "Close lightbox");
	closeBtn.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
    background: transparent;
    border: none;
    color: white;
    font-size: 2rem;
    cursor: pointer;
    z-index: 1001;
  `;

	const expandedImg = document.createElement("img");
	expandedImg.tabIndex = 0; // Make image focusable
	expandedImg.style.cssText = `
    max-width: 95%;
    max-height: 95%;
    object-fit: contain;
    border-radius: calc(var(--radius) * 1);
    border: 1px solid var(--border);
  `;

	overlay.appendChild(closeBtn);
	overlay.appendChild(expandedImg);
	document.body.appendChild(overlay);

	let lastFocusedElement: HTMLElement | null = null;

	const toggleScroll = (disable: boolean) => {
		document.body.style.overflow = disable ? "hidden" : "";
		document.body.style.paddingRight = disable
			? `${window.innerWidth - document.documentElement.clientWidth}px`
			: "";
	};

	const closeLightbox = () => {
		overlay.style.display = "none";
		toggleScroll(false);
		window.removeEventListener("keydown", handleKeydown);
		if (lastFocusedElement) lastFocusedElement.focus();
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			closeLightbox();
			return;
		}

		if (e.key === "Tab") {
			const focusableElements = [closeBtn, expandedImg];
			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];

			if (e.shiftKey) {
				if (document.activeElement === firstElement) {
					lastElement.focus();
					e.preventDefault();
				}
			} else {
				if (document.activeElement === lastElement) {
					firstElement.focus();
					e.preventDefault();
				}
			}
		}
	};

	images.forEach((img) => {
		img.style.cursor = "zoom-in";
		img.tabIndex = 0;

		const openLightbox = () => {
			lastFocusedElement = document.activeElement as HTMLElement;
			expandedImg.src = img.src;
			expandedImg.alt = img.alt;
			overlay.style.display = "flex";
			toggleScroll(true);
			closeBtn.focus();
			window.addEventListener("keydown", handleKeydown);
		};

		img.addEventListener("click", openLightbox);
		img.addEventListener("keydown", (e) => {
			if (e.key === "Enter") openLightbox();
		});
	});

	overlay.addEventListener("click", (e) => {
		if (e.target === overlay || e.target === closeBtn) closeLightbox();
	});
};

initLightbox();
document.addEventListener("astro:after-swap", initLightbox);
