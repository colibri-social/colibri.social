import type { InviteSummary } from "./invite-links";

export const FIXED_NOW = new Date("2026-10-09T12:00:00Z");

const hours = (count: number) =>
	new Date(FIXED_NOW.getTime() + count * 60 * 60 * 1000).toISOString();

const handles = [
	"timtinkers.online",
	"entropic.software",
	"birdwatcher.bsky.social",
	"a-very-long-handle-for-testing-truncation.example.com",
];

const invite = (
	code: string,
	index: number,
	rest: Partial<InviteSummary> = {},
): InviteSummary => ({
	code,
	url: `https://colibri.social/invite/${code}`,
	creator: { handle: handles[index % handles.length] },
	uses: 0,
	...rest,
});

export const inviteFixtures: InviteSummary[] = [
	invite("kjAnf91jad92Q", 0, { uses: 69 }),
	invite("pQ7mZr2xLw4aB", 1, { uses: 12, maxUses: 25, expiresAt: hours(150) }),
	invite("expiredLink01", 2, { uses: 3, maxUses: 10, expiresAt: hours(-50) }),
	invite("usedUpLink777", 3, { uses: 5, maxUses: 5, expiresAt: hours(30) }),
	invite("h4Rt8sKq2pWm1", 0, { uses: 1, maxUses: 1, expiresAt: hours(-2) }),
	invite("zz9Ty6Lmn3Qa0", 1, { uses: 0, expiresAt: hours(0.5) }),
	invite("Mx2Kp8Vb7Nc4r", 2, { uses: 48, maxUses: 100, expiresAt: hours(5) }),
	invite("Ab3Cd4Ef5Gh6i", 3, { uses: 7 }),
	invite("Jk7Lm8Np9Qr0s", 0, { uses: 2, maxUses: 50, expiresAt: hours(20) }),
	invite("Tu1Vw2Xy3Za4b", 1, { uses: 19, maxUses: 25, expiresAt: hours(100) }),
	invite("Cd5Ef6Gh7Ij8k", 2, { uses: 0, maxUses: 10, expiresAt: hours(160) }),
	invite("Lm9No0Pq1Rs2t", 3, { uses: 33 }),
];
