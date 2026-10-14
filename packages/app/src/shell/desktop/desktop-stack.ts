import { batch, createSignal } from "solid-js";
import {
	browserHistory,
	createHistorySync,
	type HistoryPort,
} from "../history-sync";
import { type Layer, type Root, sameLayer } from "../layers";
import type { Navigator, PopGuard } from "../stack";
import {
	type DesktopRoute,
	desktopRoute,
	parseDesktopPath,
	routeLayers,
	visibleLayers,
} from "./desktop-route";

const MEMBERS_KEY = "colibri:desktop-members-open";

const storedMembersOpen = () => {
	try {
		return localStorage.getItem(MEMBERS_KEY) !== "false";
	} catch {
		return true;
	}
};

const reuse = <T extends Layer>(
	previous: T | undefined,
	next: T | undefined,
) => (previous && next && sameLayer(previous, next) ? previous : next);

const keepIdentity = (
	previous: DesktopRoute,
	next: DesktopRoute,
): DesktopRoute => ({
	...next,
	chat: reuse(previous.chat, next.chat),
	pane: reuse(previous.pane, next.pane),
	overlay: reuse(previous.overlay, next.overlay),
	modal: next.modal.map(
		(layer, index) => reuse(previous.modal[index], layer) ?? layer,
	),
});

const baseLayers = (route: DesktopRoute): Layer[] =>
	routeLayers({ ...route, modal: [] });

export const createDesktopStack = (
	options: { history?: HistoryPort; initialPath?: string } = {},
) => {
	const port = options.history ?? browserHistory();
	const initial = parseDesktopPath(options.initialPath ?? port.path());
	const [route, setRoute] = createSignal<DesktopRoute>(
		desktopRoute(initial.root, initial.layers),
	);
	const [membersOpen, setMembersOpenSignal] = createSignal(
		route().membersOpen ?? storedMembersOpen(),
	);
	let popGuard: PopGuard | undefined;

	const layers = () => routeLayers(route());

	const setMembersOpen = (open: boolean) => {
		setMembersOpenSignal(open);
		try {
			localStorage.setItem(MEMBERS_KEY, String(open));
		} catch {}
	};

	const blocksPop = (next: number) => {
		if (!popGuard || next >= popGuard.depth || !popGuard.blocked()) {
			return false;
		}
		popGuard.onBlocked();
		return true;
	};

	const history = createHistorySync({
		port,
		parse: parseDesktopPath,
		route: () => ({ root: route().root, layers: layers() }),
		onExternal: (navigation) => {
			if (blocksPop(navigation.depth)) {
				history.sync();
				return;
			}
			const current = route();
			const keep = navigation.depth > 0 ? baseLayers(current) : [];
			commit(
				desktopRoute(navigation.route.root, [
					...keep,
					...navigation.route.layers,
				]),
				false,
			);
		},
	});

	const commit = (incoming: DesktopRoute, sync = true) => {
		const next = keepIdentity(route(), incoming);
		batch(() => {
			if (next.membersOpen) setMembersOpen(true);
			setRoute({ ...next, membersOpen: undefined });
		});
		if (sync) history.sync();
	};

	const apply = (list: Layer[], root: Root = route().root) =>
		commit(desktopRoute(root, list));

	const push = (layer: Layer) => apply([...layers(), layer]);

	const replaceTop = (layer: Layer) => {
		const list = layers();
		apply([...list.slice(0, -1), layer]);
	};

	const popTo = (next: number, force = false) => {
		const list = layers();
		if (next >= list.length) return;
		if (!force && blocksPop(next)) return;
		apply(list.slice(0, Math.max(0, next)));
	};

	const pop = () => {
		const list = layers();
		if (list.length === 0) return false;
		if (blocksPop(list.length - 1)) return true;
		apply(list.slice(0, -1));
		return true;
	};

	const setRoot = (next: Root) => {
		const current = route();
		if (next.tab === "settings" || next.tab === "profile") {
			apply(layers(), next);
			return;
		}
		if (next.tab !== "spaces") return;
		if (next.space === current.root.space) return;
		commit(desktopRoute({ tab: "spaces", space: next.space }, []));
	};

	const openBase = (chat: Layer) => apply([chat, ...layers()]);

	const setPopGuard = (guard: PopGuard) => {
		popGuard = guard;
		return () => {
			if (popGuard === guard) popGuard = undefined;
		};
	};

	history.seed({ root: route().root, layers: layers() });

	const navigator: Navigator = {
		root: () => route().root,
		setRoot,
		mounted: layers,
		activeDepth: () => layers().length,
		depth: () => layers().length,
		moving: () => false,
		push,
		replaceTop,
		pop,
		popTo: (next: number) => popTo(next),
		forcePop: () => popTo(layers().length - 1, true),
		setPopGuard,
		top: () => layers().at(-1),
		isVisible: (match) => visibleLayers(route()).some(match),
	};

	return {
		navigator,
		route,
		membersOpen,
		setMembersOpen,
		openBase,
		dispose: history.dispose,
	};
};

export type DesktopStack = ReturnType<typeof createDesktopStack>;
