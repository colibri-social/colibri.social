---
"@colibri-social/client": minor
---

Supporter badges are now self-service. Settings then Support gains a "Connect Open Collective" step: authorize once, and the matching badge is granted within seconds, kept in step with the contribution, and revoked when it lapses. Until now every supporter badge was handed out by a maintainer running a CLI, which contributors had started working around by pasting their DID into their Open Collective display name.

The link is published as a `social.colibri.labeler.attestation` record in the labeler's own repo, keyed by the subject DID, rather than kept in a private table. It is on-protocol, publicly auditable, replicated like any other record, and resolvable with a single `getRecord`. The OAuth `state` is a self-signed short-lived token, so the flow stores nothing anywhere.

Reading contributions needs no authentication, because a collective's orders are public. OAuth is used only to prove which Open Collective account the user controls: the access token is used once to read the account, then thrown away, and no refresh token is kept.

Entitlement is decided by amount rather than by Open Collective tier. The collective only has a $5 and a $25 tier, both flexible, so a $10 contributor arrives on the $5 tier at a custom amount or with no tier at all, and matching on tier would quietly underpay them. Yearly contributions are divided by 12, several active contributions are summed, and a currency the collective does not use is skipped rather than guessed at. The Support page also gains the `$10 SUPPORTER` tier, which it was missing.

A lapse is caught two ways. Every pass reissues the badge with an expiry a grace period past the next charge date, so badges lapse on their own if the sync ever stops running, and a contribution that goes inactive also gets an immediate negation. One-time `DONATOR` badges are permanent.

Badges granted by hand before any of this existed are safe. Labels are append-only, so linking adds a row rather than replacing one, and reconciliation never revokes a badge that carries no expiry, which is what distinguishes a maintainer's deliberate grant from one the sync issued. Linking can only add or upgrade, so nobody loses a badge by connecting their account. Badges outside the supporter set are never read by the sync at all.

Guest profiles need no manual auditing. A guest profile has no credentials so it cannot complete the flow at all, and claiming one converts it in place while keeping the contribution attached, so anyone who does reach the callback is already a claimed account. The Support page says so and links to the claim flow, and each sync reports how many contributions came from unclaimed guest profiles.

Linking adds two `rpc:` scopes, so existing sessions are asked to reauthorize before the new buttons work.

<!-- whatsnew
title: Claim your supporter badge
icon: heart-fill
platforms: web,windows,linux
kind: feature
body: Contributing on Open Collective? Connect your account under Settings then Support and your badge appears on its own.
-->
