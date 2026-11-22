import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { skeyOf } from "../../data/ids";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { Did, SpaceRef } from "../../data/types";
import { setVoiceSoundPlayer, voice } from "../../data/voice";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const STRANGER = "did:plc:notamemberyet00000000000" as Did;

const until = async (check: () => boolean, timeout = 4000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 30));
	}
};

let dispose: (() => void) | undefined;

afterEach(() => {
	voice.leave();
	dispose?.();
	dispose = undefined;
	document.body.innerHTML = "";
});

const mount = () => {
	setLatency(0);
	setVoiceSoundPlayer(() => {});
	history.replaceState(null, "", `/app/c/${HQ}`);
	const source = createMockSource({ live: false });
	const store = createDataStore(source);
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
	const hq = source.world.spaces.find((space) => space.seed.key === "hq");
	const lounge = hq?.channels.find(
		(channel) => skeyOf(channel.view.space) === "lounge",
	)?.view.space as SpaceRef;
	return { source, store, lounge };
};

const loungeRow = () =>
	Array.from(document.querySelectorAll<HTMLElement>("[data-voice-row]")).find(
		(row) => row.querySelector("[data-channel-name]")?.textContent === "Lounge",
	);

const people = () =>
	Array.from(
		loungeRow()?.querySelectorAll<HTMLElement>("[data-voice-participant]") ??
			[],
	);

it("shows a skeleton for a participant whose profile is not loaded", async () => {
	const { source, lounge } = mount();
	await until(() => people().length === 3);
	source.emit({
		$type: "presenceEvent",
		did: STRANGER,
		presence: { onlineState: "online", voice: { channel: lounge } },
	});
	await until(() => people().length === 4);
	const pending = people().filter((row) => row.hasAttribute("data-pending"));
	expect(pending).toHaveLength(1);
	expect(
		pending[0]?.querySelector("[data-voice-participant-skeleton]"),
	).not.toBeNull();
	expect(loungeRow()?.textContent).not.toContain(STRANGER);
});

it("opens the profile drawer when tapping a participant", async () => {
	mount();
	await until(() => people().length === 3);
	const button = people()[0]?.querySelector<HTMLButtonElement>("button");
	expect(button).toBeTruthy();
	const name = button?.textContent?.trim() ?? "";
	button?.click();
	await until(() =>
		Array.from(document.querySelectorAll('[role="dialog"]')).some((dialog) =>
			dialog.textContent?.includes(name.split(",")[0] ?? name),
		),
	);
});

it("keeps participant images mounted while speaking changes", async () => {
	const { source, store, lounge } = mount();
	await until(() => people().length === 3);
	voice.join({ space: HQ, channel: lounge });
	voice.collapse();
	await until(() => people().length === 4);
	const [first] = store
		.inVoice(lounge)
		.filter((did) => did !== store.viewer.did);
	const imagesBefore = people().map((element) => element.querySelector("img"));
	expect(imagesBefore.every(Boolean)).toBe(true);
	source.emit({
		$type: "voiceActivityEvent",
		did: first as Did,
		speaking: true,
	});
	await until(() =>
		people().some((element) => element.hasAttribute("data-speaking")),
	);
	const imagesAfter = people().map((element) => element.querySelector("img"));
	expect(imagesAfter).toEqual(imagesBefore);
});
