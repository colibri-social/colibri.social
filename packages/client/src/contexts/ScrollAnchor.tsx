import {
	type Accessor,
	createContext,
	onCleanup,
	type ParentComponent,
	useContext,
} from "solid-js";
import { preserveScrollOnResize } from "../utils/preserve-scroll";

export type ScrollAnchorContextValue = {
	/** The scrollable element whose visual position should stay stable. */
	container: Accessor<HTMLElement | undefined>;
};

export const ScrollAnchorContext = createContext<ScrollAnchorContextValue>();

/**
 * Provides a scroll container that descendant media can anchor against to
 * avoid layout shift. Wrap any scrollable region whose content loads media
 * asynchronously (channel messages, and link embeds in the future).
 */
export const ScrollAnchorProvider: ParentComponent<{
	container: Accessor<HTMLElement | undefined>;
}> = (props) => {
	return (
		<ScrollAnchorContext.Provider value={{ container: props.container }}>
			{props.children}
		</ScrollAnchorContext.Provider>
	);
};

/**
 * Returns a `ref` callback for a media element (image, video, embed image)
 * whose async load would otherwise shift the surrounding content. When the
 * element resizes, the scroll position of the nearest {@link ScrollAnchorProvider}
 * is compensated so the viewport stays visually stable.
 *
 * No-ops outside a provider, so the same media components can be rendered
 * anywhere without a container to anchor against.
 */
export const useStableMedia = (): ((element: HTMLElement) => void) => {
	const ctx = useContext(ScrollAnchorContext);

	return (element: HTMLElement) => {
		if (!ctx) return;
		onCleanup(preserveScrollOnResize(ctx.container, element));
	};
};
