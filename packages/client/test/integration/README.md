# Client integration tests

These drive the real client against a real AppView and a real PDS: the same
`ColibriClient`, frame codecs and record builders the app uses. Unit tests cover
the pure logic, and these cover the wire format, which is the part no amount of
mocking can check.

They are a separate vitest project and are not part of pull request CI. The
spaces alpha moves underneath this code, and a suite that fails for reasons
outside the change under review stops being read.

```bash
pnpm --filter @colibri-social/client test:integration
```

## Bringing up the stack

Start a spaces-alpha PDS and its own PLC directory from the AppView checkout, so
nothing a test creates reaches the public directory:

```bash
cd ../colibri-appview-ts
docker compose -f docker-compose.integration.yml up -d
```

Then run the AppView from source. Give it its own env file rather than using
`pnpm dev`, which loads the repository's `.env` and points at the live
deployment:

```bash
cat > /tmp/colibri-local.env <<'ENV'
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
APPVIEW_DID=did:web:localhost%3A3000
PUBLIC_URL=http://localhost:3000
SIGNING_KEY=<64 hex characters>
CREDENTIAL_ENCRYPTION_KEY=<32 random bytes, base64>
DATABASE_URL=file:/tmp/colibri-local.db
PDS_URL=http://127.0.0.1:3001
PDS_ADMIN_PASSWORD=admin
PDS_REQUIRES_INVITE=false
COMMUNITY_HANDLE_DOMAIN=test
COMMUNITY_EMAIL_DOMAIN=communities.test.invalid
PLC_URL=http://127.0.0.1:2582
JETSTREAM_ENABLED=false
VOICE_ENABLED=false
ENV

cd apps/appview
npx tsx --conditions=colibri-source --env-file=/tmp/colibri-local.env src/index.ts
```

`APPVIEW_DID` must name a host, not an address. A bare IP is not a valid
`did:web`, so the PDS refuses `did:web:127.0.0.1%3A3000` as a service auth
audience and the AppView refuses to boot on it. The server still listens on
127.0.0.1. Only the DID has to be nameable.

Point the tests somewhere else with `COLIBRI_PDS_URL`, `COLIBRI_APPVIEW_URL` and
`COLIBRI_HANDLE_DOMAIN`.

## What they cover

`smoke.test.ts` walks the whole authenticated path. The harness creates an
account on the PDS, signs in, mints service auth per method, and reads the
profile back through `ColibriClient`. A `.test` handle has no DNS or
`.well-known` record locally, so the AppView reports `handle.invalid`, which is
the documented fallback for a handle it cannot resolve.

`messages.test.ts` walks the write path. It creates a community, finds the space
behind its text channel, writes a `social.colibri.beta.message` record into that
space with `com.atproto.space.createRecord`, and reads the message back out of
`channel.listMessages`. That covers the client building a record, the AppView
syncing it out of the author's repository, and the view it serves in return.

## Writing a new one

Take accounts from `createActor` in `harness.ts`. It returns a `did`, an `agent`
and an `xrpc` client already pointed at the AppView under test, so a test calls
methods the way a component does:

```ts
const res = await actor.xrpc.call(colibri.actor.getProfile.main, {
	params: { actor: actor.did },
});
```

Reads that depend on the sync engine are eventually consistent. Poll with the
`settle` helper in `messages.test.ts` rather than sleeping for a fixed interval,
and name what you are waiting for so a timeout says which step stalled.
