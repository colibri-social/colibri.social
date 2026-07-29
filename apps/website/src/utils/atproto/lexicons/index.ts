import type { LexiconDoc } from "@atproto/lexicon";
import { Lexicons } from "@atproto/lexicon";
import { actorMethodDocs } from "./methods/actor.ts";
import { categoryMethodDocs } from "./methods/category.ts";
import { channelMethodDocs } from "./methods/channel.ts";
import { communityMethodDocs } from "./methods/community.ts";
import { embedMethodDocs } from "./methods/embed.ts";
import { notificationMethodDocs } from "./methods/notification.ts";
import { roleMethodDocs } from "./methods/role.ts";
import { serverMethodDocs } from "./methods/server.ts";
import { syncMethodDocs } from "./methods/sync.ts";
import { voiceMethodDocs } from "./methods/voice.ts";
import { permissionDocs } from "./permissions.ts";
import { actorRecordDocs } from "./records/actor.ts";
import { approvalRecordDocs } from "./records/approval.ts";
import { categoryRecordDocs } from "./records/category.ts";
import { channelRecordDocs } from "./records/channel.ts";
import { communityRecordDocs } from "./records/community.ts";
import { memberRecordDocs } from "./records/member.ts";
import { membershipRecordDocs } from "./records/membership.ts";
import { messageRecordDocs } from "./records/message.ts";
import { moderationRecordDocs } from "./records/moderation.ts";
import { plateRecordDocs } from "./records/plate.ts";
import { reactionRecordDocs } from "./records/reaction.ts";
import { richtextRecordDocs } from "./records/richtext.ts";
import { roleRecordDocs } from "./records/role.ts";

export { PERMISSION_SET_IDs, RECORD_IDs } from "./ids.ts";

export const LEXICON_DOCS: LexiconDoc[] = [
	...actorRecordDocs,
	...plateRecordDocs,
	...communityRecordDocs,
	...categoryRecordDocs,
	...channelRecordDocs,
	...messageRecordDocs,
	...reactionRecordDocs,
	...richtextRecordDocs,
	...membershipRecordDocs,
	...approvalRecordDocs,
	...roleRecordDocs,
	...memberRecordDocs,
	...moderationRecordDocs,
	...actorMethodDocs,
	...channelMethodDocs,
	...communityMethodDocs,
	...categoryMethodDocs,
	...roleMethodDocs,
	...embedMethodDocs,
	...notificationMethodDocs,
	...syncMethodDocs,
	...serverMethodDocs,
	...voiceMethodDocs,
	...permissionDocs,
];

/**
 * A lexicon that can be used to validate records before inserting them:
 * ```ts
 * lexicon.assertValidRecord('social.colibri.community', { ... })
 * ```
 */
export const lexicon = new Lexicons();

for (const doc of LEXICON_DOCS) {
	lexicon.add(doc);
}
