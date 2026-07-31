import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createLogger,
	formatLog,
	logEntries,
	resetLog,
	setLogLevel,
} from "./logger";

beforeEach(() => {
	resetLog();
	setLogLevel("debug");
	vi.spyOn(console, "debug").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("createLogger", () => {
	it("records entries with their scope and level", () => {
		const log = createLogger("auth");
		log.info("signed in");
		log.error("nope");

		const recorded = logEntries();
		expect(recorded).toHaveLength(2);
		expect(recorded[0]?.scope).toBe("auth");
		expect(recorded[0]?.level).toBe("info");
		expect(recorded[1]?.level).toBe("error");
	});

	it("redacts the message it stores", () => {
		createLogger("auth").info("token eyJhbG.eyJzdWI.sig");
		expect(logEntries()[0]?.message).toBe("token [redacted]");
	});

	it("buffers entries below the console level", () => {
		setLogLevel("error");
		createLogger("voice").debug("chatty");
		expect(logEntries()).toHaveLength(1);
		expect(console.debug).not.toHaveBeenCalled();
	});

	it("nests child scopes", () => {
		createLogger("voice").child("sfu").warn("slow");
		expect(logEntries()[0]?.scope).toBe("voice/sfu");
	});

	it("evicts the oldest entry once the buffer is full", () => {
		const log = createLogger("perf");
		for (let index = 0; index < 520; index += 1) log.debug(`entry ${index}`);

		const recorded = logEntries();
		expect(recorded).toHaveLength(500);
		expect(recorded[0]?.message).toBe("entry 20");
		expect(recorded.at(-1)?.message).toBe("entry 519");
	});
});

describe("formatLog", () => {
	it("renders one line per entry with level and scope", () => {
		createLogger("socket").warn("closed", { code: 1006 });
		const line = formatLog();
		expect(line).toContain("WARN");
		expect(line).toContain("[socket]");
		expect(line).toContain("closed");
		expect(line).toContain("1006");
	});

	it("honours the limit", () => {
		const log = createLogger("socket");
		log.info("one");
		log.info("two");
		expect(formatLog(1).split("\n")).toHaveLength(1);
	});

	it("is empty when nothing has been logged", () => {
		expect(formatLog()).toBe("");
	});
});
