import {
	createContext,
	createSignal,
	onMount,
	type ParentComponent,
	useContext,
} from "solid-js";
import { toast } from "somoto";
import { readGifFavorites, writeGifFavorites } from "../atproto/gif-favorites";
import type { GifItem } from "../atproto/xrpc/social/colibri/embed/gifTypes";
import { showError } from "../errors/show-error";
import { createLogger } from "../utils/logger";
import { useUserContext } from "./User";

const log = createLogger("gifs");

type GifFavoritesContextValue = {
	favorites: () => Array<GifItem>;
	isFavorited: (gif: GifItem) => boolean;
	toggleFavorite: (gif: GifItem) => Promise<void>;
};

const GifFavoritesContext = createContext<GifFavoritesContextValue>();

/**
 * Two GifItems are considered the same favorite if either their id or their
 * media URL matches. This lets a GIF favorited from the picker (id = Klipy
 * slug) and the same GIF favorited from a chat message (id = its media URL)
 * resolve to one entry.
 */
const sameGif = (a: GifItem, b: GifItem): boolean =>
	a.id === b.id || a.mediaUrl === b.mediaUrl;

/**
 * Holds the user's GIF favorites (one PDS record) as shared reactive state, so
 * the picker's Favorites tab and the favorite stars on chat GIFs stay in sync
 * and the record is read once per session rather than per component.
 */
export const GifFavoritesContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const [favorites, setFavorites] = createSignal<Array<GifItem>>([]);
	const [unavailable, setUnavailable] = createSignal(false);

	onMount(async () => {
		try {
			setFavorites(await readGifFavorites(user.atproto.agent, user.did));
		} catch (err) {
			setUnavailable(true);
			log.error("reading GIF favourites failed", { error: err });
			showError(err, {
				fallbackTitle: "Couldn't load your saved GIFs.",
				description: "Saving is paused until they load, so nothing is lost.",
			});
		}
	});

	const isFavorited = (gif: GifItem): boolean =>
		favorites().some((f) => sameGif(f, gif));

	const toggleFavorite = async (gif: GifItem): Promise<void> => {
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
			: [gif, ...previous];
		setFavorites(next); // optimistic
		try {
			await writeGifFavorites(user.atproto.agent, user.did, next);
		} catch (err) {
			log.error("saving GIF favourites failed", { error: err });
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
