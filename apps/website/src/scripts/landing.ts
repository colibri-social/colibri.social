import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initBranchWind } from "@/scripts/branchWind";
import { initAmbientPetals, initHeroPetals } from "@/scripts/heroPetals";
import { initCardStars, initSkyTwinkle } from "@/scripts/sky";

gsap.registerPlugin(ScrollTrigger);

if (import.meta.env.DEV) {
	(window as unknown as { __gsap: typeof gsap }).__gsap = gsap;
}

const reduceMotion = window.matchMedia(
	"(prefers-reduced-motion: reduce)",
).matches;

function parallax() {
	for (const el of gsap.utils.toArray<HTMLElement>("[data-parallax]")) {
		const speed = Number.parseFloat(el.dataset.parallax || "0.1");
		gsap.to(el, {
			yPercent: -speed * 100,
			ease: "none",
			scrollTrigger: {
				trigger: el.closest("section") || el,
				start: "top bottom",
				end: "bottom top",
				scrub: true,
			},
		});
	}
}

function branchInteractions() {
	const wind = initBranchWind();
	const canHover = window.matchMedia(
		"(hover: hover) and (pointer: fine)",
	).matches;
	if (!canHover) return;

	const petalsApi = initHeroPetals();

	const regions = gsap.utils
		.toArray<HTMLElement>("[data-branch-hit]")
		.map((el) => ({
			el,
			side: (el.dataset.branchHit ?? "right") as "left" | "right",
			inside: false,
		}));

	let pointerVX = 0;
	let pointerVY = 0;
	let prevX = 0;
	let prevY = 0;
	let prevT = 0;
	window.addEventListener(
		"pointermove",
		(e) => {
			const now = performance.now();
			const dt = prevT ? Math.min((now - prevT) / 1000, 0.05) : 0;
			if (dt > 0) {
				pointerVX = (e.clientX - prevX) / dt;
				pointerVY = (e.clientY - prevY) / dt;
			}
			prevX = e.clientX;
			prevY = e.clientY;
			prevT = now;

			for (const region of regions) {
				const rect = region.el.getBoundingClientRect();
				const isInside =
					rect.width > 0 &&
					e.clientX >= rect.left &&
					e.clientX <= rect.right &&
					e.clientY >= rect.top &&
					e.clientY <= rect.bottom;

				if (isInside && !region.inside) {
					const speed = Math.hypot(pointerVX, pointerVY);
					const strength = 0.6 + Math.min(speed / 1200, 1);
					const dx = speed > 1 ? pointerVX / speed : 0;
					const dy = speed > 1 ? pointerVY / speed : 0;
					wind?.gust(region.side, strength, dx, -dy);
					petalsApi.burst(rect, 6 + Math.floor(Math.random() * 9));
				}

				region.inside = isInside;
			}
		},
		{ passive: true },
	);
}

function detectPlatform() {
	const nav = navigator as Navigator & {
		userAgentData?: { platform?: string };
	};
	const ua = nav.userAgent || "";
	const platform = nav.userAgentData?.platform || nav.platform || "";
	if (/android/i.test(ua)) return "Android";
	if (
		/iPhone|iPad|iPod/i.test(ua) ||
		(/Mac/i.test(platform) && nav.maxTouchPoints > 1)
	) {
		return "iOS";
	}
	if (/Win/i.test(platform) || /Windows/i.test(ua)) return "Windows";
	if (/Mac/i.test(platform) || /Mac OS X/i.test(ua)) return "macOS";
	if (/Linux|X11|CrOS/i.test(platform + ua)) return "Linux";
	return null;
}

function downloadLabels() {
	const os = detectPlatform();
	for (const el of document.querySelectorAll<HTMLElement>("[data-download]")) {
		el.textContent = os ? `Download for ${os}` : "Download Colibri";
	}
}

const MONTHLY_BADGES: Record<number, { label: string; color: string }> = {
	5: { label: "$5 BACKER", color: "#22d3ee" },
	10: { label: "$10 SUPPORTER", color: "#e870df" },
	25: { label: "$25 SPONSOR", color: "#60a5fa" },
};
const ONE_TIME_BADGE_COLOR = "#2dd4bf";

function supportCard() {
	const card = document.querySelector<HTMLElement>("[data-support-card]");
	if (!card) return;
	const badge = card.querySelector<HTMLElement>("[data-support-badge]");
	const status = card.querySelector<HTMLElement>("[data-support-status]");
	const link = card.querySelector<HTMLAnchorElement>("[data-support-link]");
	const freqButtons = card.querySelectorAll<HTMLElement>("[data-freq]");
	const amountButtons = card.querySelectorAll<HTMLElement>("[data-amount]");
	const state = { freq: "month", amount: 10 };

	const render = () => {
		for (const b of freqButtons) {
			b.setAttribute("aria-pressed", String(b.dataset.freq === state.freq));
		}

		for (const b of amountButtons) {
			b.setAttribute(
				"aria-pressed",
				String(Number(b.dataset.amount) === state.amount),
			);
		}

		const monthly = state.freq === "month";
		const tier = MONTHLY_BADGES[state.amount];

		if (badge) {
			badge.textContent = monthly ? tier.label : "DONATOR";
			badge.style.background = monthly ? tier.color : ONE_TIME_BADGE_COLOR;
		}

		if (status) {
			status.textContent = monthly
				? `I’m supporting Colibri with $${state.amount} per month!`
				: `I chipped in $${state.amount} to keep Colibri in the air!`;
		}

		if (link) {
			const interval = monthly ? "month" : "oneTime";
			link.href = `https://opencollective.com/colibri-social/donate?interval=${interval}&amount=${state.amount}`;
		}
	};

	for (const b of freqButtons) {
		b.addEventListener("click", () => {
			state.freq = b.dataset.freq ?? "month";
			render();
		});
	}
	for (const b of amountButtons) {
		b.addEventListener("click", () => {
			state.amount = Number(b.dataset.amount);
			render();
		});
	}
	render();
}

function exclusiveFaq() {
	const items =
		document.querySelectorAll<HTMLDetailsElement>("[data-faq] details");
	for (const item of items) {
		item.addEventListener("toggle", () => {
			if (!item.open) return;
			for (const other of items) {
				if (other !== item && other.open) other.open = false;
			}
		});
	}
}

downloadLabels();
supportCard();
exclusiveFaq();

function extendPetalsOverFooter() {
	const layer = document.querySelector<HTMLElement>(".petal-layer");
	const footer = document.querySelector<HTMLElement>(".site-footer");
	if (!layer || !footer) return;
	const apply = () => {
		layer.style.setProperty("--footer-height", `${footer.offsetHeight}px`);
	};
	apply();
	new ResizeObserver(apply).observe(footer);
}

extendPetalsOverFooter();

const sky = document.querySelector<HTMLCanvasElement>("#sky");
if (sky?.dataset.tile) initSkyTwinkle(sky.dataset.tile, reduceMotion);

const ctaStars = document.querySelector<HTMLCanvasElement>("[data-cta-stars]");
if (ctaStars) initCardStars(ctaStars, reduceMotion);

if (!reduceMotion) {
	initAmbientPetals();
	parallax();
	branchInteractions();
}
