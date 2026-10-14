export type Tab = "spaces" | "inbox" | "profile" | "settings";

export type Root = {
	tab: Tab;
	space?: string;
};

export const TEXT_CHANNEL_TYPE = "social.colibri.beta.channel.text";

type ChannelTarget = { space: string; channel: string; channelType?: string };

export type ChatLayer = ChannelTarget & { kind: "chat" };
export type MembersLayer = ChannelTarget & { kind: "members" };
export type ThreadLayer = ChannelTarget & {
	kind: "thread";
	thread: string;
	via?: "threads";
	presentation?: "full";
};

export const FULL_THREAD_SEGMENT = "full";
export type ThreadsLayer = ChannelTarget & { kind: "threads" };
export type ThreadDraftLayer = ChannelTarget & {
	kind: "threadDraft";
	anchor?: string;
};

export const THREAD_DRAFT_SEGMENT = "new";

export type EditProfileLayer = { kind: "editProfile" };

export type SettingsLayer = { kind: "settings"; page?: string };

export const ADMIN_PAGES = [
	"overview",
	"profile",
	"messages",
	"transfer",
	"members",
	"emoji",
	"emoji-pack",
	"roles",
	"role",
	"invites",
	"invite",
	"channel",
	"channel-permissions",
	"channel-audience",
	"category",
	"category-permissions",
	"category-audience",
	"role-permissions",
	"role-members",
	"bridges",
	"bridge",
	"bridge-new",
	"bridge-connect",
	"bridge-code",
] as const;

export type AdminPage = (typeof ADMIN_PAGES)[number];

export const NEW_ENTRY = "new";

export type AdminLayer = {
	kind: "admin";
	space: string;
	page: AdminPage;
	id?: string;
};

export type CreateSpaceLayer = { kind: "createSpace" };
export type DiscoverLayer = { kind: "discover" };
export type JoinLayer = { kind: "join"; code: string };

export type AppLayer = CreateSpaceLayer | DiscoverLayer | JoinLayer;

const ADMIN_PARENT: Partial<Record<AdminPage, AdminPage>> = {
	role: "roles",
	invite: "invites",
	bridge: "bridges",
	"emoji-pack": "emoji",
	"bridge-new": "bridges",
	"bridge-connect": "bridge-new",
	"bridge-code": "bridge-new",
};

const STANDALONE_ADMIN: readonly AdminPage[] = ["channel", "category"];

export type ChannelLayer =
	| ChatLayer
	| MembersLayer
	| ThreadLayer
	| ThreadsLayer
	| ThreadDraftLayer;

export type Layer =
	| ChannelLayer
	| EditProfileLayer
	| SettingsLayer
	| AdminLayer
	| AppLayer;

const CHANNEL_KINDS: readonly string[] = [
	"chat",
	"members",
	"thread",
	"threads",
	"threadDraft",
];

export const isChannelLayer = (
	layer: Layer | undefined,
): layer is ChannelLayer => !!layer && CHANNEL_KINDS.includes(layer.kind);

export const isSheetLayer = (layer: Layer | undefined) =>
	layer?.kind === "admin" && layer.page === "overview";

export const PROFILE_EDIT_PATH = "/app/profile/edit";
export const CREATE_SPACE_PATH = "/app/new";
export const DISCOVER_PATH = "/app/discover";
export const SETTINGS_PATH = "/app/settings";

export const adminPath = (layer: Omit<AdminLayer, "kind">) => {
	const base = `/app/c/${layer.space}/manage/${layer.page}`;
	return layer.id ? `${base}/${segment(layer.id)}` : base;
};

export const adminLayers = (
	space: string,
	page: AdminPage,
	id?: string,
): AdminLayer[] => {
	const layer: AdminLayer = { kind: "admin", space, page };
	if (id) layer.id = id;
	if (page === "overview") return [layer];
	if (STANDALONE_ADMIN.includes(page)) return [layer];
	const overview: AdminLayer = { kind: "admin", space, page: "overview" };
	const parents: AdminLayer[] = [];
	for (
		let parent = ADMIN_PARENT[page];
		parent && parent !== "overview";
		parent = ADMIN_PARENT[parent]
	) {
		parents.unshift({ kind: "admin", space, page: parent });
	}
	return [overview, ...parents, layer];
};

export type Route = {
	root: Root;
	layers: Layer[];
};

const segment = (value: string) => encodeURIComponent(value);

export const rootPath = (root: Root) => {
	if (root.tab !== "spaces") return `/app/${root.tab}`;
	return root.space ? `/app/c/${root.space}` : "/app";
};

