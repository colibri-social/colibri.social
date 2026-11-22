import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, it } from "vitest";
import { page } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { MemberView } from "../../data/types";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const DEV_PATH = `/app/c/${HQ}/social.colibri.beta.channel.text/dev`;

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	document.body.replaceChildren();
});

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const sidebar = () =>
	document.querySelector<HTMLElement>("[data-members-desktop]");

const rowNamed = (name: string) =>
	Array.from(sidebar()?.querySelectorAll("[data-member-row]") ?? []).find(
		(row) => row.querySelector("[data-member-name]")?.textContent === name,
	);

const mount = async (
	prepare: (source: ReturnType<typeof createMockSource>) => void,
) => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", DEV_PATH);
	const source = createMockSource({ live: false });
	prepare(source);
	const store = createDataStore(source);
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<DesktopShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await until(
		() => (sidebar()?.querySelectorAll("[data-member-row]").length ?? 0) > 0,
	);
	return { source, store };
};

const pngUrl = async () => {
	const canvas = document.createElement("canvas");
	canvas.width = 8;
	canvas.height = 8;
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/png"),
	);
	if (!blob) throw new Error("no image");
	return URL.createObjectURL(blob);
};

const withAvatar = (
	source: ReturnType<typeof createMockSource>,
	avatar: string,
) => {
	const original = source.listMembers;
	source.listMembers = async (community, paging) => {
		const page = await original(community, paging);
		return {
			...page,
			items: page.items.map(
				(member) =>
					({ ...member, actor: { ...member.actor, avatar } }) as MemberView,
			),
		};
	};
};

const avatarShown = (name: string) => {
	const image = rowNamed(name)?.querySelector("[data-avatar-image]");
	return !!image && !image.className.includes("opacity-0");
};

it("shows a member's new avatar after their previous one failed to load", async () => {
	const broken = await pngUrl();
	URL.revokeObjectURL(broken);
	const { source, store } = await mount((source) => withAvatar(source, broken));
	const space = store.space(
		store.communities.value()?.find((entry) => entry.did === HQ) as never,
	);
	const member = space.members
		.value()
		?.find((entry) => entry.actor.handle === "mira.bsky.social");
	if (!member?.actor.displayName) throw new Error("no member");
	const name = member.actor.displayName;
	await until(() => !!rowNamed(name)?.querySelector("[data-default-avatar]"));
	const working = await pngUrl();
	source.emit({
		$type: "memberUpdateEvent",
		community: HQ as never,
		member: { ...member, actor: { ...member.actor, avatar: working as never } },
	});
	await until(() => avatarShown(name), 3000);
});

it("tries a failed avatar again", async () => {
	const broken = await pngUrl();
	URL.revokeObjectURL(broken);
	await mount((source) => withAvatar(source, broken));
	const row = sidebar()?.querySelector("[data-member-row]");
	if (!row) throw new Error("no row");
	await until(() => !!row.querySelector("[data-default-avatar]"));
	let retried = false;
	const observer = new MutationObserver((records) => {
		for (const record of records)
			for (const node of record.addedNodes)
				if (
					node instanceof Element &&
					node.querySelector(`img[src="${broken}"]`)
				)
					retried = true;
	});
	observer.observe(row, { childList: true, subtree: true });
	await until(() => retried, 5000);
	observer.disconnect();
});
