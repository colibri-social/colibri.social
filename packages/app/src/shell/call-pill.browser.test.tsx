import "../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { skeyOf } from "../data/ids";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext } from "../data/store";
import type { Did, SpaceRef } from "../data/types";
import { voice } from "../data/voice";
import { Providers } from "../providers";
import { MobileShell } from "./MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

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

const participantNames = () =>
	Array.from(
		loungeRow()?.querySelectorAll<HTMLElement>("[data-voice-participant]") ??
			[],
	).map((row) => row.textContent ?? "");

it("shows seeded voice participants and updates the row live", async () => {
	const { source, store, lounge } = mount();
	await until(() => participantNames().length === 3);
	const [first] = store.inVoice(lounge);
	expect(first).toBeDefined();
	const did = first as Did;
	const presence = source.world.people.presenceOf(did);
	source.emit({
		$type: "presenceEvent",
		did,
		presence: {
			onlineState: "online",
			...presence,
			voice: { channel: lounge, deafened: true },
		},
	});
	await until(
		() =>
			!!loungeRow()?.querySelector(
				'[data-voice-participant] [aria-label="Deafened"]',
			),
	);
	source.emit({ $type: "voiceActivityEvent", did, speaking: true });
	await new Promise((resolve) => setTimeout(resolve, 50));
	expect(loungeRow()?.querySelector("[data-speaking]")).toBeNull();
	voice.join({ space: HQ, channel: lounge });
	await until(
		() =>
			!!loungeRow()?.querySelector("[data-voice-participant][data-speaking]"),
	);
	voice.leave();
	source.emit({
		$type: "presenceEvent",
		did,
		presence: { onlineState: "online" },
	});
	await until(() => participantNames().length === 2);
	expect(loungeRow()?.querySelector("[data-speaking]")).toBeNull();
});

it("marks the joined row and lists the viewer", async () => {
	const { lounge } = mount();
	await until(() => participantNames().length === 3);
	voice.join({ space: HQ, channel: lounge });
	await until(() => participantNames().length === 4);
	expect(loungeRow()?.dataset.joined).toBe("true");
	voice.leave();
	await until(() => participantNames().length === 3);
	expect(loungeRow()?.dataset.joined).toBeUndefined();
});

it("shows the call pill while the call screen is collapsed and reopens it", async () => {
	const { lounge } = mount();
	await until(() => !!loungeRow());
	voice.join({ space: HQ, channel: lounge });
	expect(document.querySelector("[data-call-pill]")).toBeNull();
	voice.collapse();
	await until(() => !!document.querySelector("[data-call-pill]"));
	const compact = document.querySelector<HTMLElement>(
		"[data-call-pill] button",
	);
	await userEvent.click(compact as HTMLElement);
	await until(
		() => !!document.querySelector("[data-call-pill][data-expanded]"),
	);
	const open = Array.from(
		document.querySelectorAll<HTMLElement>("[data-call-pill] button"),
	).find((button) => button.textContent?.trim() === "Open call");
	await userEvent.click(open as HTMLElement);
	expect(voice.expanded()).toBe(true);
	await until(() => !document.querySelector("[data-call-pill]"));
});
