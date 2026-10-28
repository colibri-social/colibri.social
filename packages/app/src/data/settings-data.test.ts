import type { LogEntry, ReleaseNote } from "@colibri-social/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountSection, formatDiagnostics, logSection } from "./debug-info";
import { DEVICE_KEYS } from "./device-prefs";
import {
	type ExperimentDefinition,
	experimentViews,
	isExperimentOn,
	setExperiment,
} from "./experiments";
import { formatLogs, toLogLine } from "./log-buffer";
import {
	levelOf,
	microphoneConstraints,
	openMicrophone,
	toDeviceLists,
} from "./media-devices";
import {
	formatReleaseDate,
	releaseNotesFor,
	sniffReleasePlatform,
} from "./release-notes";
import { fetchSupporterAccount, parseAttestation } from "./supporter-link";
import {
	createVoiceSettings,
	DEFAULT_VOICE_SETTINGS,
	isVoiceSettings,
} from "./voice-settings";

const storage = new Map<string, string>();

beforeEach(() => {
	storage.clear();
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
		removeItem: (key: string) => storage.delete(key),
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("voice settings", () => {
	it("starts from defaults and keeps changes on the device", () => {
		const first = createVoiceSettings();
		expect(first.settings()).toEqual(DEFAULT_VOICE_SETTINGS);
		first.update({ microphone: "mic-2", inputVolume: 150 });
		const second = createVoiceSettings();
		expect(second.settings()).toMatchObject({
			microphone: "mic-2",
			inputVolume: 150,
			noiseSuppression: true,
		});
		expect(JSON.parse(storage.get(DEVICE_KEYS.voiceSettings) ?? "{}")).toEqual(
			second.settings(),
		);
	});

	it("ignores stored values it cannot use", () => {
		storage.set(
			DEVICE_KEYS.voiceSettings,
			JSON.stringify({ ...DEFAULT_VOICE_SETTINGS, inputVolume: 900 }),
		);
		expect(createVoiceSettings().settings()).toEqual(DEFAULT_VOICE_SETTINGS);
		expect(isVoiceSettings({ ...DEFAULT_VOICE_SETTINGS, camera: 3 })).toBe(
			false,
		);
	});

	it("keeps settings saved before screen sharing existed", () => {
		const { screen: _, ...older } = DEFAULT_VOICE_SETTINGS;
		storage.set(
			DEVICE_KEYS.voiceSettings,
			JSON.stringify({ ...older, microphone: "mic-2" }),
		);
		const store = createVoiceSettings();
		expect(store.settings()).toEqual({
			...DEFAULT_VOICE_SETTINGS,
			microphone: "mic-2",
		});
		store.updateScreen({ framerate: 60 });
		expect(createVoiceSettings().settings().screen).toEqual({
			...DEFAULT_VOICE_SETTINGS.screen,
			framerate: 60,
		});
	});
});

describe("media devices", () => {
	it("groups devices by kind, drops blank ids and names unlabeled ones", () => {
		expect(
			toDeviceLists([
				{ deviceId: "a", kind: "audioinput", label: "Desk mic" },
				{ deviceId: "a", kind: "audioinput", label: "Desk mic" },
				{ deviceId: "", kind: "audioinput", label: "" },
				{ deviceId: "b", kind: "audioinput", label: "" },
				{ deviceId: "s", kind: "audiooutput", label: "Speakers" },
				{ deviceId: "c", kind: "videoinput", label: "" },
			]),
		).toEqual({
			microphones: [
				{ id: "a", label: "Desk mic" },
				{ id: "b", label: "Microphone 2" },
			],
			speakers: [{ id: "s", label: "Speakers" }],
			cameras: [{ id: "c", label: "Camera 1" }],
		});
	});

	it("measures silence as zero and scales loud input with the volume", () => {
		expect(levelOf(new Uint8Array(32).fill(128))).toBe(0);
		const loud = new Uint8Array(32).map((_, index) => (index % 2 ? 136 : 120));
		expect(levelOf(loud, 2)).toBeGreaterThan(levelOf(loud, 1));
		expect(levelOf(new Uint8Array(32).fill(255), 2)).toBe(1);
	});

	it("asks for the chosen microphone with the chosen noise suppression", async () => {
		const stream = {} as MediaStream;
		const getUserMedia = vi.fn(async () => stream);
		await expect(
			openMicrophone(
				getUserMedia,
				microphoneConstraints({ noiseSuppression: false }),
				"mic-2",
			),
		).resolves.toBe(stream);
		expect(getUserMedia).toHaveBeenCalledWith({
			audio: expect.objectContaining({
				deviceId: { exact: "mic-2" },
				noiseSuppression: false,
			}),
		});
		await openMicrophone(
			getUserMedia,
			microphoneConstraints({ noiseSuppression: true }),
			undefined,
		);
		expect(getUserMedia).toHaveBeenLastCalledWith({
			audio: expect.not.objectContaining({ deviceId: expect.anything() }),
		});
	});

	it("falls back to the system microphone when the saved one is gone", async () => {
		const stream = {} as MediaStream;
		const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
			const audio = constraints.audio as MediaTrackConstraints;
			if (audio.deviceId) {
				throw Object.assign(new Error("gone"), {
					name: "OverconstrainedError",
				});
			}
			return stream;
		});
		await expect(
			openMicrophone(
				getUserMedia,
				microphoneConstraints({ noiseSuppression: true }),
				"unplugged",
			),
		).resolves.toBe(stream);
		expect(getUserMedia).toHaveBeenCalledTimes(2);
	});

	it("reports a blocked microphone without trying the default one", async () => {
		const getUserMedia = vi.fn(async () => {
			throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
		});
		await expect(
			openMicrophone(
				getUserMedia,
				microphoneConstraints({ noiseSuppression: true }),
				"mic-2",
			),
		).rejects.toMatchObject({ name: "NotAllowedError" });
		expect(getUserMedia).toHaveBeenCalledTimes(1);
	});
});

