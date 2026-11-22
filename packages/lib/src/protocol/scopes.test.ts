import permissionAccount from "@colibri-social/lexicons/lexicons/social/colibri/beta/permissionAccount.json";
import permissionCommunity from "@colibri-social/lexicons/lexicons/social/colibri/beta/permissionCommunity.json";
import permissionMessaging from "@colibri-social/lexicons/lexicons/social/colibri/beta/permissionMessaging.json";
import permissionNotification from "@colibri-social/lexicons/lexicons/social/colibri/beta/permissionNotification.json";
import permissionPush from "@colibri-social/lexicons/lexicons/social/colibri/beta/permissionPush.json";
import { describe, expect, it } from "vitest";
import {
	APPVIEW_FRAGMENT,
	DEFAULT_APPVIEW_URL,
	didWebForHost,
	NOTIF_FRAGMENT,
} from "./appview";
import {
	buildScopes,
	EMOJI_COLLECTIONS,
	getMissingScopeMethods,
	getMissingScopeSets,
	isRequestedScopeResource,
	PERMISSION_SET_LABELS,
	PERMISSION_SET_RESOURCES,
	type PermissionSetResources,
	permissionSetOf,
	permissionSetResources,
	scopeFeatureLabel,
	scopeSetLabel,
	scopes,
	WILDCARD_RPC,
} from "./scopes";

const APPVIEW = "did:web:appview.example";

interface PermissionEntry {
	resource: string;
	lxm?: string[];
	accept?: string[];
	collection?: string[];
	spaceType?: string;
}

interface PermissionSetDocument {
	defs: { main: { permissions?: PermissionEntry[] } };
}

const PERMISSION_SET_DOCUMENTS: [string, PermissionSetDocument][] = [
	["social.colibri.beta.permissionAccount", permissionAccount],
	["social.colibri.beta.permissionCommunity", permissionCommunity],
	["social.colibri.beta.permissionMessaging", permissionMessaging],
	["social.colibri.beta.permissionNotification", permissionNotification],
	["social.colibri.beta.permissionPush", permissionPush],
];

describe("buildScopes", () => {
	const built = buildScopes(APPVIEW);

	it("includes the base atproto and blob scopes", () => {
		expect(built).toContain("atproto");
		expect(built).toContain("blob:*/*");
	});

	it("targets the appview service reference for permission sets", () => {
		const includes = built.filter((s) => s.startsWith("include:"));
		expect(includes.length).toBeGreaterThan(0);
		for (const scope of includes) {
			expect(scope).toContain(`aud=${APPVIEW}#colibri_`);
		}
	});

	it("routes push to the notification service, not the appview", () => {
		const push = built.find((s) => s.includes("permissionPush"));
		expect(push).toBe(
			`include:social.colibri.beta.permissionPush?aud=${APPVIEW}#${NOTIF_FRAGMENT}`,
		);
	});

	it("keeps every other permission set on the appview service", () => {
		const appviewSets = built.filter(
			(s) => s.startsWith("include:") && !s.includes("permissionPush"),
		);
		for (const scope of appviewSets) {
			expect(scope.endsWith(`#${APPVIEW_FRAGMENT}`)).toBe(true);
		}
	});

	it("leaves wildcard rpc scopes unbound to a specific appview", () => {
		for (const scope of built.filter((s) => s.startsWith("rpc:"))) {
			expect(scope).toContain("aud=*");
		}
	});

	it("produces no duplicates", () => {
		expect(new Set(built).size).toBe(built.length);
	});

	it("varies only by the appview did", () => {
		const other = buildScopes("did:web:other.example");
		expect(other).toHaveLength(built.length);
		expect(other).not.toEqual(built);
	});

	it("backs the default exported scopes with the default appview", () => {
		expect(scopes).toEqual(
			buildScopes(didWebForHost(new URL(DEFAULT_APPVIEW_URL).host)),
		);
	});
});

describe("scopeSetLabel", () => {
	it("labels a known permission set", () => {
		expect(scopeSetLabel("social.colibri.beta.permissionAccount")).toBe(
			"Account & profile",
		);
	});

	it("falls back for an unknown nsid", () => {
		expect(scopeSetLabel("social.colibri.somethingElse")).toBe("Core access");
	});

	it("has a label for every set it advertises", () => {
		for (const label of Object.values(PERMISSION_SET_LABELS)) {
			expect(label.length).toBeGreaterThan(0);
		}
	});
});

