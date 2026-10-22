import { colibri } from "./lexicons.js";

const PERMISSION_SETS = [
	"social.colibri.beta.permissionAccount",
	"social.colibri.beta.permissionCommunity",
	"social.colibri.beta.permissionMessaging",
	"social.colibri.beta.permissionNotification",
] as const;

const PUSH_PERMISSION_SET = "social.colibri.beta.permissionPush";

export const WILDCARD_RPC = [
	"social.colibri.beta.sync.subscribeEvents",
	"social.colibri.beta.voice.subscribeSignals",
	"social.colibri.beta.voice.moderate",
	"social.colibri.labeler.linkExternalAccount",
	"social.colibri.labeler.unlinkExternalAccount",
] as const;

export const EMOJI_COLLECTIONS = [
	"blue.moji.collection.item",
	"blue.moji.packs.pack",
	"blue.moji.packs.packitem",
] as const;

export const buildScopes = (appViewDid: string) => [
	"atproto",
	"blob:*/*",
	...EMOJI_COLLECTIONS.map((collection) => `repo:${collection}`),
	...WILDCARD_RPC.map((lxm) => `rpc:${lxm}?aud=*`),
	...PERMISSION_SETS.map(
		(nsid) => `include:${nsid}?aud=${appViewDid}#colibri_appview`,
	),
	`include:${PUSH_PERMISSION_SET}?aud=${appViewDid}#colibri_notifs`,
];

export const scopes = buildScopes("did:web:spaces-api.colibri.social");

export const PERMISSION_SET_LABELS: Record<string, string> = {
	"social.colibri.beta.permissionAccount": "Account & profile",
	"social.colibri.beta.permissionCommunity": "Communities & channels",
	"social.colibri.beta.permissionMessaging": "Messages & membership",
	"social.colibri.beta.permissionNotification": "Notifications",
	"social.colibri.beta.permissionPush": "Push notifications",
	"social.colibri.beta.sync.subscribeEvents": "Live updates",
	"social.colibri.beta.voice.subscribeSignals": "Voice channels",
	"social.colibri.beta.voice.moderate": "Voice channels",
	"social.colibri.labeler.linkExternalAccount": "Supporter badges",
	"social.colibri.labeler.unlinkExternalAccount": "Supporter badges",
	...Object.fromEntries(
		EMOJI_COLLECTIONS.map((collection) => [collection, "Custom emoji"]),
	),
};

export const UNKNOWN_SCOPE_METHOD = "*";

type PermissionSource = {
	permissions: ReadonlyArray<{ resource: string; options?: unknown }>;
};

const PERMISSION_SET_SOURCES: Record<string, PermissionSource> = {
	"social.colibri.beta.permissionAccount": colibri.permissionAccount.main,
	"social.colibri.beta.permissionCommunity": colibri.permissionCommunity.main,
	"social.colibri.beta.permissionMessaging": colibri.permissionMessaging.main,
	"social.colibri.beta.permissionNotification":
		colibri.permissionNotification.main,
	[PUSH_PERMISSION_SET]: colibri.permissionPush.main,
};

export type PermissionSetResources = Readonly<
	Record<string, readonly string[]>
>;

const stringsIn = (value: unknown): string[] =>
	Array.isArray(value)
		? value.filter(
				(item): item is string => typeof item === "string" && item !== "*",
			)
		: [];

export const permissionSetResources = (set: PermissionSource): string[] => [
	...new Set(
		set.permissions.flatMap((permission) => {
			const options = (permission.options ?? {}) as Record<string, unknown>;
			if (permission.resource === "rpc") return stringsIn(options.lxm);
			if (permission.resource === "repo") return stringsIn(options.collection);
			return [];
		}),
	),
];

export const PERMISSION_SET_RESOURCES: PermissionSetResources =
	Object.fromEntries(
		Object.entries(PERMISSION_SET_SOURCES).map(([nsid, set]) => [
			nsid,
			permissionSetResources(set),
		]),
	);

type Grant = {
	includes: Set<string>;
	rpc: Map<string, Set<string>>;
	repo: Set<string>;
};

