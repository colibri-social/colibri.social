import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initBranchWind } from "@/scripts/branchWind";
import { initAmbientPetals, initHeroPetals } from "@/scripts/heroPetals";

gsap.registerPlugin(ScrollTrigger);

if (import.meta.env.DEV) {
	(window as unknown as { __gsap: typeof gsap }).__gsap = gsap;
}

const reduceMotion = window.matchMedia(
	"(prefers-reduced-motion: reduce)",
).matches;

function sizeSky() {
	const sky = document.querySelector<HTMLElement>(".hero-sky");
	const hero = document.querySelector<HTMLElement>(".hero");
	if (!sky || !hero) return;
	const apply = () => {
		sky.style.height = `${hero.offsetHeight}px`;
	};
	apply();
	window.addEventListener("resize", apply);
}

function heroReveal() {
	gsap.to(".hero-reveal", {
		opacity: 1,
		y: 0,
		duration: 0.9,
		ease: "power3.out",
		stagger: 0.12,
	});
}

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
		},
		{ passive: true },
	);

	for (const hit of gsap.utils.toArray<HTMLElement>("[data-branch-hit]")) {
		const side = hit.dataset.branchHit ?? "right";
		hit.addEventListener("pointerenter", () => {
			const speed = Math.hypot(pointerVX, pointerVY);
			const strength = 0.6 + Math.min(speed / 1200, 1);
			const dx = speed > 1 ? pointerVX / speed : 0;
			const dy = speed > 1 ? pointerVY / speed : 0;
			wind?.gust(side as "left" | "right", strength, dx, -dy);
			petalsApi.burst(
				hit.getBoundingClientRect(),
				6 + Math.floor(Math.random() * 9),
			);
		});
	}
}

sizeSky();

if (!reduceMotion) {
	heroReveal();
	initAmbientPetals();
	parallax();
	branchInteractions();
}
