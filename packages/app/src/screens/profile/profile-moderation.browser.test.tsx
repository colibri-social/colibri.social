import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { CommunityView, Did } from "../../data/types";
import { Providers } from "../../providers";
import { ProfileSheetProvider, useProfileSheet } from "./profile-sheet";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

const MODERATION = ["member.kick", "member.ban", "role.manage"];

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();

	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let stop: (() => void) | undefined;

afterEach(() => {
	stop?.();
	stop = undefined;
	document.body.replaceChildren();
});

const button = (name: RegExp) => {
	return Array.from(document.querySelectorAll<HTMLElement>("button")).find(
		(element) => name.test(element.textContent?.trim() ?? ""),
	);
};

const menuItem = (name: RegExp) => {
	return Array.from(
		document.querySelectorAll<HTMLElement>("[role='menuitem']"),
	).find((entry) => name.test(entry.textContent?.trim() ?? ""));
};

const isRegularMember = (community: CommunityView) => {
	const viewer = community.viewer;
	if (!viewer?.isMember || viewer.isOwner) return false;

	return !viewer.permissions?.some((permission) =>
		MODERATION.includes(permission),
	);
};

const mount = async (
	width: number,
	height: number,
	pick: (communities: CommunityView[]) => CommunityView | undefined,
) => {
	setLatency(0);
	await page.viewport(width, height);

	const store = createDataStore(createMockSource({ live: false }));

	await until(() => !!store.communities.value());

	const community = pick(store.communities.value() ?? []);

	if (!community) throw new Error("community missing");

	const space = store.space(community);

	await until(() => !!space.members.value() && !!space.roles.value());

	const target = space.members
		.value()
		?.find(
			(member) =>
				member.actor.did !== store.viewer.did &&
				!space.roles
					.value()
					?.some((role) => role.protected && member.roles.includes(role.rkey)),
		);

	if (!target) throw new Error("no target member");

	let open: ReturnType<typeof useProfileSheet>["open"] = () => {};
	let anchor: HTMLButtonElement | undefined;
	const Capture = () => {
		open = useProfileSheet().open;
		return null;
	};
	const host = document.createElement("div");

	host.style.cssText = `position:fixed;inset:0;width:${width}px;height:${height}px`;
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<ProfileSheetProvider>
						<Capture />
						<button type="button" ref={anchor} style={{ margin: "200px" }}>
							Anchor
						</button>
					</ProfileSheetProvider>
				</Providers>
			</DataContext.Provider>
		),
		host,
	);

	return {
		space,
		target,
		open: () => open(target.actor.did, community.did, { element: anchor }),
	};
};

const hq = (communities: CommunityView[]) => {
	return communities.find((community) => community.did === HQ);
};

describe("profile moderation", () => {
	it("bans a member from the profile popover menu after confirming", async () => {
		const { space, target, open } = await mount(1440, 900, hq);

		open();
		await until(() => !!document.querySelector("[data-profile-menu-trigger]"));
		await userEvent.click(
			document.querySelector<HTMLElement>(
				"[data-profile-menu-trigger]",
			) as HTMLElement,
		);
		await until(() => !!menuItem(/^Ban /));

		expect(menuItem(/^Roles/)).toBeTruthy();

		await userEvent.click(menuItem(/^Ban /) as HTMLElement);
		await until(() => !!button(/^Ban$/));

		expect(document.querySelector("[data-profile-menu-trigger]")).toBeNull();

		button(/^Ban$/)?.click();
		await until(() => !space.memberByDid(target.actor.did as Did));
	});

	it("shows moderation rows in the mobile profile drawer for a moderator", async () => {
		const { open } = await mount(402, 874, hq);

		open();
		await until(() => !!button(/^Ban /));

		expect(button(/^Roles/)).toBeTruthy();
		expect(button(/^Block /)).toBeTruthy();
	});

	it("leaves moderation rows out of the mobile profile drawer for a regular member", async () => {
		const { open } = await mount(402, 874, (communities) =>
			communities.find(isRegularMember),
		);

		open();
		await until(() => !!button(/^Block /));
		await wait(200);

		expect(button(/^Ban /)).toBeUndefined();
		expect(button(/^Kick /)).toBeUndefined();
		expect(button(/^Roles/)).toBeUndefined();
	});
});
