---
"@colibri-social/client": patch
"@colibri-social/website": patch
---

Upgrade every `@atproto` dependency to its current release.

`api` moves to 0.20.38, `lexicon` to 0.7.11, `oauth-client-browser` and `oauth-client-node` to 0.5.3, `common-web` to 0.5.9, `jwk-jose` to 0.2.4, `lex` to 0.3.4, `lex-data` to 0.1.7 and `ws-client` to 0.2.0. The ranges had drifted apart between the client, the shared library and the website, so the tree carried two copies each of `lexicon`, `oauth-client`, `common-web`, `jwk-jose`, `syntax` and `xrpc`. Every `@atproto` package now resolves to exactly one version.

The `oauth-client-browser` patch is rebased onto 0.5.3 and keeps all of what it carried before: the localStorage storage backend, DPoP keys generated as extractable and persisted as JWK, the IndexedDB open and transaction timeouts behind `DBUnavailableError`, and the trimmed cross-tab sync payload. 0.5.x renamed the `onUpdate` and `onDelete` hooks to `onSessionUpdated` and `onSessionDeleted`, which the patch follows. Nothing in our own code registers those hooks, so the rename does not reach the app.

Sessions survive the upgrade. The database name, the storage namespace, the sync channel and the session store encoding are unchanged between 0.4.3 and 0.5.3, so nobody gets signed out.
