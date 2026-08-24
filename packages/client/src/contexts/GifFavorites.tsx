import {
	createContext,
	createSignal,
	onMount,
	type ParentComponent,
	useContext,
} from "solid-js";
import { toast } from "somoto";
import { readGifFavorites, writeGifFavorites } from "../atproto/gif-favorites";
import type { GifView } from "../atproto/views";
import { classifyThrown } from "../errors/classify";
import { showError } from "../errors/show-error";
import { createLogger } from "../utils/logger";
import { useUserContext } from "./User";

const log = createLogger("gifs");

export type GifCandidate = Omit<GifView, "width" | "height"> &
	Partial<Pick<GifView, "width" | "height">>;

type GifFavoritesContextValue = {
	favorites: () => Array<GifView>;
	isFavorited: (gif: GifCandidate) => boolean;
	toggleFavorite: (gif: GifCandidate) => Promise<void>;
};

const MEASURE_TIMEOUT_MS = 5_000;

const measure = (url: string): Promise<{ width: number; height: number }> =>
	new Promise((resolve) => {
		const image = new Image();
		const settle = (width: number, height: number) => {
			clearTimeout(timer);
			image.onload = null;
			image.onerror = null;
			resolve({ width, height });
		};
		const timer = setTimeout(() => settle(0, 0), MEASURE_TIMEOUT_MS);
		image.onload = () => settle(image.naturalWidth, image.naturalHeight);
		image.onerror = () => settle(0, 0);
		image.src = url;
	});

const asGifView = async (gif: GifCandidate): Promise<GifView> => {
	if (gif.width !== undefined && gif.height !== undefined) {
		return gif as GifView;
	}
	const { width, height } = await measure(gif.previewUrl);
	return { ...gif, width, height };
};

const GifFavoritesContext = createContext<GifFavoritesContextValue>();

/**
 * Two GifViews are considered the same favorite if either their id or their
 * URL matches. This lets a GIF favorited from the picker (id = Klipy slug) and
 * the same GIF favorited from a chat message (id = its URL) resolve to one
 * entry.
 */
const sameGif = (a: GifCandidate, b: GifCandidate): boolean =>
	a.id === b.id || a.url === b.url;

/**
 * Holds the user's GIF favorites (one PDS record) as shared reactive state, so
 * the picker's Favorites tab and the favorite stars on chat GIFs stay in sync
 * and the record is read once per session rather than per component.
 */
export const GifFavoritesContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const [favorites, setFavorites] = createSignal<Array<GifView>>([]);
	const [unavailable, setUnavailable] = createSignal(false);

	onMount(async () => {
		try {
			setFavorites([...(await readGifFavorites(user.xrpc))]);
		} catch (err) {
			setUnavailable(true);
			log.error("reading GIF favourites failed", {
				code: classifyThrown(err).code,
			});
			showError(err, {
				fallbackTitle: "Couldn't load your saved GIFs.",
				description: "Saving is paused until they load, so nothing is lost.",
			});
		}
	});

	const isFavorited = (gif: GifCandidate): boolean =>
		favorites().some((f) => sameGif(f, gif));

	const toggleFavorite = async (gif: GifCandidate): Promise<void> => {
		if (unavailable()) {
			showError(undefined, {
				fallbackTitle: "Your saved GIFs aren't loaded yet.",
				description: "Reopen the picker once they load.",
				report: false,
			});
			return;
		}

		const previous = favorites();
		const next = isFavorited(gif)
			? previous.filter((f) => !sameGif(f, gif))
			: [await asGifView(gif), ...previous];
		setFavorites(next); // optimistic
		try {
			const res = await writeGifFavorites(
				user.atproto.agent,
				user.xrpc,
				user.did,
				next,
			);
			if (!res.ok) throw res.error;
		} catch (err) {
			log.error("saving GIF favourites failed", {
				code: classifyThrown(err).code,
			});
			setFavorites(previous); // revert on failure
			toast.error("Failed to update GIF favorites.");
		}
	};

	return (
		<GifFavoritesContext.Provider
			value={{ favorites, isFavorited, toggleFavorite }}
		>
			{props.children}
		</GifFavoritesContext.Provider>
	);
};

export const useGifFavorites = (): GifFavoritesContextValue => {
	const ctx = useContext(GifFavoritesContext);
	if (!ctx)
		throw new Error(
			"useGifFavorites called outside GifFavoritesContextProvider",
		);
	return ctx;
};