export const channelPath = (target: ChannelTarget) =>
	`/app/c/${target.space}/${target.channelType ?? TEXT_CHANNEL_TYPE}/${segment(target.channel)}`;

export const layerPath = (layer: Layer) => {
	if (layer.kind === "editProfile") return PROFILE_EDIT_PATH;
	if (layer.kind === "settings") {
		return layer.page
			? `${SETTINGS_PATH}/${segment(layer.page)}`
			: SETTINGS_PATH;
	}
	if (layer.kind === "createSpace") return CREATE_SPACE_PATH;
	if (layer.kind === "discover") return DISCOVER_PATH;
	if (layer.kind === "join") return `/app/invite/${segment(layer.code)}`;
	if (layer.kind === "admin") return adminPath(layer);
	const chat = channelPath(layer);
	if (layer.kind === "members") return `${chat}/members`;
	if (layer.kind === "threads") return `${chat}/threads`;
	if (layer.kind === "thread") {
		const prefix = layer.via === "threads" ? `${chat}/threads` : chat;
		const path = `${prefix}/t/${segment(layer.thread)}`;
		return layer.presentation === "full"
			? `${path}/${FULL_THREAD_SEGMENT}`
			: path;
	}
	if (layer.kind === "threadDraft") {
		const draft = `${chat}/t/${THREAD_DRAFT_SEGMENT}`;
		return layer.anchor ? `${draft}/${segment(layer.anchor)}` : draft;
	}
	return chat;
};

export const pathAt = (route: Route, depth: number) => {
	const layer = route.layers[depth - 1];
	return layer ? layerPath(layer) : rootPath(route.root);
};

const TABS: readonly Tab[] = ["inbox", "profile", "settings"];

export const parsePath = (pathname: string): Route => {
	const parts = pathname
		.split("/")
		.filter(Boolean)
		.map((part) => decodeURIComponent(part));
	const [app, head, space, channelType, channel, tail, thread, anchor] = parts;
	if (app === "invite" && head) {
		return { root: { tab: "spaces" }, layers: [{ kind: "join", code: head }] };
	}
	if (app !== "app") return { root: { tab: "spaces" }, layers: [] };
	if (head === "profile" && space === "edit") {
		return { root: { tab: "profile" }, layers: [{ kind: "editProfile" }] };
	}
	if (head === "new" && !space) {
		return { root: { tab: "spaces" }, layers: [{ kind: "createSpace" }] };
	}
	if (head === "discover" && !space) {
		return { root: { tab: "spaces" }, layers: [{ kind: "discover" }] };
	}
	if (head === "invite" && space) {
		return {
			root: { tab: "spaces" },
			layers: [{ kind: "join", code: space }],
		};
	}
	if (head && TABS.includes(head as Tab)) {
		return { root: { tab: head as Tab }, layers: [] };
	}
	if (head !== "c" || !space?.startsWith("did:")) {
		return { root: { tab: "spaces" }, layers: [] };
	}
	const root: Root = { tab: "spaces", space };
	if (channelType === "manage") {
		const page = (channel ?? "overview") as AdminPage;
		if (!ADMIN_PAGES.includes(page)) return { root, layers: [] };
		return { root, layers: adminLayers(space, page, tail) };
	}
	if (!channelType || !channel) return { root, layers: [] };
	const target = { space, channel, channelType };
	const chat: ChatLayer = { kind: "chat", ...target };
	if (tail === "members") {
		return { root, layers: [chat, { kind: "members", ...target }] };
	}
	if (tail === "t" && thread === THREAD_DRAFT_SEGMENT) {
		const draft: ThreadDraftLayer = { kind: "threadDraft", ...target };
		if (anchor) draft.anchor = anchor;
		return { root, layers: [chat, draft] };
	}
	if (tail === "t" && thread) {
		const layer: ThreadLayer = { kind: "thread", ...target, thread };
		if (anchor === FULL_THREAD_SEGMENT) layer.presentation = "full";
		return { root, layers: [chat, layer] };
	}
	if (tail === "threads") {
		const list: ThreadsLayer = { kind: "threads", ...target };
		if (thread === "t" && anchor) {
			return {
				root,
				layers: [
					chat,
					list,
					{ kind: "thread", ...target, thread: anchor, via: "threads" },
				],
			};
		}
		return { root, layers: [chat, list] };
	}
	return { root, layers: [chat] };
};

export const sameLayer = (a: Layer | undefined, b: Layer | undefined) =>
	!!a && !!b && layerPath(a) === layerPath(b);

export const layerKey = (layer: Layer) => layerPath(layer);
