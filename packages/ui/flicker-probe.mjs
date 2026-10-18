import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
	viewport: { width: 411, height: 815 },
	hasTouch: true,
	isMobile: true,
	deviceScaleFactor: 2,
});
await page.goto("http://localhost:5173/s/hq/typing");
await page.waitForTimeout(3000);
await page.evaluate(() => {
	window.__muts = { added: 0, removed: 0, attrs: 0, imgs: 0, samples: [] };
	const base = document.querySelector('[data-pane-index="0"]');
	new MutationObserver((list) => {
		for (const m of list) {
			if (m.type === "childList") {
				window.__muts.added += m.addedNodes.length;
				window.__muts.removed += m.removedNodes.length;
				for (const n of m.addedNodes) {
					if (
						n.nodeType === 1 &&
						(n.tagName === "IMG" || n.querySelector?.("img"))
					) {
						window.__muts.imgs++;
						if (window.__muts.samples.length < 8)
							window.__muts.samples.push((n.outerHTML || "").slice(0, 160));
					}
				}
			} else window.__muts.attrs++;
		}
	}).observe(base, { childList: true, subtree: true, attributes: true });
});
await page.waitForTimeout(Number(process.argv[2] ?? 40000));
console.log(JSON.stringify(await page.evaluate(() => window.__muts), null, 1));
await browser.close();
