import {
	type Component,
	createEffect,
	createSignal,
	on,
	onCleanup,
	Show,
} from "solid-js";
import createMediaQuery from "../../utils/create-media-query";
import { REDUCED_MOTION_QUERY } from "./Hummingbird";
import {
	DART_DURATION,
	HummingbirdLoader,
	LABEL_FADE,
} from "./HummingbirdLoader";
import {
	activeLoadingRequest,
	type LoadingPhase,
	loadingRequests,
	overlayEnterDelay,
} from "./loading-overlay-state";

const EXIT_DEBOUNCE = 120;
const EXIT_SETTLE = 60;
const TIRED_AFTER = 8000;

const MOBILE_SIZE = 176;
const DESKTOP_SIZE = 240;

export const BootOverlay: Component = () => {
	const reducedMotion = createMediaQuery(REDUCED_MOTION_QUERY);
	const narrow = createMediaQuery("(max-width: 767px)");

	const [visible, setVisible] = createSignal(false);
	const [exiting, setExiting] = createSignal(false);
	const [tired, setTired] = createSignal(false);

	const [latched, setLatched] = createSignal<{
		message: string | undefined;
		phase: LoadingPhase;
		flavor: boolean;
	}>({ message: undefined, phase: "syncing", flavor: true });

	const request = () => activeLoadingRequest();
	const active = () => loadingRequests().length > 0;

	createEffect(() => {
		const current = request();
		if (!current) return;
		setLatched({
			message: current.message(),
			phase: current.phase(),
			flavor: current.flavor(),
		});
	});

	let exitTimer: ReturnType<typeof setTimeout> | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let tiredTimer: ReturnType<typeof setTimeout> | undefined;
	let enterTimer: ReturnType<typeof setTimeout> | undefined;

	onCleanup(() => {
		clearTimeout(exitTimer);
		clearTimeout(hideTimer);
		clearTimeout(tiredTimer);
		clearTimeout(enterTimer);
	});

	const enterDelay = () => overlayEnterDelay(loadingRequests());

	createEffect(
		on([active, enterDelay], ([isActive, wait]) => {
			clearTimeout(exitTimer);
			clearTimeout(hideTimer);
			clearTimeout(enterTimer);
			enterTimer = undefined;

			if (isActive) {
				if (visible()) {
					setExiting(false);
					return;
				}

				if (wait <= 0) {
					setExiting(false);
					setVisible(true);
					return;
				}

				enterTimer = setTimeout(() => {
					enterTimer = undefined;
					setExiting(false);
					setVisible(true);
				}, wait);
				return;
			}

			if (!visible()) return;

			exitTimer = setTimeout(() => {
				if (reducedMotion()) {
					setVisible(false);
					return;
				}
				setExiting(true);
				hideTimer = setTimeout(
					() => setVisible(false),
					LABEL_FADE + DART_DURATION + EXIT_SETTLE,
				);
			}, EXIT_DEBOUNCE);
		}),
	);

	createEffect(
		on([active, () => request()?.phase(), () => request()?.flavor()], () => {
			clearTimeout(tiredTimer);
			setTired(false);

			if (!active() || request()?.flavor() === false) return;

			tiredTimer = setTimeout(() => setTired(true), TIRED_AFTER);
		}),
	);

	return (
		<Show when={visible()}>
			<div
				class="fixed inset-x-0 bottom-0 top-[var(--titlebar-height)] z-60 flex items-center justify-center bg-background"
				role="status"
			>
				<HummingbirdLoader
					size={narrow() ? MOBILE_SIZE : DESKTOP_SIZE}
					phase={latched().phase}
					message={latched().message}
					flavor={latched().flavor}
					tired={tired()}
					exiting={exiting()}
				/>
			</div>
		</Show>
	);
};
