import { describe, expect, it } from "vitest";
import { decodeFrame } from "./sync-frames";

const DID = "did:plc:community1234567890abc";
const CHANNEL = "at://did:plc:community1234567890abc/space/social.colibri.beta.channel.text/general";
const DATETIME = "2026-08-23T12:00:00.000Z";

const author = {
  did: DID,
  handle: "alice.test",
  displayName: "Alice",
  isBot: false,
  syncBluesky: false,
};

const msg = (rkey: string, parent?: unknown) => ({
  uri: `at://${DID}/social.colibri.beta.channel.message/${rkey}`,
  rkey,
  channel: CHANNEL,
  author,
  text: "hi",
  createdAt: DATETIME,
  attachments: [],
  reactions: [],
  labels: [],
  ...(parent ? { parent } : {}),
});

const decode = (message: unknown) =>
  decodeFrame(JSON.stringify({
    $type: "social.colibri.beta.sync.defs#messageEvent",
    event: "create",
    channel: CHANNEL,
    message,
  })) as any;

describe("parent survives decode", () => {
  it("decodes without parent", () => {
    const f = decode(msg("3kchild"));
    expect(f).not.toBeNull();
  });
  it("keeps parent", () => {
    const parent = { ...msg("3kparent"), $type: "social.colibri.beta.channel.defs#messageView" };
    const f = decode(msg("3kchild", parent));
    console.log("WITH PARENT:", JSON.stringify(f?.message?.parent));
    expect(f).not.toBeNull();
    expect(f.message.parent).toBeDefined();
  });
});