const decodePart = (value: string): string => {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

const parseScopeToken = (token: string) => {
	const query = token.indexOf("?");
	const head = query === -1 ? token : token.slice(0, query);
	const colon = head.indexOf(":");
	return {
		prefix: colon === -1 ? head : head.slice(0, colon),
		positional: colon === -1 ? undefined : decodePart(head.slice(colon + 1)),
		params: new URLSearchParams(query === -1 ? "" : token.slice(query + 1)),
	};
};

const valuesOf = (
	positional: string | undefined,
	params: URLSearchParams,
	key: string,
): string[] => [
	...(positional === undefined ? [] : [positional]),
	...params.getAll(key),
];

const parseGrant = (scope: string): Grant => {
	const grant: Grant = { includes: new Set(), rpc: new Map(), repo: new Set() };
	for (const token of scope.split(/\s+/)) {
		if (!token) continue;
		const { prefix, positional, params } = parseScopeToken(token);
		if (prefix === "include") {
			const nsid = positional ?? params.get("nsid");
			if (nsid) grant.includes.add(nsid);
		} else if (prefix === "rpc") {
			const aud = params.get("aud") ?? "";
			for (const lxm of valuesOf(positional, params, "lxm")) {
				const audiences = grant.rpc.get(lxm) ?? new Set<string>();
				audiences.add(aud);
				grant.rpc.set(lxm, audiences);
			}
		} else if (prefix === "repo") {
			for (const collection of valuesOf(positional, params, "collection")) {
				grant.repo.add(collection);
			}
		}
	}
	return grant;
};

const grantsRpc = (grant: Grant, lxm: string, aud?: string): boolean =>
	[lxm, "*"].some((key) => {
		const audiences = grant.rpc.get(key);
		if (!audiences) return false;
		return aud === undefined || audiences.has(aud) || audiences.has("*");
	});

const grantsRepo = (grant: Grant, collection: string): boolean =>
	grant.repo.has(collection) || grant.repo.has("*");

const grantsResource = (grant: Grant, resource: string): boolean =>
	grantsRpc(grant, resource) || grantsRepo(grant, resource);

const STANDALONE_RESOURCES = new Set<string>([
	...WILDCARD_RPC,
	...EMOJI_COLLECTIONS,
]);

const distinctiveResources = (
	nsid: string,
	sets: PermissionSetResources,
): string[] =>
	(sets[nsid] ?? []).filter(
		(resource) =>
			!STANDALONE_RESOURCES.has(resource) &&
			!Object.entries(sets).some(
				([other, resources]) => other !== nsid && resources.includes(resource),
			),
	);

const hasPermissionSet = (
	grant: Grant,
	nsid: string,
	sets: PermissionSetResources,
): boolean =>
	grant.includes.has(nsid) ||
	distinctiveResources(nsid, sets).some((resource) =>
		grantsResource(grant, resource),
	);

export const scopeSetLabel = (nsid: string): string =>
	PERMISSION_SET_LABELS[nsid] ?? "Core access";

const FEATURE_GROUP_LABELS: Record<string, string> = {
	emoji: "Custom emoji",
	voice: "Voice channels",
	thread: "Threads",
};

export const permissionSetOf = (
	resource: string,
	sets: PermissionSetResources = PERMISSION_SET_RESOURCES,
): string | undefined =>
	Object.entries(sets).find(([, resources]) =>
		resources.includes(resource),
	)?.[0];

export const isRequestedScopeResource = (
	resource: string,
	sets: PermissionSetResources = PERMISSION_SET_RESOURCES,
): boolean =>
	STANDALONE_RESOURCES.has(resource) ||
	permissionSetOf(resource, sets) !== undefined;

export const scopeFeatureLabel = (
	resource: string,
	sets: PermissionSetResources = PERMISSION_SET_RESOURCES,
): string | undefined => {
	const direct = PERMISSION_SET_LABELS[resource];
	if (direct) return direct;
	const group = resource.startsWith("social.colibri.beta.")
		? resource.split(".")[3]
		: undefined;
	const byGroup = group ? FEATURE_GROUP_LABELS[group] : undefined;
	if (byGroup) return byGroup;
	const set = permissionSetOf(resource, sets);
	return set ? scopeSetLabel(set) : undefined;
};

export const getMissingScopeSets = (
	grantedScope: string | undefined,
	sets: PermissionSetResources = PERMISSION_SET_RESOURCES,
): string[] => {
	if (!grantedScope) return [];
	const grant = parseGrant(grantedScope);
	return [
		...Object.keys(sets).filter((nsid) => !hasPermissionSet(grant, nsid, sets)),
		...WILDCARD_RPC.filter((lxm) => !grantsRpc(grant, lxm, "*")),
		...EMOJI_COLLECTIONS.filter((collection) => !grantsRepo(grant, collection)),
	];
};

export const getMissingScopeMethods = (
	grantedScope: string | undefined,
	sets: PermissionSetResources = PERMISSION_SET_RESOURCES,
): string[] => {
	if (!grantedScope) return [];
	const grant = parseGrant(grantedScope);
	const missing = new Set<string>();
	for (const [nsid, resources] of Object.entries(sets)) {
		if (grant.includes.has(nsid) || !hasPermissionSet(grant, nsid, sets)) {
			continue;
		}
		for (const resource of resources) {
			if (!grantsResource(grant, resource)) missing.add(resource);
		}
	}
	return [...missing];
};

export const getGrantedScopeSets = (
	grantedScope: string | undefined,
): string[] => {
	if (!grantedScope) return [];
	const missing = new Set(getMissingScopeSets(grantedScope));
	return [
		...Object.keys(PERMISSION_SET_RESOURCES),
		...STANDALONE_RESOURCES,
	].filter((nsid) => !missing.has(nsid));
};