describe("getMissingScopeSets", () => {
	it("reports nothing when no scope was granted at all", () => {
		expect(getMissingScopeSets(undefined)).toEqual([]);
		expect(getMissingScopeSets("")).toEqual([]);
	});

	it("reports every set as missing for an unrelated grant", () => {
		const missing = getMissingScopeSets("atproto");
		expect(missing).toContain("social.colibri.beta.permissionAccount");
		expect(missing).toContain("social.colibri.beta.permissionPush");
		expect(missing).toContain("social.colibri.beta.voice.subscribeSignals");
	});

	it("drops a set once its marker appears in the grant", () => {
		const missing = getMissingScopeSets(
			"atproto include:social.colibri.beta.permissionAccount?aud=did:web:x#colibri_appview",
		);
		expect(missing).not.toContain("social.colibri.beta.permissionAccount");
		expect(missing).toContain("social.colibri.beta.permissionCommunity");
	});

	it("treats a pre-spaces grant as stale", () => {
		const missing = getMissingScopeSets(
			"atproto include:social.colibri.permissionAccount?aud=did:web:x#colibri_appview",
		);
		expect(missing).toContain("social.colibri.beta.permissionAccount");
	});

	it("reports nothing missing for a full grant", () => {
		const full = buildScopes(APPVIEW).join(" ");
		expect(getMissingScopeSets(full)).toEqual([]);
	});

	it("reports the badge-linking scopes as missing for a session granted before them", () => {
		const missing = getMissingScopeSets(
			"atproto rpc:social.colibri.beta.voice.moderate?aud=*",
		);
		expect(missing).toContain("social.colibri.labeler.linkExternalAccount");
		expect(missing).toContain("social.colibri.labeler.unlinkExternalAccount");
	});

	it("does not confuse the two badge-linking scopes", () => {
		const missing = getMissingScopeSets(
			"rpc:social.colibri.labeler.linkExternalAccount?aud=*",
		);
		expect(missing).not.toContain("social.colibri.labeler.linkExternalAccount");
		expect(missing).toContain("social.colibri.labeler.unlinkExternalAccount");
	});

	it("reports the emoji collections as missing for a session granted before them", () => {
		const granted = buildScopes(APPVIEW)
			.filter((scope) => !scope.startsWith("repo:blue.moji."))
			.join(" ");
		expect(getMissingScopeSets(granted)).toEqual([...EMOJI_COLLECTIONS]);
	});

	it("asks for write access to every emoji collection", () => {
		for (const collection of EMOJI_COLLECTIONS) {
			expect(buildScopes(APPVIEW)).toContain(`repo:${collection}`);
		}
		expect(scopeSetLabel(EMOJI_COLLECTIONS[0])).toBe("Custom emoji");
	});

	it("does not confuse the two voice scopes", () => {
		const missing = getMissingScopeSets(
			"rpc:social.colibri.beta.voice.subscribeSignals?aud=*",
		);
		expect(missing).not.toContain("social.colibri.beta.voice.subscribeSignals");
		expect(missing).toContain("social.colibri.beta.voice.moderate");
	});
});

describe("getMissingScopeSets against an expanded grant", () => {
	const expandPermissionSet = (set: PermissionSetDocument): string[] => {
		const entries = set.defs.main.permissions ?? [];
		return entries.flatMap((entry) => {
			if (entry.resource === "rpc") {
				return (entry.lxm ?? []).map((lxm) => `rpc:${lxm}?aud=${APPVIEW}`);
			}
			if (entry.resource === "blob") {
				return (entry.accept ?? []).map((accept) => `blob:${accept}`);
			}
			return [
				...(entry.collection ?? []).map(
					(collection) => `repo:${collection}?action=create`,
				),
				...(entry.spaceType ? [`space:${entry.spaceType}?action=read`] : []),
			];
		});
	};

	const expandedGrant = [
		"atproto",
		"blob:*/*",
		...WILDCARD_RPC.map((lxm) => `rpc:${lxm}?aud=*`),
		...EMOJI_COLLECTIONS.map((collection) => `repo:${collection}`),
		...PERMISSION_SET_DOCUMENTS.flatMap(([, doc]) => expandPermissionSet(doc)),
	].join(" ");

	it("reports nothing missing once every include has been expanded", () => {
		expect(getMissingScopeSets(expandedGrant)).toEqual([]);
	});

	it("reports only the dropped set when one include is left out", () => {
		for (const [nsid] of PERMISSION_SET_DOCUMENTS) {
			const withoutOne = [
				"atproto",
				"blob:*/*",
				...WILDCARD_RPC.map((lxm) => `rpc:${lxm}?aud=*`),
				...EMOJI_COLLECTIONS.map((collection) => `repo:${collection}`),
				...PERMISSION_SET_DOCUMENTS.filter(([other]) => other !== nsid).flatMap(
					([, doc]) => expandPermissionSet(doc),
				),
			].join(" ");
			expect(getMissingScopeSets(withoutOne)).toEqual([nsid]);
		}
	});
});

