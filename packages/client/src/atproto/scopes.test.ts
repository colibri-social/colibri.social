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
} from "../utils/appview";
import {
	buildScopes,
	getMissingScopeSets,
	PERMISSION_SET_LABELS,
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
			"social.colibri.labeler.linkExternalAccount?aud=*",
		);
		expect(missing).not.toContain("social.colibri.labeler.linkExternalAccount");
		expect(missing).toContain("social.colibri.labeler.unlinkExternalAccount");
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
				...PERMISSION_SET_DOCUMENTS.filter(([other]) => other !== nsid).flatMap(
					([, doc]) => expandPermissionSet(doc),
				),
			].join(" ");
			expect(getMissingScopeSets(withoutOne)).toEqual([nsid]);
		}
	});
});
