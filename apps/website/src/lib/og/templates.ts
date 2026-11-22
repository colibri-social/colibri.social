import banner from "@/assets/og/banner.jpg?inline";
import doge from "@/assets/og/doge.png?inline";
import grin from "@/assets/og/grin.png?inline";
import heroSky from "@/assets/og/hero-sky.jpg?inline";
import home from "@/assets/og/home.jpg?inline";
import hummingbird from "@/assets/og/hummingbird.png?inline";
import starGlow from "@/assets/og/star-glow.jpg?inline";
import { esc } from "./render";

const HUMMINGBIRD = hummingbird;

const SHADOW = "0 0 16px rgba(0,0,0,0.5), 0 2px 28px rgba(16,13,26,0.6)";

const frame = (background: string, body: string, extra = "") =>
	`<div style="display:flex;position:relative;width:1200px;height:630px;color:#fff;font-family:'Hanken Grotesk';background-color:#080808;${extra}">
		<img src="${background}" width="1200" height="630" style="position:absolute;left:0;top:0;width:1200px;height:630px" />
		${body}
	</div>`;

const brand = (size: number) =>
	`<div style="display:flex;align-items:center;gap:${Math.round(size * 0.4)}px;font-weight:900;font-size:${size}px">
		<img src="${HUMMINGBIRD}" width="${Math.round(size * 1.13)}" height="${Math.round(size * 1.6)}" style="width:${Math.round(size * 1.13)}px;height:${Math.round(size * 1.6)}px" />
		<span>Colibri Social</span>
	</div>`;

const urlLabel = (path: string) =>
	`<div style="display:flex;font-weight:700;font-size:26px;color:rgba(255,255,255,0.85)">${esc(path)}</div>`;

export const homeTemplate = () =>
	frame(
		home,
		`<div style="display:flex;flex-direction:column;align-items:center;position:absolute;left:0;top:44px;width:1200px">
			<div style="display:flex;font-family:Stardom;font-size:76px;line-height:0.9;text-shadow:${SHADOW}">LET YOUR COMMUNITY</div>
			<div style="display:flex;font-family:Stardom;font-size:76px;line-height:0.9;text-shadow:${SHADOW}">SPREAD ITS WINGS.</div>
		</div>`,
	);

const PLATFORM_ICONS = [
	'<svg viewBox="0 0 24 24" width="44" height="44" fill="#ffffff"><path d="M17.523 15.341a.999.999 0 1 1 0-1.998.999.999 0 0 1 0 1.998m-11.046 0a.999.999 0 1 1 0-1.998.999.999 0 0 1 0 1.998m11.405-6.02 1.997-3.459a.416.416 0 0 0-.152-.567.416.416 0 0 0-.568.152L17.137 8.95A12.42 12.42 0 0 0 12 7.85c-1.85 0-3.6.39-5.137 1.1L4.841 5.447a.416.416 0 0 0-.568-.152.416.416 0 0 0-.152.567l1.997 3.459C2.689 11.187.343 14.659 0 18.761h24c-.344-4.102-2.689-7.574-6.118-9.44"/></svg>',
	'<svg viewBox="0 0 24 24" width="44" height="44" fill="#ffffff"><path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43m4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.630-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45"/></svg>',
	'<svg viewBox="0 0 24 24" width="40" height="40" fill="#ffffff"><path d="M0 3.449 9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.351"/></svg>',
	'<svg viewBox="0 0 24 24" width="40" height="44" fill="#ffffff"><path d="M12 2c-2.2 0-3.6 1.9-3.6 4.4 0 1.3.3 2.2-.6 3.5C6.6 11.6 5 13.4 5 16.2c0 .6.1 1.2.3 1.7-.8.4-1.8.9-1.8 1.8 0 1.2 1.7 1.3 3.3 2 1 .4 1.8.3 2.4-.4.9.2 1.8.3 2.8.3s1.9-.1 2.8-.3c.6.7 1.4.8 2.4.4 1.6-.7 3.3-.8 3.3-2 0-.9-1-1.4-1.8-1.8.2-.5.3-1.1.3-1.7 0-2.8-1.6-4.6-2.8-6.3-.9-1.3-.6-2.2-.6-3.5C15.6 3.9 14.2 2 12 2"/></svg>',
];