const COMMUNITY = "social.colibri.beta.permissionCommunity";
const ACCOUNT = "social.colibri.beta.permissionAccount";
const GET_EMOJIS = "social.colibri.beta.emoji.getEmojis";
const ADDED_LATER = "social.colibri.beta.emoji.listRecent";

const referenceExpansion = (nsid: string, aud: string): string[] => {
	const doc = PERMISSION_SET_DOCUMENTS.find(([id]) => id === nsid)?.[1];
	const audience = aud.replace("#", "%23");
	return (doc?.defs.main.permissions ?? []).flatMap((entry) => {
		if (entry.resource === "rpc") {
			const lxm = entry.lxm ?? [];
			if (lxm.length === 1) return [`rpc:${lxm[0]}?aud=${audience}`];
			return [`rpc?${lxm.map((m) => `lxm=${m}`).join("&")}&aud=${audience}`];
		}
		if (entry.resource === "repo") {
			const collections = entry.collection ?? [];
			if (collections.length === 1) return [`repo:${collections[0]}`];
			return [`repo?${collections.map((c) => `collection=${c}`).join("&")}`];
		}
		return [];
	});
};

const standaloneGrant = [
	"atproto",
	"blob:*/*",
	...WILDCARD_RPC.map((lxm) => `rpc:${lxm}?aud=*`),
	...EMOJI_COLLECTIONS.map((collection) => `repo:${collection}`),
];

const referenceGrant = (sets: readonly string[]) =>
	[
		...standaloneGrant,
		...sets.flatMap((nsid) =>
			referenceExpansion(nsid, `${APPVIEW}#colibri_appview`),
		),
	].join(" ");

const ALL_SETS = Object.keys(PERMISSION_SET_RESOURCES);

describe("PERMISSION_SET_RESOURCES", () => {
	it("lists every rpc method and repo collection of each bundled set", () => {
		for (const [nsid, doc] of PERMISSION_SET_DOCUMENTS) {
			const expected = new Set(
				(doc.defs.main.permissions ?? []).flatMap((entry) => [
					...(entry.resource === "rpc" ? (entry.lxm ?? []) : []),
					...(entry.resource === "repo" ? (entry.collection ?? []) : []),
				]),
			);
			expect(new Set(PERMISSION_SET_RESOURCES[nsid])).toEqual(expected);
		}
	});

	it("skips wildcards and resources that are neither rpc nor repo", () => {
		expect(
			permissionSetResources({
				permissions: [
					{ resource: "rpc", options: { lxm: ["*", "a.b.c"] } },
					{ resource: "blob", options: { accept: ["image/*"] } },
					{ resource: "space", options: { spaceType: "a.b.space" } },
					{ resource: "repo", options: { collection: ["a.b.record"] } },
				],
			}),
		).toEqual(["a.b.c", "a.b.record"]);
	});
});

