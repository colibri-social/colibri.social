import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	forgetServerFeatures,
	serverFeatures,
	voiceDisabledOn,
} from "./server-features";

const ORIGIN = "https://appview.example";

const described = (features: unknown) => ({
	ok: true,
	status: 200,
	json: () => Promise.resolve({ did: "did:web:appview.example", features }),
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	forgetServerFeatures();
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("voiceDisabledOn", () => {
	it("reports voice off when the appview does not list the feature", async () => {
		fetchMock.mockResolvedValue(described(["push", "embeds"]));

		expect(await voiceDisabledOn(ORIGIN)).toBe(true);
	});

	it("reports voice on when the appview lists it", async () => {
		fetchMock.mockResolvedValue(described(["voice", "embeds"]));

		expect(await voiceDisabledOn(ORIGIN)).toBe(false);
	});

	it("does not claim voice is off when the appview cannot be reached", async () => {
		fetchMock.mockRejectedValue(new TypeError("NetworkError"));

		expect(await voiceDisabledOn(ORIGIN)).toBe(false);
	});

	it("does not claim voice is off when the description omits its features", async () => {
		fetchMock.mockResolvedValue(described(undefined));

		expect(await voiceDisabledOn(ORIGIN)).toBe(false);
	});

	it("does not claim voice is off when the appview answers with an error", async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 503 });

		expect(await voiceDisabledOn(ORIGIN)).toBe(false);
	});
});

describe("serverFeatures", () => {
	it("asks each appview once and keeps the answer", async () => {
		fetchMock.mockResolvedValue(described(["voice"]));

		await serverFeatures(ORIGIN);
		await serverFeatures(ORIGIN);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			`${ORIGIN}/xrpc/social.colibri.beta.server.describeServer`,
		);
	});

	it("collapses concurrent asks into one request", async () => {
		fetchMock.mockResolvedValue(described(["voice"]));

		await Promise.all([serverFeatures(ORIGIN), serverFeatures(ORIGIN)]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("keeps each appview separate", async () => {
		fetchMock.mockImplementation((url: string) =>
			Promise.resolve(described(url.includes("quiet") ? [] : ["voice"])),
		);

		expect(await voiceDisabledOn("https://quiet.example")).toBe(true);
		expect(await voiceDisabledOn(ORIGIN)).toBe(false);
	});

	it("asks again after a failure rather than caching the miss", async () => {
		fetchMock.mockResolvedValueOnce({ ok: false, status: 502 });
		fetchMock.mockResolvedValue(described(["voice"]));

		expect(await voiceDisabledOn(ORIGIN)).toBe(false);
		await serverFeatures(ORIGIN);

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
