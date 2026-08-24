import { describe, expect, it } from "vitest";
import {
	createSubscriptionLedger,
	isEmptyDelta,
	mergeDelta,
} from "./subscriptions";

const A = "did:plc:a";
const B = "did:plc:b";
const CH = "at://did:plc:a/space/social.colibri.beta.channel.text/general";

describe("createSubscriptionLedger", () => {
	it("reports only newly wanted keys on retain", () => {
		const ledger = createSubscriptionLedger();

		expect(ledger.retain({ communities: [A], channels: [CH] })).toEqual({
			communities: [A],
			channels: [CH],
		});
		expect(ledger.retain({ communities: [A, B] })).toEqual({
			communities: [B],
			channels: [],
		});
	});

	it("keeps a key while another caller still wants it", () => {
		const ledger = createSubscriptionLedger();

		ledger.retain({ communities: [A] });
		ledger.retain({ communities: [A] });

		expect(ledger.release({ communities: [A] })).toEqual({
			communities: [],
			channels: [],
		});
		expect(ledger.wanted().communities.has(A)).toBe(true);

		expect(ledger.release({ communities: [A] })).toEqual({
			communities: [A],
			channels: [],
		});
		expect(ledger.wanted().communities.has(A)).toBe(false);
	});

	it("ignores a release for something never retained", () => {
		const ledger = createSubscriptionLedger();

		expect(ledger.release({ communities: [A] })).toEqual({
			communities: [],
			channels: [],
		});
		expect(ledger.wanted().communities.size).toBe(0);
	});

	it("tracks communities and channels independently", () => {
		const ledger = createSubscriptionLedger();

		ledger.retain({ communities: [A] });
		ledger.retain({ channels: [CH] });

		expect(ledger.release({ communities: [A] })).toEqual({
			communities: [A],
			channels: [],
		});
		expect(ledger.wanted()).toEqual({
			communities: new Set(),
			channels: new Set([CH]),
		});
	});

	it("treats a duplicate inside one retain as one caller per occurrence", () => {
		const ledger = createSubscriptionLedger();

		expect(ledger.retain({ communities: [A, A] })).toEqual({
			communities: [A],
			channels: [],
		});
		expect(ledger.release({ communities: [A] })).toEqual({
			communities: [],
			channels: [],
		});
		expect(ledger.release({ communities: [A] })).toEqual({
			communities: [A],
			channels: [],
		});
	});

	it("reports what was asked for and not granted", () => {
		const ledger = createSubscriptionLedger();
		ledger.retain({ communities: [A, B], channels: [CH] });

		expect(
			ledger.missing({ communities: new Set([A]), channels: new Set() }),
		).toEqual({ communities: new Set([B]), channels: new Set([CH]) });

		expect(
			ledger.missing({
				communities: new Set([A, B]),
				channels: new Set([CH]),
			}),
		).toEqual({ communities: new Set(), channels: new Set() });
	});

	it("ignores grants for things nobody asked for", () => {
		const ledger = createSubscriptionLedger();
		ledger.retain({ communities: [A] });

		expect(
			ledger.missing({ communities: new Set([A, B]), channels: new Set() }),
		).toEqual({ communities: new Set(), channels: new Set() });
	});
});

describe("mergeDelta and isEmptyDelta", () => {
	it("concatenates both halves", () => {
		expect(
			mergeDelta(
				{ communities: [A], channels: [] },
				{ communities: [B], channels: [CH] },
			),
		).toEqual({ communities: [A, B], channels: [CH] });
	});

	it("starts from nothing", () => {
		expect(mergeDelta(null, { communities: [A], channels: [] })).toEqual({
			communities: [A],
			channels: [],
		});
	});

	it("recognises an empty delta", () => {
		expect(isEmptyDelta({ communities: [], channels: [] })).toBe(true);
		expect(isEmptyDelta({ communities: [A], channels: [] })).toBe(false);
		expect(isEmptyDelta({ communities: [], channels: [CH] })).toBe(false);
	});
});
