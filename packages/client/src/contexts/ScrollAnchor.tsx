import {
	type Accessor,
	createContext,
	createEffect,
	onCleanup,
	type ParentComponent,
	useContext,
} from "solid-js";
import { preserveScrollOnResize } from "../utils/preserve-scroll";

const BOTTOM_THRESHOLD = 80;

export type ScrollAnchorContextValue = {
	container: Accessor<HTMLElement | undefined>;
	isAtBottom: () => boolean;
};

export const ScrollAnchorContext = createContext<ScrollAnchorContextValue>();

/**
 * Provides a scroll container that descendant media can anchor against to
 * avoid layout shift.
 */
export const ScrollAnchorProvider: ParentComponent<{
	container: Accessor<HTMLElement | undefined>;
}> = (props) => {
	// Default true: channels open pinned to the newest message.
	let atBottom = true;
	const isAtBottom = () => atBottom;

	createEffect(() => {
		const el = props.container();
		if (!el) return;

		const onScroll = () => {
			atBottom =
				el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
		};

		onScroll();
		el.addEventListener("scroll", onScroll, { passive: true });
		onCleanup(() => el.removeEventListener("scroll", onScroll));
	});

	return (
		<ScrollAnchorContext.Provider
			value={{ container: props.container, isAtBottom }}
		>
			{props.children}
		</ScrollAnchorContext.Provider>
	);
};

export const useStableMedia = (): ((element: HTMLElement) => void) => {
	const ctx = useContext(ScrollAnchorContext);

	return (element: HTMLElement) => {
		if (!ctx) return;
		onCleanup(preserveScrollOnResize(ctx.container, element, ctx.isAtBottom));
	};
};