describe("experiments", () => {
	const defs: ExperimentDefinition[] = [
		{ id: "split-pane-v1", name: "Split pane", description: "Two at once." },
	];

	it("marks enabled experiments and toggles them in the synced list", async () => {
		expect(experimentViews(["split-pane-v1"], defs)[0]?.enabled).toBe(true);
		let experiments: string[] = ["other-v2"];
		const preferences = {
			client: () => ({ experiments }) as never,
			setClient: vi.fn(async (change: { experiments?: string[] }) => {
				experiments = change.experiments ?? experiments;
				return true;
			}),
		};
		await setExperiment(preferences, "split-pane-v1", true);
		await setExperiment(preferences, "split-pane-v1", true);
		expect(experiments).toEqual(["other-v2", "split-pane-v1"]);
		expect(isExperimentOn(preferences, "split-pane-v1")).toBe(true);
		await setExperiment(preferences, "split-pane-v1", false);
		expect(experiments).toEqual(["other-v2"]);
	});
});

const entry = (overrides: Partial<LogEntry>): LogEntry => ({
	atMs: Date.UTC(2026, 9, 15, 12, 0, 0),
	level: "info",
	scope: "voice",
	message: "joined",
	data: undefined,
	...overrides,
});

describe("logs and diagnostics", () => {
	it("turns log entries into page lines and copyable text", () => {
		const line = toLogLine(entry({ level: "warn", data: { code: "Gone" } }));
		expect(line).toMatchObject({
			level: "warn",
			scope: "voice",
			message: 'joined {"code":"Gone"}',
		});
		expect(formatLogs([entry({})])).toContain("[voice] joined");
	});

	it("counts problems in the log section", () => {
		const section = logSection([
			entry({}),
			entry({ level: "warn" }),
			entry({ level: "error" }),
		]);
		expect(section.fields).toContainEqual({
			kind: "value",
			label: "Warnings and errors",
			value: "2",
		});
	});

	it("reads the account server and formats every section", async () => {
		const account = await accountSection({
			did: "did:plc:viewer",
			handle: "lou.gg",
			liveStatus: "open",
			resolvePds: async () => "pds.example",
		});
		expect(account.fields).toContainEqual({
			kind: "value",
			label: "PDS host",
			value: "pds.example",
		});
		const text = formatDiagnostics([
			account,
			{
				title: "Runtime",
				fields: [{ kind: "list", label: "Experiments", items: [] }],
			},
		]);
		expect(text).toContain("## Account and services");
		expect(text).toContain("PDS host:");
		expect(text).toContain("Experiments:\n  - None");
	});
});

describe("release notes", () => {
	const notes: ReleaseNote[] = [
		{
			version: "0.5.0",
			date: "2026-10-01",
			entries: [
				{
					title: "Phones only",
					body: "Swipe things.",
					icon: "x",
					kind: "feature",
					platforms: ["ios", "android"],
				},
				{
					title: "Everywhere",
					body: "Fixed a crash.",
					icon: "x",
					kind: "fix",
					platforms: ["web", "ios", "android", "macos", "windows", "linux"],
				},
			],
		},
		{
			version: "0.4.0",
			date: "2026-09-01",
			entries: [
				{
					title: "Mac only",
					body: "Menus.",
					icon: "x",
					kind: "feature",
					platforms: ["macos"],
				},
			],
		},
	];

	it("keeps only what applies to this platform and drops empty releases", () => {
		const web = releaseNotesFor(notes, "web", "en-GB");
		expect(web).toHaveLength(1);
		expect(web[0]?.entries.map((item) => item.title)).toEqual(["Everywhere"]);
		expect(web[0]?.date).toBe("1 October 2026");
		expect(releaseNotesFor(notes, "macos")).toHaveLength(2);
	});

	it("detects the native platform and tolerates odd dates", () => {
		expect(sniffReleasePlatform("Mozilla (Linux; Android 15)", 5)).toBe(
			"android",
		);
		expect(sniffReleasePlatform("Macintosh; Intel Mac OS X", 5)).toBe("ios");
		expect(sniffReleasePlatform("Macintosh; Intel Mac OS X", 0)).toBe("macos");
		expect(formatReleaseDate("soon")).toBe("soon");
	});
});

describe("supporter link", () => {
	it("reads a linked Open Collective account", async () => {
		const fetcher = vi.fn(
			async (_input: RequestInfo | URL) =>
				new Response(
					JSON.stringify({
						value: {
							platform: "opencollective",
							accountId: "123",
							accountSlug: "lou",
							verifiedAt: "2026-10-12T10:00:00.000Z",
						},
					}),
				),
		);
		const account = await fetchSupporterAccount("did:plc:viewer", {
			resolvePds: async () => "labeler.example",
			fetcher: fetcher as typeof fetch,
		});
		expect(account).toEqual({
			account: "lou",
			verifiedAt: "2026-10-12T10:00:00.000Z",
		});
		expect(String(fetcher.mock.calls[0]?.[0])).toContain(
			"https://labeler.example/xrpc/com.atproto.repo.getRecord?",
		);
	});

	it("treats a missing record as not connected", async () => {
		const account = await fetchSupporterAccount("did:plc:viewer", {
			resolvePds: async () => "labeler.example",
			fetcher: (async () =>
				new Response("{}", { status: 400 })) as unknown as typeof fetch,
		});
		expect(account).toBeNull();
		expect(parseAttestation({ platform: "opencollective" })).toBeNull();
	});
});
