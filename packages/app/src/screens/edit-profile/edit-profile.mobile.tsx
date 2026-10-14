import { onCleanup, onMount } from "solid-js";
import { editProfile } from "./edit-profile.contract";

const KEYBOARD_SETTLE_MS = 320;

const keepFocusVisible = (container: HTMLElement) => {
	let timer: number | undefined;
	const reveal = () => {
		const active = document.activeElement;
		if (!(active instanceof HTMLElement) || !container.contains(active)) return;
		active.scrollIntoView({ block: "nearest", behavior: "smooth" });
	};
	const schedule = () => {
		clearTimeout(timer);
		timer = window.setTimeout(reveal, KEYBOARD_SETTLE_MS);
	};
	const observer = new ResizeObserver(schedule);
	observer.observe(container);
	container.addEventListener("focusin", schedule);
	return () => {
		clearTimeout(timer);
		observer.disconnect();
		container.removeEventListener("focusin", schedule);
	};
};

export default editProfile.view({
	render: ({ slots: s }) => {
		let scroller: HTMLDivElement | undefined;
		onMount(() => {
			if (scroller) onCleanup(keepFocusVisible(scroller));
		});
		return (
			<div class="flex min-h-0 flex-1 flex-col">
				<s.Header />
				<div
					ref={scroller}
					data-scroll-y=""
					class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-safe-offset-6 scroll-pb-6"
				>
					<s.Images />
					<div class="flex flex-col gap-6 px-4 pt-4">
						<s.Fields />
						<s.Theme />
						<s.Sync />
					</div>
				</div>
			</div>
		);
	},
});
