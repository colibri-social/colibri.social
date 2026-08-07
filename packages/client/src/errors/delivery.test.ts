import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	isReportDelivered,
	markReportDelivered,
	onReportDelivered,
	resetReportDeliveries,
} from "./delivery";

beforeEach(() => resetReportDeliveries());

describe("report delivery", () => {
	it("treats an unknown reference as undelivered", () => {
		expect(isReportDelivered("event-1")).toBe(false);
		expect(isReportDelivered(undefined)).toBe(false);
	});

	it("notifies a waiting listener once the event lands", () => {
		const listener = vi.fn();
		onReportDelivered("event-1", listener);

		expect(listener).not.toHaveBeenCalled();

		markReportDelivered("event-1");

		expect(listener).toHaveBeenCalledTimes(1);
		expect(isReportDelivered("event-1")).toBe(true);
	});

	it("calls back immediately when the event already landed", () => {
		markReportDelivered("event-1");
		const listener = vi.fn();
		onReportDelivered("event-1", listener);

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("leaves other references alone", () => {
		const listener = vi.fn();
		onReportDelivered("event-1", listener);

		markReportDelivered("event-2");

		expect(listener).not.toHaveBeenCalled();
	});

	it("stops notifying after unsubscribe", () => {
		const listener = vi.fn();
		const stop = onReportDelivered("event-1", listener);

		stop();
		markReportDelivered("event-1");

		expect(listener).not.toHaveBeenCalled();
	});

	it("notifies every listener waiting on the same event", () => {
		const first = vi.fn();
		const second = vi.fn();
		onReportDelivered("event-1", first);
		onReportDelivered("event-1", second);

		markReportDelivered("event-1");

		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it("only notifies once for a repeated delivery", () => {
		const listener = vi.fn();
		onReportDelivered("event-1", listener);

		markReportDelivered("event-1");
		markReportDelivered("event-1");

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("forgets the oldest references once the cap is passed", () => {
		for (let index = 0; index < 60; index += 1) {
			markReportDelivered(`event-${index}`);
		}

		expect(isReportDelivered("event-0")).toBe(false);
		expect(isReportDelivered("event-59")).toBe(true);
	});
});
