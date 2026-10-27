import {
	AcknowledgementsSettings,
	type Contributor,
	type OpenSourceLibrary,
} from "@colibri-social/ui";
import {
	blueskyClientOf,
	buildBskyProfileUrl,
} from "../../../data/bluesky-client";
import { useData } from "../../../data/store";
import type { Platform } from "../../../screen/platform";
import generated from "../acknowledgements.generated.json";
import { CONTRIBUTORS, type ContributorEntry } from "../contributors";

const LIBRARIES = generated.libraries as OpenSourceLibrary[];

export const contributorsWithLinks = (
	entries: readonly ContributorEntry[],
	profileUrl: (identifier: string) => string,
): Contributor[] =>
	entries.map((entry) => {
		const identifier = entry.did ?? entry.handle;
		return {
			...entry,
			href: identifier ? profileUrl(identifier) : undefined,
		};
	});

export default function AcknowledgementsPage(_props: { platform: Platform }) {
	const data = useData();
	const contributors = () =>
		contributorsWithLinks(CONTRIBUTORS, (identifier) =>
			buildBskyProfileUrl(blueskyClientOf(data.preferences), identifier),
		);
	return (
		<AcknowledgementsSettings
			contributors={contributors()}
			libraries={LIBRARIES}
		/>
	);
}
