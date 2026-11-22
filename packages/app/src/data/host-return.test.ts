import { describe, expect, it } from "vitest";
import {
	captureHostReturn,
	type HostReturn,
	listenForHostReturn,
	readHostReturn,
} from "./host-return";

describe("returning from a host sign-in", () => {
	it("reads a finished and a failed sign-in", () => {
		expect(
			readHostReturn(new URLSearchParams("hostRequest=r1&hostStatus=done")),
		).toEqual({ status: "done", request: "r1" });
		expect(
			readHostReturn(
				new URLSearchParams(
					"hostRequest=r1&hostStatus=failed&hostFailure=cancelled",
				),
			),
		).toEqual({ status: "failed", request: "r1", failure: "cancelled" });
		expect(
			readHostReturn(new URLSearchParams("hostStatus=failed&hostFailure=x")),
		).toEqual({ status: "failed", request: undefined, failure: "failed" });
		expect(readHostReturn(new URLSearchParams("oc=linked"))).toBeUndefined();
	});

	it("removes the parameters and hands the outcome over", () => {
		const replaced: string[] = [];
		const received: HostReturn[] = [];
		const stop = listenForHostReturn((outcome) => received.push(outcome));

		captureHostReturn(
			{
				href: "https://colibri.social/app?hostRequest=r1&hostStatus=done&tab=x",
			},
			{
				state: null,
				replaceState: (_state, _title, url) => replaced.push(String(url)),
			},
		);
		stop();

		expect(replaced).toEqual(["https://colibri.social/app?tab=x"]);
		expect(received).toEqual([{ status: "done", request: "r1" }]);
	});
});