export type PageCard = {
	title: string;
	subtitle?: string;
	path: string;
	meta?: string;
	cover?: string | null;
	platforms?: boolean;
};

export const pageTemplate = (card: PageCard) => {
	const titleSize = card.title.length > 48 ? 64 : 76;
	const coverLayer = card.cover
		? `<img src="${card.cover}" width="1200" height="630" style="position:absolute;left:0;top:0;width:1200px;height:630px;object-fit:cover" />
			<div style="display:flex;position:absolute;left:0;top:0;width:1200px;height:630px;background-image:linear-gradient(90deg, rgba(8,8,8,0.94) 0%, rgba(8,8,8,0.82) 55%, rgba(8,8,8,0.45) 100%)"></div>`
		: "";
	return frame(
		starGlow,
		`${coverLayer}
		<div style="display:flex;flex-direction:column;justify-content:space-between;position:absolute;left:0;top:0;width:1200px;height:630px;padding:56px 64px">
			${brand(28)}
			<div style="display:flex;flex-direction:column;gap:22px;max-width:1000px">
				<div style="display:flex;font-weight:900;font-size:${titleSize}px;line-height:1.04">${esc(card.title)}</div>
				${card.subtitle ? `<div style="display:flex;font-weight:500;font-size:28px;color:#d4d4d4">${esc(card.subtitle)}</div>` : ""}
				${card.platforms ? `<div style="display:flex;gap:22px">${PLATFORM_ICONS.join("")}</div>` : ""}
			</div>
			<div style="display:flex;justify-content:space-between;align-items:center">
				${urlLabel(card.path)}
				${card.meta ? `<div style="display:flex;font-size:24px;color:#ffc973;font-weight:700">${esc(card.meta)}</div>` : '<div style="display:flex"></div>'}
			</div>
		</div>`,
	);
};

export type InviteCard = {
	name: string;
	picture?: string | null;
	banner?: string | null;
	memberCount?: number;
	inviterHandle?: string;
};

export const inviteTemplate = (card: InviteCard) => {
	const nameSize = card.name.length > 22 ? 60 : 76;
	const icon = card.picture
		? `<img src="${card.picture}" width="160" height="160" style="width:160px;height:160px;border-radius:38px" />`
		: `<img src="${HUMMINGBIRD}" width="76" height="108" style="width:76px;height:108px" />`;
	const members =
		card.memberCount !== undefined
			? `<div style="display:flex;align-items:center;gap:12px;font-size:26px;font-weight:500;color:#d4d4d4">
				<div style="display:flex;width:14px;height:14px;border-radius:7px;background-color:#8a8794"></div>
				<span>${card.memberCount.toLocaleString("en-US")} ${card.memberCount === 1 ? "member" : "members"}</span>
			</div>`
			: `<div style="display:flex"></div>`;
	return `<div style="display:flex;position:relative;width:1200px;height:630px;color:#fff;font-family:'Hanken Grotesk';background-color:#080808">
		<img src="${card.banner ?? banner}" width="1200" height="250" style="position:absolute;left:0;top:0;width:1200px;height:250px;object-fit:cover" />
		<div style="display:flex;flex-direction:column;justify-content:flex-end;position:absolute;left:0;top:0;width:1200px;height:630px;padding:0 64px 48px">
			<div style="display:flex;align-items:flex-end;gap:28px">
				<div style="display:flex;align-items:center;justify-content:center;width:180px;height:180px;border-radius:47px;background-color:#1b1430;border:10px solid #080808;overflow:hidden">${icon}</div>
				<div style="display:flex;flex-direction:column;gap:10px;padding-bottom:12px;max-width:860px">
					<div style="display:flex;font-size:26px;font-weight:500;color:#d4d4d4">${card.inviterHandle ? `@${esc(card.inviterHandle)} invited you to join` : "You've been invited to join"}</div>
					<div style="display:flex;font-weight:900;font-size:${nameSize}px;line-height:1.04">${esc(card.name)}</div>
				</div>
			</div>
			<div style="display:flex;justify-content:space-between;align-items:center;margin-top:36px">
				${members}
				${brand(24)}
			</div>
		</div>
	</div>`;
};

