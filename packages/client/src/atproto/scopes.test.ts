import { describe, expect, it } from "vitest";
import {
	buildScopes,
	getMissingScopeSets,
	PERMISSION_SET_LABELS,
	scopeSetLabel,
	scopes,
} from "./scopes";

const APPVIEW = "did:web:appview.example";

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
			`include:social.colibri.permissionPush?aud=${APPVIEW}#colibri_notif`,
		);
	});

	it("keeps every other permission set on the appview service", () => {
		const appviewSets = built.filter(
			(s) => s.startsWith("include:") && !s.includes("permissionPush"),
		);
		for (const scope of appviewSets) {
			expect(scope.endsWith("#colibri_appview")).toBe(true);
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

	it("backs the default exported scopes", () => {
		expect(scopes).toEqual(buildScopes("did:web:api.colibri.social"));
	});
});

describe("scopeSetLabel", () => {
	it("labels a known permission set", () => {
		expect(scopeSetLabel("social.colibri.permissionAccount")).toBe(
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
		expect(missing).toContain("social.colibri.permissionAccount");
		expect(missing).toContain("social.colibri.permissionPush");
		expect(missing).toContain("social.colibri.voice.signal");
	});

	it("drops a set once its marker appears in the grant", () => {
		const missing = getMissingScopeSets(
			"atproto social.colibri.actor.deleteAccount",
		);
		expect(missing).not.toContain("social.colibri.permissionAccount");
		expect(missing).toContain("social.colibri.permissionCommunity");
	});

	it("treats a pre-deletion account grant as stale", () => {
		const missing = getMissingScopeSets("atproto social.colibri.actor.getData");
		expect(missing).toContain("social.colibri.permissionAccount");
	});

	it("reports nothing missing for a full grant", () => {
		const full = [
			"social.colibri.actor.deleteAccount",
			"social.colibri.community.getData",
			"social.colibri.membership",
			"social.colibri.notification.listNotifications",
			"social.colibri.notification.registerPush",
			"social.colibri.voice.signal?aud=*",
			"social.colibri.voice.moderate?aud=*",
			"social.colibri.labeler.linkExternalAccount?aud=*",
			"social.colibri.labeler.unlinkExternalAccount?aud=*",
		].join(" ");

		expect(getMissingScopeSets(full)).toEqual([]);
	});

	it("reports the badge-linking scopes as missing for a session granted before them", () => {
		const missing = getMissingScopeSets(
			"atproto social.colibri.voice.signal?aud=*",
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
		const missing = getMissingScopeSets("social.colibri.voice.signal?aud=*");
		expect(missing).not.toContain("social.colibri.voice.signal");
		expect(missing).toContain("social.colibri.voice.moderate");
	});
});
