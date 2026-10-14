import type { JSX } from "solid-js";

const LINK_PATTERN =
	/(?<!\S)(?!@)(https?:\/\/(www\.)?)?[-a-zA-Z0-9@%._+~#=]{1,256}\.[a-zA-Z][a-zA-Z0-9()]{0,17}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/g;
const MENTION_PATTERN = /(?<!\S)@[a-zA-Z0-9._-]+(?:\.[a-zA-Z]{2,})?/g;

export type BioSegment =
	| { kind: "text"; text: string }
	| { kind: "link"; text: string; href: string }
	| { kind: "mention"; text: string; handle: string };

type Match = { start: number; end: number; segment: BioSegment };

const collect = (text: string): Match[] => {
	const matches: Match[] = [];
	for (const match of text.matchAll(LINK_PATTERN)) {
		const value = match[0];
		const start = match.index ?? 0;
		matches.push({
			start,
			end: start + value.length,
			segment: {
				kind: "link",
				text: value,
				href: /^https?:\/\//i.test(value) ? value : `https://${value}`,
			},
		});
	}
	for (const match of text.matchAll(MENTION_PATTERN)) {
		const value = match[0];
		const start = match.index ?? 0;
		matches.push({
			start,
			end: start + value.length,
			segment: { kind: "mention", text: value, handle: value.slice(1) },
		});
	}
	matches.sort((a, b) => a.start - b.start || b.end - a.end);
	const kept: Match[] = [];
	let reached = 0;
	for (const candidate of matches) {
		if (candidate.start < reached) continue;
		kept.push(candidate);
		reached = candidate.end;
	}
	return kept;
};

export const bioSegments = (text: string): BioSegment[] => {
	const segments: BioSegment[] = [];
	let cursor = 0;
	for (const match of collect(text)) {
		if (match.start > cursor) {
			segments.push({ kind: "text", text: text.slice(cursor, match.start) });
		}
		segments.push(match.segment);
		cursor = match.end;
	}
	if (cursor < text.length) {
		segments.push({ kind: "text", text: text.slice(cursor) });
	}
	return segments;
};

export type BioLinkOptions = {
	profileHref: (handle: string) => string;
	onLink: (href: string, label: string) => void;
};

const plainClick = (event: MouseEvent) =>
	event.button === 0 &&
	!event.metaKey &&
	!event.ctrlKey &&
	!event.shiftKey &&
	!event.altKey;

export const linkifyBio = (
	text: string,
	options: BioLinkOptions,
): JSX.Element => {
	const anchor = (href: string, label: string) => (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			data-bio-link=""
			onClick={(event) => {
				if (!plainClick(event)) return;
				event.preventDefault();
				options.onLink(href, label);
			}}
		>
			{label}
		</a>
	);
	return (
		<span class="whitespace-pre-line">
			{bioSegments(text).map((segment) => {
				if (segment.kind === "link") return anchor(segment.href, segment.text);
				if (segment.kind === "mention") {
					return anchor(options.profileHref(segment.handle), segment.text);
				}
				return segment.text;
			})}
		</span>
	);
};
