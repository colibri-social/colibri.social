import {
	type ChatLayer,
	type Layer,
	type NotFoundLayer,
	parsePath,
	type Root,
	type Route,
	SETTINGS_PATH,
	type ThreadDraftLayer,
	type ThreadLayer,
	type ThreadsLayer,
} from "../layers";

export type PaneLayer = ThreadLayer | ThreadDraftLayer;

export type DesktopRoute = {
	root: Root;
	chat?: ChatLayer;
	overlay?: ThreadsLayer;
	pane?: PaneLayer;
	modal: Layer[];
	notFound?: NotFoundLayer;
	membersOpen?: boolean;
};

const MODAL_KINDS: readonly Layer["kind"][] = [
	"admin",
	"settings",
	"editProfile",
	"createSpace",
	"discover",
	"join",
];

export const isModalLayer = (layer: Layer | undefined) =>
	!!layer && MODAL_KINDS.includes(layer.kind);

const chatFor = (layer: {
	space: string;
	channel: string;
	channelType?: string;
}): ChatLayer => {
	const chat: ChatLayer = {
		kind: "chat",
		space: layer.space,
		channel: layer.channel,
	};
	if (layer.channelType) chat.channelType = layer.channelType;
	return chat;
};

const sameChannel = (
	a: { space: string; channel: string } | undefined,
	b: { space: string; channel: string },
) => !!a && a.space === b.space && a.channel === b.channel;

export const desktopRoute = (root: Root, layers: Layer[]): DesktopRoute => {
	const route: DesktopRoute = {
		root: { tab: "spaces", space: root.space },
		modal: [],
	};
	if (root.tab === "settings" || root.tab === "profile") {
		route.modal.push(
			root.tab === "profile"
				? { kind: "settings", page: "profile" }
				: { kind: "settings" },
		);
	}
	const enterChannel = (layer: {
		space: string;
		channel: string;
		channelType?: string;
	}) => {
		if (!sameChannel(route.chat, layer)) {
			route.chat = chatFor(layer);
			route.pane = undefined;
			route.overlay = undefined;
		}
		route.root.space = layer.space;
		route.modal = [];
		route.notFound = undefined;
	};
	for (const layer of layers) {
		if (layer.kind === "notFound") {
			route.chat = undefined;
			route.pane = undefined;
			route.overlay = undefined;
			route.modal = [];
			route.notFound = layer;
			continue;
		}
		if (layer.kind === "chat") {
			enterChannel(layer);
			route.overlay = undefined;
			if (route.pane?.kind === "thread" && route.pane.presentation === "full")
				route.pane = undefined;
			continue;
		}
		if (layer.kind === "members") {
			enterChannel(layer);
			route.membersOpen = true;
			continue;
		}
		if (layer.kind === "threads") {
			enterChannel(layer);
			route.overlay = { ...layer };
			continue;
		}
		if (layer.kind === "thread" || layer.kind === "threadDraft") {
			enterChannel(layer);
			const pane = { ...layer };
			if (pane.kind === "thread") delete pane.via;
			route.pane = pane;
			route.overlay = undefined;
			continue;
		}
		if (layer.kind === "editProfile") {
			route.modal.push({ kind: "settings", page: "profile" });
			continue;
		}
		route.modal.push(layer);
	}
	return route;
};

export const routeLayers = (route: DesktopRoute): Layer[] => [
	...(route.notFound ? [route.notFound] : []),
	...(route.chat ? [route.chat] : []),
	...(route.pane ? [route.pane] : []),
	...(route.overlay ? [route.overlay] : []),
	...route.modal,
];

export const visibleLayers = (route: DesktopRoute): Layer[] => [
	...(route.notFound ? [route.notFound] : []),
	...(route.overlay ? [route.overlay] : route.chat ? [route.chat] : []),
	...(route.pane ? [route.pane] : []),
	...route.modal.slice(-1),
];

export const isCovered = (route: DesktopRoute) => route.modal.length > 0;

export const parseDesktopPath = (pathname: string): Route => {
	const parsed = parsePath(pathname);
	if (!pathname.startsWith(`${SETTINGS_PATH}/`)) return parsed;
	const page = decodeURIComponent(pathname.slice(SETTINGS_PATH.length + 1));
	if (!page || page.includes("/")) return parsed;
	return {
		root: { tab: "spaces" },
		layers: [{ kind: "settings", page }],
	};
};
