const TAP_SLOP = 10;

export const installTapGuard = () => {
	let startX = 0;
	let startY = 0;
	let moved = false;
	let tracking = false;

	const onDown = (event: PointerEvent) => {
		if (event.pointerType === "mouse" || !event.isPrimary) {
			tracking = false;
			return;
		}
		tracking = true;
		moved = false;
		startX = event.clientX;
		startY = event.clientY;
	};

	const onMove = (event: PointerEvent) => {
		if (!tracking || moved || !event.isPrimary) return;
		if (Math.hypot(event.clientX - startX, event.clientY - startY) > TAP_SLOP) {
			moved = true;
		}
	};

	const onCancel = () => {
		moved = true;
	};

	const onClick = (event: MouseEvent) => {
		if (!tracking) return;
		tracking = false;
		if (!moved) return;
		event.preventDefault();
		event.stopImmediatePropagation();
	};

	const options = { capture: true, passive: true } as const;
	document.addEventListener("pointerdown", onDown, options);
	document.addEventListener("pointermove", onMove, options);
	document.addEventListener("pointercancel", onCancel, options);
	document.addEventListener("click", onClick, { capture: true });

	return () => {
		document.removeEventListener("pointerdown", onDown, options);
		document.removeEventListener("pointermove", onMove, options);
		document.removeEventListener("pointercancel", onCancel, options);
		document.removeEventListener("click", onClick, { capture: true });
	};
};