export const inviteFallbackTemplate = () =>
	frame(
		heroSky,
		`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;position:absolute;left:0;top:0;width:1200px;height:630px">
			<img src="${HUMMINGBIRD}" width="96" height="137" style="width:96px;height:137px" />
			<div style="display:flex;font-family:Stardom;font-size:96px;line-height:0.9;text-shadow:${SHADOW}">COME ON IN</div>
			<div style="display:flex;font-size:30px;font-weight:500;text-shadow:0 1px 14px rgba(16,13,26,0.5)">You've been invited to a space on Colibri.</div>
		</div>
		<div style="display:flex;justify-content:center;position:absolute;left:0;bottom:32px;width:1200px">${urlLabel("colibri.social")}</div>`,
	);

const STICKER_SPOTS = [
	{ left: 80, top: 70, rotate: -12, size: 130 },
	{ left: 950, top: 430, rotate: -10, size: 130 },
	{ left: 950, top: 60, rotate: 10, size: 130 },
	{ left: 70, top: 390, rotate: 9, size: 120 },
	{ left: 300, top: 40, rotate: 8, size: 100 },
	{ left: 790, top: 510, rotate: 6, size: 90 },
	{ left: 1040, top: 250, rotate: -8, size: 100 },
	{ left: 250, top: 480, rotate: -6, size: 96 },
];

const stickers = (images: readonly string[]) =>
	STICKER_SPOTS.slice(0, images.length)
		.map(
			(spot, i) =>
				`<img src="${images[i]}" width="${spot.size}" height="${spot.size}" style="position:absolute;left:${spot.left}px;top:${spot.top}px;width:${spot.size}px;height:${spot.size}px;transform:rotate(${spot.rotate}deg)" />`,
		)
		.join("");

export type EmojiPackCard = {
	name: string;
	count: number;
	images: readonly string[];
	creatorHandle?: string;
};

export const emojiPackTemplate = (card: EmojiPackCard) => {
	const nameSize = card.name.length > 16 ? 72 : 96;
	return frame(
		heroSky,
		`${stickers(card.images)}
		<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;position:absolute;left:0;top:0;width:1200px;height:630px;padding:0 240px">
			<div style="display:flex;text-align:center;font-family:Stardom;font-size:${nameSize}px;line-height:0.9;text-shadow:${SHADOW}">${esc(card.name.toUpperCase())}</div>
			<div style="display:flex;font-size:28px;font-weight:500;color:#e5e5e5;text-shadow:0 1px 14px rgba(16,13,26,0.5)">${card.count} emoji ${card.creatorHandle ? `by @${esc(card.creatorHandle)}` : "on Colibri"}</div>
			<div style="display:flex;margin-top:10px;height:44px;padding:0 18px;align-items:center;border-radius:10px;background-color:#ffffff;color:#000000;font-weight:700;font-size:22px">Add to Colibri</div>
		</div>`,
	);
};

export const emojiFallbackTemplate = () =>
	frame(
		heroSky,
		`${stickers([doge, grin, doge, grin])}
		<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;position:absolute;left:0;top:0;width:1200px;height:630px;padding:0 220px">
			<div style="display:flex;text-align:center;font-weight:900;font-size:68px;line-height:1.04;text-shadow:0 1px 14px rgba(16,13,26,0.5)">Someone shared an emoji pack</div>
			<div style="display:flex;font-size:28px;font-weight:500;color:#e5e5e5;text-shadow:0 1px 14px rgba(16,13,26,0.5)">Open it in Colibri to see every emoji.</div>
		</div>
		<div style="display:flex;justify-content:space-between;align-items:center;position:absolute;left:48px;right:48px;bottom:32px">${brand(24)}${urlLabel("colibri.social")}</div>`,
	);
