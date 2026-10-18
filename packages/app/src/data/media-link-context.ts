import { untrack, useContext } from "solid-js";
import {
	createMediaLinkRefresher,
	MediaLinkContext,
	type MediaLinkRefresher,
} from "./media-link";
import { DataContext, type DataStore } from "./store";

const viewingRefreshers = new WeakMap<DataStore, MediaLinkRefresher>();

const viewingRefresher = (store: DataStore) => {
	let refresher = viewingRefreshers.get(store);
	if (!refresher) {
		refresher = createMediaLinkRefresher({
			feed: () => {
				const ref = untrack(store.viewing);
				return ref ? store.channel(ref) : undefined;
			},
			listMessages: (params) => store.source.listMessages(params),
		});
		viewingRefreshers.set(store, refresher);
	}
	return refresher;
};

export const useMediaLinkRefresher = (): MediaLinkRefresher | undefined => {
	const provided = useContext(MediaLinkContext);
	if (provided) return provided;
	const store = useContext(DataContext);
	return store ? viewingRefresher(store) : undefined;
};
