---
eyebrow: "Your data, your PDS."
title: "PRIVACY POLICY"
description: "How Colibri processes personal data, what leaves your device, and the rights you have under the GDPR."
---

**Effective date:** 11 July 2026

**Last updated:** 11 July 2026

This Privacy Policy explains how personal data is processed when you use the hosted Colibri service at
[colibri.social](https://colibri.social), including the web app, the AppView, the Colibri-operated Personal Data
Server (PDS), and the desktop applications (together, the "**Service**"). It is written to meet the requirements of the
EU General Data Protection Regulation (GDPR) and the German Digitale-Dienste-Gesetz (DDG) and Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz
(TDDDG, formerly TTDSG).

Colibri is built on the [AT Protocol](https://atproto.com) ("ATproto", the "Atmosphere"). Understanding how that works
is essential to understanding your privacy, so please read Section 2 carefully.

## 1. Who is responsible (Controller)

The controller responsible for the hosted Service within the meaning of Art. 4(7) GDPR is:

**Louis Escher**, Marsweilerstraße 20, 88255 Baindt, Germany

For any privacy-related request, or to exercise the rights described in Section 12, contact **pds@colibri.social**.

Colibri is operated by an individual as a non-commercial passion project. There is no separate data protection officer,
a DPO is not mandatory under Art. 37 GDPR for an operation of this nature.

## 2. Where your data lives

Colibri is **not** a traditional service where we hold your data on our servers. It is built on the AT Protocol, and
this changes who holds what:

- **Your Personal Data Server (PDS)** is the canonical home of your identity and everything you create. This includes your messages,
  profile, images, reactions, and other records. Your PDS may be **operated by Colibri** (if you create a colibri.social
  account) or by **a third party** (for example Bluesky, or a server you run yourself). The data in your PDS is
  controlled by whoever operates it.
- **The AppView** is the service that makes Colibri fast and real-time. It continuously reads **publicly available**
  records from the AT Protocol network (via a public relay) and keeps an index of them so the app can show
  conversations, communities, and profiles instantly. The AppView is an **index and cache of already-public data**, not
  the origin of that data.
- **Communities** are themselves repositories on the network. A community's records (its channels, roles, membership,
  moderation actions, and the messages posted in it) live in the community's own repository, not locked inside our app.

A direct consequence: **content you create on Colibri is public by design.** Messages, community membership, profiles,
and reactions are stored as public records on the AT Protocol network. They can be read by anyone, indexed by other
AppViews, and are not private communications. Do not post anything on Colibri that you are not comfortable being public.
Colibri does not currently offer end-to-end-encrypted private messaging.

## 3. What data we process, and why

### 3.1 Identity

When you sign in, you authenticate through AT Protocol OAuth. We process your **decentralized identifier (DID)** and
**handle** to identify you across the Service. We do not receive or store your PDS password, authentication is handled
by your PDS using short-lived, cryptographically signed tokens (DPoP-bound access tokens and service-auth JWTs).

If you use a **colibri.social account**, i.e. an account hosted on Colibri's own PDS, then, in that role, Colibri (as
your PDS operator) also stores your account's repository contents and the authentication credentials associated with it.
Credentials used by the AppView to administer community accounts are stored **encrypted at rest** using AES-256-GCM.

If you sign in with an **external identity** (e.g. a Bluesky account or a self-hosted PDS), Colibri never holds your
account credentials, and your canonical data remains with your PDS operator.

### 3.2 Content you create

