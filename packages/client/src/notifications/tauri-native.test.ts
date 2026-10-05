import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const listen = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
	invoke: (command: string, args?: unknown) => invoke(command, args),
}));

vi.mock("@tauri-apps/api/event", () => ({
	listen: (event: string, handler: unknown) => listen(event, handler),
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "ios" }));

const { listenForNativeActivation } = await import("./tauri-native");

const CHANNEL =
	"at://did:plc:community/space/social.colibri.beta.channel.text/3lkchannel1";

beforeEach(() => {
	vi.stubGlobal("window", {
		__TAURI_INTERNALS__: {},
		__TAURI_OS_PLUGIN_INTERNALS__: { platform: "ios" },
	});
	listen.mockResolvedValue(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("listenForNativeActivation", () => {
	it("opens a launch activation that carries no message", async () => {
		invoke.mockResolvedValue({ channelUri: CHANNEL });
		const handler = vi.fn();

		await listenForNativeActivation(handler);

		expect(invoke).toHaveBeenCalledWith("apns_take_activation", undefined);
		expect(handler).toHaveBeenCalledWith({ channelUri: CHANNEL });
	});

	it("skips a launch activation the live event already delivered", async () => {
		const activation = { channelUri: CHANNEL, messageUri: `${CHANNEL}/m` };
		listen.mockImplementation(async (_event, live) => {
			(live as (event: { payload: unknown }) => void)({ payload: activation });
			return () => {};
		});
		invoke.mockResolvedValue(activation);
		const handler = vi.fn();

		await listenForNativeActivation(handler);

		expect(handler).toHaveBeenCalledTimes(1);
	});
});
