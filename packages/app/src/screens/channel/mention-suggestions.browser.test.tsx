import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { displayNameOf } from "../../data/adapters/display-name";
import type { MemberView, SpaceRef } from "../../data/types";
import { recentSenders } from "./composer/mention-candidates";
import { HQ, main, mainEditor, mount, until, wait } from "./desktop-test-kit";

const memberRows = () => {
	return Array.from(
		main().querySelectorAll<HTMLElement>(
			'[data-suggestions] [data-suggestion-kind="member"]',
		),
	);
};

const suggestionKinds = () => {
	return Array.from(
		main().querySelectorAll<HTMLElement>(
			"[data-suggestions] [data-suggestion-kind]",
		),
	).map((row) => row.getAttribute("data-suggestion-kind"));
};

const loadDev = async () => {
	const { store } = await mount();
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);

	if (!community) throw new Error("community missing");

	const space = store.space(community);
	const dev = space.channelBySlug("dev");

	if (!dev) throw new Error("dev missing");

	const members = new Map<string, MemberView>(
		(space.members.value() ?? []).map((member) => [member.actor.did, member]),
	);

	return { store, members, channel: dev.space as SpaceRef };
};

it("lists the latest senders newest first on a bare @, roles below", async () => {
	const { store, members, channel } = await loadDev();

	const expected = recentSenders(store.channel(channel).messages(), {
		limit: 5,
		include: (did) => did !== store.viewer.did && members.has(did),
	}).map((did) => {
		const member = members.get(did);
		return member ? displayNameOf(member.actor, member) : did;
	});

	expect(expected.length).toBeGreaterThan(1);

	await userEvent.click(mainEditor());
	await userEvent.keyboard("@");
	await until(() => memberRows().length > 0);
	await wait(100);

	const names = memberRows().map((row) => row.textContent ?? "");

	expect(names).toHaveLength(expected.length);
	names.forEach((text, index) => {
		expect(text).toContain(expected[index]);
	});

	const kinds = suggestionKinds();

	expect(kinds.lastIndexOf("member")).toBeLessThan(
		kinds.findIndex((kind) => kind !== "member"),
	);

	await userEvent.keyboard("{Escape}");
});

it("puts a name prefix match first when typing", async () => {
	await loadDev();

	await userEvent.click(mainEditor());
	await userEvent.keyboard("@pri");
	await until(() => memberRows().length > 0);
	await wait(100);

	expect(memberRows()[0]?.textContent).toContain("Priya");

	await userEvent.keyboard("{Escape}");
});
