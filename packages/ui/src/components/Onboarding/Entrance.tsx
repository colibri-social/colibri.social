import { For, type JSX, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";

export const ENTRANCE_GROUP_GAP_MS = 90;
export const ENTRANCE_WORD_GAP_MS = 30;
const MAX_WORD_SPREAD_MS = 360;

export const entranceDelay = (group: number, offset = 0) =>
	group * ENTRANCE_GROUP_GAP_MS + offset;

type TextTag = "h1" | "h2" | "p" | "span" | "div";

export type EntranceTextLine = string | { text: string; class?: string };

export type EntranceTextProps = {
	as?: TextTag;
	group: number;
	lines: EntranceTextLine | EntranceTextLine[];
	class?: string;
	id?: string;
};

const toLines = (lines: EntranceTextLine | EntranceTextLine[]) =>
	(Array.isArray(lines) ? lines : [lines]).map((line) =>
		typeof line === "string" ? { text: line } : line,
	);

export const EntranceText = (props: EntranceTextProps) => {
	const lines = () => toLines(props.lines);
	const totalWords = () =>
		lines().reduce(
			(sum, line) => sum + line.text.split(/\s+/).filter(Boolean).length,
			0,
		);
	const wordGap = () =>
		Math.min(
			ENTRANCE_WORD_GAP_MS,
			MAX_WORD_SPREAD_MS / Math.max(1, totalWords() - 1),
		);

	const wordsBefore = (lineIndex: number) =>
		lines()
			.slice(0, lineIndex)
			.reduce(
				(sum, line) => sum + line.text.split(/\s+/).filter(Boolean).length,
				0,
			);

	return (
		<Dynamic
			component={props.as ?? "p"}
			id={props.id}
			data-entrance-text=""
			class={props.class}
		>
			<For each={lines()}>
				{(line, lineIndex) => {
					const words = line.text.split(/\s+/).filter(Boolean);
					return (
						<>
							{lineIndex() > 0 ? " " : ""}
							<span class={cx("block", line.class)}>
								<For each={words}>
									{(word, wordIndex) => (
										<>
											<span
												data-entrance="word"
												style={{
													"--entrance-delay": `${entranceDelay(
														props.group,
														(wordsBefore(lineIndex()) + wordIndex()) *
															wordGap(),
													)}ms`,
												}}
											>
												{word}
											</span>
											{wordIndex() < words.length - 1 ? " " : ""}
										</>
									)}
								</For>
							</span>
						</>
					);
				}}
			</For>
		</Dynamic>
	);
};

export type EntranceProps = JSX.HTMLAttributes<HTMLDivElement> & {
	group: number;
	offset?: number;
};

export const Entrance = (props: EntranceProps) => {
	const [local, rest] = splitProps(props, ["group", "offset", "style"]);
	return (
		<div
			{...rest}
			data-entrance="block"
			style={{
				...(typeof local.style === "object" ? local.style : {}),
				"--entrance-delay": `${entranceDelay(local.group, local.offset)}ms`,
			}}
		/>
	);
};
