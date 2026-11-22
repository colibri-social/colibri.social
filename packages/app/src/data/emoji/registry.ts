import { createEmojiRegistry } from "./provider";
import { bluemojiProvider } from "./providers/bluemoji";

export const emojiRegistry = createEmojiRegistry([bluemojiProvider]);

export const DEFAULT_EMOJI_PROVIDER = bluemojiProvider.id;
