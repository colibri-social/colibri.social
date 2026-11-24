---
title: "PRIVACY POLICY"
description: "Which personal data Colibri processes, where it is stored, who can read it, and the rights you have under the GDPR."
---

**Effective date:** 1 December 2026

**Last updated:** 22 November 2026

This Privacy Policy explains how personal data is processed when you use the hosted Colibri service at
[colibri.social](https://colibri.social). The service consists of the website, the web app, the desktop and mobile
apps, the Colibri server (the "**AppView**"), the voice servers, the server that holds the accounts of Spaces, the
hosted bridge, and the badge service (together, the "**Service**"). It follows the EU General Data Protection
Regulation (GDPR), the German Digitale-Dienste-Gesetz (DDG), and the German
Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz (TDDDG).

Colibri is built on the [AT Protocol](https://atproto.com). Section 2 explains what that means for your data. Read it
before the rest.

## 1. Who is responsible

The controller within the meaning of Art. 4(7) GDPR is:

**Louis Escher**, Marsweilerstraße 20, 88255 Baindt, Germany

Contact for every privacy request: **pds@colibri.social**

Colibri is run by an individual and funded by donations. Two people have access to the production systems: the
operator and the co-founder of the project. Both are bound to confidentiality. A data protection officer is not
required under Art. 37 GDPR and none is appointed.

The operator can transfer the Service to a legal entity that continues it. In that case the entity becomes the
controller, this policy names it, and you are told at least 30 days in advance as described in Section 13.

## 2. How Colibri stores your data

**Your account belongs to your account provider.** You sign in to Colibri with an AT Protocol account from a provider
of your choice, for example Bluesky or a server you run. Colibri hosts no personal accounts. Your handle, your password
and everything you do in other apps stay with that provider, under its own privacy policy.

**A Space is private to its members.** A Space is a group with channels, roles and a member list. Messages, reactions,
threads and files in a Space can be read by the members who have access to the channel they are in. People outside the
Space receive nothing from it, apart from the name, description and images of the Space, which are shown to someone
who opens an invitation.

**Our server keeps a copy of every Space it serves.** Your messages are stored in your own account, in a private area
for that Space. The AppView holds a credential for each Space it manages, reads the members' private areas with it,
and keeps a synchronised copy in its database. That copy is what makes Colibri fast, delivers messages live, and sends
notifications.

**If your provider can't store Space data, we store it for you.** Private Space data is a recent part of the AT
Protocol, and many providers do not support it. For an account on such a provider, the AppView stores your Space
messages, reactions, preferences and uploaded files itself. When your provider adds support, the app moves the data to
your account and the AppView keeps only its synchronised copy.

**Space content is not end-to-end encrypted.** It is encrypted in transit and is stored unencrypted in our database.
These people can read it:

- the members of the Space who have access to the channel
- moderators of the Space, who also see messages they have hidden and the moderation log
- the operator and the co-founder, only in the two cases described in Section 5

**A few records are public.** Your Colibri profile, custom emoji and emoji packs you upload, and badges are public
records on the AT Protocol network. Anyone can read them, and other services can copy them. Section 3.5 lists them.

## 3. What we process, and why

### 3.1 Identity and sign-in

You sign in through AT Protocol OAuth on the website of your account provider. We never receive your password. We
process your **decentralized identifier (DID)**, your **handle**, the address of your provider, and your public
signing key, and we keep a cached copy of them to recognise you and to verify requests.

Reading a private Space needs a permission from your account. During sign-in your provider shows what Colibri asks
for. The app then uses your session to create short-lived tokens that let the AppView read and write your Space data.
The session itself stays on your device (Section 3.14).

### 3.2 Space content

We store and process what you and others create in a Space:

- messages, edits, replies, forwards, mentions, threads, and reactions
- files, images and videos you attach
- labels on messages, for example a spoiler mark or a moderator hiding a message
- memberships, roles and channel permissions
- invitations and invite links, including who created them, and requests to join
- the moderation log of the Space, with bans, unbans and kicks, who issued them, and the reason given

The legal basis is Art. 6(1)(b) GDPR. Attached files are fetched from the account that holds them and served through
the AppView, so other members never connect to your provider directly. The AppView keeps resized previews of images
and copies of large files in a cache on disk.

### 3.3 Data we host for accounts without Space support

For an account whose provider cannot store Space data (Section 2), the AppView is the place where that data lives.
It stores the records in its database and the uploaded files in a file store that we operate. A file can be up to
75 MB. A file that no message refers to is deleted within 24 hours of the upload.

Once your provider supports Space data, the app copies the records and files to your account. The AppView checks the
copy against its own and then treats your account as the home of the data.

### 3.4 The account behind a Space

Every Space has an AT Protocol account of its own that holds its channels, roles and member list.

- **Hosted by Colibri:** we create the account on a server that we run for Space accounts only. We store its
  generated password.
- **Hosted on an account you own:** you sign in as that account once, and we store the resulting session so the
  AppView can act for the Space. If you hand us a password for the account, we store that.

Passwords and sessions are stored encrypted with AES-256-GCM. If the owner of a Colibri-hosted Space moves its account
to another provider, we set the email address the owner gives us on the account so that the confirmation codes of the
move reach them.

### 3.5 Public records

These are stored as public records in an AT Protocol account and are readable by anyone on the network:

- your **Colibri profile**: display name, description, pronouns, avatar and banner
- **custom emoji and emoji packs** you upload, which the AppView indexes so that others can find and use them
- **badges**: labels issued by the Colibri badge service for your DID, for example a team or supporter badge
- the **link between your DID and an Open Collective account**, if you connect one (Section 3.16)

If you turn on profile syncing, the app also reads your public Bluesky profile from Bluesky's public interface and the
AppView caches it.

### 3.6 Preferences and read state

The app saves these to your account as private records, and the AppView keeps a copy so that every device you use
shows the same state: muted Spaces, channels and threads, blocked people, notification levels, app settings, the order
of your Spaces, read positions per channel, threads you follow or left, emoji packs you follow, and the state of the
message box. Unsent drafts stay on your device.

### 3.7 Presence and status

While the app is connected, we process whether you are online, away or set to do not disturb, your status text and
status emoji with their expiry, typing indicators, and the list of your open connections. Other members of your Spaces
see them. Typing indicators and connection data exist only while they are relevant.

### 3.8 Activity status

If you turn on activity sharing in the settings, Colibri shows other people what you are listening to or playing.
The setting is off by default. The AppView reads this from public records that other apps
write to your account: teal.fm, Rocksky, atradio and atmosphere.games. It stores the title, artist or game, a link,
an image address, and the start and end time, and removes the entry when the activity ends.

To find cover art, the AppView sends the title and artist to Cover Art Archive, MusicBrainz, Deezer, and Apple's
iTunes Search, and to YouTube where that option is on. These requests come from our server and carry no information
about you.

### 3.9 Notifications and push

The AppView keeps a notification inbox for you with mentions, replies and other events. Entries you have seen are
deleted after 30 days, and all entries after 90 days.

If you turn on push notifications, your browser or device gives us an identifier for its push service, and we store
it with your DID:

- in a browser, a **push subscription**: an address at Google, Apple, Mozilla or Microsoft plus encryption keys
- in the Android app, a **Firebase Cloud Messaging token** from Google
- in the iOS and macOS apps, an **Apple Push Notification service device token**

A push notification contains the name and avatar address of the sender, the names of the Space and the channel, the
message text, the address of an attached image unless it is marked as a spoiler, the identifiers needed to open the
message, and a signed token that lets you mark the channel as read from the notification. The token is valid for
seven days.

Browser push messages are encrypted before they reach the push service (RFC 8291), so the push provider cannot read
them. Messages sent through Firebase Cloud Messaging and the Apple Push Notification service are encrypted in transit
only, so Google or Apple can process their content to deliver them. Every push service receives delivery metadata
such as the token and the time.

### 3.10 Voice, video and screen sharing

Calls run through voice servers that are part of the AppView. Audio, video and screen shares are encrypted in transit
(DTLS-SRTP) and forwarded live to the other participants. They are not end-to-end encrypted. **We do not record or
store calls.**

We process which call you are in, when you joined, whether you are muted or deafened, whether your camera or screen
share is on, and moderation state such as a moderator muting you. Setting up a call exchanges network addresses, so
the voice server sees your IP address. Where a direct connection fails, the call is relayed through Cloudflare's relay
service, which then sees your IP address and the encrypted media.

The app accesses your microphone, camera or screen only after you allow it in your browser or operating system, and
only during the call.

### 3.11 Bridges to other chat services

An owner or administrator of a Space can connect a **bridge**, a program that relays messages between channels of the
Space and rooms on another chat service. We operate one such bridge (the "**hosted bridge**"). Anyone can run their
own (Section 12). A bridge relays only the channels an administrator links, and only while it stays connected.

**From the other service into Colibri.** For every message, edit, deletion, reaction and thread in a linked room, the
bridge sends the AppView the author's identifier, display name and avatar on the other service, the message text,
attachments, replies, forwards and mentions. The AppView stores this in the Space, marked with that person's name,
where the members of the Space can read it. This applies to people who have never used Colibri. If an administrator
imports the earlier history of a room, the same data is stored for past messages in the chosen range.

**From Colibri into the other service.** Messages, edits, deletions, reactions and threads from a linked channel are
sent to the other service under the Colibri author's display name and avatar. From there, the operator of that
service processes them under its own terms and privacy policy.

**Registration.** The Space stores a record that names the bridge, the service and server it connects to, the linked
channels, and the DID of the administrator who connected it. Members of the Space can read it.

**What the hosted bridge stores.** It keeps a database that maps message, reaction and thread identifiers on the
other service to the matching Colibri records, the identifiers of people who reacted to a relayed message, a
reference to each author's uploaded avatar, and the progress of history imports. It stores no message text. It
receives events from every room it can see on the other service and discards those from rooms that are not linked.

### 3.12 Link previews and GIFs

When a message contains a link, the AppView fetches the page from our server to build a preview and stores the result
for reuse. Preview images are loaded through the AppView. The linked website sees our server and never your IP
address.

The GIF picker uses **Klipy**. Your search terms go to Klipy through the AppView, so Klipy sees our server's request.
A GIF in a message is loaded through the AppView like any other preview image. The GIFs shown inside the picker,
including your saved and recently used ones, are loaded by your device directly from Klipy's servers, which then see
your IP address and browser details.

### 3.13 Finding people

When you type a handle on the sign-in screen, the app sends what you typed to a handle search service at
typeahead.waow.tech to suggest accounts. To turn a handle into an account, the app and the AppView ask the public
directory of the AT Protocol (plc.directory) or the website that the handle names.

### 3.14 Data stored on your device

The app stores the following in your browser or in the app's own storage:

- your **sign-in session**: access and refresh tokens and the keys they are bound to
- **settings**: theme, audio and video devices, volumes, voice layout, haptics, notification choices, and the Space
  you opened last
- **drafts** of unsent messages and edits
- a **cache** of recent messages and other data, so the app starts faster

This storage is strictly necessary to provide the app you asked for, so it needs no consent under § 25(2) TDDDG. We
set no advertising or tracking identifiers and no cookies for tracking. Logging out removes the session and the
account-specific cache.

### 3.15 Logs, metrics and error reports

**Server logs.** The AppView writes operational logs that can contain DIDs, handles, identifiers of Spaces and
channels, and technical details of a request. Message text is not logged in normal operation. A record that fails to
parse can appear in an error log. The AppView does not log IP addresses. Logs are kept for 30 days.

**Metrics.** We collect technical measurements such as request counts, response times and the number of running
calls. They are aggregated and contain no personal data.

**Error reports.** We use **Sentry** (Functional Software, Inc.) to find crashes and slow requests in the app and on
the server. Sentry is set up to leave out IP addresses, cookies and request headers, and the app removes access
tokens and email addresses from error texts before sending them. Reports contain the error, the code location, technical
details of your device and app version, and timing data for a sample of requests. The server also sends its log
entries at the levels info, warning and error, which can contain the identifiers listed under server logs. Your DID is
attached to reports from your app only if you turn on **Include my account** under **Settings > Advanced**. Data is
stored in Sentry's EU region and kept for 90 days.

The legal basis for this section is Art. 6(1)(f) GDPR.

### 3.16 Donations and supporter badges

Donations to Colibri run through **Open Collective**, which processes your payment under its own privacy policy. We
receive no payment details.

To get a supporter badge, you can connect your Open Collective account in the app. You sign in at Open Collective,
and the badge service learns which Open Collective account you control. It discards the access token immediately. It
then publishes a public record that links your DID to that Open Collective account, reads the public list of
contributions to the Colibri collective at regular intervals, and issues or withdraws the badge that matches your
contribution. Disconnecting removes the record and the badge.

### 3.17 Website analytics

The public website (landing page, blog and documentation) uses **Rybbit**, a cookieless analytics tool that we host
ourselves. It counts page views in aggregate, stores nothing on your device, and builds no profile of you across
sites. It needs no consent under § 25 TDDDG. The app itself contains no analytics.

### 3.18 Other Colibri servers

Colibri is open source, and other people run their own AppViews. Such a server sends ours one anonymous message a
day with a random installation ID, its version and setup, and rough ranges for the number of Spaces, users and voice
minutes. It contains no personal data, and the operator of that server can turn it off.

## 4. Legal bases

We rely on these legal bases under Art. 6(1) GDPR:

- **Performance of a contract (Art. 6(1)(b))** for providing the Service you ask for: sign-in, Spaces and their
  content, hosting your Space data where your provider can't, preferences, presence, calls, link previews, GIF
  search, and supporter badges you request.
- **Consent (Art. 6(1)(a))** where you turn on an optional feature: push notifications, access to your microphone,
  camera or screen, activity status, and attaching your account to error reports. You can withdraw consent at any
  time in the app or in your device settings. Withdrawal does not affect earlier processing.
- **Legitimate interests (Art. 6(1)(f))** for keeping the Service stable and secure: logs, metrics, error reports,
  backups, abuse prevention, handling reports about content, and cookieless website analytics. Our interest is a
  reliable and safe service. You can object under Art. 21 GDPR (Section 11).
- **Legitimate interests (Art. 6(1)(f))** for relaying content through a bridge (Section 3.11). The interest is that
  of the Space and of the people on both services to hold one conversation. People on the other service can see that
  a room is bridged from the bridge's presence there, and can object as described in Section 11.
- **Legal obligation (Art. 6(1)(c))** where the law requires processing, for example answering a valid request from
  an authority or reporting certain crimes.

## 5. When we look at Space content

Space content is technically readable for us (Section 2). The operator and the co-founder open the content of a
Space in two cases only:

- **A report.** Someone reports content or behaviour in a Space to us, or we learn of content that is likely to be
  illegal. We look at the reported content and at what is needed to assess it.
- **A legal obligation.** A court or an authority requires access or disclosure in a legally binding way.

We do not read Space content to fix technical problems, to analyse usage, or for any other purpose. Technical work
uses logs, metrics and error reports. We do not scan Space content or uploaded files automatically.

If content that we host turns out to be illegal, we remove it or block access to it. Where the law requires it, we
report it to the competent authority. This applies in particular to depictions of child sexual abuse.

## 6. Who receives your data

Depending on the features you use, personal data goes to these recipients:

- **Your account provider**, which stores your account and, where it supports this, your Space data.
- **Other members of your Spaces**, who see your messages, profile, presence and activity.
- **Infrastructure providers** that act for us under a data processing agreement: providers of rented servers, a
  provider of network services (DNS, traffic routing, protection against attacks and call relays), a provider of the
  private network between our servers, and a provider of storage for encrypted backups. We name them on request.
- **Sentry**, for error reports and server logs (Section 3.15).
- **Push services** of Google, Apple, Mozilla and Microsoft, if you turn on push notifications (Section 3.9).
- **Klipy**, for GIF searches (Section 3.12).
- **The operator of a bridged service**, for content relayed from a channel that an administrator linked
  (Section 3.11).
- **Open Collective**, if you donate or connect your account (Section 3.16).
- **The handle search service, the AT Protocol directory and Bluesky**, for the lookups in Sections 3.5 and 3.13.
- **Authorities and courts**, where the law obliges us.

We do not sell personal data. We do not use it for advertising or profiling, and we do not use it to train
artificial intelligence models.

## 7. Where our servers are, and international transfers

The Service runs on a network of servers ("**nodes**") in several regions of the world, inside and outside the
European Union and the European Economic Area. Nodes close to you make the app and calls faster. Every node can hold a
complete copy of the database, including the content of Spaces, and every node can carry calls.

The current list of nodes and their regions is on the [status page](https://status.colibri.social). We add, move and
remove nodes as the network grows. Such a change is not a change to this policy and is not announced in advance.
Whatever the region, a node is a rented server that only we administer, the connections between nodes are encrypted,
and backups are encrypted before they leave the database server.

Where personal data is processed in a country outside the EU and the EEA, one of these safeguards under Chapter V
GDPR applies:

- an **adequacy decision** of the European Commission for that country, where one exists. For recipients in the
  United States, this is the EU-US Data Privacy Framework where the recipient is certified.
- otherwise, the **Standard Contractual Clauses** of the European Commission, agreed with the provider that runs the
  server or service.

The same safeguards apply to the recipients in Section 6 that are based outside the EU and the EEA, mainly in the
United States: Sentry, Klipy, Open Collective, the push services, the network provider, and the operators of bridged
services. You can ask us for details of the safeguard for a specific recipient or country.

## 8. How long we keep data

- **Space content and memberships** are kept while the Space exists and the record exists in the account that holds
  it. Deleting a message removes it from our database. Deleting a Space removes its channels, messages, member list
  and its account.
- **Data we host for you** (Section 3.3) is kept until you delete it, delete your Colibri data, or it has moved to
  your account.
- **Notifications** are deleted after 30 days once seen, and after 90 days in every case.
- **Push identifiers** are kept until you turn notifications off, log out on that device, or the push service reports
  the identifier as invalid.
- **Presence, typing and call state** exist only while they are relevant. Activity entries are removed when the
  activity ends.
- **Link previews, cached profiles and cached files** are refreshed or dropped automatically. Cached files are
  addressed by their content and are removed as the cache fills.
- **Server logs** are kept for 30 days and **error reports** for 90 days.
- **Backups** of the database are encrypted and kept for up to 90 days. Deleted data leaves the backups when the
  backup that contains it expires.
- **Bans and kicks** recorded against you are kept while the Space exists, also after you delete your Colibri data
  (Art. 17(3)(e) GDPR). Deleting them with your data would let anyone undo a ban.
- **Bridged content** follows the rules for Space content. Deleting or editing a message on one side deletes or edits
  the copy on the other. When a bridge is disconnected, the hosted bridge deletes its own database entries for it.
  Messages it already relayed stay on both sides until someone deletes them there.
- **Data on your device** stays until you log out, clear it, or uninstall the app.

## 9. Security

We protect personal data with technical and organisational measures. These include encryption in transit (TLS for
the app and the connections between servers, DTLS-SRTP for calls), encrypted storage of Space account passwords and
sessions (AES-256-GCM), encrypted backups, encrypted browser push messages, short-lived signed tokens for every
request, access checks on every read of a Space, and production access limited to two people.

No system is perfectly secure. Space content is not end-to-end encrypted (Section 2), so treat it accordingly.

## 10. Children

The Service is for people **aged 18 and over**. We do not knowingly process personal data of anyone under 18. If you
believe that someone under 18 uses the Service, write to **pds@colibri.social**, and we remove the data under our
control.

## 11. Your rights

Under the GDPR you have the right to **access** your data (Art. 15), to **rectification** (Art. 16), to **erasure**
(Art. 17), to **restriction** of processing (Art. 18), to **data portability** (Art. 20), and to **object** to
processing based on legitimate interests (Art. 21). Where processing is based on consent, you can **withdraw** it at
any time (Art. 7(3)).

**You can delete your Colibri data yourself.** Open **Settings > Advanced > Delete my Colibri data** in the app, or
go to [colibri.social/app/settings/deleteAccount](/app/settings/deleteAccount) if the app is no longer installed.
This removes your Colibri profile and status, every message and reaction you sent, your memberships, your invite
links, your preferences and read positions, your notifications, your push identifiers, and the Space data we host for
you. If you are the only owner of a Space, you first hand it to another member or delete it.

Deleting your Colibri data leaves your AT Protocol account in place. Only your account provider can delete that
account. Bans and kicks recorded against you are kept (Section 8).

**Your account already gives you a copy of your data.** Records you create are stored in your own account in an open
format, and you can export them with standard AT Protocol tools. For data that we host for you (Section 3.3), ask us
for an export.

**If you post on a bridged service** in a room that is connected to a Space, deleting a message there also deletes
its copy in Colibri. To have your bridged messages, name or avatar removed from a Space, or to object to being
relayed, ask the administrators of the Space to unlink the room, or write to **pds@colibri.social**.

For data held by your account provider, by the operator of another Colibri server, or by a bridged service, send your
request to that operator.

To exercise any right, or if deleting your data fails, write to **pds@colibri.social**. You also have the right to
lodge a complaint with a data protection supervisory authority, for example the authority where you live or the one
responsible for the operator, the Landesbeauftragte für den Datenschutz und die Informationsfreiheit
Baden-Württemberg.

We make no decisions about you by automated means alone that have a legal or similarly significant effect
(Art. 22 GDPR).

## 12. Other operators

Colibri is open source and part of an open network. Each of the following is operated by someone else, who is
responsible for the data they process:

- **Your account provider.**
- **Another Colibri server.** A Space is served by the AppView it was created on. If you use a Space on a server that
  someone else runs, that operator holds the copy of the Space and is its controller. This policy covers only the
  Service at colibri.social.
- **A Space hosted on its owner's own account.** The provider of that account stores the channels, roles and member
  list of the Space.
- **A bridge that someone else runs**, and every chat service a bridge connects to.
- **The owners and moderators of a Space.** They decide who joins, set the rules, and can see the moderation log and
  hidden messages. They are responsible for how they use what they see.

## 13. Changes to this policy

We update this policy when the Service or the law changes. The current version is always at
[colibri.social/policy](https://colibri.social/policy) with the date of the last update.

We announce material changes in the app and on the website at least 30 days before they take effect. Changes to the
list of nodes (Section 7) and to the infrastructure providers in Section 6, corrections, and clearer wording are not
material changes.

## 14. Contact

Questions about this policy or your data: **pds@colibri.social**. The operator's full legal details are in the
[imprint](/imprint).
