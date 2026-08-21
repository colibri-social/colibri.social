import type { ActorData } from "@colibri-social/lib";
import { useActorCache } from "../../../../contexts/ActorCache";
import { useCommunityContext } from "../../../../contexts/Community";
import { displayableNameFn } from "../../../../utils/displayable-name";
import { aliasesForSlug, slugForEmoji } from "../../../../utils/emoji-data";

export function emojiShortcode(emoji: string): string | undefined {
	const slug = slugForEmoji(emoji);
	if (!slug) return undefined;
	return aliasesForSlug(slug)[0] ?? slug;
}

export function useReactorResolver(): (did: string) => ActorData {
	const community = useCommunityContext();
	const { resolve } = useActorCache();

	return (did) => {
		const bare = did.replaceAll("at://", "");

		return (
			community().utils.getMember(did) ??
			resolve(did) ?? {
				did,
				handle: bare,
				data: {
					displayName: bare,
					isBot: false,
					onlineState: "offline",
				},
			}
		);
	};
}

export function reactedByLabel(
	dids: Array<string>,
	resolveActor: (did: string) => ActorData,
): string {
	const names = dids
		.slice(0, 3)
		.map((did) => displayableNameFn(resolveActor(did)));
	const remaining = dids.length - names.length;

	if (remaining > 0) {
		return `${names.join(", ")} and ${remaining} ${remaining === 1 ? "other" : "others"}`;
	}
	if (names.length <= 1) return names.join("");
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
