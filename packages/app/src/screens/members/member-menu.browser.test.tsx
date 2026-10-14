import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { Did } from "../../data/types";
import { ProfileSheetProvider } from "../profile/profile-sheet";
import { MemberMenuProvider, useMemberMenu } from "./member-menu";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stop: (() => void) | undefined;
afterEach(() => {
	stop?.();
	document.body.innerHTML = "";
});

const setup = async () => {
	setLatency(0);
	const store = createDataStore(createMockSource({ live: false }));
	await until(() => !!store.communities.value());
	const hq = store.communities
		.value()
		?.find((entry) => entry.handle.startsWith("hq."));
	if (!hq) throw new Error("hq missing");
	const space = store.space(hq);
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
	let open: (did: string, space: string) => void = () => {};
	const Capture = () => {
		open = useMemberMenu().open;
		return null;
	};
	const host = document.createElement("div");
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<ProfileSheetProvider>
					<MemberMenuProvider>
						<Capture />
					</MemberMenuProvider>
				</ProfileSheetProvider>
			</DataContext.Provider>
		),
		host,
	);
	return { store, space, target, open: () => open(target.actor.did, hq.did) };
};

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const button = (name: RegExp) =>
	Array.from(document.querySelectorAll<HTMLElement>("button")).find((element) =>
		name.test(element.textContent?.trim() ?? ""),
	);

describe("member menu", () => {
	it("opens for a member and bans them after confirming", async () => {
		const { space, target, open } = await setup();
		open();
		await until(() => !!button(/^Ban /));
		expect(button(/Roles/)).toBeDefined();
		button(/^Ban /)?.click();
		await until(() => !!button(/^Ban$/));
		button(/^Ban$/)?.click();
		await until(() => !space.memberByDid(target.actor.did as Did));
		await until(() => !dialog());
	});

	it("updates roles in place", async () => {
		const { space, target, open } = await setup();
		const before = [...target.roles];
		open();
		await until(() => !!button(/Roles/));
		button(/Roles/)?.click();
		await until(
			() =>
				document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')
					.length > 0,
		);
		const toggle = document.querySelector<HTMLElement>(
			'[role="checkbox"]:not([aria-disabled="true"]), input[type="checkbox"]:not(:disabled)',
		);
		toggle?.click();
		await until(
			() =>
				JSON.stringify(space.memberByDid(target.actor.did as Did)?.roles) !==
				JSON.stringify(before),
		);
	});
});
