import { type Accessor, createSignal, type JSX, onCleanup } from "solid-js";

const MIN_PRESS_MS = 90;
const PRESS_KEYS = new Set([" ", "Enter"]);

type Handler<T extends HTMLElement, E extends Event> =
	| JSX.EventHandlerUnion<T, E>
	| undefined;

export const callHandler = <T extends HTMLElement, E extends Event>(
	handler: Handler<T, E>,
	event: E & { currentTarget: T; target: Element },
) => {
	if (!handler) return;
	if (typeof handler === "function") {
		handler(event);
		return;
	}
	handler[0](handler[1], event);
};

export type PressHandlers<T extends HTMLElement> = {
	onPointerDown?: Handler<T, PointerEvent>;
	onPointerUp?: Handler<T, PointerEvent>;
	onPointerLeave?: Handler<T, PointerEvent>;
	onPointerCancel?: Handler<T, PointerEvent>;
	onKeyDown?: Handler<T, KeyboardEvent>;
	onKeyUp?: Handler<T, KeyboardEvent>;
	onBlur?: Handler<T, FocusEvent>;
};

export const createPress = <T extends HTMLElement>(options: {
	disabled: Accessor<boolean | undefined>;
	handlers?: PressHandlers<T>;
	onPressStart?: () => void;
}) => {
	const [pressed, setPressed] = createSignal(false);
	let pressedAt = 0;
	let releaseTimer: ReturnType<typeof setTimeout> | undefined;

	const start = () => {
		if (options.disabled()) return;
		clearTimeout(releaseTimer);
		pressedAt = performance.now();
		setPressed(true);
		options.onPressStart?.();
	};

	const release = () => {
		if (!pressed()) return;
		const held = performance.now() - pressedAt;
		clearTimeout(releaseTimer);
		if (held >= MIN_PRESS_MS) {
			setPressed(false);
			return;
		}
		releaseTimer = setTimeout(() => setPressed(false), MIN_PRESS_MS - held);
	};

	const cancel = () => {
		clearTimeout(releaseTimer);
		setPressed(false);
	};

	onCleanup(() => clearTimeout(releaseTimer));

	const handlers = options.handlers ?? {};

	const pressProps = {
		onPointerDown: (
			event: PointerEvent & { currentTarget: T; target: Element },
		) => {
			callHandler(handlers.onPointerDown, event);
			if (event.button !== 0) return;
			start();
		},
		onPointerUp: (
			event: PointerEvent & { currentTarget: T; target: Element },
		) => {
			callHandler(handlers.onPointerUp, event);
			release();
		},
		onPointerLeave: (
			event: PointerEvent & { currentTarget: T; target: Element },
		) => {
			callHandler(handlers.onPointerLeave, event);
			cancel();
		},
		onPointerCancel: (
			event: PointerEvent & { currentTarget: T; target: Element },
		) => {
			callHandler(handlers.onPointerCancel, event);
			cancel();
		},
		onKeyDown: (
			event: KeyboardEvent & { currentTarget: T; target: Element },
		) => {
			callHandler(handlers.onKeyDown, event);
			if (!event.repeat && PRESS_KEYS.has(event.key)) start();
		},
		onKeyUp: (event: KeyboardEvent & { currentTarget: T; target: Element }) => {
			callHandler(handlers.onKeyUp, event);
			if (PRESS_KEYS.has(event.key)) release();
		},
		onBlur: (event: FocusEvent & { currentTarget: T; target: Element }) => {
			callHandler(handlers.onBlur, event);
			cancel();
		},
	};

	return { pressed, pressProps };
};