describe("getMissingScopeMethods", () => {
	it("reports nothing for a reference-expanded grant of every set", () => {
		const grant = referenceGrant(ALL_SETS);
		expect(getMissingScopeSets(grant)).toEqual([]);
		expect(getMissingScopeMethods(grant)).toEqual([]);
	});

	it("bundles the batched emoji lookup in the community set", () => {
		expect(PERMISSION_SET_RESOURCES[COMMUNITY]).toContain(GET_EMOJIS);
	});

	it("reports a method added to an approved set after the grant", () => {
		const grant = referenceGrant(ALL_SETS);
		const grown: PermissionSetResources = {
			...PERMISSION_SET_RESOURCES,
			[COMMUNITY]: [
				...(PERMISSION_SET_RESOURCES[COMMUNITY] ?? []),
				ADDED_LATER,
			],
		};
		expect(getMissingScopeSets(grant, grown)).toEqual([]);
		expect(getMissingScopeMethods(grant, grown)).toEqual([ADDED_LATER]);
	});

	it("matches whole method names, never prefixes", () => {
		const sets: PermissionSetResources = {
			[COMMUNITY]: [
				"social.colibri.beta.emoji.getEmoji",
				"social.colibri.beta.emoji.getEmojis",
			],
		};
		const grant = `rpc:social.colibri.beta.emoji.getEmojis?aud=${APPVIEW}`;
		expect(getMissingScopeMethods(grant, sets)).toEqual([
			"social.colibri.beta.emoji.getEmoji",
		]);
	});

	it("reads one method per rpc scope as well as grouped lxm params", () => {
		const sets: PermissionSetResources = {
			[COMMUNITY]: ["a.b.one", "a.b.two", "a.b.three"],
		};
		const grant = `rpc:a.b.one?aud=${APPVIEW} rpc?lxm=a.b.two&lxm=a.b.three&aud=${APPVIEW}`;
		expect(getMissingScopeMethods(grant, sets)).toEqual([]);
	});

	it("checks repo collections from a set", () => {
		const sets: PermissionSetResources = {
			[ACCOUNT]: ["a.b.getProfile", "a.b.profile", "a.b.settings"],
		};
		const grant =
			"rpc:a.b.getProfile?aud=did:web:x repo?collection=a.b.profile&action=create";
		expect(getMissingScopeMethods(grant, sets)).toEqual(["a.b.settings"]);
	});

	it("treats an rpc wildcard as covering every method", () => {
		const sets: PermissionSetResources = {
			[COMMUNITY]: ["a.b.one", "a.b.two"],
		};
		expect(getMissingScopeMethods(`rpc:*?aud=${APPVIEW}`, sets)).toEqual([]);
	});

	it("trusts an unexpanded include for its whole set", () => {
		const full = buildScopes(APPVIEW).join(" ");
		const grown: PermissionSetResources = {
			...PERMISSION_SET_RESOURCES,
			[COMMUNITY]: [
				...(PERMISSION_SET_RESOURCES[COMMUNITY] ?? []),
				ADDED_LATER,
			],
		};
		expect(getMissingScopeMethods(full, grown)).toEqual([]);
	});

	it("leaves a set missing entirely to the set-level check", () => {
		const grant = referenceGrant(ALL_SETS.filter((nsid) => nsid !== COMMUNITY));
		expect(getMissingScopeSets(grant)).toEqual([COMMUNITY]);
		expect(getMissingScopeMethods(grant)).toEqual([]);
	});

	it("does not count a method shared with a standalone scope as the set", () => {
		const grant = referenceGrant(ALL_SETS.filter((nsid) => nsid !== COMMUNITY));
		expect(grant).toContain("rpc:social.colibri.beta.voice.moderate?aud=*");
		expect(getMissingScopeSets(grant)).toContain(COMMUNITY);
	});

	it("reports nothing without a grant", () => {
		expect(getMissingScopeMethods(undefined)).toEqual([]);
		expect(getMissingScopeMethods("")).toEqual([]);
	});
});

describe("scope resource lookups", () => {
	it("finds the set a method belongs to", () => {
		expect(permissionSetOf("social.colibri.beta.community.create")).toBe(
			COMMUNITY,
		);
		expect(permissionSetOf("com.atproto.repo.createRecord")).toBeUndefined();
	});

	it("knows which resources Colibri asks for", () => {
		expect(
			isRequestedScopeResource("social.colibri.beta.community.create"),
		).toBe(true);
		expect(isRequestedScopeResource(EMOJI_COLLECTIONS[0])).toBe(true);
		expect(isRequestedScopeResource("com.atproto.repo.createRecord")).toBe(
			false,
		);
	});

	it("names the feature a method belongs to", () => {
		expect(scopeFeatureLabel(GET_EMOJIS)).toBe("Custom emoji");
		expect(
			scopeFeatureLabel("social.colibri.beta.voice.subscribeSignals"),
		).toBe("Voice channels");
		expect(scopeFeatureLabel("social.colibri.beta.community.create")).toBe(
			"Communities & channels",
		);
		expect(scopeFeatureLabel("com.atproto.repo.createRecord")).toBeUndefined();
	});
});