Messages, profile fields (display name, description, pronouns, website, avatar and banner images), reactions, read
positions, mutes, GIF favorites, community records, and any blog/document records you publish are stored as **records
and media blobs on your (or the community's) PDS** and are **indexed by the AppView** so they can be displayed.

### 3.3 AppView index (server-side)

To provide the real-time experience, the AppView maintains a durable index in a PostgreSQL database. This index mirrors
the public records described above, including **the full text of messages**, profiles, community and channel data,
memberships, reactions, and moderation records, keyed by DID, collection, and record key. See Section 9 for retention.

### 3.4 Presence and voice state

We process ephemeral presence information: your online/offline/do-not-disturb status, typing indicators, and, while you
are in a voice channel, which channel you are in and your mute/deafen state. This is used to power the live experience
and, where you have enabled presence sharing, to show your status to others.

### 3.5 Push notifications

If you enable push notifications, your browser or operating system generates a **push subscription** (an endpoint URL
provided by your platform's push service (Google, Apple, Mozilla, or Microsoft) plus cryptographic keys). We store this
subscription together with your DID so we can deliver notifications. When a notification is triggered, the AppView
composes a payload that includes the **notification title and the message text** (with spoiler-marked content redacted),
the message identifier, and the channel identifier. The payload is **encrypted** (RFC 8291) before it is handed to your
platform's push service, so the push provider cannot read the message conten. It does receive routing metadata (the
endpoint, timing, and delivery information). Notifications respect your do-not-disturb state and channel/community mutes.

### 3.6 Voice and video

Voice, video, and screen sharing are provided through a Selective Forwarding Unit (SFU, based on mediasoup) operated as
part of the AppView. Media travels over WebRTC and is **encrypted in transit** (DTLS-SRTP). It is **not end-to-end
encrypted**. **Media is not recorded or stored**, it is forwarded live between participants and discarded when you disconnect. Establishing a
call involves the standard WebRTC exchange of network candidates, which can reveal participants' IP addresses to the
SFU and, depending on network conditions, to other participants. We access your microphone, camera, or screen only after
you grant the corresponding browser/OS permission and only for the duration of the call.

### 3.7 Data stored on your device

To function, the app stores data locally in your browser or app:

- **Authentication session** (access/refresh tokens and DPoP keys), stored by the AT Protocol OAuth client in IndexedDB,
  and your DID (`sub`) in local storage, so your session can be restored.
- **Preferences**: audio/video device selection and volumes,
  noise-suppression settings, per-participant volume, self-mute/deafen, notification preference, your preferred Bluesky
  client and AppView, presence-sharing choice, recently used GIFs, and enabled experiments.
- **A local message/data cache**: a limited tail of recent messages per channel and
  cached network data, to make the app load faster. User-scoped caches are cleared when you log out or switch accounts.

This on-device storage is **strictly necessary** to provide the service you have requested (maintaining your session,
remembering your settings, and rendering the app). Under §25(2) TDDDG it therefore does not require separate consent. We
do not use cookies for tracking, and we set no advertising or cross-site tracking identifiers.

### 3.8 Server logs

The AppView produces operational logs to run and debug the Service. These logs can include DIDs, handles, channel
identifiers, and technical information. Message content is not logged in normal operation, on rare parsing errors a raw
record (which may contain message text) may appear in an error log. We do not maintain application-level logs of your IP
address or user agent. Logs are used solely for operating, securing, and improving the Service.

### 3.9 Error and performance monitoring (Sentry)

We use **Sentry** to detect and diagnose crashes and performance problems in both the client and the server. We
configure Sentry **not** to send default personal data: the "send default PII" option is disabled, so Sentry does not
attach your IP address, request headers, cookies, or user identifiers to the reports it receives. What is sent is
limited to technical diagnostic information (error and stack-trace data and performance traces) needed to keep the
Service stable and secure. Data is sent to Sentry's **EU ingestion region**. Sentry is operated by a provider based in
the United States, see Section 10 on international transfers. Because error reports can, in rare cases, incidentally
contain personal data (for example if it appears in an error message), we treat this processing as covered by this
policy even though it is not our intention to send such data.

### 3.10 Website analytics (Rybbit)

Our public website (marketing pages, blog, and documentation) loads **Rybbit**, a privacy-focused, **cookieless**
analytics tool self-hosted by the operator. It measures aggregate page usage without setting cookies and without
building cross-site profiles of you. Because it stores nothing on your device and does not track you across sites, it
does not require consent under §25 TDDDG.

### 3.11 GIF search (Klipy)

The GIF picker is powered by **Klipy**. When you search for a GIF, your **search terms** are sent to Klipy **through the
AppView** (Klipy sees our server's request, not your IP, for the search). However, when a GIF is displayed in chat, the
image is loaded **directly from Klipy's content delivery network by your browser**, which means your **IP address and
user agent are exposed to Klipy's CDN** at that moment, as is normal whenever a browser loads an image hosted by a
third party.

### 3.12 Link previews

When a link is shared, the AppView fetches the target page **on your behalf, from our server**, to generate a preview.
This is done deliberately so that the linked website does **not** receive your IP address.

## 4. Legal bases

We rely on the following legal bases under Art. 6(1) GDPR:

- **Performance of a contract / pre-contractual measures (Art. 6(1)(b))** for providing the core Service you request:
  authentication, indexing and displaying content, communities, presence, voice/video, push notifications you enable,
  and on-device storage necessary for the app.
- **Legitimate interests (Art. 6(1)(f))** for keeping the Service secure, stable, and functioning: error and
  performance monitoring (Sentry), operational logging, abuse prevention, and cookieless aggregate analytics (Rybbit).
  Our legitimate interest is operating a reliable and safe servicem, you may object under Art. 21 GDPR (see Section 12).
- **Consent (Art. 6(1)(a))** where you actively enable an optional feature such as push notifications, or grant device
  permissions for your microphone, camera, or screen. You can withdraw consent at any time, without affecting prior
  processing.
- **Legal obligation (Art. 6(1)(c))** where we must process data to comply with the law (e.g. responding to valid
  legal requests).

## 5. The public and federated nature of Colibri

Because Colibri runs on the AT Protocol:

- **Your content is public.** Anyone, not only Colibri, can read the public records you create and can operate their
  own AppView that indexes them. Colibri does not control third-party AppViews or third-party PDSes.
- **Federation (Humming).** Colibri AppViews can relay a small amount of **ephemeral** information (online status,
  typing, and voice presence/mute state) to other Colibri AppViews so presence works across instances. No message
  content is relayed by this mechanism, each receiving instance derives identity from its own view of the public network.
- **Deletion is best-effort across the network.** When you delete a record or account, Colibri removes it from **our**
  index when we receive the corresponding deletion event from the network, and Colibri will delete data it holds as your
  PDS operator (for colibri.social accounts). We **cannot** guarantee deletion from PDSes we do not operate, from other
  AppViews run by third parties, or from copies that others made while the content was public.

## 6. Cookies and access to your device

Colibri does not use tracking cookies and does not display a cookie consent banner because it sets no non-essential
cookies. The only information stored on or read from your device is the strictly necessary session, preference, and cache
data described in Section 3.7, which is exempt from consent under §25(2) TDDDG. Rybbit analytics is cookieless.

## 7. Recipients and processors

Depending on the features you use, personal data may be processed by:

- **Your PDS operator** (Colibri, Bluesky, or a self-hosted server), the canonical home of your data.
- **Your platform's push service** (Google/FCM, Apple, Mozilla, or Microsoft), encrypted push payloads and routing
  metadata, only if you enable push notifications.
- **Sentry**: error and performance monitoring data (EU ingest region).
- **Klipy**: GIF search terms (via our server) and, when GIFs render, your IP/user agent to Klipy's CDN.
- **Hosting/infrastructure providers** used to run the AppView and website.

We do not sell personal data, and we do not use it for advertising or profiling.

## 8. International data transfers

Some recipients (e.g. Sentry, Klipy, and the push services operated by Google, Apple, Microsoft, and Mozilla) are
established outside the EU/EEA, primarily in the United States. Where personal data is transferred to such recipients,
the transfer is safeguarded by appropriate measures under Chapter V GDPR, in particular **Standard Contractual Clauses**
and/or the recipient's certification under the **EU–US Data Privacy Framework**, where available. You can request further
information about these safeguards using the contact details in Section 1.

## 9. Retention

Colibri's AppView operates as a **live index of public network data**. Indexed records are retained for as long as the
corresponding record exists on its source PDS. When a record, community, or account is deleted at the source and the
deletion is propagated over the network, the corresponding entry is removed from our index. For colibri.social-hosted
accounts, deleting your account removes the repository we hold as your PDS operator.

Deleting your Colibri data (Section 12) removes our AppView entries, notifications, read state, presence, push
subscriptions, and invitations immediately, rather than waiting for the network to propagate the deletion. Images are served through a short-lived in-memory cache keyed by content address, not by account; entries there
are not addressable per user and fall out on eviction or restart, and cannot be re-fetched once the originals are gone.

Push subscriptions are kept until you disable notifications, the subscription expires, or your platform reports it as no
longer valid, at which point it is removed. Ephemeral presence and voice state exist only while relevant and are not
retained as history. On-device data persists until you clear it, log out, or uninstall the app (see Section 3.7).

## 10. Security

We take appropriate technical and organisational measures to protect personal data, including: encryption in transit
(HTTPS/TLS, DTLS-SRTP for real-time media), encryption of stored community credentials (AES-256-GCM), encrypted push
payloads (RFC 8291), and short-lived, cryptographically signed authentication tokens. No system is perfectly secure, and
we cannot guarantee absolute security. In particular, remember that content you post to the network is public (Section
2).

## 11. Children

The Service is intended for users **aged 18 and over**. We do not knowingly process the personal data of anyone under 18. If you believe someone under 18 is using the Service, contact **pds@colibri.social** and we will take appropriate action for the data under our control.

## 12. Your rights

Under the GDPR you have the right to: **access** your data (Art. 15), **rectification** (Art. 16), **erasure** (Art. 17),
**restriction** of processing (Art. 18), **data portability** (Art. 20), and to **object** to processing based on
legitimate interests (Art. 21). Where processing is based on consent, you may **withdraw** it at any time (Art. 7(3))
without affecting the lawfulness of prior processing.

Please note the practical limits imposed by the architecture (Section 2 and Section 5): for data held on a PDS we do not
operate, or indexed by third-party AppViews, you may need to direct your request to the relevant operator, and public
content cannot always be fully recalled once it has been distributed across the network. The AT Protocol also provides
you with strong self-service control, since you own your repository and can export or delete records directly.

**Erasure is self-service.** You can delete your Colibri data and everything we hold about you from
**Settings > Delete account** in the app, or at [colibri.social/app/delete-account](/app/delete-account) if you no
longer have the app installed. That removes your Colibri records and your AppView data (index entries, notifications,
read state, presence, push subscriptions, invitations). It does **not** delete the atproto account you sign in with,
which only your PDS operator can remove, see Section 2. Bans and kicks recorded against you are retained under
Art. 17(3)(e) GDPR, since deleting them with the account would make them evadable.

To exercise any other right, or if the self-service flow fails, contact **pds@colibri.social**. You also have the right to lodge a complaint with a data
protection supervisory authority. In Germany, the competent authority is generally the authority of the federal state
in which the controller is established or in which you reside.

## 13. Third-party services and instances

The AT Protocol is an open network. Other PDSes, AppViews, relays, and clients, as well as third-party providers such
as GIF and push services, are operated by parties other than Colibri and under their own terms and privacy policies.
Colibri is not responsible for how those third parties process your data. Likewise, if you use a **self-hosted** Colibri
AppView or PDS, or a colibri.social community whose designated AppView is operated by someone else, that operator is a
separate controller responsible for their own instance.

## 14. Changes to this policy

We may update this Privacy Policy to reflect changes to the Service or the law. The current version is always available
at [colibri.social/policy](https://colibri.social/policy), with the "Last updated" date shown above. Material changes
will be communicated in an appropriate way.

## 15. Contact

Questions about this policy or your data: **pds@colibri.social**. The operator's full legal identification is set out in
the site imprint (Impressum).
