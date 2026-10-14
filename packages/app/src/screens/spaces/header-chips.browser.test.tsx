import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	document.body.replaceChildren();
});

it("shows the member count and owner chips in the mobile Space header", async () => {
	setLatency(0);
	await page.viewport(402, 874);
	history.replaceState(null, "", `/app/c/${HQ}`);
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await expect.poll(() => !!store.spaceByKey(HQ)).toBe(true);
	const community = store.spaceByKey(HQ);
	if (!community) throw new Error("no HQ");
	const space = store.space(community);
	await expect
		.poll(() => space.members.value()?.length ?? 0)
		.toBeGreaterThan(0);
	const ownerRole = space.roles.value()?.find((role) => role.protected);
	const owner = space.members
		.value()
		?.find((member) => member.roles.includes(ownerRole?.rkey ?? ""));
	await expect
		.poll(
			() =>
				document
					.querySelector(
						'[data-channel-list-header][data-platform="mobile"] [data-space-chips] [data-owner-chip]',
					)
					?.textContent?.trim() ?? "",
		)
		.toBe(`Owner @${owner?.actor.handle}`);
	const chips = document.querySelector("[data-space-chips]") as HTMLElement;
	const [members, ownerChip] = Array.from(chips.children) as HTMLElement[];
	if (!members || !ownerChip) throw new Error("chips missing");
	expect(members.textContent?.trim()).toMatch(/members?$/);
	const first = members.getBoundingClientRect();
	const second = ownerChip.getBoundingClientRect();
	const sameRow = Math.round(second.top) === Math.round(first.top);
	const nextRow =
		Math.round(second.top - first.bottom) ===
		Math.round(Number.parseFloat(getComputedStyle(chips).rowGap));
	expect(sameRow || nextRow).toBe(true);
	expect(second.right).toBeLessThanOrEqual(
		chips.getBoundingClientRect().right + 0.5,
	);
});
