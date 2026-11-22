import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { expect, it } from "vitest";
import { defineContract, slot } from "./define";

it("keeps screen args reactive after mount", async () => {
	const contract = defineContract({
		id: "probe",
		model: (args: { slug: string }) => ({ slug: () => args.slug }),
		slots: { Label: slot((m) => <span data-probe="">{m.slug()}</span>) },
	});
	const View = contract.view({ render: ({ slots: s }) => <s.Label /> });
	const [slug, setSlug] = createSignal("hq");
	const host = document.createElement("div");
	document.body.append(host);
	const dispose = render(() => <View args={{ slug: slug() }} />, host);
	expect(host.textContent).toBe("hq");
	setSlug("nightowls");
	expect(host.textContent).toBe("nightowls");
	dispose();
	host.remove();
});
